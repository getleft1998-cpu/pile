import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export async function GET() {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select(
      `*, order_items(
        id, quantity, price,
        product_variants(shade_name, color_hex, sku, products(name, slug))
      )`
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
