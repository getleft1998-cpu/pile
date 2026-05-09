export const dynamic = "force-dynamic";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { createServerClient } from "@/src/lib/supabase";
import { ORDER_STATUS_LABELS } from "@/src/lib/types";
import type { Order } from "@/src/lib/types";

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export const metadata = {
  title: "Commande confirmée — Flormar Tunisie",
};

async function getOrder(id: string): Promise<Order | null> {
  const { data } = await createServerClient()
    .from("orders")
    .select("*, order_items(*, products(name), product_variants(shade_name))")
    .eq("id", id)
    .single();
  return data ?? null;
}

export default async function OrderConfirmationPage({ searchParams }: Props) {
  const { id } = await searchParams;
  const order = id ? await getOrder(id) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <CheckCircle size={64} className="mx-auto text-green-500 mb-6" />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Merci pour votre commande !
      </h1>
      <p className="text-gray-500 mb-8">
        Notre équipe vous contactera bientôt pour confirmer la livraison.
      </p>

      {order && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-left mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Commande n°
              </p>
              <p className="font-mono font-bold text-gray-900 text-sm">
                {order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <span className="bg-brand-light text-brand text-xs font-semibold px-3 py-1 rounded-full">
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Nom</p>
              <p className="font-medium">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Téléphone</p>
              <p className="font-medium">{order.customer_phone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-400 text-xs mb-0.5">Adresse</p>
              <p className="font-medium">
                {order.customer_address}, {order.customer_city}
              </p>
            </div>
          </div>

          {order.order_items && order.order_items.length > 0 && (
            <div className="border-t pt-4 flex flex-col gap-2">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {(item as any).products?.name ?? "Produit"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(item as any).product_variants?.shade_name} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {(item.price * item.quantity).toFixed(3)} TND
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>{order.total.toFixed(3)} TND</span>
              </div>
            </div>
          )}
        </div>
      )}

      <Link
        href="/"
        className="inline-block bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-full transition-colors"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
