import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/src/lib/types";

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const mainImage = product.product_images?.[0]?.url ?? null;
  const price = product.sale_price ?? product.price;
  const hasDiscount = product.sale_price !== null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
    >
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
            <svg
              className="w-16 h-16"
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
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">
            Promo
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1">
        <p className="text-xs text-gray-400">
          {product.categories?.name ?? ""}
        </p>
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-brand transition-colors">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-bold text-gray-900">
            {price.toFixed(3)} TND
          </span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 line-through">
              {product.price.toFixed(3)} TND
            </span>
          )}
        </div>
        {product.product_variants && product.product_variants.length > 0 && (
          <p className="text-xs text-gray-400">
            {product.product_variants.length} teinte
            {product.product_variants.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
