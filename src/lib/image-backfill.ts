import { createAdminClient } from "@/src/lib/supabase";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_IMAGES = 5;

export interface BackfillResult {
  product_id: string;
  slug: string;
  status: "ok" | "skipped" | "no_source" | "no_images" | "error";
  message?: string;
  imagesAdded: number;
  imagesFailed: number;
  candidates: number;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en,fr;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function resolveUrl(href: string, base: string): string | null {
  try {
    if (href.startsWith("//")) return "https:" + href;
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function looksLikeProductImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(lower)) return false;
  if (/(logo|sprite|icon|favicon|placeholder|thumb-cart|cookie|loader|spinner|swatch)/i.test(lower))
    return false;
  return true;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function extractImageUrls(html: string, baseUrl: string): string[] {
  const candidates = new Set<string>();

  // 1) JSON-LD blocks (Product schema usually has `image` array or string)
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRegex.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const blocks = Array.isArray(parsed) ? parsed : [parsed];
      for (const b of blocks) collectImagesFromLd(b, candidates);
    } catch {
      try {
        const cleaned = decodeHtmlEntities(raw).replace(/,\s*([}\]])/g, "$1");
        const parsed = JSON.parse(cleaned);
        const blocks = Array.isArray(parsed) ? parsed : [parsed];
        for (const b of blocks) collectImagesFromLd(b, candidates);
      } catch {
        // Ignore unparseable LD block
      }
    }
  }

  // 2) Open Graph + Twitter image meta tags
  const metaRegex =
    /<meta[^>]+(?:property|name)=["'](og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  while ((m = metaRegex.exec(html)) !== null) {
    const resolved = resolveUrl(decodeHtmlEntities(m[2]), baseUrl);
    if (resolved) candidates.add(resolved);
  }

  // 3) Common data attributes for product galleries (Shopify/Magento/Prestashop)
  const dataAttrRegex =
    /\b(?:data-zoom-image|data-large-image|data-large_image|data-image|data-src-large|data-original)=["']([^"']+\.(?:jpe?g|png|webp|avif)[^"']*)["']/gi;
  while ((m = dataAttrRegex.exec(html)) !== null) {
    const resolved = resolveUrl(decodeHtmlEntities(m[1]), baseUrl);
    if (resolved) candidates.add(resolved);
  }

  // 4) Bare <img src> as a last resort
  const imgRegex = /<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp|avif)[^"']*)["'][^>]*>/gi;
  while ((m = imgRegex.exec(html)) !== null) {
    const resolved = resolveUrl(decodeHtmlEntities(m[1]), baseUrl);
    if (resolved) candidates.add(resolved);
  }

  const filtered = [...candidates].filter(looksLikeProductImage);
  const ranked = filtered.sort((a, b) => {
    const score = (u: string) =>
      (/product|catalog|media|cdn/i.test(u) ? 1 : 0) +
      (/_(?:small|thumb|tiny|mini)\b/i.test(u) ? -1 : 0);
    return score(b) - score(a);
  });

  return ranked.slice(0, MAX_IMAGES);
}

function collectImagesFromLd(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const img = obj.image;
  if (typeof img === "string") out.add(img);
  else if (Array.isArray(img)) {
    for (const v of img) {
      if (typeof v === "string") out.add(v);
      else if (v && typeof v === "object") {
        const url = (v as Record<string, unknown>).url;
        if (typeof url === "string") out.add(url);
      }
    }
  } else if (img && typeof img === "object") {
    const url = (img as Record<string, unknown>).url;
    if (typeof url === "string") out.add(url);
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) for (const x of v) collectImagesFromLd(x, out);
    else if (v && typeof v === "object") collectImagesFromLd(v, out);
  }
}

async function downloadImage(
  url: string
): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: { "User-Agent": UA, Referer: new URL(url).origin },
    });
    if (!res.ok) return null;
    const ct =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    return { data: buf, contentType: ct };
  } catch {
    return null;
  }
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("avif")) return "avif";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

export async function ensureBucketPublic(): Promise<void> {
  const supabase = createAdminClient();
  // Idempotent: try to update first; if bucket doesn't exist, create it.
  const { error: updErr } = await supabase.storage.updateBucket(
    "product-images",
    { public: true }
  );
  if (updErr) {
    // Likely "Bucket not found" — try to create it as public.
    await supabase.storage.createBucket("product-images", { public: true });
  }
}

export async function backfillProductImages(
  productId: string,
  opts: { overwrite?: boolean } = {}
): Promise<BackfillResult> {
  const supabase = createAdminClient();
  await ensureBucketPublic();

  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, slug, name, source_url")
    .eq("id", productId)
    .maybeSingle();

  if (pErr || !product) {
    return {
      product_id: productId,
      slug: "",
      status: "error",
      message: pErr?.message ?? "product not found",
      imagesAdded: 0,
      imagesFailed: 0,
      candidates: 0,
    };
  }

  const slug = product.slug as string;

  if (!opts.overwrite) {
    const { count } = await supabase
      .from("product_images")
      .select("*", { count: "exact", head: true })
      .eq("product_id", productId);
    if ((count ?? 0) > 0) {
      return {
        product_id: productId,
        slug,
        status: "skipped",
        message: "already has images",
        imagesAdded: 0,
        imagesFailed: 0,
        candidates: 0,
      };
    }
  }

  const sourceUrl = product.source_url as string | null;
  if (!sourceUrl) {
    return {
      product_id: productId,
      slug,
      status: "no_source",
      message: "product has no source_url",
      imagesAdded: 0,
      imagesFailed: 0,
      candidates: 0,
    };
  }

  const html = await fetchHtml(sourceUrl);
  if (!html) {
    return {
      product_id: productId,
      slug,
      status: "error",
      message: "failed to fetch source_url",
      imagesAdded: 0,
      imagesFailed: 0,
      candidates: 0,
    };
  }

  const urls = extractImageUrls(html, sourceUrl);
  if (urls.length === 0) {
    return {
      product_id: productId,
      slug,
      status: "no_images",
      message: "no product images found in HTML",
      imagesAdded: 0,
      imagesFailed: 0,
      candidates: 0,
    };
  }

  if (opts.overwrite) {
    await supabase.from("product_images").delete().eq("product_id", productId);
  }

  const inserted: { product_id: string; url: string; sort_order: number }[] = [];
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const src = urls[i];
    const dl = await downloadImage(src);
    if (!dl) {
      failed++;
      continue;
    }
    const ext = extFromContentType(dl.contentType);
    const filePath = `products/${slug}/${Date.now()}-${i}.${ext}`;
    const { data: up, error: upErr } = await supabase.storage
      .from("product-images")
      .upload(filePath, dl.data, {
        contentType: dl.contentType,
        upsert: true,
      });
    if (upErr || !up) {
      failed++;
      continue;
    }
    const publicUrl = supabase.storage
      .from("product-images")
      .getPublicUrl(up.path).data.publicUrl;
    inserted.push({
      product_id: productId,
      url: publicUrl,
      sort_order: inserted.length,
    });
  }

  if (inserted.length > 0) {
    const { error: insErr } = await supabase
      .from("product_images")
      .insert(inserted);
    if (insErr) {
      return {
        product_id: productId,
        slug,
        status: "error",
        message: `db insert failed: ${insErr.message}`,
        imagesAdded: 0,
        imagesFailed: failed,
        candidates: urls.length,
      };
    }
  }

  return {
    product_id: productId,
    slug,
    status: inserted.length > 0 ? "ok" : "no_images",
    imagesAdded: inserted.length,
    imagesFailed: failed,
    candidates: urls.length,
  };
}
