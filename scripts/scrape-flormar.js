#!/usr/bin/env node
/**
 * scripts/scrape-flormar.js
 *
 * Scrapes all categories and products from the flormar.tn Converty REST API.
 * Saves output to scripts/dry-run.json.
 * Always writes dry-run.json (even if empty) so import-to-supabase.js can run.
 *
 * Run: node scripts/scrape-flormar.js
 * Requires: Node 18+ (native fetch)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const BASE_API = "https://flormar.tn/api/v1";
const OUT_FILE = path.join(__dirname, "dry-run.json");
const PAGE_LIMIT = 100;

// Map Arabic/French category names returned by the Converty API to English
const CAT_NAME_MAP = {
  "منتجات الوجه": "Face",
  "منتجات العيون": "Eyes",
  "منتجات الشفاه": "Lips",
  "إكسسوارات": "Accessories",
  "العناية بالبشرة": "Skincare",
  "Lèvres": "Lips",
  "Yeux": "Eyes",
  "Teint": "Face",
  "Sourcils": "Eyebrows",
  "Ongles": "Nails",
  "Soins": "Skincare",
  "Visage": "Face",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://flormar.tn/",
  "Origin": "https://flormar.tn",
};

function saveReport(categories, products, errors) {
  const report = {
    scrapedAt: new Date().toISOString(),
    sourceUrl: "https://flormar.tn",
    totals: {
      categories: categories.length,
      products: products.length,
      variants: products.reduce((s, p) => s + p.variants.length, 0),
      missingPrices: products.filter(p => !p.price).length,
      missingImages: products.filter(p => !p.images.length).length,
    },
    categories: categories.map(({ id: _id, ...c }) => c),
    products,
    errors,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n📁 Saved ${products.length} products to ${OUT_FILE}`);
  return report;
}

async function apiFetch(endpoint, retries = 3) {
  const url = `${BASE_API}${endpoint}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

function slugify(text) {
  return String(text).toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parsePrice(val) {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const m = String(val).replace(/\s/g, "").match(/[\d.,]+/);
  return m ? parseFloat(m[0].replace(",", ".")) : null;
}

function extractImages(product) {
  const urls = new Set();
  for (const key of ["image", "images", "thumbnail", "cover", "photo", "picture", "gallery"]) {
    const v = product[key];
    if (typeof v === "string" && v.startsWith("http")) urls.add(v);
    if (Array.isArray(v)) v.forEach(u => typeof u === "string" && u.startsWith("http") && urls.add(u));
    if (v && typeof v === "object" && typeof v.url === "string") urls.add(v.url);
  }
  const json = JSON.stringify(product);
  const re = /https:\/\/cdn\.converty\.shop\/images\/[a-f0-9]+_[a-z]+\.[a-z]+/gi;
  for (const m of json.matchAll(re)) urls.add(m[0]);
  return [...urls]
    .map(u => u.replace(/_(sm|md|xs|thumb)\.(webp|jpg|jpeg|png)$/i, "_lg.$2"))
    .filter((u, i, a) => a.indexOf(u) === i)
    .slice(0, 5);
}

function extractVariants(product) {
  const rawVars = product.variants || product.options || product.shades ||
    product.colors || product.attributes || [];
  if (!Array.isArray(rawVars) || rawVars.length === 0) {
    return [{ shade_name: "Standard", sku: product.sku || (product.id != null ? String(product.id) : null), color_hex: null, swatch_image_url: null, stock_qty: 99 }];
  }
  return rawVars.map((v, i) => {
    if (typeof v === "string") return { shade_name: v, sku: null, color_hex: null, swatch_image_url: null, stock_qty: 99 };
    const shadeName = v.name || v.shade_name || v.title || v.value || v.label || v.option || `Shade ${i + 1}`;
    const colorHex = v.color || v.color_hex || v.hex || v.hexCode || null;
    const sku = v.sku || v.barcode || v.reference || (v.id != null ? String(v.id) : null);
    let swatchUrl = null;
    const swatchMatch = JSON.stringify(v).match(/https:\/\/cdn\.converty\.shop\/images\/[a-f0-9]+_[a-z]+\.[a-z]+/i);
    if (swatchMatch) swatchUrl = swatchMatch[0].replace(/_(sm|md|xs|thumb)\.(webp|jpg|jpeg|png)$/i, "_lg.$2");
    return { shade_name: String(shadeName).trim(), sku: sku || null, color_hex: colorHex || null, swatch_image_url: swatchUrl, stock_qty: 99 };
  }).filter(v => v.shade_name && v.shade_name.length < 100);
}

function parseProduct(raw, categorySlug) {
  const name = raw.name || raw.title || raw.product_name;
  if (!name || typeof name !== "string" || name.trim().length < 2) return null;
  const trimmedName = name.trim();
  const slug = raw.slug || raw.handle || slugify(trimmedName);
  const price = parsePrice(raw.price ?? raw.regular_price ?? raw.original_price ?? raw.basePrice);
  const salePrice = parsePrice(raw.sale_price ?? raw.promo_price ?? raw.discounted_price ?? raw.specialPrice);
  const description = ((raw.description || raw.short_description || raw.body_html || "")
    .replace(/<[^>]+>/g, "").trim().slice(0, 1000)) || null;
  return {
    name: trimmedName, slug, category_slug: categorySlug, description, price,
    sale_price: salePrice !== price ? salePrice : null,
    source_url: raw.url || raw.permalink || `https://flormar.tn/product/${slug}`,
    images: extractImages(raw),
    variants: extractVariants(raw),
  };
}

async function fetchAllProducts(categoryId, categorySlug) {
  const products = [];
  let page = 1;
  while (true) {
    const data = await apiFetch(`/products?page=${page}&limit=${PAGE_LIMIT}&categoryId=${categoryId}`);
    const items = data.data || data.products || data.items || data.results || (Array.isArray(data) ? data : []);
    if (!items.length) break;
    for (const raw of items) { const p = parseProduct(raw, categorySlug); if (p) products.push(p); }
    console.log(`    page ${page}: ${items.length} raw → ${products.length} parsed`);
    const total = data.total || data.count || data.totalCount || (data.pagination && data.pagination.total) || null;
    const hasMore = data.hasMore || data.has_more || data.nextPage || (total && products.length < total);
    if (!hasMore || items.length < PAGE_LIMIT) break;
    page++;
    await new Promise(r => setTimeout(r, 300));
  }
  return products;
}

async function main() {
  console.log("\n🌸 Flormar Tunisia — API Scraper");
  console.log("══════════════════════════════════\n");

  const allErrors = [];
  let categories = [];

  // Fetch categories — on failure write empty report and exit 0 so import step still runs
  console.log("Fetching categories...");
  try {
    const data = await apiFetch("/categories");
    const raw = data.data || data.categories || data.items || data.results || (Array.isArray(data) ? data : []);
    categories = raw
      .map(c => {
        const rawName = (c.name || c.title || "").trim();
        const name = CAT_NAME_MAP[rawName] || rawName;
        // Use English name for slug so categories get clean URLs like "face", "eyes", etc.
        const slug = c.slug || c.handle || slugify(name) || slugify(rawName);
        return { id: c.id || c._id, name, slug };
      })
      .filter(c => c.name && c.slug);
    console.log(`  Found ${categories.length} categories: ${categories.map(c => c.name).join(", ")}\n`);
  } catch (err) {
    const msg = `Failed to fetch categories: ${err.message}`;
    console.error(`  ✗ ${msg}`);
    console.error("  ⚠ flormar.tn API may block requests from this IP.");
    allErrors.push(msg);
    saveReport([], [], allErrors);
    // Exit 0 so the import step still runs (it will skip gracefully with 0 products)
    process.exit(0);
  }

  if (!categories.length) {
    console.error("  No categories returned.");
    saveReport([], [], ["No categories returned"]);
    process.exit(0);
  }

  // Fetch products per category
  const allProducts = [];
  const slugsSeen = new Set();

  for (const cat of categories) {
    console.log(`  → ${cat.name} (id: ${cat.id})`);
    try {
      const products = await fetchAllProducts(cat.id, cat.slug);
      for (const p of products) {
        if (slugsSeen.has(p.slug)) p.slug = `${p.slug}-${cat.slug}`;
        slugsSeen.add(p.slug);
        allProducts.push(p);
      }
      console.log(`    ✓ ${products.length} products\n`);
    } catch (err) {
      const msg = `Category ${cat.slug}: ${err.message}`;
      console.error(`    ✗ ${msg}`);
      allErrors.push(msg);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const report = saveReport(categories, allProducts, allErrors);

  console.log("══════════════════════════════════");
  console.log(`  Categories : ${report.totals.categories}`);
  console.log(`  Products   : ${report.totals.products}`);
  console.log(`  Variants   : ${report.totals.variants}`);
  console.log(`  No price   : ${report.totals.missingPrices}`);
  console.log(`  No images  : ${report.totals.missingImages}`);

  allProducts.slice(0, 3).forEach(p =>
    console.log(`  • "${p.name}" | ${p.price} DT | ${p.variants.length} shades | ${p.images.length} img`)
  );
}

main().catch(err => {
  console.error("Fatal:", err);
  // Still write a report so the import step sees a valid (empty) JSON file
  try { saveReport([], [], [String(err)]); } catch {}
  process.exit(0); // exit 0 so continue-on-error doesn't matter and import still runs
});
