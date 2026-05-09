"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { getSupabase } from "@/src/lib/supabase";
import type { Product, ProductVariant } from "@/src/lib/types";

export default function VariantsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const emptyForm = {
    shade_name: "",
    sku: "",
    color_hex: "",
    swatch_image_url: "",
    stock_qty: "99",
  };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const supabase = getSupabase();
    const [{ data: prod }, { data: vars }] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).single(),
      supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", id)
        .order("shade_name"),
    ]);
    setProduct(prod);
    setVariants(vars ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(v: ProductVariant) {
    setEditing(v);
    setForm({
      shade_name: v.shade_name,
      sku: v.sku ?? "",
      color_hex: v.color_hex ?? "",
      swatch_image_url: v.swatch_image_url ?? "",
      stock_qty: String(v.stock_qty),
    });
    setShowForm(true);
  }

  async function handleSave() {
    const body = {
      product_id: id,
      shade_name: form.shade_name,
      sku: form.sku || null,
      color_hex: form.color_hex || null,
      swatch_image_url: form.swatch_image_url || null,
      stock_qty: parseInt(form.stock_qty) || 99,
    };
    const url = editing
      ? `/api/admin/variants/${editing.id}`
      : "/api/admin/variants";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    load();
  }

  async function handleDelete(variantId: string) {
    if (!confirm("Supprimer cette teinte ?")) return;
    setDeleting(variantId);
    await fetch(`/api/admin/variants/${variantId}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  const set =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand";

  if (loading) {
    return <p className="text-gray-400 text-center py-20">Chargement…</p>;
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand mb-4 transition-colors"
      >
        <ChevronLeft size={16} /> Retour aux produits
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Teintes — {product?.name}
          </h1>
          <p className="text-sm text-gray-400 font-mono mt-0.5">{product?.slug}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-4 py-2 rounded-full text-sm transition-colors"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <h2 className="font-bold text-gray-900">
              {editing ? "Modifier la teinte" : "Nouvelle teinte"}
            </h2>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nom de la teinte *</label>
              <input className={inputCls} value={form.shade_name} onChange={set("shade_name")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">SKU</label>
              <input className={inputCls} value={form.sku} onChange={set("sku")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Couleur hex (ex. #FF5733)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color_hex || "#e91e8c"}
                  onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                />
                <input className={inputCls} value={form.color_hex} onChange={set("color_hex")} placeholder="#e91e8c" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">URL swatch (Supabase Storage)</label>
              <input className={inputCls} value={form.swatch_image_url} onChange={set("swatch_image_url")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Stock</label>
              <input type="number" className={inputCls} value={form.stock_qty} onChange={set("stock_qty")} />
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

      {variants.length === 0 ? (
        <p className="text-gray-400 text-center py-20">
          Aucune teinte pour ce produit.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3">Teinte</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Couleur</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {variants.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{v.shade_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {v.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {v.color_hex ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full border border-gray-200 inline-block"
                          style={{ backgroundColor: v.color_hex }}
                        />
                        <span className="text-xs text-gray-400 font-mono">
                          {v.color_hex}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        v.stock_qty === 0
                          ? "text-red-500 font-semibold"
                          : "text-gray-700"
                      }
                    >
                      {v.stock_qty}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(v)}
                        className="p-1.5 text-gray-400 hover:text-brand transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(v.id)}
                        disabled={deleting === v.id}
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
      )}
    </div>
  );
}
