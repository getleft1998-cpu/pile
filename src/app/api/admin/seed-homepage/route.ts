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
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Referer": "https://flormar.com/",
        "Accept": "image/*,*/*",
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

const HERO_IMAGES = [
  {
    url: "https://www.flormar.com/wp-content/uploads/2026/03/1920x810-px-eng.jpg",
    path: "banners/hero1.jpg",
    key: "hero1",
  },
  {
    url: "https://www.flormar.com/wp-content/uploads/2026/01/1920x810-px-eng-1.jpg",
    path: "banners/hero2.jpg",
    key: "hero2",
  },
];

const CATEGORY_IMAGES: Array<{ url: string; path: string; slug: string }> = [
  {
    url: "https://www.flormar.com/wp-content/uploads/2025/11/face-600x500-1.jpg",
    path: "categories/face.jpg",
    slug: "face",
  },
  {
    url: "https://www.flormar.com/wp-content/uploads/2025/11/eye-600x500-1.jpg",
    path: "categories/eyes.jpg",
    slug: "eyes",
  },
  {
    url: "https://www.flormar.com/wp-content/uploads/2025/11/lipstick-600x500-1.jpg",
    path: "categories/lips.jpg",
    slug: "lips",
  },
  {
    url: "https://www.flormar.com/wp-content/uploads/2025/11/nail-600x500-1.jpg",
    path: "categories/nails.jpg",
    slug: "nails",
  },
  {
    url: "https://www.flormar.com/wp-content/uploads/2025/11/skincare.jpg",
    path: "categories/skincare.jpg",
    slug: "skincare",
  },
  {
    url: "https://www.flormar.com/wp-content/uploads/2025/11/accesories.jpg",
    path: "categories/accessories.jpg",
    slug: "accessories",
  },
];

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

  const uploaded: string[] = [];
  const failed: string[] = [];

  // Upload hero images
  const heroUrls: Record<string, string | null> = {};
  for (const hero of HERO_IMAGES) {
    const publicUrl = await downloadAndUpload(supabase, hero.url, hero.path);
    heroUrls[hero.key] = publicUrl;
    if (publicUrl) {
      uploaded.push(hero.path);
    } else {
      failed.push(hero.path);
    }
  }

  // Upload category images and update DB
  const categoryResults: Record<string, string | null> = {};
  for (const cat of CATEGORY_IMAGES) {
    const publicUrl = await downloadAndUpload(supabase, cat.url, cat.path);
    categoryResults[cat.slug] = publicUrl;
    if (publicUrl) {
      uploaded.push(cat.path);
      await supabase
        .from("categories")
        .update({ image_url: publicUrl })
        .eq("slug", cat.slug);
    } else {
      failed.push(cat.path);
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    uploaded,
    failed,
    heroUrls,
    categoryResults,
    note: failed.length === 0
      ? "All images seeded successfully."
      : `${failed.length} images failed to download from flormar.com. Check Vercel connectivity.`,
  });
}
