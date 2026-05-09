import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <span className="text-2xl font-black text-brand">FLORMAR</span>
            <p className="mt-2 text-sm text-gray-400">
              Maquillage & cosmétiques de qualité professionnelle, disponibles
              en Tunisie.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Navigation
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-brand transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="hover:text-brand transition-colors"
                >
                  Catégories
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-brand transition-colors">
                  Mon panier
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Informations
            </h3>
            <ul className="space-y-2 text-sm">
              <li>Paiement à la livraison (COD)</li>
              <li>Livraison dans toute la Tunisie</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Flormar Tunisie. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
