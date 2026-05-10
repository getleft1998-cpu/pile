import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export async function GET() {
  const admin = createAdminClient();

  // Step 1: orders + items (no nested joins)
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("*, order_items(id, quantity, price, variant_id, product_id)")
    .order("created_at", { ascending: false });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }
  if (!orders || orders.length === 0) {
    return NextResponse.json([]);
  }

  type Item = { variant_id: string | null; product_id: string | null; [key: string]: unknown };

  const allItems: Item[] = orders.flatMap((o) => o.order_items ?? []);
  const variantIds = [...new Set(allItems.map((i) => i.variant_id).filter(Boolean))] as string[];
  const productIds = [...new Set(allItems.map((i) => i.product_id).filter(Boolean))] as string[];

  // Step 2: variants flat (no join to products)
  let variantMap: Record<string, { id: string; shade_name: string; color_hex: string | null; sku: string | null; product_id: string | null }> = {};
  if (variantIds.length > 0) {
    const { data: variants } = await admin
      .from("product_variants")
      .select("id, shade_name, color_hex, sku, product_id")
      .in("id", variantIds);
    if (variants) {
      variantMap = Object.fromEntries(variants.map((v) => [v.id, v]));
    }
  }

  // Step 3: products flat
  let productMap: Record<string, { id: string; name: string; slug: string }> = {};
  if (productIds.length > 0) {
    const { data: products } = await admin
      .from("products")
      .select("id, name, slug")
      .in("id", productIds);
    if (products) {
      productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    }
  }

  // Step 4: merge everything in JS
  const enriched = orders.map((order) => ({
    ...order,
    order_items: (order.order_items ?? []).map((item: Item) => {
      const variant = item.variant_id ? (variantMap[item.variant_id] ?? null) : null;
      const resolvedProductId = variant?.product_id ?? item.product_id;
      const product = resolvedProductId ? (productMap[resolvedProductId] ?? null) : null;
      return {
        ...item,
        product_variants: variant ? { ...variant, products: product } : null,
      };
    }),
  }));

  return NextResponse.json(enriched);
}
