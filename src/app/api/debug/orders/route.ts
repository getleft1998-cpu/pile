import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

// Temporary debug endpoint — remove after diagnosis
export async function GET() {
  const admin = createAdminClient();

  // Step 1: get a real variant + its product
  const { data: variant, error: ve } = await admin
    .from("product_variants")
    .select("id, shade_name, color_hex, product_id, products(id, name, price)")
    .limit(1)
    .single();

  if (ve || !variant) {
    return NextResponse.json({ step: "fetch variant", error: ve?.message });
  }

  const product = variant.products as { id: string; name: string; price: number } | null;
  if (!product) {
    return NextResponse.json({ step: "product missing on variant", variant });
  }

  // Step 2: create a test order
  const { data: order, error: oe } = await admin
    .from("orders")
    .insert({
      customer_name: "TEST — Claude Debug",
      customer_phone: "00000000",
      customer_address: "1 Rue de Test",
      customer_city: "Tunis",
      total: product.price,
      status: "cancelled",
    })
    .select("id")
    .single();

  if (oe || !order) {
    return NextResponse.json({ step: "create order", error: oe?.message });
  }

  // Step 3: insert order item
  const { error: ie } = await admin.from("order_items").insert({
    order_id: order.id,
    variant_id: variant.id,
    product_id: product.id,
    quantity: 1,
    price: product.price,
  });

  if (ie) {
    return NextResponse.json({ step: "insert order_item", error: ie.message, order_id: order.id });
  }

  // Step 4: read it back with the same nested join the admin page uses
  const { data: result, error: re } = await admin
    .from("orders")
    .select(`*, order_items(id, quantity, price, product_variants(shade_name, color_hex, sku, products(name, slug)))`)
    .eq("id", order.id)
    .single();

  return NextResponse.json({
    ok: !re,
    order_id: order.id,
    variant_used: { id: variant.id, shade: variant.shade_name, product: product.name },
    join_error: re?.message ?? null,
    result,
  });
}
