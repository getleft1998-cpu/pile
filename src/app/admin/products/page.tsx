"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Palette, ImageIcon, Download } from "lucide-react";
import { getSupabase } from "@/src/lib/supabase";
import type { Product, Category } from "@/src/lib/types";

interface ProductWithVariantCount extends Product {
  variant_count?: number;
  image_count?: number;
}

interface BackfillProgress {
  total: number;
  done: number;
  added: number;
  failed: number;
  skipped: number;
  current?: string;
  running: boolean;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductWithVariantCount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BackfillProgress | null>(null);

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
        .select(
          "*, categories(name), product_variants(id), product_images(id)"
        )
        .order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts(
      (prods ?? []).map((p: any) => ({
        ...p,
        variant_count: p.product_variants?.length ?? 0,
        image_count: p.product_images?.length ?? 0,
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

  async function handleBackfillOne(id: string, overwrite = false) {
    setBackfilling(id);
    try {
      const qs = overwrite ? "?overwrite=1" : "";
      const res = await fetch(
        `/api/admin/products/${id}/backfill-images${qs}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.status === "ok") {
        alert(`✓ ${data.imagesAdded} image(s) ajoutée(s).`);
      } else if (data.status === "skipped") {
        alert("Le produit a déjà des images. Utilisez 'Remplacer' pour les écraser.");
      } else if (data.status === "no_source") {
        alert("Ce produit n'a pas d'URL source flormar.");
      } else if (data.status === "no_images") {
        alert("Aucune image trouvée sur la page source.");
      } else {
        alert(`Erreur : ${data.message ?? "inconnue"}`);
      }
    } finally {
      setBackfilling(null);
      load();
    }
  }

  async function handleBackfillAllMissing() {
    if (
      !confirm(
        "Lancer la récupération des images pour tous les produits sans images ? Ceci peut prendre plusieurs minutes."
      )
    )
      return;

    const listRes = await fetch("/api/admin/products/missing-images");
    const list: { id: string; name: string; has_source_url: boolean }[] =
      await listRes.json();
    const targets = list.filter((p) => p.has_source_url);

    if (targets.length === 0) {
      alert("Aucun produit éligible (tous ont des images ou pas d'URL source).");
      return;
    }

    const progress: BackfillProgress = {
      total: targets.length,
      done: 0,
      added: 0,
      failed: 0,
      skipped: 0,
      running: true,
    };
    setBulkProgress({ ...progress });

    for (const p of targets) {
      progress.current = p.name;
      setBulkProgress({ ...progress });
      try {
        const res = await fetch(
          `/api/admin/products/${p.id}/backfill-images`,
          { method: "POST" }
        );
        const data = await res.json();
        if (data.status === "ok") {
          progress.added += data.imagesAdded ?? 0;
        } else if (data.status === "skipped") {
          progress.skipped++;
        } else {
          progress.failed++;
        }
      } catch {
        progress.failed++;
      }
      progress.done++;
      setBulkProgress({ ...progress });
    }

    progress.running = false;
    progress.current = undefined;
    setBulkProgress({ ...progress });
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBackfillAllMissing}
            disabled={!!bulkProgress?.running}
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-full text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Récupérer les images depuis flormar pour tous les produits qui n'en ont pas"
          >
            <Download size={16} /> Récupérer images manquantes
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-4 py-2 rounded-full text-sm transition-colors"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {bulkProgress && (
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900">
              {bulkProgress.running
                ? `Récupération en cours… ${bulkProgress.done}/${bulkProgress.total}`
                : `Terminé — ${bulkProgress.done}/${bulkProgress.total} produits traités`}
            </p>
            {!bulkProgress.running && (
              <button
                onClick={() => setBulkProgress(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Fermer
              </button>
            )}
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-brand transition-all"
              style={{
                width: `${
                  bulkProgress.total > 0
                    ? (bulkProgress.done / bulkProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>+{bulkProgress.added} images ajoutées</span>
            <span>{bulkProgress.skipped} ignorés</span>
            <span>{bulkProgress.failed} échecs</span>
            {bulkProgress.current && (
              <span className="truncate">→ {bulkProgress.current}</span>
            )}
          </div>
        </div>
      )}

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
                  <th className="px-4 py-3">Images</th>
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
                      {(p.image_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <ImageIcon size={13} /> {p.image_count}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <ImageIcon size={13} /> 0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleBackfillOne(p.id, (p.image_count ?? 0) > 0)
                          }
                          disabled={
                            backfilling === p.id || !!bulkProgress?.running
                          }
                          className="p-1.5 text-gray-400 hover:text-brand transition-colors disabled:opacity-40"
                          title={
                            (p.image_count ?? 0) > 0
                              ? "Re-télécharger les images depuis flormar (remplace)"
                              : "Récupérer les images depuis flormar"
                          }
                        >
                          <Download
                            size={15}
                            className={
                              backfilling === p.id ? "animate-pulse" : ""
                            }
                          />
                        </button>
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
