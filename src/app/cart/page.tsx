"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "@/src/lib/cart";

export default function CartPage() {
  const { items, total, removeItem, updateQty } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-200 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Votre panier est vide
        </h1>
        <p className="text-gray-500 mb-8">
          Découvrez notre collection et ajoutez vos produits favoris.
        </p>
        <Link
          href="/categories"
          className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-full transition-colors"
        >
          Continuer les achats
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Mon panier</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Items */}
        <div className="flex-1 flex flex-col gap-4">
          {items.map(({ product, variant, quantity }) => {
            const img = product.product_images?.[0]?.url ?? null;
            const price = product.sale_price ?? product.price;

            return (
              <div
                key={variant.id}
                className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-4"
              >
                <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-50">
                  {img ? (
                    <Image
                      src={img}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${product.slug}`}
                    className="font-semibold text-gray-900 hover:text-brand line-clamp-2 text-sm"
                  >
                    {product.name}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Teinte : {variant.shade_name}
                  </p>
                  <p className="font-bold text-gray-900 mt-1">
                    {price.toFixed(3)} TND
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => removeItem(variant.id)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-full px-2 py-1">
                    <button
                      onClick={() => updateQty(variant.id, quantity - 1)}
                      className="p-0.5 text-gray-500 hover:text-brand"
                      disabled={quantity <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQty(variant.id, quantity + 1)}
                      className="p-0.5 text-gray-500 hover:text-brand"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-700">
                    {(price * quantity).toFixed(3)} TND
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24">
            <h2 className="font-bold text-gray-900 mb-4">Récapitulatif</h2>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Sous-total</span>
              <span>{total.toFixed(3)} TND</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mb-4">
              <span>Livraison</span>
              <span className="text-green-600 font-medium">À confirmer</span>
            </div>
            <div className="border-t pt-4 flex justify-between font-bold text-gray-900 mb-6">
              <span>Total</span>
              <span>{total.toFixed(3)} TND</span>
            </div>
            <Link
              href="/checkout"
              className="block w-full bg-brand hover:bg-brand-dark text-white font-bold text-center py-4 rounded-full transition-colors"
            >
              Commander
            </Link>
            <p className="text-xs text-gray-400 text-center mt-3">
              Paiement à la livraison
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
