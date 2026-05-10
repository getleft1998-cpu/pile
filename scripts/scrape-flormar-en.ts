#!/usr/bin/env tsx
/**
 * Flormar Tunisia — Scraper (Converty SPA)
 *
 * Uses Playwright with response event listeners to intercept Converty API calls.
 * Names are used exactly as shown on flormar.tn.
 *
 * Run: npx tsx scripts/scrape-flormar-en.ts
 */

import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = "https://flormar.tn";
const OUT_DIR = path.join(process.cwd(), "dry-run-output");

interface Variant {
  shade_name: string;
  sku: string | null;
  color_hex: string | null;
  swatch_image_url: string | null;
  stock_qty: number;
}

interface Product {
  name: string;
  slug: string;
  url: string;
  category_slug: string;
  description: string | null;
  price: number | null;
  sale_price: number | null;
  source_url: string;
  variants: Variant[];
  images: Array<{ url: string; source: string; confidence: string; reason: string; needsReview: boolean }>;
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
  categories: Array<{ name: string; slug: string; url: string }>;
  products: Product[];
  reviewList: Array<{ product: string; url: string; reason: string }>;
  errors: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePrice(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  const m = String(raw).replace(/\s/g, "").match(/[\d.,]+/);
  if (!m) return null;
  return parseFloat(m[0].replace(",", "."));
}

function extractImgUrls(obj: unknown, out: Set<string>): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) { for (const v of obj) extractImgUrls(v, out); return; }
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && v.startsWith("http") && /\.(jpe?g|png|webp|avif)/i.test(v)) {
      if (!/(logo|placeholder|pixel|sprite|favicon)/i.test(v)) out.add(v);
    } else if (v && typeof v === "object") {
      extractImgUrls(v, out);
    }
  }
}

function makeImageEntry(url: string) {
  // Prefer _lg size if converty CDN
  const upgraded = url.replace(/_(sm|md|xs|thumb)\.(webp|jpg|png)/i, "_lg.$2");
  return { url: upgraded, source: "flormar.tn", confidence: "high", reason: "flormar.tn image", needsReview: false };
}

function parseProduct(raw: Record<string, unknown>, catSlug: string): Product | null {
  const name =
    (raw.name as string) ??
    (raw.title as string) ??
    (raw.product_name as string) ??
    null;
  if (!name || name.length < 2) return null;

  const slug =
    (raw.slug as string) ??
    (raw.handle as string) ??
    (raw.permalink as string)?.split("/").filter(Boolean).pop() ??
    slugify(name);

  const price = parsePrice(raw.price ?? raw.regular_price ?? raw.original_price);
  const salePrice = parsePrice(raw.sale_price ?? raw.promo_price ?? raw.discounted_price);
  const description =
    (raw.description as string) ??
    (raw.short_description as string) ??
    (raw.body_html as string) ??
    null;

  // Images
  const imgSet = new Set<string>();
  extractImgUrls(raw, imgSet);
  const images = [...imgSet].slice(0, 5).map(makeImageEntry);

  // Variants
  const rawVars =
    (raw.variants as unknown[]) ??
    (raw.options as unknown[]) ??
    (raw.shades as unknown[]) ??
    (raw.colors as unknown[]) ??
    (raw.attributes as unknown[]) ??
    [];

  const variants: Variant[] = [];
  for (const v of rawVars) {
    if (!v || typeof v !== "object") continue;
    const vo = v as Record<string, unknown>;
    const shadeName =
      (vo.name as string) ??
      (vo.shade_name as string) ??
      (vo.title as string) ??
      (vo.value as string) ??
      (vo.label as string) ??
      null;
    if (!shadeName || shadeName.length > 100) continue;
    const colorHex = (vo.color as string) ?? (vo.color_hex as string) ?? (vo.hex as string) ?? null;
    const swatchSet = new Set<string>();
    extractImgUrls(vo, swatchSet);
    const swatchImg = [...swatchSet][0] ?? null;
    const sku = (vo.sku as string) ?? (vo.barcode as string) ?? (vo.id != null ? String(vo.id) : null);
    variants.push({ shade_name: shadeName, sku, color_hex: colorHex, swatch_image_url: swatchImg, stock_qty: 99 });
  }
  if (variants.length === 0) {
    variants.push({ shade_name: "Standard", sku: raw.id != null ? String(raw.id) : null, color_hex: null, swatch_image_url: null, stock_qty: 99 });
  }

  const id = raw.id ?? raw._id;
  const sourceUrl = raw.url as string ?? (id ? `${BASE}/product/${slug}` : `${BASE}/product/${slug}`);

  const issues: string[] = [];
  if (!price) issues.push("missing_price");
  if (images.length === 0) issues.push("missing_images");

  return {
    name, slug,
    url: typeof sourceUrl === "string" ? sourceUrl : `${BASE}/product/${slug}`,
    category_slug: catSlug,
    description: description ? String(description).replace(/<[^>]+>/g, "").trim().slice(0, 500) : null,
    price, sale_price: salePrice,
    source_url: typeof sourceUrl === "string" ? sourceUrl : `${BASE}/product/${slug}`,
    variants, images, issues,
  };
}

