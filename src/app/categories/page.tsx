export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { createServerClient } from "@/src/lib/supabase";
import type { Category } from "@/src/lib/types";

export const metadata = {
  title: "Catégories — Flormar Tunisie",
};

async function getCategories(): Promise<Category[]> {
  const { data } = await createServerClient()
    .from("categories")
    .select("*")
    .order("name");
  return data ?? [];
}

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Catégories</h1>

      {categories.length === 0 ? (
        <p className="text-gray-500 text-center py-20">
          Aucune catégorie disponible pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group flex flex-col items-center gap-4 p-6 bg-white rounded-2xl border border-gray-100 hover:border-brand hover:shadow-lg transition-all"
            >
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-brand-light">
                {cat.image_url ? (
                  <Image
                    src={cat.image_url}
                    alt={cat.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    sizes="96px"
                  />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-brand font-bold text-3xl">
                    {cat.name.charAt(0)}
                  </span>
                )}
              </div>
              <span className="font-semibold text-gray-900 text-center group-hover:text-brand transition-colors">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
