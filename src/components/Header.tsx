"use client";

import Link from "next/link";
import { ShoppingBag, Search, User, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/src/lib/cart";

const NAV_LINKS = [
  { href: "/categories", label: "New In" },
  { href: "/categories/face", label: "Makeup" },
  { href: "/categories/skincare", label: "Skin Care" },
  { href: "/categories/nails", label: "Nails" },
  { href: "/categories/accessories", label: "Accessories" },
  { href: "/categories", label: "Best Sellers" },
  { href: "/categories", label: "Offers" },
];

export default function Header() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile announcement bar */}
      <div className="bg-black text-white text-[11px] py-1.5 text-center sm:hidden leading-tight">
        Livraison gratuite dès 99 TND · Paiement sécurisé · Flormar officiel
      </div>

      {/* Desktop announcement bar */}
      <div className="bg-black text-white text-xs py-2 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 overflow-hidden">
            <span className="whitespace-nowrap">Livraison gratuite dès 99 TND</span>
            <span className="text-gray-500">·</span>
            <span className="whitespace-nowrap">Paiement sécurisé</span>
            <span className="text-gray-500">·</span>
            <span className="whitespace-nowrap">Boutique officielle Flormar Tunisie</span>
          </div>
          <div className="flex items-center gap-4 shrink-0 text-gray-300">
            <Link href="/about" className="hover:text-white transition-colors whitespace-nowrap">À propos</Link>
            <Link href="/contact" className="hover:text-white transition-colors whitespace-nowrap">Contact</Link>
            <Link href="/track" className="hover:text-white transition-colors whitespace-nowrap">Suivre ma commande</Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-1 shrink-0">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-brand">FLORMAR</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden sm:block ml-1">
                Tunisie
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-5 xl:gap-6">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm font-medium text-gray-700 hover:text-brand transition-colors whitespace-nowrap relative group"
                >
                  {l.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand transition-all group-hover:w-full" />
                </Link>
              ))}
            </nav>

            {/* Icons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                className="hidden md:flex p-2 text-gray-600 hover:text-brand transition-colors"
                aria-label="Rechercher"
              >
                <Search size={20} />
              </button>
              <button
                className="hidden md:flex p-2 text-gray-600 hover:text-brand transition-colors"
                aria-label="Mon compte"
              >
                <User size={20} />
              </button>
              <Link
                href="/cart"
                className="relative p-2 text-gray-600 hover:text-brand transition-colors"
                aria-label="Mon panier"
              >
                <ShoppingBag size={20} />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-brand text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
              <button
                className="lg:hidden p-2 text-gray-600 hover:text-brand transition-colors"
                onClick={() => setOpen(!open)}
                aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {open && (
          <div className="lg:hidden border-t border-gray-100 bg-white">
            <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm font-medium text-gray-700 hover:text-brand transition-colors py-3 border-b border-gray-50 last:border-0"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-gray-100 mt-1 flex flex-col gap-2.5 text-xs text-gray-500">
                <Link href="/about" onClick={() => setOpen(false)} className="hover:text-brand transition-colors">À propos</Link>
                <Link href="/contact" onClick={() => setOpen(false)} className="hover:text-brand transition-colors">Contact</Link>
                <Link href="/track" onClick={() => setOpen(false)} className="hover:text-brand transition-colors">Suivre ma commande</Link>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
