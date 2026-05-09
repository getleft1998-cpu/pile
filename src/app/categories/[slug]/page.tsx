export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createServerClient } from "@/src/lib/supabase";
import ProductCard from "@/src/components/ProductCard";
import type { Product } from "@/src/lib/types";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  const { data: products } = await supabase
    .from("products")
    .select(
      "*, categories(*), product_variants(id, shade_name, color_hex, stock_qty), product_images(url, sort_order)"
    )
    .eq("category_id", category.id)
    .order("name");

  const items: Product[] = products ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <nav className="text-sm text-gray-400 mb-4">
        <a href="/categories" className="hover:text-brand">
          Catégories
        </a>{" "}
        / <span className="text-gray-700">{category.name}</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{category.name}</h1>
      <p className="text-gray-500 mb-8">
        {items.length} produit{items.length !== 1 ? "s" : ""}
      </p>

      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-20">
          Aucun produit dans cette catégorie pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
