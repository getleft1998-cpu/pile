"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/src/lib/supabase";
import { ORDER_STATUS_LABELS } from "@/src/lib/types";
import type { Order, OrderStatus } from "@/src/lib/types";

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    const { data } = await getSupabase()
      .from("orders")
      .select("*, order_items(id)")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: OrderStatus) {
    setUpdating(id);
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setUpdating(null);
  }

  if (loading) {
    return <p className="text-gray-400 text-center py-20">Chargement…</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Commandes</h1>

      {orders.length === 0 ? (
        <p className="text-gray-400 text-center py-20">
          Aucune commande pour le moment.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                    <td className="px-4 py-3 text-gray-500">{o.customer_city}</td>
                    <td className="px-4 py-3 text-gray-500">{o.customer_phone}</td>
                    <td className="px-4 py-3 font-bold">
                      {Number(o.total).toFixed(3)} TND
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString("fr-TN")}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) =>
                          updateStatus(o.id, e.target.value as OrderStatus)
                        }
                        disabled={updating === o.id}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:border-brand focus:ring-1 focus:ring-brand bg-white disabled:opacity-50"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
