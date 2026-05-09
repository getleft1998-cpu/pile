"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/src/lib/cart";

const TUNISIAN_CITIES = [
  "Ariana","Béja","Ben Arous","Bizerte","Gabès","Gafsa","Jendouba",
  "Kairouan","Kasserine","Kébili","Kef","Mahdia","Manouba","Médenine",
  "Monastir","Nabeul","Sfax","Sidi Bouzid","Siliana","Sousse",
  "Tataouine","Tozeur","Tunis","Zaghouan",
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCart();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 mb-4">Votre panier est vide.</p>
        <Link
          href="/categories"
          className="text-brand font-semibold hover:underline"
        >
          Retour à la boutique
        </Link>
      </div>
    );
  }

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address || !form.city) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.name,
          customer_phone: form.phone,
          customer_address: form.address,
          customer_city: form.city,
          total,
          items: items.map((i) => ({
            product_id: i.product.id,
            variant_id: i.variant.id,
            quantity: i.quantity,
            price: i.product.sale_price ?? i.product.price,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      clear();
      router.push(`/order-confirmation?id=${id}`);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Finaliser la commande
      </h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-5">
            <h2 className="font-semibold text-gray-900">Vos coordonnées</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Ex. Fatma Ben Ali"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de téléphone *
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="Ex. +216 20 000 000"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse *
              </label>
              <input
                type="text"
                value={form.address}
                onChange={set("address")}
                placeholder="Ex. 12 Rue Habib Bourguiba"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville *
              </label>
              <select
                value={form.city}
                onChange={set("city")}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand transition bg-white"
                required
              >
                <option value="">Sélectionnez votre ville</option>
                {TUNISIAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-brand-light rounded-2xl p-4 text-sm text-gray-700">
            <p className="font-semibold mb-1">💳 Paiement à la livraison</p>
            <p>
              Vous payez en cash lors de la réception de votre commande.
              Aucune carte bancaire requise.
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-4 rounded-full transition-colors disabled:opacity-60"
          >
            {loading ? "Traitement en cours…" : "Confirmer la commande"}
          </button>
        </form>

        {/* Order summary */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24">
            <h2 className="font-bold text-gray-900 mb-4">Votre commande</h2>
            <div className="flex flex-col gap-3 mb-4">
              {items.map(({ product, variant, quantity }) => (
                <div key={variant.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900 line-clamp-1">
                      {product.name}
                    </p>
                    <p className="text-gray-400 text-xs">{variant.shade_name} × {quantity}</p>
                  </div>
                  <span className="font-semibold text-gray-900 shrink-0 ml-2">
                    {((product.sale_price ?? product.price) * quantity).toFixed(3)} TND
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>{total.toFixed(3)} TND</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
