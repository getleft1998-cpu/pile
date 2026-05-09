"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Palette } from "lucide-react";
import { getSupabase } from "@/src/lib/supabase";
import type { Product, Category } from "@/src/lib/types";

interface ProductWithVariantCount extends Product {
  variant_count?: number;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductWithVariantCount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const emptyForm = {
    name: "",
    slug: "",
    description: "",
    price: "",
    sale_price: "",
    category_id: "",
    source_url: "",
  };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const supabase = getSupabase();
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories(name), product_variants(id)")
        .order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts(
      (prods ?? []).map((p: any) => ({
        ...p,
        variant_count: p.product_variants?.length ?? 0,
      }))
    );
    setCategories(cats ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      price: String(p.price),
      sale_price: p.sale_price !== null ? String(p.sale_price) : "",
      category_id: p.category_id ?? "",
      source_url: p.source_url ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    const body = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      price: parseFloat(form.price),
      sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      category_id: form.category_id || null,
      source_url: form.source_url || null,
    };
    const url = editing
      ? `/api/admin/products/${editing.id}`
      : "/api/admin/products";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    setDeleting(id);
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  function set(field: string) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand";

  if (loading) {
    return <p className="text-gray-400 text-center py-20">Chargement…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-4 py-2 rounded-full text-sm transition-colors"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
            <h2 className="font-bold text-gray-900">
              {editing ? "Modifier le produit" : "Nouveau produit"}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
                <input className={inputCls} value={form.name} onChange={set("name")} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Slug *</label>
                <input className={inputCls} value={form.slug} onChange={set("slug")} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Prix (TND) *</label>
                <input type="number" step="0.001" className={inputCls} value={form.price} onChange={set("price")} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Prix promo (TND)</label>
                <input type="number" step="0.001" className={inputCls} value={form.sale_price} onChange={set("sale_price")} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Catégorie</label>
                <select className={inputCls} value={form.category_id} onChange={set("category_id")}>
                  <option value="">— Aucune —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea className={inputCls} rows={3} value={form.description} onChange={set("description")} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">URL source</label>
                <input className={inputCls} value={form.source_url} onChange={set("source_url")} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-full py-2 text-sm font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-brand hover:bg-brand-dark text-white rounded-full py-2 text-sm font-semibold transition-colors"
              >
                {editing ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-gray-400 text-center py-20">Aucun produit.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Teintes</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium max-w-xs">
                      <p className="truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {(p as any).categories?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold">{Number(p.price).toFixed(3)} TND</p>
                      {p.sale_price && (
                        <p className="text-xs text-brand">
                          {Number(p.sale_price).toFixed(3)} TND
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.variant_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/products/${p.id}/variants`}
                          className="p-1.5 text-gray-400 hover:text-brand transition-colors"
                          title="Gérer les teintes"
                        >
                          <Palette size={15} />
                        </Link>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-gray-400 hover:text-brand transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
