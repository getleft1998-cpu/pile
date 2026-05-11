export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { createServerClient } from "@/src/lib/supabase";
import ProductCard from "@/src/components/ProductCard";
import type { Category, Product } from "@/src/lib/types";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yqgtjgvqeogsykkpgxiy.supabase.co";
const HERO_URL = `${SUPABASE_URL}/storage/v1/object/public/product-images/banners/hero.jpg`;

async function getFeatured(): Promise<{
  categories: Category[];
  products: Product[];
  hasBanner: boolean;
}> {
  const supabase = createServerClient();
  const [{ data: categories }, { data: products }, { data: bannerFiles }] = await Promise.all([
    supabase.from("categories").select("*").order("name").limit(6),
    supabase
      .from("products")
      .select(
        "*, categories(*), product_variants(id, shade_name, color_hex, stock_qty), product_images(url, sort_order)"
      )
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.storage.from("product-images").list("banners"),
  ]);
  const hasBanner = (bannerFiles ?? []).some((f) => f.name === "hero.jpg");
  return { categories: categories ?? [], products: products ?? [], hasBanner };
}

export default async function HomePage() {
  const { categories, products, hasBanner } = await getFeatured();

  return (
    <>
      {/* Hero */}
      {hasBanner ? (
        <section className="relative min-h-[460px] md:min-h-[560px] flex items-center overflow-hidden bg-gray-900">
          <Image
            src={HERO_URL}
            alt="Flormar — votre beauté, sublimée"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="relative z-10 max-w-7xl mx-auto w-full px-6 md:px-16 py-20">
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 max-w-xl leading-tight">
              Votre beauté,{" "}
              <span className="text-pink-300">sublimée</span>
            </h1>
            <p className="text-lg text-gray-200 mb-8 max-w-lg">
              Découvrez la collection Flormar — maquillage professionnel livré
              partout en Tunisie, paiement à la livraison.
            </p>
            <Link
              href="/categories"
              className="inline-block bg-white hover:bg-gray-100 text-brand font-semibold px-8 py-3 rounded-full transition-colors"
            >
              Explorer la collection
            </Link>
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-br from-brand-light to-white py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4">
              Votre beauté,{" "}
              <span className="text-brand">sublimée</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
              Découvrez la collection Flormar — maquillage professionnel livré
              partout en Tunisie, paiement à la livraison.
            </p>
            <Link
              href="/categories"
              className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-full transition-colors"
            >
              Explorer la collection
            </Link>
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Nos catégories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand hover:shadow-md transition-all"
              >
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-brand-light flex-shrink-0">
                  {cat.image_url ? (
                    <Image
                      src={cat.image_url}
                      alt={cat.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="80px"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-full h-full text-brand font-bold text-2xl">
                      {cat.name.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700 text-center group-hover:text-brand transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/categories" className="text-sm text-brand font-semibold hover:underline">
              Voir toutes les catégories →
            </Link>
          </div>
        </section>
      )}

      {/* Featured products */}
      {products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 bg-gray-50 rounded-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Nouveautés</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p as Product} />
            ))}
          </div>
        </section>
      )}

      {/* COD banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-brand rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Paiement à la livraison
          </h2>
          <p className="text-brand-light max-w-md mx-auto">
            Payez en cash à la réception de votre commande, partout en Tunisie.
            Simple, sûr et sans risque.
          </p>
        </div>
      </section>
    </>
  );
}
