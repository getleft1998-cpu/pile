"use client";

import Image from "next/image";
import type { ImageShade } from "@/src/lib/shade-utils";

interface Props {
  shades: ImageShade[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function ImageShadeSelector({ shades, selectedIndex, onSelect }: Props) {
  if (shades.length <= 1) return null;
  const selected = shades[selectedIndex];

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
        Couleur
        {selected && (
          <span className="font-normal text-brand normal-case ml-1">— {selected.code}</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {shades.map((shade, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              title={shade.code}
              className={[
                "relative w-16 h-20 sm:w-[72px] sm:h-24 rounded-lg overflow-hidden border-2 transition-all flex flex-col bg-white",
                isSelected
                  ? "border-brand shadow-md ring-2 ring-brand/20"
                  : "border-gray-200 hover:border-brand",
              ].join(" ")}
            >
              <div className="relative flex-1 bg-gray-50">
                <Image
                  src={shade.imageUrl}
                  alt={shade.code}
                  fill
                  className="object-cover"
                  sizes="72px"
                  unoptimized
                />
              </div>
              <div
                className={[
                  "px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-center leading-tight",
                  isSelected ? "bg-brand text-white" : "bg-white text-gray-700",
                ].join(" ")}
              >
                {shade.code}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
