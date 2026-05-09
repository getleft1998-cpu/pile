import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administration — Flormar Tunisie",
};

const navItems = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/orders", label: "Commandes" },
  { href: "/admin/products", label: "Produits" },
  { href: "/admin/categories", label: "Catégories" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Admin header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span className="font-black text-brand text-lg">
              FLORMAR <span className="text-gray-400 text-xs font-normal">Admin</span>
            </span>
            <nav className="hidden md:flex items-center gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-gray-600 hover:text-brand transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link href="/" className="text-xs text-gray-400 hover:text-brand transition-colors">
            ← Boutique
          </Link>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="md:hidden bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto gap-1 px-4 py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 text-xs font-medium text-gray-600 hover:text-brand px-3 py-1.5 rounded-full border border-gray-200 hover:border-brand transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
