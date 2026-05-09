"use client";

import Link from "next/link";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/src/lib/cart";

export default function Header() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Accueil" },
    { href: "/categories", label: "Catégories" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-black tracking-tight text-brand">
              FLORMAR
            </span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">
              Tunisie
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-700 hover:text-brand transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative p-2 text-gray-700 hover:text-brand transition-colors"
              aria-label="Mon panier"
            >
              <ShoppingBag size={22} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 text-gray-700 hover:text-brand transition-colors"
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
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-700 hover:text-brand transition-colors"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
