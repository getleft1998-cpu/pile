"use client";

import Image from "next/image";
import type { ProductVariant } from "@/src/lib/types";

interface Props {
  variants: ProductVariant[];
  selected: ProductVariant | null;
  onSelect: (v: ProductVariant) => void;
}

// Detect whether the shade name looks like a numeric/short code (e.g. "001", "12A")
// — in that case we render labeled pills instead of plain color swatches.
function looksLikeShadeCode(name: string): boolean {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return false;
  if (trimmed.length > 6) return false;
  return /^[0-9]{1,4}[A-Z]?$/i.test(trimmed);
}

export default function ShadeSelector({ variants, selected, onSelect }: Props) {
  if (variants.length === 0) return null;

  // If at least half of the variants look like codes, use the "labeled pill" UI
  const codeCount = variants.filter((v) => looksLikeShadeCode(v.shade_name)).length;
  const useCodeUI = codeCount >= Math.ceil(variants.length / 2);

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
        Couleur{" "}
        {selected && (
          <span className="font-normal text-brand normal-case">— {selected.shade_name}</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isSelected = selected?.id === v.id;
          const outOfStock = v.stock_qty === 0;

          if (useCodeUI) {
            // Labeled pill (shade code prominently displayed)
            return (
              <button
                key={v.id}
                onClick={() => !outOfStock && onSelect(v)}
                disabled={outOfStock}
                title={v.shade_name + (outOfStock ? " (épuisé)" : "")}
                className={[
                  "relative min-w-[44px] h-11 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 text-sm font-semibold",
                  isSelected
                    ? "border-brand bg-brand-light text-brand shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-brand",
                  outOfStock ? "opacity-40 cursor-not-allowed line-through" : "cursor-pointer",
                ].join(" ")}
              >
                {v.color_hex && !v.swatch_image_url && (
                  <span
                    className="block w-3.5 h-3.5 rounded-full border border-gray-300"
                    style={{ backgroundColor: v.color_hex }}
                  />
                )}
                <span>{v.shade_name}</span>
              </button>
            );
          }

          // Default: circular swatch (color or image)
          return (
            <button
              key={v.id}
              onClick={() => !outOfStock && onSelect(v)}
              disabled={outOfStock}
              title={v.shade_name + (outOfStock ? " (épuisé)" : "")}
              className={[
                "relative w-11 h-11 rounded-full border-2 transition-all",
                isSelected
                  ? "border-brand scale-110 shadow-md"
                  : "border-gray-200 hover:border-gray-400",
                outOfStock ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              {v.swatch_image_url ? (
                <Image
                  src={v.swatch_image_url}
                  alt={v.shade_name}
                  fill
                  className="rounded-full object-cover"
                  sizes="44px"
                  unoptimized
                />
              ) : v.color_hex ? (
                <span
                  className="block w-full h-full rounded-full"
                  style={{ backgroundColor: v.color_hex }}
                />
              ) : (
                <span className="block w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                  {v.shade_name.slice(0, 3)}
                </span>
              )}

              {outOfStock && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="block w-8 h-0.5 bg-gray-400 rotate-45 rounded" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && selected.sku && (
        <p className="mt-2 text-xs text-gray-400">Réf. {selected.sku}</p>
      )}
    </div>
  );
}
