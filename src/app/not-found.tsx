import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <p className="text-7xl font-black text-brand mb-4">404</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Page introuvable
      </h1>
      <p className="text-gray-500 mb-8">
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-full transition-colors"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
