import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export async function GET() {
  const admin = createAdminClient();

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

  const variantIds: string[] = [
    ...new Set(
      orders
        .flatMap((o) => (o.order_items ?? []).map((i: { variant_id: string | null }) => i.variant_id))
        .filter(Boolean) as string[]
    ),
  ];

  let variantMap: Record<string, { id: string; shade_name: string; color_hex: string | null; sku: string | null; products: { name: string; slug: string } | null }> = {};

  if (variantIds.length > 0) {
    const { data: variants } = await admin
      .from("product_variants")
      .select("id, shade_name, color_hex, sku, products(name, slug)")
      .in("id", variantIds);

    if (variants) {
      variantMap = Object.fromEntries(variants.map((v) => [v.id, v]));
    }
  }

  const enriched = orders.map((order) => ({
    ...order,
    order_items: (order.order_items ?? []).map((item: { variant_id: string | null; [key: string]: unknown }) => ({
      ...item,
      product_variants: item.variant_id ? (variantMap[item.variant_id] ?? null) : null,
    })),
  }));

  return NextResponse.json(enriched);
}