function extractProducts(data: unknown, catSlug: string): Product[] {
  const found: Product[] = [];
  const tryList = (list: unknown[]): void => {
    for (const item of list) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const p = parseProduct(item as Record<string, unknown>, catSlug);
      if (p) found.push(p);
    }
  };
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { tryList(node); for (const v of node) walk(v); return; }
    const o = node as Record<string, unknown>;
    if (Array.isArray(o.data)) tryList(o.data);
    if (Array.isArray(o.products)) tryList(o.products);
    if (Array.isArray(o.items)) tryList(o.items);
    if (Array.isArray(o.results)) tryList(o.results);
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(data);
  return found;
}

async function listenAndLoad(page: Page, url: string, waitMs = 4000): Promise<Map<string, unknown>> {
  const captured = new Map<string, unknown>();
  const listener = async (response: import("playwright").Response) => {
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const text = await response.text();
      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) return;
      const parsed = JSON.parse(text);
      captured.set(response.url(), parsed);
    } catch { /* ignore */ }
  };
  page.on("response", listener);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
  } catch { /* ignore timeout */ }
  await page.waitForTimeout(waitMs);
  page.off("response", listener);
  return captured;
}

async function getNavCategories(page: Page): Promise<Array<{ name: string; slug: string; url: string }>> {
  return page.evaluate((base: string) => {
    const results: Array<{ name: string; slug: string; url: string }> = [];
    const seen = new Set<string>();
    const sels = ["nav a", ".main-menu a", ".navigation a", "header nav a", "[class*='menu'] a", "[class*='nav'] a"];
    for (const sel of sels) {
      const links = document.querySelectorAll(sel);
      if (links.length < 2) continue;
      links.forEach((el) => {
        const href = (el as HTMLAnchorElement).href ?? "";
        const text = el.textContent?.trim() ?? "";
        if (!href.includes(new URL(base).hostname)) return;
        if (text.length < 2 || text.length > 60) return;
        if (/cart|account|wishlist|contact|about|blog|search/i.test(href)) return;
        const parts = href.split("/").filter(Boolean);
        const slug = parts[parts.length - 1] ?? "";
        if (!slug || slug === "" || seen.has(slug)) return;
        seen.add(slug);
        results.push({ name: text, slug, url: href });
      });
      if (results.length > 0) break;
    }
    return results;
  }, BASE);
}

async function getProductLinksFromPage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const anchors = document.querySelectorAll("a[href]");
    const hrefs: string[] = [];
    anchors.forEach((el) => {
      const h = (el as HTMLAnchorElement).href;
      if (h && (h.includes("/product/") || h.includes("/products/") || h.includes("/p/"))) {
        hrefs.push(h);
      }
    });
    return [...new Set(hrefs)];
  });
}

