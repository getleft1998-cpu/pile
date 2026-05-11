"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ShoppingBag, Zap, ChevronLeft } from "lucide-react";
import { getSupabase } from "@/src/lib/supabase";
import { useCart } from "@/src/lib/cart";
import ShadeSelector from "@/src/components/ShadeSelector";
import type { Product, ProductVariant } from "@/src/lib/types";

const FAKE_SHADE_NAMES = new Set([
  "standard", "couleur", "color", "default", "taille unique", "unique", "n/a", "",
]);

function isRealVariant(v: ProductVariant): boolean {
  return !FAKE_SHADE_NAMES.has((v.shade_name ?? "").toLowerCase().trim());
}

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
        .select("*, categories(*), product_variants(*), product_images(id, url, sort_order)")
        .eq("slug", slug)
        .single();
      if (!data) {
        router.replace("/404");
        return;
      }
      const p = data as Product;
      if (p.product_images) p.product_images.sort((a, b) => a.sort_order - b.sort_order);
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
  const realVariants = variants.filter(isRealVariant);
  const requireShade = realVariants.length > 0;
  const defaultVariant = !requireShade ? (variants[0] ?? null) : null;

  const images = product.product_images ?? [];
  const activePrice = product.sale_price ?? product.price;
  const hasDiscount = product.sale_price !== null;

  const canAddToCart = requireShade ? selected !== null : defaultVariant !== null;
  const effectiveVariant = requireShade ? selected : defaultVariant;

  // Main display image: prefer the selected shade's image if it has one
  const displayImage =
    (selected && selected.swatch_image_url) ||
    images[activeImg]?.url ||
    null;

  function handleAddToCart() {
    if (!effectiveVariant) return;
    addItem(product!, effectiveVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function handleBuyNow() {
    if (!effectiveVariant) return;
    addItem(product!, effectiveVariant);
    router.push("/checkout");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand mb-4 sm:mb-6 transition-colors"
      >
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50">
            {displayImage ? (
              <Image
                src={displayImage}
                alt={`${product.name}${selected ? " — " + selected.shade_name : ""}`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => {
                    setActiveImg(i);
                    setSelected(null);
                  }}
                  className={[
                    "relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    activeImg === i && !selected ? "border-brand" : "border-transparent hover:border-gray-300",
                  ].join(" ")}
                >
                  <Image src={img.url} alt={`Image ${i + 1}`} fill className="object-cover" sizes="64px" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          {product.categories && (
            <a
              href={`/categories/${product.categories.slug}`}
              className="text-sm text-brand font-medium hover:underline w-fit"
            >
              {product.categories.name}
            </a>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{product.name}</h1>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-gray-900">
              {activePrice.toFixed(3)} <span className="text-xl">TND</span>
            </span>
            {hasDiscount && (
              <span className="text-lg text-gray-400 line-through">{product.price.toFixed(3)} TND</span>
            )}
          </div>

          {product.description && (
            <p className="text-gray-600 leading-relaxed text-sm">{product.description}</p>
          )}

          {requireShade && (
            <ShadeSelector
              variants={realVariants}
              selected={selected}
              onSelect={setSelected}
            />
          )}

          {requireShade && !selected && (
            <p className="text-sm text-amber-600 font-medium -mt-1">
              Veuillez choisir une teinte pour continuer.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className={[
                "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold transition-all text-sm",
                canAddToCart
                  ? added
                    ? "bg-green-500 text-white"
                    : "border-2 border-brand text-brand hover:bg-brand hover:text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              <ShoppingBag size={18} />
              {added ? "Ajouté au panier !" : "Ajouter au panier"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!canAddToCart}
              className={[
                "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold transition-all text-sm",
                canAddToCart
                  ? "bg-brand hover:bg-brand-dark text-white active:scale-95"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              <Zap size={18} />
              Commander maintenant
            </button>
          </div>

          <div className="border-t pt-4 text-sm text-gray-500 space-y-1">
            <p>✓ Paiement à la livraison (COD)</p>
            <p>✓ Livraison dans toute la Tunisie</p>
          </div>
        </div>
      </div>
    </div>
  );
}
