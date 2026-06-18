"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import type { Category, Product, ProductSize } from "@/lib/types";

interface CategoryForm {
  id: number | null;
  name: string;
  description: string;
  image: string;
  isActive: boolean;
}

interface ProductForm {
  id: number | null;
  name: string;
  categoryId: string;
  price: string;
  stock: string;
  discountPercent: string;
  image: string;
  description: string;
  sizesText: string;
  isAvailable: boolean;
}

type Drawer =
  | { type: "category"; mode: "create" | "edit" }
  | { type: "product"; mode: "create" | "edit" }
  | null;

type DeleteTarget =
  | { type: "category"; id: number; name: string }
  | { type: "product"; id: number; name: string }
  | null;

const INPUT_CLASS =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-[#2A1D15]";

const EMPTY_CATEGORY_FORM: CategoryForm = {
  id: null,
  name: "",
  description: "",
  image: "",
  isActive: true,
};

const EMPTY_PRODUCT_FORM: ProductForm = {
  id: null,
  name: "",
  categoryId: "",
  price: "",
  stock: "0",
  discountPercent: "0",
  image: "",
  description: "",
  sizesText: "",
  isAvailable: true,
};

type ManagementView = "categories" | "products";

const VIEW_COPY: Record<ManagementView, { title: string; description: string }> = {
  categories: {
    title: "Category Management",
    description: "Manage menu categories and customer-facing menu sections.",
  },
  products: {
    title: "Product Management",
    description: "Manage products, prices, stock, sizes, and discounts.",
  },
};

export function AdminProductManagement({
  view = "products",
}: {
  view?: ManagementView;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [busy, setBusy] = useState(false);
  const pageCopy = VIEW_COPY[view];

  const reload = useCallback(async () => {
    const [nextCategories, nextProducts] = await Promise.all([
      api<Category[]>("/categories"),
      api<Product[]>("/products"),
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextCategories, nextProducts] = await Promise.all([
          api<Category[]>("/categories"),
          api<Product[]>("/products"),
        ]);
        if (!cancelled) {
          setCategories(nextCategories);
          setProducts(nextProducts);
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
    const map = new Map(categories.map((category) => [category.id, category.name]));
    return (id: number) => map.get(id) ?? "-";
  }, [categories]);

  const productCountByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    for (const product of products) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  function openCategoryCreate() {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setDrawer({ type: "category", mode: "create" });
    setError(null);
  }

  function openCategoryEdit(category: Category) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      image: category.image ?? "",
      isActive: category.isActive,
    });
    setDrawer({ type: "category", mode: "edit" });
    setError(null);
  }

  function openProductCreate() {
    setProductForm(EMPTY_PRODUCT_FORM);
    setDrawer({ type: "product", mode: "create" });
    setError(null);
  }

  function openProductEdit(product: Product) {
    setProductForm({
      id: product.id,
      name: product.name,
      categoryId: String(product.categoryId),
      price: product.price,
      stock: String(product.stock),
      discountPercent: String(product.discountPercent ?? 0),
      image: product.image ?? "",
      description: product.description ?? "",
      sizesText: formatSizes(product.sizes),
      isAvailable: product.isAvailable,
    });
    setDrawer({ type: "product", mode: "edit" });
    setError(null);
  }

  async function submitCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryForm.name.trim()) return;

    setBusy(true);
    setError(null);
    const payload = {
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim() || undefined,
      image: categoryForm.image.trim() || undefined,
      isActive: categoryForm.isActive,
    };

    try {
      if (categoryForm.id === null) {
        await api("/categories", { method: "POST", body: payload });
      } else {
        await api(`/categories/${categoryForm.id}`, {
          method: "PATCH",
          body: payload,
        });
      }
      await reload();
      setDrawer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (!productForm.categoryId) {
      setError("Pick a category for the product");
      return;
    }

    const parsedSizes = parseSizes(productForm.sizesText);
    if (parsedSizes instanceof Error) {
      setError(parsedSizes.message);
      return;
    }

    setBusy(true);
    setError(null);
    const payload = {
      name: productForm.name.trim(),
      description: productForm.description.trim() || undefined,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      discountPercent: Number(productForm.discountPercent || "0"),
      image: productForm.image.trim() || undefined,
      sizes: parsedSizes,
      categoryId: Number(productForm.categoryId),
      isAvailable: productForm.isAvailable,
    };

    try {
      if (productForm.id === null) {
        await api("/products", { method: "POST", body: payload });
      } else {
        await api(`/products/${productForm.id}`, { method: "PATCH", body: payload });
      }
      await reload();
      setDrawer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setBusy(true);
    setError(null);
    try {
      await api(`/${deleteTarget.type === "category" ? "categories" : "products"}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      await reload();
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete ${deleteTarget.type}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {pageCopy.title}
          </h1>
          <p className="text-sm text-stone-500">
            {pageCopy.description}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
        >
          Dashboard
        </Link>
      </header>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <div className="space-y-6">
          {view === "categories" && (
            <ManagementSection
              title="Menu Categories"
              description="Group customer-facing products into visible menu sections."
              count={categories.length}
              actionLabel="Create category"
              onCreate={openCategoryCreate}
            >
            {categories.length === 0 ? (
              <EmptyState message="No categories yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-stone-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Products</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Image</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {categories.map((category) => (
                      <tr key={category.id} className="text-stone-800">
                        <td className="px-4 py-3">
                          <p className="font-medium text-stone-900">{category.name}</p>
                          <p className="mt-0.5 max-w-md truncate text-xs text-stone-400">
                            {category.description || "No description"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {productCountByCategory.get(category.id) ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill active={category.isActive} activeLabel="Active" inactiveLabel="Hidden" />
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {category.image ? "Attached" : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <RowActions
                            viewHref={`/admin/categories/${category.id}`}
                            onEdit={() => openCategoryEdit(category)}
                            onDelete={() =>
                              setDeleteTarget({
                                type: "category",
                                id: category.id,
                                name: category.name,
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </ManagementSection>
          )}

          {view === "products" && (
            <ManagementSection
              title="Products"
              description="Control item details, availability, stock, prices, and menu visibility."
              count={products.length}
              actionLabel="Create product"
              onCreate={openProductCreate}
            >
            {products.length === 0 ? (
              <EmptyState message="No products yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-stone-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Discount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products.map((product) => (
                      <tr key={product.id} className="text-stone-800">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-stone-100 text-lg">
                              {product.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                "☕"
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-stone-900">
                                {product.name}
                              </p>
                              {product.sizes && product.sizes.length > 0 && (
                                <p className="truncate text-xs text-stone-400">
                                  {product.sizes
                                    .map((size) => `${size.size} ${formatPrice(size.price)}`)
                                    .join(" / ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {categoryName(product.categoryId)}
                        </td>
                        <td className="px-4 py-3">{productPriceLabel(product)}</td>
                        <td className="px-4 py-3">{product.stock}</td>
                        <td className="px-4 py-3">
                          {product.discountPercent ? `${product.discountPercent}%` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            active={product.isAvailable}
                            activeLabel="Available"
                            inactiveLabel="Hidden"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <RowActions
                            viewHref={`/admin/menu/${product.id}`}
                            onEdit={() => openProductEdit(product)}
                            onDelete={() =>
                              setDeleteTarget({
                                type: "product",
                                id: product.id,
                                name: product.name,
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </ManagementSection>
          )}
        </div>
      )}

      {drawer?.type === "category" && (
        <SidePanel
          title={drawer.mode === "create" ? "Create category" : "Edit category"}
          description="Categories appear as sections on the customer menu."
          onClose={() => setDrawer(null)}
        >
          <form onSubmit={submitCategory} className="space-y-4">
            <Field label="Name">
              <input
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((form) => ({ ...form, name: event.target.value }))
                }
                required
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Image URL">
              <input
                value={categoryForm.image}
                onChange={(event) =>
                  setCategoryForm((form) => ({ ...form, image: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={categoryForm.isActive}
                onChange={(event) =>
                  setCategoryForm((form) => ({
                    ...form,
                    isActive: event.target.checked,
                  }))
                }
              />
              Active on menu
            </label>
            <PanelActions
              busy={busy}
              submitLabel={drawer.mode === "create" ? "Create category" : "Save category"}
              onCancel={() => setDrawer(null)}
            />
          </form>
        </SidePanel>
      )}

      {drawer?.type === "product" && (
        <SidePanel
          title={drawer.mode === "create" ? "Create product" : "Edit product"}
          description="Products are shown in the customer menu when available."
          onClose={() => setDrawer(null)}
        >
          <form onSubmit={submitProduct} className="space-y-4">
            <Field label="Name">
              <input
                value={productForm.name}
                onChange={(event) =>
                  setProductForm((form) => ({ ...form, name: event.target.value }))
                }
                required
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Category">
              <select
                value={productForm.categoryId}
                onChange={(event) =>
                  setProductForm((form) => ({
                    ...form,
                    categoryId: event.target.value,
                  }))
                }
                required
                className={INPUT_CLASS}
              >
                <option value="">Select...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Base price ($)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.price}
                  onChange={(event) =>
                    setProductForm((form) => ({
                      ...form,
                      price: event.target.value,
                    }))
                  }
                  required
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Stock">
                <input
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={(event) =>
                    setProductForm((form) => ({
                      ...form,
                      stock: event.target.value,
                    }))
                  }
                  required
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <Field label="Discount (%)">
              <input
                type="number"
                min="0"
                max="100"
                value={productForm.discountPercent}
                onChange={(event) =>
                  setProductForm((form) => ({
                    ...form,
                    discountPercent: event.target.value,
                  }))
                }
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Image URL">
              <input
                value={productForm.image}
                onChange={(event) =>
                  setProductForm((form) => ({ ...form, image: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={productForm.description}
                onChange={(event) =>
                  setProductForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Sizes (optional, one per line: Small=2.50)">
              <textarea
                value={productForm.sizesText}
                onChange={(event) =>
                  setProductForm((form) => ({
                    ...form,
                    sizesText: event.target.value,
                  }))
                }
                rows={4}
                className={`${INPUT_CLASS} font-mono text-sm`}
                placeholder={"Small=2.50\nMedium=3.00\nLarge=3.50"}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={productForm.isAvailable}
                onChange={(event) =>
                  setProductForm((form) => ({
                    ...form,
                    isAvailable: event.target.checked,
                  }))
                }
              />
              Available for sale
            </label>
            <PanelActions
              busy={busy}
              submitLabel={drawer.mode === "create" ? "Create product" : "Save product"}
              onCancel={() => setDrawer(null)}
            />
          </form>
        </SidePanel>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type}`}
          message={`Delete "${deleteTarget.name}"? This action cannot be undone.`}
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </main>
  );
}

function ManagementSection({
  title,
  description,
  count,
  actionLabel,
  onCreate,
  children,
}: {
  title: string;
  description: string;
  count: number;
  actionLabel: string;
  onCreate: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
              {count}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        </div>
        <button
          onClick={onCreate}
          className="rounded-lg bg-[#2A1D15] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20]"
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function RowActions({
  viewHref,
  onEdit,
  onDelete,
}: {
  viewHref: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={viewHref}
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
      >
        View
      </Link>
      <button
        onClick={onEdit}
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
      >
        Edit
      </button>
      <button
        onClick={onDelete}
        className="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );
}

function SidePanel({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-stone-950/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="border-b border-stone-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-stone-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-stone-500">{description}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Close
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-stone-900">{title}</h2>
        <p className="mt-2 text-sm text-stone-500">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelActions({
  busy,
  submitLabel,
  onCancel,
}: {
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-2 border-t border-stone-200 bg-white px-6 py-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[#2A1D15] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20] disabled:opacity-50"
      >
        {busy ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function StatusPill({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return active ? (
    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
      {activeLabel}
    </span>
  ) : (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
      {inactiveLabel}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-5 py-12 text-center text-sm text-stone-400">{message}</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function parseSizes(value: string): ProductSize[] | null | Error {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const sizes: ProductSize[] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)[=:,]\s*(\d+(?:\.\d{1,2})?)$/);
    if (!match) {
      return new Error(`Invalid size row: "${line}". Use Small=2.50`);
    }
    sizes.push({ size: match[1].trim(), price: Number(match[2]) });
  }

  return sizes;
}

function formatSizes(sizes: ProductSize[] | null): string {
  if (!sizes || sizes.length === 0) return "";
  return sizes.map((size) => `${size.size}=${Number(size.price).toFixed(2)}`).join("\n");
}

function productPriceLabel(product: Product): string {
  if (product.sizes && product.sizes.length > 0) {
    const min = Math.min(...product.sizes.map((size) => Number(size.price)));
    return `from ${formatPrice(min)}`;
  }
  return formatPrice(product.price);
}
