import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

interface OrderItem {
  product_id: string;
  variant_id: string;
  quantity: number;
  price: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customer_name, customer_phone, customer_address, customer_city, total, items } = body;

  if (!customer_name || !customer_phone || !customer_address || !customer_city) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Panier vide" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({ customer_name, customer_phone, customer_address, customer_city, total, status: "pending" })
    .select("id")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Erreur création commande" }, { status: 500 });
  }

  const orderItems = (items as OrderItem[]).map((i) => ({
    order_id: order.id,
    product_id: i.product_id,
    variant_id: i.variant_id,
    quantity: i.quantity,
    price: i.price,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    return NextResponse.json({ error: "Erreur articles" }, { status: 500 });
  }

  return NextResponse.json({ id: order.id }, { status: 201 });
}
