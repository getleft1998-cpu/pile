#!/usr/bin/env tsx
/**
 * Flormar Tunisia — Catalog Dry-Run Import
 *
 * Scrapes flormar.tn (Playwright, JS-rendered), attempts to match product
 * images with flormar.com, and saves everything to dry-run-output/.
 *
 * DOES NOT write to Supabase. Run: npx tsx scripts/import-catalog.ts
 */

import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedCategory {
  name: string;
  slug: string;
  url: string;
}

interface ImageMatch {
  url: string;
  source: "flormar.com" | "flormar.tn" | "none";
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
  needsReview: boolean;
}

interface ScrapedVariant {
  shade_name: string;
  sku: string | null;
  color_hex: string | null;
  swatch_image_url: string | null;
  stock_qty: number;
}

interface ScrapedProduct {
  name: string;
  slug: string;
  url: string;
  category_slug: string;
  description: string | null;
  price: number | null;
  sale_price: number | null;
  source_url: string;
  variants: ScrapedVariant[];
  images: ImageMatch[];
  issues: string[];
}

interface DryRunReport {
  scrapedAt: string;
  sourceUrl: string;
  totals: {
    categories: number;
    products: number;
    variants: number;
    matchedImages: number;
    fallbackImages: number;
    uncertainMatches: number;
    missingPrices: number;
    missingImages: number;
    missingSkus: number;
    duplicateSlugs: number;
    failedPages: number;
  };
  categories: ScrapedCategory[];
  products: ScrapedProduct[];
  reviewList: Array<{ product: string; url: string; reason: string }>;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.replace(/\s/g, "").match(/[\d.,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(",", "."));
}

async function safeNavigate(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

async function waitAndGet(page: Page, selector: string, timeout = 5000): Promise<string | null> {
  try {
    await page.waitForSelector(selector, { timeout });
    return await page.$eval(selector, (el) => el.textContent?.trim() ?? null);
  } catch {
    return null;
  }
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────

async function scrapeCategories(page: Page): Promise<ScrapedCategory[]> {
  console.log("  → Scraping categories from flormar.tn …");
  const ok = await safeNavigate(page, "https://flormar.tn");
  if (!ok) {
    console.log("  ✗ Failed to load flormar.tn homepage");
    return [];
  }

  await page.waitForTimeout(2000);

  const rawCategories: Array<{ name: string; url: string }> = await page.evaluate(() => {
    const results: Array<{ name: string; url: string }> = [];

    // Try common nav selectors
    const selectors = [
      "nav a",
      ".navigation a",
      ".main-menu a",
      ".nav-menu a",
      "header a",
      ".category-menu a",
    ];

    for (const sel of selectors) {
      const links = document.querySelectorAll(sel);
      if (links.length > 2) {
        links.forEach((el) => {
          const href = (el as HTMLAnchorElement).href;
          const text = el.textContent?.trim();
          if (
            text &&
            text.length > 1 &&
            text.length < 60 &&
            href &&
            href.includes("flormar.tn") &&
            !href.includes("cart") &&
            !href.includes("account") &&
            !href.includes("wishlist")
          ) {
            results.push({ name: text, url: href });
          }
        });
        if (results.length > 0) break;
      }
    }

    return results;
  });

  // Deduplicate and slugify
  const seen = new Set<string>();
  return rawCategories
    .filter((c) => {
      const slug = c.url.split("/").filter(Boolean).pop() ?? slugify(c.name);
      if (seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })
    .map((c) => ({
      name: c.name,
      url: c.url,
      slug: c.url.split("/").filter(Boolean).pop() ?? slugify(c.name),
    }));
}

async function scrapeProductLinks(
  page: Page,
  categoryUrl: string
): Promise<string[]> {
  const ok = await safeNavigate(page, categoryUrl);
  if (!ok) return [];

  await page.waitForTimeout(2000);

  const links: string[] = await page.evaluate(() => {
    const anchors = document.querySelectorAll("a[href]");
    const results: string[] = [];
    anchors.forEach((el) => {
      const href = (el as HTMLAnchorElement).href;
      if (
        href &&
        (href.includes("/product/") ||
          href.includes("/products/") ||
          href.includes("/p/"))
      ) {
        results.push(href);
      }
    });
    return [...new Set(results)];
  });

  return links;
}

async function scrapeProductDetail(
  page: Page,
  url: string,
  categorySlug: string
): Promise<ScrapedProduct | null> {
  const ok = await safeNavigate(page, url);
  if (!ok) return null;

  await page.waitForTimeout(2000);

  try {
    const data = await page.evaluate(() => {
      // Name
      const nameEl =
        document.querySelector("h1") ??
        document.querySelector(".product-name") ??
        document.querySelector(".product-title");
      const name = nameEl?.textContent?.trim() ?? null;

      // Price
      const priceEl =
        document.querySelector(".price") ??
        document.querySelector(".product-price") ??
        document.querySelector("[class*='price']");
      const priceText = priceEl?.textContent?.trim() ?? null;

      // Sale price
      const salePriceEl =
        document.querySelector(".sale-price") ??
        document.querySelector(".special-price") ??
        document.querySelector("[class*='sale']");
      const salePriceText = salePriceEl?.textContent?.trim() ?? null;

      // Description
      const descEl =
        document.querySelector(".product-description") ??
        document.querySelector(".description") ??
        document.querySelector("[class*='description']");
      const description = descEl?.textContent?.trim() ?? null;

      // Images
      const imgEls = document.querySelectorAll(
        ".product-image img, .gallery img, [class*='product'] img"
      );
      const images: string[] = [];
      imgEls.forEach((el) => {
        const src = (el as HTMLImageElement).src;
        if (src && !src.includes("placeholder") && !src.includes("pixel")) {
          images.push(src);
        }
      });

      // Variants / shades
      const swatchEls = document.querySelectorAll(
        ".swatch, .color-swatch, [class*='swatch'], [class*='shade']"
      );
      const variants: Array<{
        shade_name: string;
        color_hex: string | null;
        sku: string | null;
      }> = [];
      swatchEls.forEach((el) => {
        const label =
          el.getAttribute("title") ??
          el.getAttribute("aria-label") ??
          el.textContent?.trim() ??
          "Sans nom";
        const color =
          (el as HTMLElement).style?.backgroundColor ??
          el.getAttribute("data-color") ??
          null;
        const sku = el.getAttribute("data-sku") ?? el.getAttribute("data-value") ?? null;

        if (label && label.length > 0 && label.length < 80) {
          variants.push({ shade_name: label, color_hex: color, sku });
        }
      });

      return { name, priceText, salePriceText, description, images, variants };
    });

    if (!data.name) return null;

    const slug = slugify(data.name);
    const price = parsePrice(data.priceText);
    const salePrice = parsePrice(data.salePriceText);

    const issues: string[] = [];
    if (!price) issues.push("missing_price");
    if (data.images.length === 0) issues.push("missing_images");
    if (data.variants.length > 0 && data.variants.every((v) => !v.sku))
      issues.push("missing_skus");

    const images: ImageMatch[] = data.images.slice(0, 5).map((imgUrl) => ({
      url: imgUrl,
      source: "flormar.tn" as const,
      confidence: "high" as const,
      reason: "Scraped directly from product page",
      needsReview: false,
    }));

    const variants: ScrapedVariant[] = data.variants.map((v) => ({
      shade_name: v.shade_name,
      sku: v.sku,
      color_hex: v.color_hex,
      swatch_image_url: null,
      stock_qty: 99, // default per rules
    }));

    // If no variants found but it's a makeup product, add a default variant
    if (variants.length === 0) {
      variants.push({
        shade_name: "Standard",
        sku: null,
        color_hex: null,
        swatch_image_url: null,
        stock_qty: 99,
      });
    }

    return {
      name: data.name,
      slug,
      url,
      category_slug: categorySlug,
      description: data.description ?? null,
      price,
      sale_price: salePrice,
      source_url: url,
      variants,
      images,
      issues,
    };
  } catch (err) {
    console.log(`    ✗ Parse error on ${url}: ${err}`);
    return null;
  }
}

async function tryMatchFlormarCom(
  page: Page,
  product: ScrapedProduct
): Promise<ImageMatch[]> {
  const searchUrl = `https://www.flormar.com/search?q=${encodeURIComponent(product.name)}`;
  const ok = await safeNavigate(page, searchUrl);
  if (!ok) return product.images;

  await page.waitForTimeout(2000);

  try {
    const result = await page.evaluate((productName: string) => {
      const cards = document.querySelectorAll(
        ".product-card, [class*='product-item'], [class*='product-card']"
      );
      if (cards.length === 0) return null;

      const first = cards[0];
      const title = first.querySelector("h2, h3, .name, [class*='name']")?.textContent?.trim() ?? "";
      const img = first.querySelector("img");
      const imgSrc = img?.src ?? img?.getAttribute("data-src") ?? null;

      const nameLower = productName.toLowerCase();
      const titleLower = title.toLowerCase();

      // Compute a simple word overlap confidence
      const nameWords = nameLower.split(/\s+/).filter((w) => w.length > 2);
      const matchCount = nameWords.filter((w) => titleLower.includes(w)).length;
      const confidence =
        matchCount >= 2 ? "high" : matchCount === 1 ? "medium" : "low";

      return { title, imgSrc, confidence };
    }, product.name);

    if (!result || !result.imgSrc) return product.images;

    const match: ImageMatch = {
      url: result.imgSrc,
      source: "flormar.com",
      confidence: result.confidence as "high" | "medium" | "low",
      reason: `Found "${result.title}" on flormar.com — ${result.confidence} word-overlap with "${product.name}"`,
      needsReview: result.confidence !== "high",
    };

    // Prepend com image if confidence is high, otherwise append for review
    if (result.confidence === "high") {
      return [match, ...product.images];
    } else {
      return [...product.images, match];
    }
  } catch {
    return product.images;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.join(process.cwd(), "dry-run-output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const report: DryRunReport = {
    scrapedAt: new Date().toISOString(),
    sourceUrl: "https://flormar.tn",
    totals: {
      categories: 0,
      products: 0,
      variants: 0,
      matchedImages: 0,
      fallbackImages: 0,
      uncertainMatches: 0,
      missingPrices: 0,
      missingImages: 0,
      missingSkus: 0,
      duplicateSlugs: 0,
      failedPages: 0,
    },
    categories: [],
    products: [],
    reviewList: [],
    errors: [],
  };

  let browser: Browser | null = null;

  try {
    console.log("\n🌸 Flormar Tunisia — Catalog Dry-Run Import");
    console.log("══════════════════════════════════════════\n");

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "Accept-Language": "fr-TN,fr;q=0.9,en;q=0.8",
    });

    // 1. Scrape categories
    const categories = await scrapeCategories(page);
    report.categories = categories;
    report.totals.categories = categories.length;
    console.log(`  ✓ Found ${categories.length} categories\n`);

    // 2. Scrape products per category
    const slugsSeen = new Set<string>();

    for (const cat of categories) {
      console.log(`  → Category: ${cat.name} (${cat.slug})`);
      const productLinks = await scrapeProductLinks(page, cat.url);
      console.log(`    Found ${productLinks.length} product links`);

      for (const link of productLinks.slice(0, 50)) { // cap per category
        try {
          const product = await scrapeProductDetail(page, link, cat.slug);
          if (!product) {
            report.totals.failedPages++;
            continue;
          }

          // Duplicate slug check
          if (slugsSeen.has(product.slug)) {
            report.totals.duplicateSlugs++;
            product.slug = `${product.slug}-${cat.slug}`;
          }
          slugsSeen.add(product.slug);

          // Try to match with flormar.com
          const matchPage = await browser!.newPage();
          product.images = await tryMatchFlormarCom(matchPage, product);
          await matchPage.close();

          // Tally issues
          if (product.issues.includes("missing_price")) report.totals.missingPrices++;
          if (product.issues.includes("missing_images")) report.totals.missingImages++;
          if (product.issues.includes("missing_skus")) report.totals.missingSkus++;

          // Tally images
          product.images.forEach((img) => {
            if (img.source === "flormar.com" && img.confidence === "high") {
              report.totals.matchedImages++;
            } else if (img.needsReview) {
              report.totals.uncertainMatches++;
              report.reviewList.push({
                product: product.name,
                url: img.url,
                reason: img.reason,
              });
            } else {
              report.totals.fallbackImages++;
            }
          });

          report.totals.variants += product.variants.length;
          report.products.push(product);
          process.stdout.write(`    ✓ ${product.name}\n`);
        } catch (err) {
          report.totals.failedPages++;
          report.errors.push(`${link}: ${err}`);
        }
      }
    }

    report.totals.products = report.products.length;

    // 3. Save JSON
    const jsonPath = path.join(outDir, "dry-run.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");

    // 4. Save CSV (products)
    const csvRows = [
      "name,slug,category_slug,price,sale_price,variants,images,issues,source_url",
      ...report.products.map((p) =>
        [
          `"${p.name.replace(/"/g, '""')}"`,
          p.slug,
          p.category_slug,
          p.price ?? "",
          p.sale_price ?? "",
          p.variants.length,
          p.images.length,
          p.issues.join("|"),
          p.source_url,
        ].join(",")
      ),
    ];
    const csvPath = path.join(outDir, "products.csv");
    fs.writeFileSync(csvPath, csvRows.join("\n"), "utf-8");

    // 5. Save review list
    const reviewPath = path.join(outDir, "review-list.json");
    fs.writeFileSync(reviewPath, JSON.stringify(report.reviewList, null, 2), "utf-8");

    // 6. Print report
    console.log("\n══════════════════════════════════════════");
    console.log("📊 DRY-RUN REPORT");
    console.log("══════════════════════════════════════════");
    console.log(`  Categories     : ${report.totals.categories}`);
    console.log(`  Products       : ${report.totals.products}`);
    console.log(`  Variants       : ${report.totals.variants}`);
    console.log(`  Matched images : ${report.totals.matchedImages} (flormar.com, high confidence)`);
    console.log(`  Fallback images: ${report.totals.fallbackImages} (flormar.tn)`);
    console.log(`  Uncertain      : ${report.totals.uncertainMatches} → review-list.json`);
    console.log(`  Missing prices : ${report.totals.missingPrices}`);
    console.log(`  Missing images : ${report.totals.missingImages}`);
    console.log(`  Missing SKUs   : ${report.totals.missingSkus}`);
    console.log(`  Duplicate slugs: ${report.totals.duplicateSlugs}`);
    console.log(`  Failed pages   : ${report.totals.failedPages}`);
    console.log("\n📁 Output:");
    console.log(`  ${jsonPath}`);
    console.log(`  ${csvPath}`);
    console.log(`  ${reviewPath}`);
    console.log("\n⚠️  Nothing has been written to Supabase.");
    console.log("   Review the output, then confirm import.\n");
  } catch (err) {
    console.error("Fatal error:", err);
    report.errors.push(String(err));
  } finally {
    await browser?.close();
  }
}

main().catch(console.error);
