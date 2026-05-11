import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export const maxDuration = 60;

interface ProbedShade {
  code: string;
  label?: string;
  image_url?: string;
  color_hex?: string;
  price?: number;
  in_stock?: boolean;
  product_url?: string;
}

interface ProductProbe {
  product_id: string;
  product_name: string;
  product_slug: string;
  source_url: string | null;
  attempted_urls: string[];
  fetched_url: string | null;
  status: "found" | "no-shades" | "fetch-failed" | "no-source";
  strategy: string | null;
  shades_found: number;
  shades_sample: ProbedShade[];
  error?: string;
}

const FAKE_SHADES = new Set([
  "standard", "couleur", "color", "default", "taille unique", "unique", "n/a", "",
]);

function isRealShade(name: string): boolean {
  return !FAKE_SHADES.has((name ?? "").toLowerCase().trim());
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchPage(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605 (KHTML, like Gecko) Version/17 Safari/605",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractWooVariations(html: string): ProbedShade[] {
  const match = html.match(/data-product_variations=(['"])([^'"]+)\1/);
  if (!match) return [];
  try {
    const json = decodeHtmlEntities(match[2]);
    const variations = JSON.parse(json);
    if (!Array.isArray(variations)) return [];
    const shades: ProbedShade[] = [];
    for (const v of variations) {
      const attrs = v.attributes ?? {};
      const code =
        attrs.attribute_pa_couleur ??
        attrs.attribute_couleur ??
        attrs.attribute_pa_color ??
        attrs.attribute_color ??
        attrs.attribute_pa_teinte ??
        Object.values(attrs)[0];
      if (!code || typeof code !== "string") continue;
      shades.push({
        code: String(code).trim(),
        label: v.variation_description ?? undefined,
        image_url: v.image?.src ?? v.image?.full_src ?? undefined,
        price: v.display_price ?? v.price ?? undefined,
        in_stock: v.is_in_stock ?? undefined,
      });
    }
    return shades;
  } catch {
    return [];
  }
}

function extractJsonLd(html: string): ProbedShade[] {
  const matches = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  for (const m of matches) {
    try {
      const obj = JSON.parse(m[1]);
      const items = Array.isArray(obj) ? obj : [obj];
      for (const item of items) {
        if (item["@type"] !== "Product") continue;
        const offers = Array.isArray(item.offers) ? item.offers : [];
        if (offers.length <= 1) continue;
        const shades: ProbedShade[] = [];
        for (const offer of offers) {
          const code =
            offer.name ??
            offer.sku ??
            offer.color ??
            offer.itemOffered?.name;
          if (!code) continue;
          shades.push({
            code: String(code).trim(),
            image_url: offer.image ?? undefined,
            price: typeof offer.price === "number" ? offer.price : parseFloat(offer.price ?? "0") || undefined,
            in_stock: offer.availability?.includes("InStock"),
            product_url: offer.url ?? undefined,
          });
        }
        if (shades.length > 0) return shades;
      }
    } catch {
      // continue
    }
  }
  return [];
}

function extractFrameworkState(html: string): ProbedShade[] {
  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const variants = findVariantArray(data);
      if (variants && variants.length > 1) return mapAnyVariants(variants);
    } catch {}
  }
  return [];
}

function findVariantArray(obj: unknown): unknown[] | null {
  if (!obj || typeof obj !== "object") return null;
  const seen = new WeakSet<object>();
  const stack: unknown[] = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur as object)) continue;
    seen.add(cur as object);
    const rec = cur as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key === "variants" || key === "variations" || key === "shades" || key === "colors") {
        const v = rec[key];
        if (Array.isArray(v) && v.length > 1) return v;
      }
      if (typeof rec[key] === "object") stack.push(rec[key]);
    }
  }
  return null;
}

