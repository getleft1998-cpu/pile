#!/usr/bin/env tsx
/**
 * Flormar Tunisia — Full Supabase Import
 *
 * Reads dry-run-output/dry-run.json, checks quality (>80% products have prices),
 * upserts categories/products/variants into Supabase, downloads images from
 * source URLs, uploads them to the product-images Storage bucket, then writes
 * IMPORT_REPORT.md.
 *
 * Run: npx tsx scripts/full-import.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY env var
 * Optional: SKIP_IMAGE_UPLOAD=true to store source URLs without uploading
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://yqgtjgvqeogsykkpgxiy.supabase.co";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZ3RqZ3ZxZW9nc3lra3BneGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI3NTQ0OSwiZXhwIjoyMDkzODUxNDQ5fQ.1aqknhzGE-YcIJvddlRunrOqJqjUOEkieQ3cUFkDOqM";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Types (mirrors dry-run output) ────────────────────────────────────────────

interface ScrapedVariant {
  shade_name: string;
  sku: string | null;
  color_hex: string | null;
  swatch_image_url: string | null;
  stock_qty: number;
}

interface ImageMatch {
  url: string;
  source: string;
  confidence: string;
  reason: string;
  needsReview: boolean;
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
  products: ScrapedProduct[];
  reviewList: Array<{ product: string; url: string; reason: string }>;
  errors: string[];
}

interface ImportResult {
  categoriesInserted: number;
  productsInserted: number;
  variantsInserted: number;
  imageRecordsInserted: number;
  imagesUploaded: number;
  imagesFailed: number;
  productsFailed: number;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function downloadImage(
  url: string
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
    });
    if (!resp.ok) return null;
    const contentType =
      resp.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const data = Buffer.from(await resp.arrayBuffer());
    if (data.length < 1000) return null;
    return { data, contentType };
  } catch {
    return null;
  }
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function uploadToStorage(
  buffer: Buffer,
  contentType: string,
  filePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(filePath, buffer, { contentType, upsert: true });
  if (error) return null;
  return supabase.storage.from("product-images").getPublicUrl(data.path).data
    .publicUrl;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRunPath = path.join(process.cwd(), "dry-run-output", "dry-run.json");

  if (!fs.existsSync(dryRunPath)) {
    console.error("dry-run-output/dry-run.json not found. Run fetch-catalog.ts first.");
    writeReport("failed", "dry-run.json not found", null, null);
    process.exit(1);
  }

  const dryRun: DryRunReport = JSON.parse(fs.readFileSync(dryRunPath, "utf-8"));
  const skipUpload = process.env.SKIP_IMAGE_UPLOAD === "true";

  console.log("\n🌸 Flormar Tunisia — Supabase Import");
  console.log("═════════════════════════════════════\n");
  console.log(`  Scraped at  : ${dryRun.scrapedAt}`);
  console.log(`  Categories  : ${dryRun.totals.categories}`);
  console.log(`  Products    : ${dryRun.totals.products}`);
  console.log(`  Variants    : ${dryRun.totals.variants}`);
  console.log(`  Image upload: ${skipUpload ? "SKIPPED (source URLs stored)" : "enabled"}`);

  const total = dryRun.totals.products;
  if (total === 0) {
    console.log("\n⚠  No products scraped — nothing to import.");
    writeReport("skipped", "0 products in dry-run output", dryRun, null);
    process.exit(0);
  }

  const withPrices = total - dryRun.totals.missingPrices;
  const quality = withPrices / total;
  const qPct = (quality * 100).toFixed(1);
  console.log(`\n  Quality     : ${qPct}% (${withPrices}/${total} have prices)`);

  if (quality < 0.8) {
    console.error(`\n✗ Quality ${qPct}% < 80% — aborting import.`);
    writeReport("aborted", `Quality score ${qPct}% is below the 80% threshold`, dryRun, null);
    process.exit(1);
  }

  console.log(`\n✓ Quality check passed — proceeding.\n`);

  const result: ImportResult = {
    categoriesInserted: 0,
    productsInserted: 0,
    variantsInserted: 0,
    imageRecordsInserted: 0,
    imagesUploaded: 0,
    imagesFailed: 0,
    productsFailed: 0,
    errors: [],
  };

  // ── 1. Upsert categories ──────────────────────────────────────────────────────────
  console.log(`Importing ${dryRun.categories.length} categories...`);
  for (const cat of dryRun.categories) {
    const { error } = await supabase
      .from("categories")
      .upsert({ name: cat.name, slug: cat.slug }, { onConflict: "slug" });
    if (error) {
      result.errors.push(`category:${cat.slug}: ${error.message}`);
    } else {
      result.categoriesInserted++;
    }
  }
  console.log(`  ✓ ${result.categoriesInserted} categories`);

  const { data: catRows } = await supabase.from("categories").select("id, slug");
  const catMap = new Map<string, string>((catRows ?? []).map((r) => [r.slug, r.id]));

  // ── 2. Products, variants, images ───────────────────────────────────────────────
  console.log(`\nImporting ${dryRun.products.length} products...\n`);

  for (const product of dryRun.products) {
    try {
      const categoryId = catMap.get(product.category_slug) ?? null;

      const { data: productRow, error: pErr } = await supabase
        .from("products")
        .upsert(
          {
            name: product.name,
            slug: product.slug,
            description: product.description,
            price: product.price ?? 0,
            sale_price: product.sale_price,
            category_id: categoryId,
            source_url: product.source_url,
          },
          { onConflict: "slug" }
        )
        .select("id")
        .single();

      if (pErr || !productRow) {
        result.errors.push(`product:${product.slug}: ${pErr?.message ?? "no row returned"}`);
        result.productsFailed++;
        continue;
      }

      result.productsInserted++;
      const pid = productRow.id as string;

      if (product.variants.length > 0) {
        await supabase.from("product_variants").delete().eq("product_id", pid);
        const { error: vErr } = await supabase.from("product_variants").insert(
          product.variants.map((v) => ({
            product_id: pid,
            sku: v.sku,
            shade_name: v.shade_name,
            color_hex: v.color_hex,
            swatch_image_url: v.swatch_image_url,
            stock_qty: v.stock_qty,
          }))
        );
        if (vErr) {
          result.errors.push(`variants:${product.slug}: ${vErr.message}`);
        } else {
          result.variantsInserted += product.variants.length;
        }
      }

      await supabase.from("product_images").delete().eq("product_id", pid);

      const imageRecords: Array<{ product_id: string; url: string; sort_order: number }> = [];

      for (let i = 0; i < product.images.length && i < 5; i++) {
        const imgSrc = product.images[i].url;
        let finalUrl = imgSrc;

        if (!skipUpload) {
          const downloaded = await downloadImage(imgSrc);
          if (downloaded) {
            const ext = extFromContentType(downloaded.contentType);
            const storagePath = `${product.slug}-${i}.${ext}`;
            const stored = await uploadToStorage(downloaded.data, downloaded.contentType, storagePath);
            if (stored) {
              finalUrl = stored;
              result.imagesUploaded++;
            } else {
              result.imagesFailed++;
            }
          } else {
            result.imagesFailed++;
          }
        }

        imageRecords.push({ product_id: pid, url: finalUrl, sort_order: i });
      }

      if (imageRecords.length > 0) {
        const { error: iErr } = await supabase.from("product_images").insert(imageRecords);
        if (iErr) {
          result.errors.push(`images:${product.slug}: ${iErr.message}`);
        } else {
          result.imageRecordsInserted += imageRecords.length;
        }
      }

      process.stdout.write(`  ✓ ${product.name}\n`);
    } catch (err) {
      result.errors.push(`product:${product.slug}: ${err}`);
      result.productsFailed++;
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`  Products inserted  : ${result.productsInserted}`);
  console.log(`  Variants inserted  : ${result.variantsInserted}`);
  console.log(`  Image records      : ${result.imageRecordsInserted}`);
  console.log(`  Images → Storage   : ${result.imagesUploaded}`);
  console.log(`  Image dl failures  : ${result.imagesFailed}`);
  console.log(`  Product failures   : ${result.productsFailed}`);
  console.log(`══════════════════════════════════════\n`);

  writeReport("success", null, dryRun, result);
}

function writeReport(
  status: "success" | "aborted" | "failed" | "skipped",
  reason: string | null,
  dryRun: DryRunReport | null,
  result: ImportResult | null
) {
  const now = new Date().toISOString();
  const lines: string[] = [
    "# Flormar Tunisia — Catalog Import Report",
    "",
    `Generated: ${now}  `,
    `Status: **${status}**  `,
  ];

  if (reason) lines.push(`Reason: ${reason}  `);

  if (dryRun) {
    lines.push(
      "",
      "## Scrape Totals",
      "",
      "| Metric | Count |",
      "|--------|------:|",
      `| Categories | ${dryRun.totals.categories} |`,
      `| Products | ${dryRun.totals.products} |`,
      `| Variants | ${dryRun.totals.variants} |`,
      `| Missing prices | ${dryRun.totals.missingPrices} |`,
      `| Missing images | ${dryRun.totals.missingImages} |`,
      `| Failed pages | ${dryRun.totals.failedPages} |`
    );
  }

  if (result) {
    lines.push(
      "",
      "## Supabase Import",
      "",
      "| Metric | Count |",
      "|--------|------:|",
      `| Categories inserted | ${result.categoriesInserted} |`,
      `| Products inserted | ${result.productsInserted} |`,
      `| Variants inserted | ${result.variantsInserted} |`,
      `| Image records | ${result.imageRecordsInserted} |`,
      `| Images uploaded to Storage | ${result.imagesUploaded} |`,
      `| Image download failures | ${result.imagesFailed} |`,
      `| Product failures | ${result.productsFailed} |`
    );

    if (result.errors.length > 0) {
      lines.push("", "## Errors", "");
      result.errors.slice(0, 100).forEach((e) => lines.push(`- \`${e}\``));
      if (result.errors.length > 100)
        lines.push(`- … and ${result.errors.length - 100} more`);
    }
  }

  if (dryRun?.reviewList?.length) {
    lines.push("", "## Needs Manual Review", "");
    dryRun.reviewList.slice(0, 30).forEach((item) => {
      lines.push(`- **${item.product}** — ${item.reason}`);
    });
    if (dryRun.reviewList.length > 30)
      lines.push(`- … and ${dryRun.reviewList.length - 30} more`);
  }

  const reportPath = path.join(process.cwd(), "IMPORT_REPORT.md");
  fs.writeFileSync(reportPath, lines.join("\n") + "\n", "utf-8");
  console.log(`📄 IMPORT_REPORT.md written (status: ${status})`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
