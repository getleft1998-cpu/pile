import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchHead(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en,fr;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    return { status: res.status, finalUrl: res.url, htmlLength: html.length, sample: html.slice(0, 800), html };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe");
  if (probe) {
    const q = url.searchParams.get("q") ?? "lipstick";
    const targets = [
      { name: "rss_search", url: `https://www.flormar.com/search/${encodeURIComponent(q)}/feed/rss2/` },
      { name: "wc_api", url: `https://www.flormar.com/wp-json/wc/v3/products?search=${encodeURIComponent(q)}&per_page=5` },
      { name: "blush_category", url: "https://www.flormar.com/blush/" },
      { name: "lipstick_category", url: `https://www.flormar.com/${encodeURIComponent(q)}/` },
      { name: "wp_search", url: `https://www.flormar.com/?s=${encodeURIComponent(q)}` },
    ];

    // Sequential to avoid 429 rate limits
    const results: Record<string, unknown>[] = [];
    for (const t of targets) {
      const r = await fetchHead(t.url);
      results.push({ name: t.name, url: t.url, ...(r as object) });
    }

    const trim = <T>(r: T): T => {
      if (!r || typeof r !== "object") return r;
      const { html: _h, ...rest } = r as { html?: string } & Record<string, unknown>;
      return rest as T;
    };

    const findProductLinks = (html: string | undefined) => {
      if (!html) return [];
      const anchors = [...html.matchAll(/href=["']([^"']*flormar\.com\/[^"'?#]+)["']/gi)].map((m) => m[1]);
      const unique = [...new Set(anchors)];
      return unique.filter((u) => {
        if (/\.(css|js|xml|png|jpg|webp|svg|ico|gif|woff|ttf|woff2|eot)(\?|$)/i.test(u)) return false;
        if (/(wp-content|wp-includes|wp-json|wp-admin|xmlrpc|\/feed|rss2?)/i.test(u)) return false;
        return true;
      }).slice(0, 40);
    };

    const findRssLinks = (html: string | undefined) => {
      if (!html) return {};
      const links = [...html.matchAll(/<link>(https?:\/\/[^<]+)<\/link>/gi)].map((m) => m[1].trim());
      const titles = [...html.matchAll(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/gi)].map((m) => m[1].trim());
      const imgs = [...html.matchAll(/<enclosure[^>]+url=["']([^"']+)["']/gi)].map((m) => m[1]);
      return { links: [...new Set(links)], titles: titles.slice(0, 20), imgs: imgs.slice(0, 20) };
    };

    return NextResponse.json(
      results.map((r) => {
        const html = (r as { html?: string }).html;
        const isRss = (r as { url?: string }).url?.includes("rss2") ?? false;
        return {
          ...trim(r),
          productLinks: isRss ? undefined : findProductLinks(html),
          rss: isRss ? findRssLinks(html) : undefined,
          bodySample: html ? html.slice(html.indexOf("<body"), html.indexOf("<body") + 3000).replace(/\s+/g, " ") : null,
        };
      })
    );
  }

  const slug = url.searchParams.get("slug");
  const admin = createAdminClient();

  let pq = admin.from("products").select("id, name, slug, source_url, product_variants(id, shade_name, color_hex)");
  if (slug) pq = pq.eq("slug", slug);
  pq = pq.limit(1);
  const { data: rows, error } = await pq;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const product = rows?.[0];
  if (!product) return NextResponse.json({ error: "no product" }, { status: 404 });

  const sourceUrl = product.source_url as string | null;
  if (!sourceUrl) return NextResponse.json({ product, html: null, error: "no source_url" });

  let html: string | null = null;
  let httpStatus: number | null = null;
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "fr,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    httpStatus = res.status;
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ product, error: `fetch failed: ${e}` });
  }

  if (!html) return NextResponse.json({ product, httpStatus });

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const ogImage = [...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/gi)].map((m) => m[1]);
  const ogImageSecure = [...html.matchAll(/<meta[^>]+property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/gi)].map((m) => m[1]);
  const twitterImage = [...html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/gi)].map((m) => m[1]);

  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const ldBlocks: unknown[] = [];
  let m: RegExpExecArray | null;
  while ((m = ldRegex.exec(html)) !== null) {
    try {
      ldBlocks.push(JSON.parse(m[1].trim()));
    } catch {
      ldBlocks.push({ _parseError: m[1].slice(0, 200) });
    }
  }

  const imgUrls: { src: string; context: string }[] = [];
  const imgRegex =
    /<img\b[^>]*?\b(?:src|data-src|data-original|data-large_image|data-zoom-image|data-hires)=["']([^"']+\.(?:jpe?g|png|webp|avif)[^"']*)["']/gi;
  while ((m = imgRegex.exec(html)) !== null) {
    const start = Math.max(0, m.index - 200);
    const ctx = html.slice(start, m.index + m[0].length);
    imgUrls.push({ src: m[1], context: ctx.replace(/\s+/g, " ").slice(-300) });
    if (imgUrls.length >= 30) break;
  }

  const galleryJs =
    [...html.matchAll(/data-gallery-role=["']gallery-placeholder["'][\s\S]{0,2000}?<\/div>/gi)].map((g) => g[0].slice(0, 1500))[0] ?? null;

  const swatchOptions =
    [...html.matchAll(/jsonConfig\s*:\s*(\{[\s\S]*?\})\s*,\s*[}"]/gi)].map((g) => g[1].slice(0, 500))[0] ?? null;

  return NextResponse.json({
    product,
    httpStatus,
    htmlLength: html.length,
    title: titleMatch?.[1]?.trim() ?? null,
    ogImage,
    ogImageSecure,
    twitterImage,
    ldBlockCount: ldBlocks.length,
    ldBlocks,
    imgCount: imgUrls.length,
    imgUrls: imgUrls.slice(0, 20),
    galleryJsSnippet: galleryJs,
    swatchOptionsSnippet: swatchOptions,
  });
}
