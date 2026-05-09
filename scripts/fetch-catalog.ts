#!/usr/bin/env tsx
/**
 * Flormar Tunisia — Fetch-based catalog scraper (no Playwright)
 *
 * Uses plain HTTP fetch + HTML parsing (regex) to extract categories and
 * products from flormar.tn. Much faster and more reliable than Playwright.
 * Writes the same dry-run-output/dry-run.json format as import-catalog.ts.
 *
 * Run: npx tsx scripts/fetch-catalog.ts
 */

import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://flormar.tn";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-TN,fr;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { name: string; slug: string; url: string }
interface Variant { shade_name: string; sku: string | null; color_hex: string | null; swatch_image_url: string | null; stock_qty: number }
interface ImageMatch { url: string; source: string; confidence: string; reason: string; needsReview: boolean }
interface Product {
  name: string; slug: string; url: string; category_slug: string;
  description: string | null; price: number | null; sale_price: number | null;
  source_url: string; variants: Variant[]; images: ImageMatch[]; issues: string[];
}
interface DryRunReport {
  scrapedAt: string; sourceUrl: string;
  totals: { categories: number; products: number; variants: number; matchedImages: number; fallbackImages: number; uncertainMatches: number; missingPrices: number; missingImages: number; missingSkus: number; duplicateSlugs: number; failedPages: number };
  categories: Category[]; products: Product[];
  reviewList: Array<{ product: string; url: string; reason: string }>;
  errors: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePrice(text: string): number | null {
  const m = text.replace(/\s/g, "").match(/[\d]+[,.]?[\d]*/);
  if (!m) return null;
  return parseFloat(m[0].replace(",", "."));
}

async function fetchHtml(url: string, timeout = 20_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      console.log(`    HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.log(`    Fetch error for ${url}: ${err}`);
    return null;
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const matches = html.matchAll(/href=["']([^"']+)["']/gi);
  const links: string[] = [];
  for (const m of matches) {
    let href = m[1];
    if (href.startsWith("/")) href = new URL(href, baseUrl).href;
    else if (!href.startsWith("http")) continue;
    links.push(href);
  }
  return links;
}

function extractMeta(html: string, property: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i"));
  return m ? m[1].trim() : null;
}

function extractImages(html: string, siteUrl: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let src = m[1];
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = new URL(src, siteUrl).href;
    if (
      src.startsWith("http") &&
      !src.includes("placeholder") &&
      !src.includes("pixel") &&
      !src.includes("logo") &&
      !src.includes("icon") &&
      (src.includes(".jpg") || src.includes(".jpeg") || src.includes(".png") || src.includes(".webp"))
      && !seen.has(src)
    ) {
      seen.add(src);
      results.push(src);
    }
  }
  return results;
}

// ─── Scrapers ────────────────────────────────────────────────────────────────

async function scrapeCategories(): Promise<Category[]> {
  console.log("  → Fetching flormar.tn homepage…");
  const html = await fetchHtml(BASE_URL);
  if (!html) {
    console.log("  → Homepage failed, trying sitemap…");
    return scrapeCategoriesFromSitemap();
  }

  const links = extractLinks(html, BASE_URL);
  const catUrls = links.filter(u =>
    u.includes("flormar.tn") &&
    !u.includes("?") &&
    !u.includes("cart") &&
    !u.includes("account") &&
    !u.includes("checkout") &&
    !u.includes("wishlist") &&
    !u.includes("search") &&
    !u.includes("blog") &&
    !u.includes("page") &&
    u !== BASE_URL + "/" && u !== BASE_URL
  );

  const seen = new Set<string>();
  const categories: Category[] = [];
  for (const url of catUrls) {
    const slug = url.replace(/\/$/, "").split("/").pop() ?? "";
    if (!slug || seen.has(slug) || slug.length > 60) continue;
    seen.add(slug);
    const re = new RegExp(`href=["']${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>([^<]{2,60})<`, "i");
    const nameMatch = html.match(re);
    const name = nameMatch ? nameMatch[1].trim() : slug;
    categories.push({ name, slug, url });
  }

  console.log(`  ✓ Found ${categories.length} categories from homepage`);
  if (categories.length === 0) return scrapeCategoriesFromSitemap();
  return categories;
}

async function scrapeCategoriesFromSitemap(): Promise<Category[]> {
  const sitemapUrls = [
    `${BASE_URL}/sitemap.xml`,
    `${BASE_URL}/sitemap_index.xml`,
    `${BASE_URL}/sitemap`,
  ];
  for (const url of sitemapUrls) {
    const xml = await fetchHtml(url);
    if (!xml) continue;

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1]);
    const catUrls = locs.filter(u =>
      u.includes("flormar.tn") &&
      !u.includes("product") &&
      !u.includes(".xml") &&
      !u.includes("?") &&
      u !== BASE_URL + "/" && u !== BASE_URL
    );

    if (catUrls.length > 0) {
      console.log(`  ✓ Found ${catUrls.length} categories from sitemap`);
      const seen = new Set<string>();
      return catUrls
        .filter(u => {
          const slug = u.replace(/\/$/, "").split("/").pop() ?? "";
          if (!slug || seen.has(slug)) return false;
          seen.add(slug);
          return true;
        })
        .map(u => {
          const slug = u.replace(/\/$/, "").split("/").pop()!;
          return { name: slug, slug, url: u };
        });
    }
  }
  console.log("  ✗ No categories found from sitemap");
  return [];
}

