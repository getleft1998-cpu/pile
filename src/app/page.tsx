export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { createServerClient } from "@/src/lib/supabase";
import ProductCard from "@/src/components/ProductCard";
import type { Category, Product } from "@/src/lib/types";

async function getPageData(): Promise<{ categories: Category[]; products: Product[] }> {
  const supabase = createServerClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("name").limit(6),
    supabase
      .from("products")
      .select(
        "*, categories(*), product_variants(id, shade_name, color_hex, swatch_image_url, stock_qty), product_images(url, sort_order)"
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  return { categories: categories ?? [], products: products ?? [] };
}

const CATEGORY_DISPLAY_ORDER = ["face", "eyes", "lips", "nails", "skincare", "accessories"];

export default async function HomePage() {
  const { categories, products } = await getPageData();

  const sortedCategories = [...categories].sort((a, b) => {
    const ai = CATEGORY_DISPLAY_ORDER.indexOf(a.slug);
    const bi = CATEGORY_DISPLAY_ORDER.indexOf(b.slug);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <>
      {/* Intro */}
      <section className="bg-gradient-to-br from-brand-light via-white to-brand-light py-10 sm:py-14 lg:py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-semibold text-brand uppercase tracking-widest mb-3">
            Flormar Tunisie
          </p>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight">
            Votre beauté, <span className="text-brand">sublimée</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto mb-6">
            Maquillage professionnel livré partout en Tunisie. Paiement à la livraison.
          </p>
          <Link
            href="/categories"
            className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-7 py-3 rounded-full transition-colors text-sm sm:text-base shadow-sm"
          >
            Explorer la collection
          </Link>
        </div>
      </section>

      {/* Shop by Category */}
      {sortedCategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
            Shop by Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {sortedCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group flex flex-col items-center overflow-hidden rounded-2xl border border-gray-100 hover:border-brand hover:shadow-lg transition-all bg-white"
              >
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-brand-light">
                  {cat.image_url ? (
                    <Image
                      src={cat.image_url}
                      alt={cat.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
                      unoptimized
                    />
                  ) : (
                    <span className="flex items-center justify-center w-full h-full text-brand font-bold text-3xl">
                      {cat.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="px-2 py-3 sm:py-4 text-center w-full">
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-brand transition-colors mb-1.5 sm:mb-2">
                    {cat.name}
                  </p>
                  <span className="inline-block text-[10px] sm:text-xs font-semibold text-brand border border-brand rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 group-hover:bg-brand group-hover:text-white transition-colors">
                    Shop Now
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Nouveautés */}
      {products.length > 0 && (
        <section className="bg-gray-50 py-12 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Nouveautés</h2>
              <Link href="/categories" className="text-sm font-semibold text-brand hover:underline">
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p as Product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* COD banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14">
        <div className="bg-brand rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3">
            Paiement à la livraison
          </h2>
          <p className="text-brand-light max-w-md mx-auto text-sm sm:text-base">
            Payez en cash à la réception de votre commande, partout en Tunisie.
            Simple, sûr et sans risque.
          </p>
        </div>
      </section>
    </>
  );
}
