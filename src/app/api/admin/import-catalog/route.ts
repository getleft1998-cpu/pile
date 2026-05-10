import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export const maxDuration = 60;

interface IncomingVariant {
  shade_name: string;
  color_hex?: string | null;
  swatch_image_url?: string | null;
}

interface IncomingProduct {
  name: string;
  slug?: string;
  category_slug?: string;
  description?: string | null;
  price?: number | null;
  sale_price?: number | null;
  source_url?: string;
  images?: string[];
  variants?: IncomingVariant[];
}

interface ImportPayload {
  products: IncomingProduct[];
  categories?: Array<{ name: string; slug: string }>;
  overwrite?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function downloadAndUpload(
  supabase: ReturnType<typeof createAdminClient>,
  imgUrl: string,
  slug: string,
  idx: number
): Promise<string | null> {
  try {
    const res = await fetch(imgUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/webp";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 500) return null;
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("gif") ? "gif" : "jpg";
    const filePath = `products/${slug}/${Date.now()}-${idx}.${ext}`;
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(filePath, buf, { contentType: ct, upsert: true });
    if (error || !data) return null;
    return supabase.storage.from("product-images").getPublicUrl(data.path).data.publicUrl;
  } catch {
    return null;
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // Auth check — accept cookie OR X-Admin-Token header OR ?token= query param
  const expected = process.env.ADMIN_PASSWORD ?? "flormar2024";
  const cookieToken = req.cookies.get("admin_token")?.value;
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = new URL(req.url).searchParams.get("token");
  const token = cookieToken ?? headerToken ?? queryToken;
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  let payload: ImportPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(payload.products) || payload.products.length === 0) {
    return NextResponse.json({ error: "no products in payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Ensure bucket exists and is public
  await supabase.storage.updateBucket("product-images", { public: true }).catch(() => {
    supabase.storage.createBucket("product-images", { public: true });
  });

  // Upsert categories
  const catMap = new Map<string, string>();
  if (payload.categories?.length) {
    for (const cat of payload.categories) {
      const { data } = await supabase
        .from("categories")
        .upsert({ name: cat.name, slug: cat.slug }, { onConflict: "slug" })
        .select("id")
        .single();
      if (data?.id) catMap.set(cat.slug, data.id as string);
    }
  }
  // Fetch all existing categories
  const { data: existingCats } = await supabase.from("categories").select("id, slug");
  for (const c of existingCats ?? []) catMap.set(c.slug as string, c.id as string);

  let productsInserted = 0;
  let variantsInserted = 0;
  let imagesInserted = 0;
  let imagesFailed = 0;
  const errors: string[] = [];

  for (const product of payload.products) {
    try {
      const name = product.name?.trim();
      if (!name) continue;
      const slug = product.slug ?? slugify(name);
      const catId = product.category_slug ? (catMap.get(product.category_slug) ?? null) : null;

      const { data: productRow, error: pErr } = await supabase
        .from("products")
        .upsert(
          {
            name,
            slug,
            description: product.description ?? null,
            price: product.price ?? 0,
            sale_price: product.sale_price ?? null,
            category_id: catId,
            source_url: product.source_url ?? null,
          },
          { onConflict: "slug" }
        )
        .select("id")
        .single();

      if (pErr || !productRow) {
        errors.push(`product:${slug}: ${pErr?.message ?? "no row"}`);
        continue;
      }

      productsInserted++;
      const pid = productRow.id as string;

      // Variants
      const variants = product.variants ?? [];
      if (variants.length > 0) {
        await supabase.from("product_variants").delete().eq("product_id", pid);
        const { error: vErr } = await supabase.from("product_variants").insert(
          variants.map((v) => ({
            product_id: pid,
            shade_name: v.shade_name,
            color_hex: v.color_hex ?? null,
            swatch_image_url: v.swatch_image_url ?? null,
            stock_qty: 99,
          }))
        );
        if (!vErr) variantsInserted += variants.length;
        else errors.push(`variants:${slug}: ${vErr.message}`);
      }

      // Images
      if (payload.overwrite) {
        await supabase.from("product_images").delete().eq("product_id", pid);
      } else {
        const { count } = await supabase
          .from("product_images")
          .select("*", { count: "exact", head: true })
          .eq("product_id", pid);
        if ((count ?? 0) > 0) continue; // skip — already has images
      }

      const imageUrls = (product.images ?? []).slice(0, 5);
      const imageRecords: Array<{ product_id: string; url: string; sort_order: number }> = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const stored = await downloadAndUpload(supabase, imageUrls[i], slug, i);
        if (stored) {
          imageRecords.push({ product_id: pid, url: stored, sort_order: i });
        } else {
          // Store original URL as fallback
          imageRecords.push({ product_id: pid, url: imageUrls[i], sort_order: i });
          imagesFailed++;
        }
      }

      if (imageRecords.length > 0) {
        const { error: iErr } = await supabase.from("product_images").insert(imageRecords);
        if (!iErr) imagesInserted += imageRecords.length;
        else errors.push(`images:${slug}: ${iErr.message}`);
      }
    } catch (err) {
      errors.push(`${product.name}: ${err}`);
    }
  }

  return NextResponse.json(
    { ok: true, productsInserted, variantsInserted, imagesInserted, imagesFailed, errors: errors.slice(0, 20) },
    { headers: CORS_HEADERS }
  );
}
