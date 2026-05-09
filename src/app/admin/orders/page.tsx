"use client";

import { Fragment, useEffect, useState } from "react";
import { ORDER_STATUS_LABELS } from "@/src/lib/types";
import type { OrderStatus } from "@/src/lib/types";

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

interface OrderItemRow {
  id: string;
  quantity: number;
  price: number;
  product_variants: {
    shade_name: string;
    color_hex: string | null;
    sku: string | null;
    products: { name: string; slug: string } | null;
  } | null;
}

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  order_items: OrderItemRow[];
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    const res = await fetch("/api/admin/orders");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Articles</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => {
                  const items = o.order_items ?? [];
                  const isOpen = !!expanded[o.id];
                  return (
                    <Fragment key={o.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggle(o.id)}
                      >
                        <td className="px-4 py-3 text-gray-400 select-none">
                          {isOpen ? "▾" : "▸"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          {o.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {o.customer_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {o.customer_city}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {o.customer_phone}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {items.reduce((n, it) => n + (it.quantity ?? 0), 0)}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {Number(o.total).toFixed(3)} TND
                        </td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {new Date(o.created_at).toLocaleDateString("fr-TN")}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                      {isOpen && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid md:grid-cols-2 gap-6">
                              <div>
                                <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                                  Adresse de livraison
                                </h3>
                                <p className="text-sm text-gray-700 whitespace-pre-line">
                                  {o.customer_address}{"\n"}{o.customer_city}
                                </p>
                              </div>
                              <div>
                                <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                                  Articles ({items.length})
                                </h3>
                                {items.length === 0 ? (
                                  <p className="text-sm text-gray-400">
                                    Aucun article.
                                  </p>
                                ) : (
                                  <ul className="space-y-2">
                                    {items.map((it) => {
                                      const pv = it.product_variants;
                                      const name = pv?.products?.name ?? "Produit supprimé";
                                      const shade = pv?.shade_name;
                                      const color = pv?.color_hex;
                                      return (
                                        <li
                                          key={it.id}
                                          className="flex items-center gap-3 text-sm"
                                        >
                                          {color && (
                                            <span
                                              className="inline-block w-4 h-4 rounded-full border border-gray-200 shrink-0"
                                              style={{ backgroundColor: color }}
                                            />
                                          )}
                                          <span className="font-medium text-gray-900">
                                            {name}
                                          </span>
                                          {shade && (
                                            <span className="text-gray-500">
                                              — {shade}
                                            </span>
                                          )}
                                          <span className="ml-auto text-gray-500">
                                            ×{it.quantity}
                                          </span>
                                          <span className="text-gray-700 font-medium w-24 text-right">
                                            {(Number(it.price) * it.quantity).toFixed(3)} TND
                                          </span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
