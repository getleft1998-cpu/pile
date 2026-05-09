"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/src/lib/supabase";
import { ORDER_STATUS_LABELS } from "@/src/lib/types";
import type { Order } from "@/src/lib/types";

interface Stats {
  orders: number;
  products: number;
  categories: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      const [
        { count: orders },
        { count: products },
        { count: categories },
        { data: recentOrders },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const { data: allOrders } = await supabase
        .from("orders")
        .select("total") as { data: Array<{ total: number }> | null };
      const revenue = (allOrders ?? []).reduce((s, o) => s + Number(o.total), 0);

      setStats({
        orders: orders ?? 0,
        products: products ?? 0,
        categories: categories ?? 0,
        revenue,
      });
      setRecent(recentOrders ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-gray-400 text-center py-20">Chargement…</p>;
  }

  const statCards = [
    { label: "Commandes", value: stats!.orders, href: "/admin/orders" },
    { label: "Produits", value: stats!.products, href: "/admin/products" },
    { label: "Catégories", value: stats!.categories, href: "/admin/categories" },
    {
      label: "Chiffre d'affaires",
      value: `${stats!.revenue.toFixed(3)} TND`,
      href: "/admin/orders",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Tableau de bord
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-brand transition-colors"
          >
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              {c.label}
            </p>
            <p className="text-2xl font-black text-gray-900">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Commandes récentes</h2>
          <Link
            href="/admin/orders"
            className="text-sm text-brand hover:underline"
          >
            Voir tout
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Aucune commande pour le moment.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {o.customer_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {o.customer_city} · {new Date(o.created_at).toLocaleDateString("fr-TN")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-gray-900">
                    {Number(o.total).toFixed(3)} TND
                  </span>
                  <span className="text-xs bg-brand-light text-brand font-semibold px-2 py-0.5 rounded-full">
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
