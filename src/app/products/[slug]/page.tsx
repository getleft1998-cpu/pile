"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ShoppingBag, ChevronLeft } from "lucide-react";
import { getSupabase } from "@/src/lib/supabase";
import { useCart } from "@/src/lib/cart";
import ShadeSelector from "@/src/components/ShadeSelector";
import type { Product, ProductVariant } from "@/src/lib/types";

export default function ProductPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await getSupabase()
        .from("products")
        .select(
          "*, categories(*), product_variants(*), product_images(id, url, sort_order)"
        )
        .eq("slug", slug)
        .single();
      if (!data) {
        router.replace("/404");
        return;
      }
      const p = data as Product;
      // Sort images by sort_order
      if (p.product_images)
        p.product_images.sort((a, b) => a.sort_order - b.sort_order);
      setProduct(p);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-400">
        Chargement…
      </div>
    );
  }

  if (!product) return null;

  const variants = product.product_variants ?? [];
  const images = product.product_images ?? [];
  const activePrice = product.sale_price ?? product.price;
  const hasDiscount = product.sale_price !== null;

  function handleAddToCart() {
    if (!selected) return;
    addItem(product!, selected);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand mb-6 transition-colors"
      >
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50">
            {images[activeImg]?.url ? (
              <Image
                src={images[activeImg].url}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg
                  className="w-24 h-24"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={[
                    "relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    activeImg === i
                      ? "border-brand"
                      : "border-transparent hover:border-gray-300",
                  ].join(" ")}
                >
                  <Image
                    src={img.url}
                    alt={`Image ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-6">
          {product.categories && (
            <a
              href={`/categories/${product.categories.slug}`}
              className="text-sm text-brand font-medium hover:underline w-fit"
            >
              {product.categories.name}
            </a>
          )}

          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-gray-900">
              {activePrice.toFixed(3)} TND
            </span>
            {hasDiscount && (
              <span className="text-lg text-gray-400 line-through">
                {product.price.toFixed(3)} TND
              </span>
            )}
          </div>

          {product.description && (
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          )}

          {/* Shade selector */}
          {variants.length > 0 && (
            <ShadeSelector
              variants={variants}
              selected={selected}
              onSelect={setSelected}
            />
          )}

          {/* Add to cart */}
          <div className="flex flex-col gap-3">
            {variants.length > 0 && !selected && (
              <p className="text-sm text-amber-600 font-medium">
                Veuillez sélectionner une teinte avant d'ajouter au panier.
              </p>
            )}
            <button
              onClick={handleAddToCart}
              disabled={variants.length > 0 && !selected}
              className={[
                "flex items-center justify-center gap-2 w-full py-4 rounded-full font-bold text-white transition-all",
                variants.length > 0 && !selected
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-brand hover:bg-brand-dark active:scale-95",
                added ? "bg-green-500 hover:bg-green-600" : "",
              ].join(" ")}
            >
              <ShoppingBag size={20} />
              {added ? "Ajouté !" : "Ajouter au panier"}
            </button>
          </div>

          <div className="border-t pt-4 text-sm text-gray-500">
            <p>✓ Paiement à la livraison (COD)</p>
            <p>✓ Livraison dans toute la Tunisie</p>
          </div>
        </div>
      </div>
    </div>
  );
}