async function scrapeProductLinks(categoryUrl: string): Promise<string[]> {
  const html = await fetchHtml(categoryUrl);
  if (!html) return [];
  const links = extractLinks(html, categoryUrl);
  return [...new Set(links.filter(u =>
    u.includes("flormar.tn") &&
    (u.includes("/product/") || u.includes("/products/") || u.includes("/p/"))
  ))];
}

async function scrapeProductLinks_multipage(categoryUrl: string): Promise<string[]> {
  const all = new Set<string>();
  (await scrapeProductLinks(categoryUrl)).forEach(l => all.add(l));
  for (let p = 2; p <= 5; p++) {
    const html = await fetchHtml(categoryUrl.replace(/\/$/, "") + `?page=${p}`, 15_000);
    if (!html) break;
    const links = extractLinks(html, categoryUrl).filter(u =>
      u.includes("flormar.tn") &&
      (u.includes("/product/") || u.includes("/products/") || u.includes("/p/"))
    );
    if (links.length === 0) break;
    links.forEach(l => all.add(l));
  }
  return [...all];
}

async function scrapeProduct(url: string, categorySlug: string): Promise<Product | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const ogTitle = extractMeta(html, "og:title");
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const name = (ogTitle || h1Match?.[1] || "").trim().replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  if (!name) return null;

  const ogDesc = extractMeta(html, "og:description") || extractMeta(html, "description");

  const pricePatterns = [
    /class=["'][^"']*price[^"']*["'][^>]*>\s*([0-9]+[.,][0-9]+)/gi,
    /["']price["'][^:]*:\s*["']?([0-9]+[.,][0-9]+)/gi,
    />\s*([0-9]+[.,][0-9]+)\s*(?:TND|DT|د\.ت)/gi,
  ];
  let priceText: string | null = null;
  for (const re of pricePatterns) {
    const m = re.exec(html);
    if (m) { priceText = m[1]; break; }
  }
  const price = priceText ? parsePrice(priceText) : null;

  const ogImage = extractMeta(html, "og:image");
  const pageImages = extractImages(html, url);
  const allImages = [...new Set([...(ogImage ? [ogImage] : []), ...pageImages])].slice(0, 5);

  const issues: string[] = [];
  if (!price) issues.push("missing_price");
  if (allImages.length === 0) issues.push("missing_images");

  return {
    name,
    slug: slugify(name),
    url,
    category_slug: categorySlug,
    description: ogDesc || null,
    price,
    sale_price: null,
    source_url: url,
    variants: [{ shade_name: "Standard", sku: null, color_hex: null, swatch_image_url: null, stock_qty: 99 }],
    images: allImages.map(imgUrl => ({ url: imgUrl, source: "flormar.tn", confidence: "high", reason: "Scraped from product page", needsReview: false })),
    issues,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.join(process.cwd(), "dry-run-output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const report: DryRunReport = {
    scrapedAt: new Date().toISOString(),
    sourceUrl: BASE_URL,
    totals: { categories: 0, products: 0, variants: 0, matchedImages: 0, fallbackImages: 0, uncertainMatches: 0, missingPrices: 0, missingImages: 0, missingSkus: 0, duplicateSlugs: 0, failedPages: 0 },
    categories: [], products: [], reviewList: [], errors: [],
  };

  console.log("\n🌸 Flormar Tunisia — Fetch-Based Catalog Scraper");
  console.log("══════════════════════════════════════════════\n");

  try {
    const categories = await scrapeCategories();
    report.categories = categories;
    report.totals.categories = categories.length;
    if (categories.length === 0) {
      report.errors.push("No categories found — flormar.tn may be blocking or returning non-HTML");
    }

    const slugsSeen = new Set<string>();
    for (const cat of categories) {
      console.log(`\n  → Category: ${cat.name} (${cat.slug})`);
      let productLinks: string[];
      try {
        productLinks = await scrapeProductLinks_multipage(cat.url);
      } catch (err) {
        report.errors.push(`category:${cat.slug}: ${err}`);
        continue;
      }
      console.log(`    Found ${productLinks.length} product links`);

      for (const link of productLinks.slice(0, 50)) {
        try {
          const product = await scrapeProduct(link, cat.slug);
          if (!product) { report.totals.failedPages++; continue; }

          if (slugsSeen.has(product.slug)) {
            report.totals.duplicateSlugs++;
            product.slug = `${product.slug}-${cat.slug}`;
          }
          slugsSeen.add(product.slug);

          if (product.issues.includes("missing_price")) report.totals.missingPrices++;
          if (product.issues.includes("missing_images")) report.totals.missingImages++;
          product.images.forEach(() => { report.totals.fallbackImages++; });
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

    const jsonPath = path.join(outDir, "dry-run.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
    fs.writeFileSync(path.join(outDir, "products.csv"),
      ["name,slug,category_slug,price,sale_price,variants,images,issues,source_url",
       ...report.products.map(p => [`"${p.name.replace(/"/g, '""')}"`, p.slug, p.category_slug, p.price ?? "", "", p.variants.length, p.images.length, p.issues.join("|"), p.source_url].join(","))]
      .join("\n"), "utf-8");
    fs.writeFileSync(path.join(outDir, "review-list.json"), JSON.stringify(report.reviewList, null, 2), "utf-8");

    console.log("\n══════════════════════════════════════════════");
    console.log(`  Categories: ${report.totals.categories} | Products: ${report.totals.products} | Missing prices: ${report.totals.missingPrices}`);
    console.log("⚠️  Nothing written to Supabase. Run full-import.ts next.\n");
  } catch (err) {
    console.error("Fatal error:", err);
    report.errors.push(String(err));
    fs.writeFileSync(path.join(outDir, "dry-run.json"), JSON.stringify(report, null, 2), "utf-8");
  }
}

main().catch(console.error);
