#!/usr/bin/env node
/**
 * scripts/import-to-supabase.js
 *
 * Reads scripts/dry-run.json and imports everything into Supabase.
 * Run: node scripts/import-to-supabase.js
 * Env: SUPABASE_SERVICE_ROLE_KEY
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yqgtjgvqeogsykkpgxiy.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZ3RqZ3ZxZW9nc3lra3BneGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI3NTQ0OSwiZXhwIjoyMDkzODUxNDQ5fQ.1aqknhzGE-YcIJvddlRunrOqJqjUOEkieQ3cUFkDOqM";

const DRY_RUN_FILE = path.join(__dirname, "dry-run.json");
const REPORT_FILE = path.join(__dirname, "..", "IMPORT_REPORT.md");
const BUCKET = "product-images";
const SKIP_UPLOAD = process.env.SKIP_IMAGE_UPLOAD === "true";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function downloadImage(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://flormar.tn/" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/webp";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 500 ? { data: buf, contentType: ct } : null;
  } catch { return null; }
}

function extFromCt(ct) {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

function writeReport(status, reason, totals, result) {
  const lines = [
    "# Flormar Tunisia — Catalog Import Report", "",
    `Generated: ${new Date().toISOString()}  `, `Status: **${status}**  `,
  ];
  if (reason) lines.push(`Reason: ${reason}  `);
  if (totals) {
    lines.push("", "## Scrape Totals", "", "| Metric | Count |", "|--------|------:|",
      `| Categories | ${totals.categories} |`, `| Products | ${totals.products} |`,
      `| Variants | ${totals.variants} |`, `| Missing prices | ${totals.missingPrices} |`,
      `| Missing images | ${totals.missingImages} |`);
  }
  if (result) {
    lines.push("", "## Supabase Import", "", "| Metric | Count |", "|--------|------:|",
      `| Categories inserted | ${result.catsInserted} |`,
      `| Products inserted | ${result.productsInserted} |`,
      `| Variants inserted | ${result.variantsInserted} |`,
      `| Images uploaded | ${result.imagesUploaded} |`,
      `| Image failures | ${result.imagesFailed} |`,
      `| Product failures | ${result.productsFailed} |`);
    if (result.errors.length) {
      lines.push("", "## Errors", "");
      result.errors.slice(0, 50).forEach(e => lines.push(`- \`${e}\``));
    }
  }
  try {
    fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n", "utf-8");
    console.log(`\n📄 IMPORT_REPORT.md written (${status})`);
  } catch (e) {
    console.error("Failed to write IMPORT_REPORT.md:", e.message);
  }
}

async function main() {
  console.log("\n🌸 Flormar Tunisia — Supabase Import");
  console.log("════════════════════════════════════\n");

  if (!fs.existsSync(DRY_RUN_FILE)) {
    console.error("scripts/dry-run.json not found. Run scripts/scrape-flormar.js first.");
    writeReport("failed", "dry-run.json not found", null, null);
    process.exit(1);
  }

  const dryRun = JSON.parse(fs.readFileSync(DRY_RUN_FILE, "utf-8"));
  const { totals, categories = [], products = [] } = dryRun;

  console.log(`  Scraped at  : ${dryRun.scrapedAt}`);
  console.log(`  Categories  : ${totals.categories}`);
  console.log(`  Products    : ${totals.products}`);
  console.log(`  Image upload: ${SKIP_UPLOAD ? "SKIPPED" : "enabled"}\n`);

  if (!products.length) { writeReport("skipped", "0 products", totals, null); process.exit(0); }

  // Quick connectivity check before doing any work
  const probe = await supabase.from("categories").select("count", { count: "exact", head: true });
  if (probe.error?.message?.includes("Host not in allowlist")) {
    const msg = "Supabase blocked this IP with 'Host not in allowlist'. " +
      "Run this script from your local machine or disable Supabase Network Restrictions in the dashboard.";
    console.error("✗", msg);
    writeReport("failed", msg, totals, null);
    process.exit(1);
  }

  const { error: updErr } = await supabase.storage.updateBucket(BUCKET, { public: true });
  if (updErr) await supabase.storage.createBucket(BUCKET, { public: true });

  const result = { catsInserted: 0, productsInserted: 0, variantsInserted: 0, imagesUploaded: 0, imagesFailed: 0, productsFailed: 0, errors: [] };

  console.log(`Importing ${categories.length} categories...`);
  for (const cat of categories) {
    const { error } = await supabase.from("categories").upsert({ name: cat.name, slug: cat.slug }, { onConflict: "slug" });
    if (error) result.errors.push(`cat:${cat.slug}: ${error.message}`);
    else result.catsInserted++;
  }
  console.log(`  ✓ ${result.catsInserted} categories\n`);

  const { data: catRows } = await supabase.from("categories").select("id, slug");
  const catMap = new Map((catRows || []).map(r => [r.slug, r.id]));

  console.log(`Importing ${products.length} products...\n`);
  for (const product of products) {
    try {
      const catId = catMap.get(product.category_slug) || null;
      const { data: pRow, error: pErr } = await supabase.from("products")
        .upsert({ name: product.name, slug: product.slug, description: product.description || null,
          price: product.price || 0, sale_price: product.sale_price || null,
          category_id: catId, source_url: product.source_url || null }, { onConflict: "slug" })
        .select("id").single();
      if (pErr || !pRow) { result.errors.push(`product:${product.slug}: ${pErr?.message || "no row"}`); result.productsFailed++; continue; }
      result.productsInserted++;
      const pid = pRow.id;

      if (product.variants?.length) {
        await supabase.from("product_variants").delete().eq("product_id", pid);
        const { error: vErr } = await supabase.from("product_variants").insert(
          product.variants.map(v => ({ product_id: pid, shade_name: v.shade_name, sku: v.sku || null,
            color_hex: v.color_hex || null, swatch_image_url: v.swatch_image_url || null, stock_qty: 99 }))
        );
        if (vErr) result.errors.push(`variants:${product.slug}: ${vErr.message}`);
        else result.variantsInserted += product.variants.length;
      }

      await supabase.from("product_images").delete().eq("product_id", pid);
      const imageRecords = [];
      for (let i = 0; i < Math.min((product.images || []).length, 5); i++) {
        let finalUrl = product.images[i];
        if (!SKIP_UPLOAD) {
          const dl = await downloadImage(product.images[i]);
          if (dl) {
            const filePath = `products/${product.slug}/${Date.now()}-${i}.${extFromCt(dl.contentType)}`;
            const { data: up, error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, dl.data, { contentType: dl.contentType, upsert: true });
            if (up && !upErr) { finalUrl = supabase.storage.from(BUCKET).getPublicUrl(up.path).data.publicUrl; result.imagesUploaded++; }
            else result.imagesFailed++;
          } else result.imagesFailed++;
        }
        imageRecords.push({ product_id: pid, url: finalUrl, sort_order: i });
      }
      if (imageRecords.length) {
        const { error: iErr } = await supabase.from("product_images").insert(imageRecords);
        if (iErr) result.errors.push(`images:${product.slug}: ${iErr.message}`);
      }
      process.stdout.write(`  ✓ ${product.name}\n`);
    } catch (err) { result.errors.push(`${product.slug}: ${err}`); result.productsFailed++; }
  }

  console.log("\n════════════════════════════════════");
  console.log(`  Products inserted : ${result.productsInserted}`);
  console.log(`  Variants inserted : ${result.variantsInserted}`);
  console.log(`  Images uploaded   : ${result.imagesUploaded}`);
  console.log(`  Image failures    : ${result.imagesFailed}`);
  console.log(`  Product failures  : ${result.productsFailed}`);
  writeReport(result.productsFailed > 0 && result.productsInserted === 0 ? "failed" : "success", null, totals, result);
}

main().catch(err => { console.error("Fatal:", err); writeReport("failed", String(err), null, null); process.exit(1); });
