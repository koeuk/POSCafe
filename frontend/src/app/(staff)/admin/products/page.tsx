"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api";
import { Role, type Category, type Product } from "@/lib/types";

interface ProductForm {
  id: number | null;
  name: string;
  categoryId: string;
  price: string;
  stock: string;
  description: string;
  isAvailable: boolean;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-stone-900";

const EMPTY_FORM: ProductForm = {
  id: null,
  name: "",
  categoryId: "",
  price: "",
  stock: "0",
  description: "",
  isAvailable: true,
};

function ProductManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [catName, setCatName] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [prodBusy, setProdBusy] = useState(false);

  const reload = useCallback(async () => {
    const [cats, prods] = await Promise.all([
      api<Category[]>("/categories"),
      api<Product[]>("/products"),
    ]);
    setCategories(cats);
    setProducts(prods);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [cats, prods] = await Promise.all([
          api<Category[]>("/categories"),
          api<Product[]>("/products"),
        ]);
        if (!cancelled) {
          setCategories(cats);
          setProducts(prods);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: number) => map.get(id) ?? "—";
  }, [categories]);

  // --- Category actions ---
  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatBusy(true);
    setError(null);
    try {
      await api("/categories", { method: "POST", body: { name: catName.trim() } });
      setCatName("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setCatBusy(false);
    }
  }

  async function deleteCategory(id: number) {
    setError(null);
    try {
      await api(`/categories/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  // --- Product actions ---
  function editProduct(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      categoryId: String(p.categoryId),
      price: p.price,
      stock: String(p.stock),
      description: p.description ?? "",
      isAvailable: p.isAvailable,
    });
    setError(null);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function submitProduct(e: FormEvent) {
    e.preventDefault();
    if (!form.categoryId) {
      setError("Pick a category for the product");
      return;
    }
    setProdBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: Number(form.price),
      stock: Number(form.stock),
      categoryId: Number(form.categoryId),
      isAvailable: form.isAvailable,
    };
    try {
      if (form.id === null) {
        await api("/products", { method: "POST", body: payload });
      } else {
        await api(`/products/${form.id}`, { method: "PATCH", body: payload });
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setProdBusy(false);
    }
  }

  async function deleteProduct(id: number) {
    setError(null);
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      if (form.id === id) resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Menu Management</h1>
          <p className="text-sm text-stone-500">Manage categories & products</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : (
          <div className="space-y-10">
            {/* Categories */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-stone-900">
                Categories
              </h2>
              <form onSubmit={addCategory} className="mb-4 flex gap-2">
                <input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-stone-900"
                />
                <button
                  type="submit"
                  disabled={catBusy || !catName.trim()}
                  className="rounded-lg bg-stone-900 px-4 py-2 font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              {categories.length === 0 ? (
                <p className="text-sm text-stone-400">No categories yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-2 rounded-full bg-white border border-stone-200 px-3 py-1.5 text-sm text-stone-700"
                    >
                      {c.name}
                      <button
                        onClick={() => deleteCategory(c.id)}
                        className="text-stone-400 transition hover:text-red-500"
                        aria-label={`Delete ${c.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Product form */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-stone-900">
                {form.id === null ? "Add product" : "Edit product"}
              </h2>
              <form
                onSubmit={submitProduct}
                className="grid grid-cols-1 gap-4 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-2"
              >
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categoryId: e.target.value }))
                    }
                    required
                    className={INPUT_CLASS}
                  >
                    <option value="">Select…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Price ($)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    required
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Stock">
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    required
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Description (optional)">
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className={INPUT_CLASS}
                  />
                </Field>
                <label className="flex items-center gap-2 self-end text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.isAvailable}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isAvailable: e.target.checked }))
                    }
                  />
                  Available for sale
                </label>

                <div className="flex gap-2 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={prodBusy}
                    className="rounded-lg bg-stone-900 px-5 py-2.5 font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
                  >
                    {prodBusy
                      ? "Saving…"
                      : form.id === null
                        ? "Add product"
                        : "Update product"}
                  </button>
                  {form.id !== null && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-lg border border-stone-300 px-5 py-2.5 font-medium text-stone-700 transition hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* Product list */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-stone-900">
                Products ({products.length})
              </h2>
              {products.length === 0 ? (
                <p className="text-sm text-stone-400">No products yet.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-stone-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                        <th className="px-4 py-3 font-medium">Stock</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {products.map((p) => (
                        <tr key={p.id} className="text-stone-800">
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-stone-500">
                            {categoryName(p.categoryId)}
                          </td>
                          <td className="px-4 py-3">
                            ${Number(p.price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">{p.stock}</td>
                          <td className="px-4 py-3">
                            {p.isAvailable ? (
                              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                                Available
                              </span>
                            ) : (
                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                                Hidden
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => editProduct(p)}
                              className="mr-3 text-stone-600 transition hover:text-stone-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="text-stone-400 transition hover:text-red-500"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function AdminProductsPage() {
  return (
    <RequireAuth role={Role.ADMIN}>
      <ProductManagement />
    </RequireAuth>
  );
}
