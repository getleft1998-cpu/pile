import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchHead(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xml", "Accept-Language": "en,fr;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
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
      { name: "home", url: "https://www.flormar.com/" },
      { name: "wp_search", url: `https://www.flormar.com/?s=${encodeURIComponent(q)}` },
      { name: "sitemap_index", url: "https://www.flormar.com/sitemap_index.xml" },
      { name: "sitemap", url: "https://www.flormar.com/sitemap.xml" },
      { name: "product_sitemap", url: "https://www.flormar.com/product-sitemap.xml" },
      { name: "page_sitemap", url: "https://www.flormar.com/page-sitemap.xml" },
    ];
    const results = await Promise.all(
      targets.map((t) => fetchHead(t.url).then((r) => ({ name: t.name, url: t.url, ...(r as object) })))
    );
    const trim = <T>(r: T): T => {
      if (!r || typeof r !== "object") return r;
      const { html: _h, ...rest } = r as { html?: string } & Record<string, unknown>;
      return rest as T;
    };
    // Surface up to 25 anchors that point to flormar.com pages
    const findFlormarLinks = (html: string | undefined) => {
      if (!html) return [];
      const anchors = [
        ...[...html.matchAll(/href=["']([^"']*flormar\.com[^"']*)["']/gi)].map((m) => m[1]),
        ...[...html.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]),
      ];
      return [...new Set(anchors)].slice(0, 25);
    };
    return NextResponse.json(
      results.map((r) => ({
        ...trim(r),
        flormarLinks: findFlormarLinks((r as { html?: string }).html),
      }))
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

  return NextResponse.json({
    product,
    httpStatus,
    htmlLength: html.length,
    title: titleMatch?.[1]?.trim() ?? null,
    ogImage,
  });
}
