"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { getSupabase } from "@/src/lib/supabase";
import type { Category } from "@/src/lib/types";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", image_url: "" });

  async function load() {
    const { data } = await getSupabase()
      .from("categories")
      .select("*")
      .order("name");
    setCategories(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", slug: "", image_url: "" });
    setShowForm(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, image_url: c.image_url ?? "" });
    setShowForm(true);
  }

  async function handleSave() {
    const body = {
      name: form.name,
      slug: form.slug,
      image_url: form.image_url || null,
    };
    const url = editing
      ? `/api/admin/categories/${editing.id}`
      : "/api/admin/categories";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette catégorie ?")) return;
    setDeleting(id);
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
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
              {editing ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </h2>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
              <input className={inputCls} value={form.name} onChange={set("name")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Slug *</label>
              <input className={inputCls} value={form.slug} onChange={set("slug")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                URL image (Supabase Storage)
              </label>
              <input className={inputCls} value={form.image_url} onChange={set("image_url")} />
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

      {categories.length === 0 ? (
        <p className="text-gray-400 text-center py-20">Aucune catégorie.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-brand transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
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
