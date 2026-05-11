import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";
// Statically imported so Vercel bundles it with the function
import catalog from "../../../../../scripts/dry-run.json";

export const maxDuration = 300;

const BUCKET = "product-images";

async function storeImage(
  supabase: ReturnType<typeof createAdminClient>,
  cdnUrl: string,
  slug: string,
  idx: number
): Promise<string> {
  try {
    const res = await fetch(cdnUrl, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://flormar.tn/" },
    });
    if (!res.ok) return cdnUrl;
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/webp";
    if (!ct.startsWith("image/")) return cdnUrl;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 500) return cdnUrl;
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("gif") ? "gif" : "jpg";
    const filePath = `products/${slug}/${Date.now()}-${idx}.${ext}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buf, { contentType: ct, upsert: true });
    if (error || !data) return cdnUrl;
    return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
  } catch {
    return cdnUrl;
  }
}

export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD ?? "flormar2024";
  const token =
    req.cookies.get("admin_token")?.value ??
    req.headers.get("x-admin-token") ??
    new URL(req.url).searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { categories, products } = catalog;

  // Ensure storage bucket is public
  const { error: updErr } = await supabase.storage.updateBucket(BUCKET, { public: true });
  if (updErr) await supabase.storage.createBucket(BUCKET, { public: true });

  // Upsert categories and build slug→id map
  const catMap = new Map<string, string>();
  for (const cat of categories) {
    const { data } = await supabase
      .from("categories")
      .upsert({ name: cat.name, slug: cat.slug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (data?.id) catMap.set(cat.slug, data.id as string);
  }
  const { data: allCats } = await supabase.from("categories").select("id, slug");
  for (const c of allCats ?? []) catMap.set(c.slug as string, c.id as string);

  // Collect slugs and source_urls that already exist to detect duplicates
  const { data: existing } = await supabase
    .from("products")
    .select("slug, source_url");
  const existingSlugs = new Set((existing ?? []).map((r) => r.slug as string));
  const existingSourceUrls = new Set(
    (existing ?? []).filter((r) => r.source_url).map((r) => r.source_url as string)
  );

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of products) {
    // Skip if product already exists by slug or source_url
    if (existingSlugs.has(product.slug) || (product.source_url && existingSourceUrls.has(product.source_url))) {
      skipped++;
      continue;
    }

    try {
      const catId = (product as { category_slug?: string }).category_slug
        ? (catMap.get((product as { category_slug?: string }).category_slug!) ?? null)
        : null;

      const { data: pRow, error: pErr } = await supabase
        .from("products")
        .insert({
          name: product.name,
          slug: product.slug,
          description: product.description ?? null,
          price: product.price ?? 0,
          sale_price: product.sale_price ?? null,
          category_id: catId,
          source_url: product.source_url ?? null,
        })
        .select("id")
        .single();

      if (pErr || !pRow) {
        errors.push(`${product.slug}: ${pErr?.message ?? "insert failed"}`);
        failed++;
        continue;
      }

      imported++;
      const pid = pRow.id as string;

      // Variants
      const variants = (product as { variants?: Array<{ shade_name: string; sku?: string | null; color_hex?: string | null; swatch_image_url?: string | null }> }).variants ?? [];
      if (variants.length > 0) {
        await supabase.from("product_variants").insert(
          variants.map((v) => ({
            product_id: pid,
            shade_name: v.shade_name,
            sku: v.sku ?? null,
            color_hex: v.color_hex ?? null,
            swatch_image_url: v.swatch_image_url ?? null,
            stock_qty: 99,
          }))
        );
      }

      // Images — parallel download+upload, fall back to CDN URL on failure
      const imageUrls = ((product as { images?: string[] }).images ?? []).slice(0, 5);
      if (imageUrls.length > 0) {
        const storedUrls = await Promise.all(
          imageUrls.map((url, idx) => storeImage(supabase, url, product.slug, idx))
        );
        await supabase.from("product_images").insert(
          storedUrls.map((url, sort_order) => ({ product_id: pid, url, sort_order }))
        );
      }
    } catch (err) {
      errors.push(`${product.slug}: ${String(err)}`);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: products.length,
    imported,
    skipped,
    failed,
    errors: errors.slice(0, 50),
  });
}
