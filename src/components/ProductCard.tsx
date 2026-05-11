"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, Zap } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/src/lib/cart";
import type { Product, ProductVariant } from "@/src/lib/types";

const FAKE_SHADE_NAMES = new Set([
  "standard", "couleur", "color", "default", "taille unique", "unique", "n/a", "",
]);

function isRealVariant(v: ProductVariant): boolean {
  return !FAKE_SHADE_NAMES.has((v.shade_name ?? "").toLowerCase().trim());
}

export function isFakeShade(shadeName: string): boolean {
  return FAKE_SHADE_NAMES.has((shadeName ?? "").toLowerCase().trim());
}

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const mainImage = product.product_images?.[0]?.url ?? null;
  const price = product.sale_price ?? product.price;
  const hasDiscount = product.sale_price !== null;
  const variants = product.product_variants ?? [];
  const realVariants = variants.filter(isRealVariant);
  const hasRealShades = realVariants.length > 0;
  const defaultVariant = !hasRealShades ? variants[0] ?? null : null;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!defaultVariant) return;
    addItem(product, defaultVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!defaultVariant) return;
    addItem(product, defaultVariant);
    router.push("/checkout");
  }

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image + info — navigate to product page */}
      <Link href={`/products/${product.slug}`} className="flex-1 flex flex-col">
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          {mainImage ? (
            <Image
              src={mainImage}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {hasDiscount && (
            <span className="absolute top-2 left-2 bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">
              Promo
            </span>
          )}
        </div>

        <div className="p-3 flex flex-col gap-1">
          <p className="text-xs text-gray-400">{product.categories?.name ?? ""}</p>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-brand transition-colors">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-bold text-gray-900">{price.toFixed(3)} TND</span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">{product.price.toFixed(3)} TND</span>
            )}
          </div>
          {hasRealShades && (
            <p className="text-xs text-gray-400">
              {realVariants.length} teinte{realVariants.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </Link>

      {/* Action buttons */}
      <div className="px-3 pb-3">
        {!hasRealShades && defaultVariant ? (
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className={[
                "flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-xs font-semibold border transition-colors",
                added
                  ? "bg-green-500 text-white border-green-500"
                  : "border-brand text-brand hover:bg-brand hover:text-white",
              ].join(" ")}
            >
              <ShoppingBag size={13} />
              {added ? "Ajouté !" : "Ajouter"}
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-xs font-semibold bg-brand text-white hover:bg-brand-dark transition-colors"
            >
              <Zap size={13} />
              Commander
            </button>
          </div>
        ) : (
          <Link
            href={`/products/${product.slug}`}
            className="block w-full text-center py-2 rounded-full text-xs font-semibold border border-brand text-brand hover:bg-brand hover:text-white transition-colors"
          >
            Choisir une teinte →
          </Link>
        )}
      </div>
    </div>
  );
}