function mapAnyVariants(arr: unknown[]): ProbedShade[] {
  return arr
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      const code =
        (o.shade_name as string) ??
        (o.color as string) ??
        (o.name as string) ??
        (o.sku as string) ??
        (o.code as string) ??
        (o.label as string);
      if (!code) return null;
      return {
        code: String(code).trim(),
        image_url:
          ((o.image as Record<string, string> | undefined)?.src) ??
          (o.image_url as string) ??
          (o.image as string),
        color_hex: (o.color_hex as string) ?? (o.hex as string),
        price: typeof o.price === "number" ? (o.price as number) : undefined,
      } as ProbedShade;
    })
    .filter((x): x is ProbedShade => x !== null);
}

async function probeProduct(p: {
  id: string;
  name: string;
  slug: string;
  source_url: string | null;
}): Promise<ProductProbe> {
  const candidates = new Set<string>();
  if (p.source_url) candidates.add(p.source_url);
  candidates.add(`https://flormar.tn/produit/${p.slug}`);
  candidates.add(`https://flormar.tn/product/${p.slug}`);
  candidates.add(`https://www.flormar.com/product/${p.slug}/`);
  candidates.add(`https://www.flormar.com/${p.slug}/`);

  const attempted = [...candidates];
  const base: ProductProbe = {
    product_id: p.id,
    product_name: p.name,
    product_slug: p.slug,
    source_url: p.source_url,
    attempted_urls: attempted,
    fetched_url: null,
    status: "no-source",
    strategy: null,
    shades_found: 0,
    shades_sample: [],
  };

  for (const url of attempted) {
    const html = await fetchPage(url);
    if (!html) continue;
    base.fetched_url = url;

    const strategies: Array<[string, (h: string) => ProbedShade[]]> = [
      ["woocommerce_variations_form", extractWooVariations],
      ["json_ld_product_offers", extractJsonLd],
      ["framework_state", extractFrameworkState],
    ];

    for (const [name, fn] of strategies) {
      const shades = fn(html).filter((s) => isRealShade(s.code));
      if (shades.length > 1) {
        base.status = "found";
        base.strategy = name;
        base.shades_found = shades.length;
        base.shades_sample = shades.slice(0, 6);
        return base;
      }
    }

    base.status = "no-shades";
    return base;
  }

  base.status = "fetch-failed";
  return base;
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

  const params = new URL(req.url).searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 8), 25);
  const slugFilter = params.get("slug");

  const supabase = createAdminClient();
  let query = supabase
    .from("products")
    .select("id, name, slug, source_url")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (slugFilter) query = query.eq("slug", slugFilter);
  const { data: products, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!products || products.length === 0) {
    return NextResponse.json({ error: "no products to probe" }, { status: 404 });
  }

  const probes: ProductProbe[] = [];
  for (const p of products) {
    const probe = await probeProduct({
      id: p.id as string,
      name: p.name as string,
      slug: p.slug as string,
      source_url: (p.source_url as string | null) ?? null,
    });
    probes.push(probe);
  }

  const summary = {
    products_checked: probes.length,
    products_with_shades_found: probes.filter((p) => p.status === "found").length,
    products_no_shades: probes.filter((p) => p.status === "no-shades").length,
    products_fetch_failed: probes.filter((p) => p.status === "fetch-failed").length,
    strategies_used: Array.from(new Set(probes.map((p) => p.strategy).filter(Boolean))),
  };

  return NextResponse.json({
    ok: true,
    mode: "dry-run",
    schema_proposal: {
      message: "If real shade data is found, store as follows:",
      product_variants: {
        shade_name: "The shade code (e.g. '001', '015')",
        color_hex: "Optional hex color (#abcdef) for swatch fallback",
        swatch_image_url: "REUSED as the shade-specific MAIN product image (full size). On selection, the product page swaps to this image.",
        stock_qty: "From in_stock probe (99 if unknown)",
      },
      no_schema_change_needed: "swatch_image_url already serves dual purpose: swatch + main image.",
    },
    summary,
    probes,
  });
}
