"use client";

import Image from "next/image";
import type { ProductVariant } from "@/src/lib/types";

interface Props {
  variants: ProductVariant[];
  selected: ProductVariant | null;
  onSelect: (v: ProductVariant) => void;
}

export default function ShadeSelector({ variants, selected, onSelect }: Props) {
  if (variants.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">
        Teinte{" "}
        {selected && (
          <span className="font-normal text-brand">{selected.shade_name}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isSelected = selected?.id === v.id;
          const outOfStock = v.stock_qty === 0;

          return (
            <button
              key={v.id}
              onClick={() => !outOfStock && onSelect(v)}
              disabled={outOfStock}
              title={v.shade_name + (outOfStock ? " (épuisé)" : "")}
              className={[
                "relative w-9 h-9 rounded-full border-2 transition-all",
                isSelected
                  ? "border-brand scale-110 shadow-md"
                  : "border-transparent hover:border-gray-300",
                outOfStock ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              {v.swatch_image_url ? (
                <Image
                  src={v.swatch_image_url}
                  alt={v.shade_name}
                  fill
                  className="rounded-full object-cover"
                  sizes="36px"
                />
              ) : v.color_hex ? (
                <span
                  className="block w-full h-full rounded-full"
                  style={{ backgroundColor: v.color_hex }}
                />
              ) : (
                <span className="block w-full h-full rounded-full bg-gray-200" />
              )}

              {outOfStock && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="block w-7 h-0.5 bg-gray-400 rotate-45 rounded" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && selected.sku && (
        <p className="mt-1 text-xs text-gray-400">Réf. {selected.sku}</p>
      )}
    </div>
  );
}