async function scrapeProductDom(page: Page, url: string, catSlug: string): Promise<Product | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch { /* ignore timeout */ }
  await page.waitForTimeout(3000);
  // Wait for h1
  try { await page.waitForSelector("h1", { timeout: 5000 }); } catch { /* ok */ }

  try {
    const data = await page.evaluate(() => {
      const h1 = document.querySelector("h1")?.textContent?.trim() ?? null;
      const priceEls = [...document.querySelectorAll("[class*='price']")].map(e => e.textContent?.trim()).filter(Boolean);

      // Collect all images from converty CDN
      const allImgs = [...document.querySelectorAll("img")].map(img => {
        const s = img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "";
        return s;
      }).filter(s => s && s.includes("converty") && !/logo|placeholder|pixel/i.test(s));

      // Swatches
      const swatches = [...document.querySelectorAll(
        "[class*='swatch'], [class*='shade'], [class*='variant'], [class*='option'], [data-shade], [data-variant], [data-option]"
      )].map(el => ({
        name: el.getAttribute("title") ?? el.getAttribute("aria-label") ?? el.getAttribute("data-name") ?? el.textContent?.trim() ?? "",
        hex: (el as HTMLElement).style?.backgroundColor || el.getAttribute("data-color") || el.getAttribute("data-hex") || null,
        sku: el.getAttribute("data-sku") ?? el.getAttribute("data-value") ?? el.getAttribute("data-id") ?? null,
        img: (el.querySelector("img") as HTMLImageElement | null)?.src ?? el.getAttribute("data-image") ?? null,
      })).filter(s => s.name && s.name.length > 0 && s.name.length < 100);

      const descEl = document.querySelector(".product-description, .description, [class*='description']");
      return { name: h1, prices: priceEls, images: [...new Set(allImgs)], swatches, description: descEl?.textContent?.trim() ?? null };
    });

    if (!data.name) return null;
    const slug = data.name.split("/").filter(Boolean).pop() ?? slugify(data.name);
    const price = data.prices.length ? parsePrice(data.prices[data.prices.length - 1]) : null;
    const salePrice = data.prices.length > 1 ? parsePrice(data.prices[0]) : null;

    const images = data.images.slice(0, 5).map(makeImageEntry);
    const variants: Variant[] = data.swatches.length
      ? data.swatches.map(s => ({ shade_name: s.name, sku: s.sku, color_hex: s.hex, swatch_image_url: s.img, stock_qty: 99 }))
      : [{ shade_name: "Standard", sku: null, color_hex: null, swatch_image_url: null, stock_qty: 99 }];

    const issues: string[] = [];
    if (!price) issues.push("missing_price");
    if (images.length === 0) issues.push("missing_images");

    return {
      name: data.name,
      slug: slugify(data.name),
      url,
      category_slug: catSlug,
      description: data.description,
      price,
      sale_price: salePrice,
      source_url: url,
      variants,
      images,
      issues,
    };
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const report: DryRunReport = {
    scrapedAt: new Date().toISOString(),
    sourceUrl: BASE,
    totals: { categories: 0, products: 0, variants: 0, matchedImages: 0, fallbackImages: 0, uncertainMatches: 0, missingPrices: 0, missingImages: 0, missingSkus: 0, duplicateSlugs: 0, failedPages: 0 },
    categories: [], products: [], reviewList: [], errors: [],
  };

  let browser: Browser | null = null;

  try {
    console.log("\n🌸 Flormar Tunisia — Catalog Scraper");
    console.log("══════════════════════════════════════\n");

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "en-US",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    });
    const page = await context.newPage();

    // ── Load homepage, capture API calls ─────────────────────────────────────
    console.log("  Loading homepage...");
    const homeData = await listenAndLoad(page, BASE, 5000);
    console.log(`  Intercepted ${homeData.size} JSON responses from homepage`);
    if (homeData.size > 0) {
      for (const [u] of homeData) console.log(`    · ${u.slice(0, 100)}`);
    }

    // ── Categories ───────────────────────────────────────────────────────────
    console.log("\n  Getting categories from nav...");
    const categories = await getNavCategories(page);
    console.log(`  Found ${categories.length} nav categories`);
    categories.forEach(c => console.log(`    · ${c.name} → ${c.url}`));

    report.categories = categories;
    report.totals.categories = categories.length;

    // ── Collect products ─────────────────────────────────────────────────────
    const allProducts = new Map<string, Product>();
    const slugsSeen = new Set<string>();

    const addProduct = (p: Product) => {
      if (slugsSeen.has(p.slug)) {
        report.totals.duplicateSlugs++;
        p.slug = `${p.slug}-${p.category_slug}`;
      }
      slugsSeen.add(p.slug);
      allProducts.set(p.slug, p);
    };

    // Extract products from homepage JSON responses
    for (const [url, data] of homeData) {
      const found = extractProducts(data, "home");
      for (const p of found) addProduct(p);
      if (found.length > 0) console.log(`  Found ${found.length} products from homepage API: ${url.slice(0, 80)}`);
    }

    // Navigate each category
    for (const cat of categories) {
      console.log(`\n  → ${cat.name} (${cat.slug})`);
      const catData = await listenAndLoad(page, cat.url, 4000);
      console.log(`    Intercepted ${catData.size} JSON responses`);

      let fromApi = 0;
      for (const [url, data] of catData) {
        const found = extractProducts(data, cat.slug);
        for (const p of found) { p.category_slug = cat.slug; addProduct(p); fromApi++; }
        if (found.length > 0) console.log(`    [API] ${found.length} from ${url.slice(0, 80)}`);
      }

      if (fromApi > 0) continue;

      // DOM fallback
      const links = await getProductLinksFromPage(page);
      console.log(`    ${links.length} product links (DOM fallback)`);
      for (const link of links.slice(0, 50)) {
        const slug = link.split("/").filter(Boolean).pop() ?? "";
        if (slugsSeen.has(slugify(slug))) continue;
        const captured = await listenAndLoad(page, link, 3000);
        let got = false;
        for (const [, data] of captured) {
          const found = extractProducts(data, cat.slug);
          for (const p of found) { addProduct(p); got = true; }
        }
        if (!got) {
          const p = await scrapeProductDom(page, link, cat.slug);
          if (p) { addProduct(p); console.log(`    ✓ ${p.name}`); }
          else report.totals.failedPages++;
        }
      }
    }

    // ── No products found — try direct API probing ────────────────────────────
    if (allProducts.size === 0) {
      console.log("\n  Probing Converty API endpoints...");
      const probes = [
        `${BASE}/api/products?limit=200`,
        `${BASE}/api/v1/products?limit=200`,
        `${BASE}/api/catalog?limit=200`,
        `${BASE}/api/collections`,
        `${BASE}/products.json`,
        `${BASE}/collections/all/products.json`,
      ];
      for (const probe of probes) {
        const captured = await listenAndLoad(page, probe, 2000);
        for (const [u, data] of captured) {
          const found = extractProducts(data, "uncategorized");
          for (const p of found) addProduct(p);
          if (found.length > 0) console.log(`  ✓ ${found.length} products from ${u}`);
        }
        // Also try reading response body directly
        try {
          const body = await page.evaluate(() => {
            try { return JSON.parse(document.body.innerText); } catch { return null; }
          });
          if (body) {
            const found = extractProducts(body, "uncategorized");
            for (const p of found) addProduct(p);
            if (found.length > 0) console.log(`  ✓ ${found.length} products from body: ${probe}`);
          }
        } catch { /* ignore */ }
      }
    }

    report.products = [...allProducts.values()];
    report.totals.products = report.products.length;
    for (const p of report.products) {
      report.totals.variants += p.variants.length;
      if (p.issues.includes("missing_price")) report.totals.missingPrices++;
      if (p.issues.includes("missing_images")) report.totals.missingImages++;
      report.totals.fallbackImages += p.images.length;
    }

    const jsonPath = path.join(OUT_DIR, "dry-run.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("\n══════════════════════════════════════════");
    console.log("RESULTS");
    console.log("══════════════════════════════════════════");
    console.log(`  Categories : ${report.totals.categories}`);
    console.log(`  Products   : ${report.totals.products}`);
    console.log(`  Variants   : ${report.totals.variants}`);
    console.log(`  No images  : ${report.totals.missingImages}`);
    console.log(`  No price   : ${report.totals.missingPrices}`);
    if (report.products.length > 0) {
      console.log("\n  Sample products:");
      report.products.slice(0, 5).forEach(p =>
        console.log(`    • "${p.name}" | ${p.price} DT | ${p.variants.length} shades | ${p.images.length} img`)
      );
    }
    console.log(`\n📁 ${jsonPath}`);
  } catch (err) {
    console.error("Fatal:", err);
    report.errors.push(String(err));
    fs.writeFileSync(path.join(OUT_DIR, "dry-run.json"), JSON.stringify(report, null, 2), "utf-8");
  } finally {
    await browser?.close();
  }
}

main().catch(console.error);
