"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, uploadImage } from "@/lib/api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { rolePathBase } from "@/lib/permissions";
import { formatPrice } from "@/lib/pricing";
import type { Category, Product, Size } from "@/lib/types";
import { GLASS } from "@/lib/ui";

interface CategoryForm {
  id: number | null;
  name: string;
  description: string;
  image: string;
  isActive: boolean;
}

// A size row on the product form: chosen size name + its price + stock qty.
interface SizeRow {
  size: string;
  price: string;
  stock: string;
}

interface ProductForm {
  id: number | null;
  name: string;
  categoryId: string;
  price: string;
  stock: string;
  discountPercent: string;
  image: string;
  gallery: string[];
  description: string;
  sizes: SizeRow[];
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
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-[#2A1D15] dark:bg-stone-800 dark:border-stone-700 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-amber-400";

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
  gallery: [],
  description: "",
  sizes: [],
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
  const [sizeCatalog, setSizeCatalog] = useState<Size[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [busy, setBusy] = useState(false);
  const [imageMode, setImageMode] = useState<"upload" | "link">("upload");
  const [categoryImageMode, setCategoryImageMode] = useState<"upload" | "link">(
    "upload",
  );
  const [uploading, setUploading] = useState(false);
  const [galleryLink, setGalleryLink] = useState("");
  const pageCopy = VIEW_COPY[view];
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  // Keep links within the current role's namespace (admin: clean, cashier: /cashier/*).
  const base = rolePathBase(pathname);
  const handledParam = useRef(false);

  // Reflect the open drawer in the URL query (e.g. ?create=1 or ?edit=12) so the
  // action is shareable and the back button closes it.
  function setQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function closeDrawer() {
    setDrawer(null);
    setQuery({ create: null, edit: null });
  }

  async function handleMainImageUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setProductForm((form) => ({ ...form, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleCategoryImageUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setCategoryForm((form) => ({ ...form, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadImage(file)));
      setProductForm((form) => ({ ...form, gallery: [...form.gallery, ...urls] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addGalleryLink() {
    const url = galleryLink.trim();
    if (!url) return;
    setProductForm((form) => ({ ...form, gallery: [...form.gallery, url] }));
    setGalleryLink("");
  }

  function removeGalleryImage(index: number) {
    setProductForm((form) => ({
      ...form,
      gallery: form.gallery.filter((_, i) => i !== index),
    }));
  }

  const reload = useCallback(async () => {
    const [nextCategories, nextProducts, nextSizes] = await Promise.all([
      api<Category[]>("/categories"),
      api<Product[]>("/products"),
      api<Size[]>("/sizes"),
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setSizeCatalog(nextSizes);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextCategories, nextProducts, nextSizes] = await Promise.all([
          api<Category[]>("/categories"),
          api<Product[]>("/products"),
          api<Size[]>("/sizes"),
        ]);
        if (!cancelled) {
          setCategories(nextCategories);
          setProducts(nextProducts);
          setSizeCatalog(nextSizes);
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

  // Deep-link: open the create/edit drawer when arriving via ?create=1 or
  // ?edit=<id> (e.g. the "Edit" button on the Stock page, or a shared link).
  // Runs once per visit.
  useEffect(() => {
    if (handledParam.current) return;
    if (searchParams.get("create")) {
      handledParam.current = true;
      if (view === "categories") openCategoryCreate();
      else openProductCreate();
      return;
    }
    const editId = searchParams.get("edit");
    if (!editId) return;
    if (view === "categories") {
      const category = categories.find((c) => c.id === Number(editId));
      if (category) {
        handledParam.current = true;
        openCategoryEdit(category);
      }
    } else {
      const product = products.find((p) => p.id === Number(editId));
      if (product) {
        handledParam.current = true;
        openProductEdit(product);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, products, categories, view]);

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

  // Products filtered by the search box (name / category / size names).
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products
      .filter((p) => {
        if (categoryFilter !== "all" && p.categoryId !== categoryFilter) {
          return false;
        }
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          categoryName(p.categoryId).toLowerCase().includes(q) ||
          (p.sizes ?? []).some((s) => s.size.toLowerCase().includes(q))
        );
      })
      // Newest first — the highest id is the most recently created product.
      .sort((a, b) => b.id - a.id);
  }, [products, productQuery, categoryFilter, categoryName]);

  function openCategoryCreate() {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryImageMode("upload");
    setDrawer({ type: "category", mode: "create" });
    setQuery({ create: "1", edit: null });
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
    setCategoryImageMode(category.image ? "link" : "upload");
    setDrawer({ type: "category", mode: "edit" });
    setQuery({ edit: String(category.id), create: null });
    setError(null);
  }

  function openProductCreate() {
    setProductForm(EMPTY_PRODUCT_FORM);
    setImageMode("upload");
    setGalleryLink("");
    setDrawer({ type: "product", mode: "create" });
    setQuery({ create: "1", edit: null });
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
      gallery: product.gallery ?? [],
      description: product.description ?? "",
      sizes: (product.sizes ?? []).map((s) => ({
        size: s.size,
        price: String(s.price),
        stock: String(
          product.variants?.find((v) => v.size === s.size)?.stock ?? 0,
        ),
      })),
      isAvailable: product.isAvailable,
    });
    setImageMode(product.image ? "link" : "upload");
    setGalleryLink("");
    setDrawer({ type: "product", mode: "edit" });
    setQuery({ edit: String(product.id), create: null });
    setError(null);
  }

  function addSizeRow() {
    // Pre-select the first catalog size not already used.
    const used = new Set(productForm.sizes.map((r) => r.size));
    const next = sizeCatalog.find((s) => !used.has(s.name));
    setProductForm((form) => ({
      ...form,
      sizes: [...form.sizes, { size: next?.name ?? "", price: "", stock: "0" }],
    }));
  }

  function updateSizeRow(index: number, key: keyof SizeRow, value: string) {
    setProductForm((form) => ({
      ...form,
      sizes: form.sizes.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    }));
  }

  function removeSizeRow(index: number) {
    setProductForm((form) => ({
      ...form,
      sizes: form.sizes.filter((_, i) => i !== index),
    }));
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
      closeDrawer();
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

    // Sizes: pick a size + price per row. Quantities are set on the Stock page.
    const parsedSizes = buildSizes(productForm.sizes);
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
      gallery: productForm.gallery.length > 0 ? productForm.gallery : null,
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
      closeDrawer();
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
      <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {pageCopy.title}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {pageCopy.description}
          </p>
        </div>
      </header>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">Loading...</p>
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
                  <thead className="bg-stone-50 text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Products</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Image</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {[...categories]
                      .sort((a, b) => b.id - a.id)
                      .map((category) => (
                      <tr key={category.id} className="text-stone-800 transition-colors hover:bg-stone-50/70 dark:text-stone-200 dark:hover:bg-stone-800/40">
                        <td className="px-4 py-3">
                          <p className="font-medium text-stone-900 dark:text-stone-100">{category.name}</p>
                          <p className="mt-0.5 max-w-md truncate text-xs text-stone-400 dark:text-stone-500">
                            {category.description || "No description"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400">
                          {productCountByCategory.get(category.id) ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill active={category.isActive} activeLabel="Active" inactiveLabel="Hidden" />
                        </td>
                        <td className="px-4 py-3 text-stone-500 dark:text-stone-400">
                          {category.image ? "Attached" : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <RowActions
                            viewHref={`${base}/categories/${category.id}`}
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
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="relative max-w-sm flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search product, category, or size…"
                  aria-label="Search products"
                  className={`${INPUT_CLASS} pl-9 pr-9`}
                />
                {productQuery && (
                  <button
                    type="button"
                    onClick={() => setProductQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-700"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="relative shrink-0">
                <select
                  value={
                    categoryFilter === "all" ? "all" : String(categoryFilter)
                  }
                  onChange={(e) =>
                    setCategoryFilter(
                      e.target.value === "all" ? "all" : Number(e.target.value),
                    )
                  }
                  aria-label="Filter by category"
                  className={`${INPUT_CLASS} !w-56 cursor-pointer appearance-none pr-9 transition hover:border-stone-400 dark:hover:border-stone-600`}
                >
                  <option value="all">All categories ({products.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({productCountByCategory.get(c.id) ?? 0})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>
              {(productQuery || categoryFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setProductQuery("");
                    setCategoryFilter("all");
                  }}
                  className="shrink-0 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  Clear
                </button>
              )}
            </div>
            {products.length === 0 ? (
              <EmptyState message="No products yet." />
            ) : filteredProducts.length === 0 ? (
              <EmptyState message={`No products match “${productQuery}”.`} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
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
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="text-stone-800 transition-colors hover:bg-stone-50/70 dark:text-stone-200 dark:hover:bg-stone-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-stone-100 text-lg dark:bg-stone-800">
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
                              <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                                {product.name}
                              </p>
                              {product.sizes && product.sizes.length > 0 && (
                                <p className="truncate text-xs text-stone-400 dark:text-stone-500">
                                  {product.sizes
                                    .map((size) => `${size.size} ${formatPrice(size.price)}`)
                                    .join(" / ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-500 dark:text-stone-400">
                          {categoryName(product.categoryId)}
                        </td>
                        <td className="px-4 py-3">{productPriceLabel(product)}</td>
                        <td className="px-4 py-3">
                          <StockCell product={product} />
                        </td>
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
                            viewHref={`${base}/products/${product.id}`}
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
          onClose={() => closeDrawer()}
        >
          <form
            onSubmit={submitCategory}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
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
            <Field label="Image">
              <div className="mb-2 flex gap-1 rounded-lg bg-stone-100 p-1 text-sm dark:bg-stone-800">
                <button
                  type="button"
                  onClick={() => setCategoryImageMode("upload")}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                    categoryImageMode === "upload"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100"
                      : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryImageMode("link")}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                    categoryImageMode === "link"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100"
                      : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  Use link
                </button>
              </div>
              {categoryImageMode === "upload" ? (
                <input
                  key="category-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleCategoryImageUpload(event.target.files?.[0])
                  }
                  disabled={uploading}
                  className={INPUT_CLASS}
                />
              ) : (
                <input
                  key="category-image-link"
                  value={categoryForm.image}
                  onChange={(event) =>
                    setCategoryForm((form) => ({
                      ...form,
                      image: event.target.value,
                    }))
                  }
                  placeholder="https://…"
                  className={INPUT_CLASS}
                />
              )}
              {categoryForm.image && (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={categoryForm.image}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryForm((form) => ({ ...form, image: "" }))
                    }
                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              )}
            </Field>
            <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
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
            </div>
            <PanelActions
              busy={busy}
              submitLabel={drawer.mode === "create" ? "Create category" : "Save category"}
              onCancel={() => closeDrawer()}
            />
          </form>
        </SidePanel>
      )}

      {drawer?.type === "product" && (
        <SidePanel
          title={drawer.mode === "create" ? "Create product" : "Edit product"}
          description="Products are shown in the customer menu when available."
          onClose={() => closeDrawer()}
        >
          <form
            onSubmit={submitProduct}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
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
              <CategoryCombobox
                categories={categories}
                value={productForm.categoryId}
                onChange={(categoryId) =>
                  setProductForm((form) => ({ ...form, categoryId }))
                }
              />
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
            <Field label="Main image">
              <div className="mb-2 flex gap-1 rounded-lg bg-stone-100 p-1 text-sm dark:bg-stone-800">
                <button
                  type="button"
                  onClick={() => setImageMode("upload")}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                    imageMode === "upload"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100"
                      : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("link")}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                    imageMode === "link"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100"
                      : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  Use link
                </button>
              </div>
              {imageMode === "upload" ? (
                <input
                  key="product-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleMainImageUpload(event.target.files?.[0])
                  }
                  disabled={uploading}
                  className={INPUT_CLASS}
                />
              ) : (
                <input
                  key="product-image-link"
                  value={productForm.image}
                  onChange={(event) =>
                    setProductForm((form) => ({ ...form, image: event.target.value }))
                  }
                  placeholder="https://…"
                  className={INPUT_CLASS}
                />
              )}
              {productForm.image && (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productForm.image}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setProductForm((form) => ({ ...form, image: "" }))
                    }
                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              )}
            </Field>
            <Field label="Gallery (extra images)">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleGalleryUpload(event.target.files)}
                disabled={uploading}
                className={INPUT_CLASS}
              />
              <div className="mt-2 flex gap-2">
                <input
                  value={galleryLink}
                  onChange={(event) => setGalleryLink(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addGalleryLink();
                    }
                  }}
                  placeholder="…or paste an image link"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={addGalleryLink}
                  className="shrink-0 rounded-lg bg-stone-800 px-3 py-2 text-sm font-medium text-white dark:bg-stone-700"
                >
                  Add
                </button>
              </div>
              {productForm.gallery.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {productForm.gallery.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(index)}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs leading-none text-white"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
            <Field label="Sizes (optional)">
              {sizeCatalog.length === 0 ? (
                <p className="rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
                  No cup sizes defined yet. Add sizes on the{" "}
                  <Link
                    href={`${base}/stock`}
                    className="font-medium text-[#2A1D15] underline dark:text-amber-400"
                  >
                    Stock
                  </Link>{" "}
                  page first.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Column labels — aligned to the grid below. */}
                  {productForm.sizes.length > 0 && (
                    <div className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
                      <span>Size</span>
                      <span>Price</span>
                      <span>Qty</span>
                      <span />
                    </div>
                  )}
                  {productForm.sizes.map((row, index) => {
                    // Hide sizes chosen in other rows; keep this row's own value.
                    const usedElsewhere = new Set(
                      productForm.sizes
                        .filter((_, i) => i !== index)
                        .map((r) => r.size),
                    );
                    const options = sizeCatalog.filter(
                      (s) => !usedElsewhere.has(s.name),
                    );
                    return (
                      <div
                        key={index}
                        className="grid grid-cols-[1fr_1fr_1fr_2rem] items-center gap-2"
                      >
                        <select
                          value={row.size}
                          onChange={(e) =>
                            updateSizeRow(index, "size", e.target.value)
                          }
                          className={`${INPUT_CLASS} min-w-0`}
                        >
                          <option value="">Select…</option>
                          {options.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <div className="relative min-w-0">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500">
                            $
                          </span>
                          <input
                            value={row.price}
                            onChange={(e) =>
                              updateSizeRow(index, "price", e.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                            aria-label="Price"
                            className={`${INPUT_CLASS} pl-6`}
                          />
                        </div>
                        <input
                          value={row.stock}
                          onChange={(e) =>
                            updateSizeRow(
                              index,
                              "stock",
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          inputMode="numeric"
                          placeholder="Qty"
                          aria-label="Cups in stock for this size"
                          title="Cups in stock for this size"
                          className={`${INPUT_CLASS} min-w-0`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSizeRow(index)}
                          aria-label="Remove size"
                          className="flex h-9 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:text-stone-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addSizeRow}
                    disabled={productForm.sizes.length >= sizeCatalog.length}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-[#2A1D15] hover:text-[#2A1D15] disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:text-stone-400 dark:hover:border-amber-400 dark:hover:text-amber-400"
                  >
                    <span className="text-base leading-none">＋</span>
                    Add size
                  </button>
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    Size · price · Qty (cups in stock). Restock anytime on the{" "}
                    <Link
                      href={`${base}/stock`}
                      className="underline hover:text-stone-600 dark:hover:text-stone-300"
                    >
                      Stock
                    </Link>{" "}
                    page.
                  </p>
                </div>
              )}
            </Field>
            <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
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
            </div>
            <PanelActions
              busy={busy}
              submitLabel={drawer.mode === "create" ? "Create product" : "Save product"}
              onCancel={() => closeDrawer()}
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
    <section className={`overflow-hidden rounded-2xl ${GLASS}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              {count}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>
        </div>
        <button
          onClick={onCreate}
          className="rounded-lg bg-pos-button px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20]"
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
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-800"
      >
        View
      </Link>
      <button
        onClick={onEdit}
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-800"
      >
        Edit
      </button>
      <button
        onClick={onDelete}
        className="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
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
      {/* Backdrop is non-dismissing — only Close/Cancel can close the form. */}
      <div className="absolute inset-0 bg-stone-950/30" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-stone-900">
        <header className="border-b border-stone-200 px-6 py-5 dark:border-stone-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {title}
              </h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Close
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
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
    <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200 bg-white px-6 py-4 dark:border-stone-800 dark:bg-stone-900">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-pos-button px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20] disabled:opacity-50"
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
    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-500/15 dark:text-green-300">
      {activeLabel}
    </span>
  ) : (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
      {inactiveLabel}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-5 py-12 text-center text-sm text-stone-400 dark:text-stone-500">{message}</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </span>
      {children}
    </label>
  );
}

// Searchable category picker — keeps the visible option list short (Hicks' Law)
// by letting the user type to filter instead of scanning every category.
function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = categories.find((category) => String(category.id) === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((category) =>
      category.name.toLowerCase().includes(q),
    );
  }, [categories, query]);

  // Close the dropdown and reset the search in one step.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  // Close on outside click while open.
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  function pick(id: string) {
    onChange(id);
    close();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${INPUT_CLASS} flex items-center justify-between text-left`}
      >
        <span className={selected ? "text-stone-900 dark:text-stone-100" : "text-stone-400 dark:text-stone-500"}>
          {selected ? selected.name : "Select..."}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-stone-400 transition-transform dark:text-stone-500 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg dark:border-stone-800 dark:bg-stone-900">
          <div className="border-b border-stone-100 p-2 dark:border-stone-800">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search category…"
              className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm text-stone-900 outline-none focus:border-[#2A1D15] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-amber-400"
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-400 dark:text-stone-500">
                No categories found
              </li>
            ) : (
              filtered.map((category) => {
                const isSelected = String(category.id) === value;
                return (
                  <li key={category.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => pick(String(category.id))}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-stone-50 dark:hover:bg-stone-800 ${
                        isSelected
                          ? "font-medium text-[#2A1D15] dark:text-amber-400"
                          : "text-stone-700 dark:text-stone-300"
                      }`}
                    >
                      {category.name}
                      {isSelected && <span className="text-[#2A1D15] dark:text-amber-400">✓</span>}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Validate the size rows: each needs a picked size (unique), a valid price,
// and a valid stock quantity.
function buildSizes(
  rows: SizeRow[],
): { size: string; price: number; stock: number }[] | null | Error {
  const filled = rows.filter((r) => r.size.trim() || r.price.trim());
  if (filled.length === 0) return null;

  const seen = new Set<string>();
  const sizes: { size: string; price: number; stock: number }[] = [];
  for (const row of filled) {
    const size = row.size.trim();
    if (!size) return new Error("Pick a size for each row.");
    if (seen.has(size)) return new Error(`Size "${size}" is selected twice.`);
    seen.add(size);
    const price = Number(row.price);
    if (!row.price || Number.isNaN(price) || price < 0) {
      return new Error(`Enter a valid price for "${size}".`);
    }
    const stock = Number(row.stock || "0");
    if (Number.isNaN(stock) || stock < 0) {
      return new Error(`Enter a valid stock for "${size}".`);
    }
    sizes.push({ size, price, stock });
  }
  return sizes;
}

// Stock summary for the products table: how many sizes are out vs in stock,
// with a popover breaking it down per size. Sizeless products count as a
// single line (their base stock).
function StockCell({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const sized = !!product.sizes && product.sizes.length > 0;
  const lines = sized
    ? product.sizes!.map((s) => ({
        label: s.size,
        qty: product.variants?.find((v) => v.size === s.size)?.stock ?? 0,
      }))
    : [{ label: "Stock", qty: product.stock }];

  // out = number of sizes that are sold out; in = total cups across all sizes.
  const out = lines.filter((l) => l.qty <= 0).length;
  const inStock = lines.reduce((sum, l) => sum + Math.max(0, l.qty), 0);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium transition hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        <span
          className={
            out > 0
              ? "text-red-600 dark:text-red-400"
              : "text-stone-400 dark:text-stone-500"
          }
        >
          out {out}
        </span>
        <span className="text-stone-300 dark:text-stone-600">/</span>
        <span
          className={
            inStock > 0
              ? "text-green-600 dark:text-green-400"
              : "text-stone-400 dark:text-stone-500"
          }
        >
          in {inStock}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-48 rounded-xl border border-stone-200 bg-white p-2 text-left shadow-lg dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center justify-between px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
            <span>Stock by size</span>
            <span>in / out</span>
          </div>
          <ul className="space-y-0.5">
            {lines.map((l) => {
              const isOut = l.qty <= 0;
              const inCups = Math.max(0, l.qty);
              return (
                <li
                  key={l.label}
                  className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-sm"
                >
                  <span className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                    <span
                      className={`h-2 w-2 rounded-full ${isOut ? "bg-red-500" : "bg-green-500"}`}
                    />
                    {l.label}
                  </span>
                  <span className="text-xs font-medium tabular-nums">
                    <span className="text-green-600 dark:text-green-400">
                      {inCups}
                    </span>
                    <span className="text-stone-300 dark:text-stone-600"> / </span>
                    <span
                      className={
                        isOut
                          ? "text-red-600 dark:text-red-400"
                          : "text-stone-400 dark:text-stone-500"
                      }
                    >
                      {isOut ? 1 : 0}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function productPriceLabel(product: Product): string {
  if (product.sizes && product.sizes.length > 0) {
    const min = Math.min(...product.sizes.map((size) => Number(size.price)));
    return `from ${formatPrice(min)}`;
  }
  return formatPrice(product.price);
}
