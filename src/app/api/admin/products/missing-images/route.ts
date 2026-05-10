import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export async function GET() {
  const admin = createAdminClient();

  const { data: products, error } = await admin
    .from("products")
    .select("id, name, slug, source_url, product_images(id)")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    name: string;
    slug: string;
    source_url: string | null;
    product_images: { id: string }[] | null;
  };

  const missing = (products ?? []).filter(
    (p: Row) => !p.product_images || p.product_images.length === 0
  );

  return NextResponse.json(
    missing.map((p: Row) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      source_url: p.source_url,
      has_source_url: !!p.source_url,
    }))
  );
}
