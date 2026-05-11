import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export const maxDuration = 60;

const BUCKET = "product-images";

async function downloadAndUpload(
  supabase: ReturnType<typeof createAdminClient>,
  url: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        "Referer": "https://flormar.com/",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 2_000) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: ct, upsert: true });
    if (error || !data) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
  } catch {
    return null;
  }
}

async function scrapeOgImage(siteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(siteUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const url = m?.[1];
    return url?.startsWith("http") ? url : null;
  } catch {
    return null;
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
  const { error: updErr } = await supabase.storage.updateBucket(BUCKET, { public: true });
  if (updErr) await supabase.storage.createBucket(BUCKET, { public: true });

  const categoryImages: Record<string, string | null> = {};
  const uploaded: string[] = [];

  // ── Category images ────────────────────────────────────────────────────────
  const { data: cats } = await supabase.from("categories").select("id, name, slug");

  for (const cat of cats ?? []) {
    const { data: prods } = await supabase
      .from("products")
      .select("id")
      .eq("category_id", cat.id)
      .limit(10);

    if (!prods?.length) {
      categoryImages[cat.slug as string] = null;
      continue;
    }

    const ids = prods.map((p) => p.id as string);
    const { data: img } = await supabase
      .from("product_images")
      .select("url")
      .in("product_id", ids)
      .order("sort_order")
      .limit(1)
      .single();

    const imageUrl = (img?.url as string) ?? null;
    if (imageUrl) {
      await supabase.from("categories").update({ image_url: imageUrl }).eq("id", cat.id);
      uploaded.push(`category:${cat.slug}`);
    }
    categoryImages[cat.slug as string] = imageUrl;
  }

  // ── Banner / hero image ────────────────────────────────────────────
  let bannerUrl: string | null = null;

  for (const site of [
    "https://flormar.tn/",
    "https://www.flormar.com.tr/",
    "https://flormar.com/",
  ]) {
    const ogUrl = await scrapeOgImage(site);
    if (!ogUrl) continue;
    bannerUrl = await downloadAndUpload(supabase, ogUrl, "banners/hero.jpg");
    if (bannerUrl) {
      uploaded.push("banner:hero");
      break;
    }
  }

  // Fallback: use first available category image as banner
  if (!bannerUrl) {
    const firstImg = Object.values(categoryImages).find(Boolean) as string | undefined;
    if (firstImg) {
      bannerUrl = await downloadAndUpload(supabase, firstImg, "banners/hero.jpg");
      if (bannerUrl) uploaded.push("banner:hero (fallback from category)");
    }
  }

  return NextResponse.json({
    ok: true,
    bannerUrl,
    categoryImages,
    uploaded,
    note: bannerUrl
      ? "All images seeded. Deploy is not needed — category image_url updated in DB."
      : "Category images seeded but banner fetch failed. Check flormar.tn connectivity from Vercel.",
  });
}
