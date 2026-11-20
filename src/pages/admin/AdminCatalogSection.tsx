import {
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import type { Category, Product, ProductReturnPolicy, ProductVariation } from '../../types/commerce.ts';
import { formatDateShort, formatNaira } from '../../utils/currency.ts';
import { sanitizeHtml } from '../../utils/sanitizeHtml.ts';

interface Props {
  mode: 'products' | 'categories' | 'inventory';
  products: Product[];
  categories: Category[];
  onRefresh: () => Promise<void>;
  onNavigateProduct: (slug: string) => void;
  pushToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type EditorTab =
  | 'general'
  | 'images'
  | 'description'
  | 'pricing'
  | 'inventory'
  | 'categories'
  | 'variations'
  | 'shipping'
  | 'seo'
  | 'return_policy';

const EMPTY_RETURN_POLICY: ProductReturnPolicy = {
  enabled: false,
  returnWindowDays: 7,
  eligibleConditions: '',
  nonReturnableConditions: '',
  exchangeRules: '',
  refundConditions: '',
  returnShippingPayer: 'depends',
  formattedText: '',
};

export function AdminCatalogSection({
  mode,
  products,
  categories,
  onRefresh,
  onNavigateProduct,
  pushToast,
}: Props) {
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('general');
  const [descPreview, setDescPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Product list filters
  const [prodSearch, setProdSearch] = useState('');
  const [prodCatFilter, setProdCatFilter] = useState('all');

  // New variation draft
  const [varSize, setVarSize] = useState('');
  const [varColor, setVarColor] = useState('');
  const [varPrice, setVarPrice] = useState<number>(45000);
  const [varSalePrice, setVarSalePrice] = useState<string>('');
  const [varStock, setVarStock] = useState<number>(5);

  // Category editor state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catParentId, setCatParentId] = useState<string>('');
  const [catImage, setCatImage] = useState('');
  const [catBannerImage, setCatBannerImage] = useState('');
  const [catFeatured, setCatFeatured] = useState(true);
  const [catVisible, setCatVisible] = useState(true);
  const [savingCat, setSavingCat] = useState(false);
  const [uploadingCatImg, setUploadingCatImg] = useState(false);

  // Inline stock edits
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (prodCatFilter !== 'all' && p.categoryId !== prodCatFilter && p.subcategoryId !== prodCatFilter) {
        return false;
      }
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.brand || ''} ${p.categoryName} ${
          p.subcategoryName || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, prodSearch, prodCatFilter]);

  const openNewProduct = () => {
    setEditorTab('general');
    setDescPreview(false);
    setEditingProduct({
      name: '',
      sku: `DM-${Date.now().toString().slice(-4)}`,
      brand: 'Diamond Market',
      material: '',
      shortDescription: '',
      description: '',
      careInstructions: '',
      sizeGuide: '',
      price: 45000,
      salePrice: null,
      saleStartDate: null,
      saleEndDate: null,
      categoryId: sortedCategories[0]?.id || '',
      subcategoryId: null,
      images: [],
      stockQuantity: 10,
      manageStock: true,
      lowStockThreshold: 3,
      inStock: true,
      status: 'publish',
      featured: false,
      isNewArrival: true,
      isBestSeller: false,
      codAllowed: true,
      weightKg: 0.8,
      dimensions: '',
      tags: [],
      specifications: [],
      type: 'simple',
      variations: [],
      seoTitle: '',
      seoDescription: '',
      slug: '',
      returnPolicy: { ...EMPTY_RETURN_POLICY },
    });
  };

  const openEditProduct = (product: Product) => {
    setEditorTab('general');
    setDescPreview(false);
    setEditingProduct({
      ...product,
      returnPolicy: product.returnPolicy
        ? { ...EMPTY_RETURN_POLICY, ...product.returnPolicy }
        : { ...EMPTY_RETURN_POLICY },
    });
  };

  const handleMultiImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !editingProduct) return;
    setUploadingImg(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        const res = await apiFetch<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: form,
        });
        uploadedUrls.push(res.url);
      }
      setEditingProduct((prev) =>
        prev ? { ...prev, images: [...(prev.images || []), ...uploadedUrls] } : prev
      );
      pushToast(`Uploaded ${uploadedUrls.length} image(s)`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    if (!editingProduct?.images) return;
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= editingProduct.images.length) return;
    const copy = [...editingProduct.images];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, moved);
    setEditingProduct({ ...editingProduct, images: copy });
  };

  const setPrimaryImage = (index: number) => {
    if (!editingProduct?.images || index === 0) return;
    const copy = [...editingProduct.images];
    const [chosen] = copy.splice(index, 1);
    copy.unshift(chosen);
    setEditingProduct({ ...editingProduct, images: copy });
    pushToast('Primary image updated', 'info');
  };

  const insertDescSnippet = (snippet: string) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      description: `${editingProduct.description || ''}${editingProduct.description ? '\n' : ''}${snippet}`,
    });
  };

  const addVariationRow = () => {
    if (!editingProduct) return;
    const attributes: Record<string, string> = {};
    if (varSize.trim()) attributes.Size = varSize.trim();
    if (varColor.trim()) attributes.Color = varColor.trim();
    if (Object.keys(attributes).length === 0) {
      pushToast('Enter at least a Size or Color for this variation.', 'error');
      return;
    }
    const skuBase = editingProduct.sku || 'DM-VAR';
    const suffix = Object.values(attributes)
      .join('-')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8);
    const newVar: ProductVariation = {
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      sku: `${skuBase}-${suffix}`,
      attributes,
      price: Number(varPrice) || Number(editingProduct.price) || 45000,
      salePrice: varSalePrice ? Number(varSalePrice) : null,
      stockQuantity: Number(varStock) || 0,
      inStock: (Number(varStock) || 0) > 0,
    };
    setEditingProduct({
      ...editingProduct,
      type: 'variable',
      variations: [...(editingProduct.variations || []), newVar],
    });
    setVarSize('');
    setVarColor('');
    pushToast('Variation added', 'success');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editingProduct.name?.trim()) {
      setEditorTab('general');
      pushToast('Product name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingProduct.id) {
        await apiFetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingProduct),
        });
        pushToast('Product saved & synced', 'success');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(editingProduct),
        });
        pushToast('New product created', 'success');
      }
      setEditingProduct(null);
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (product: Product) => {
    const nextStatus = product.status === 'publish' ? 'draft' : 'publish';
    try {
      await apiFetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      pushToast(`${product.name} marked as ${nextStatus}`, 'success');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      await apiFetch(`/api/admin/products/${product.id}/duplicate`, { method: 'POST' });
      pushToast(`Duplicated "${product.name}" as Draft`, 'success');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Duplicate failed', 'error');
    }
  };

  const handleDeleteProduct = async (product: Product, archiveOnly: boolean) => {
    const confirmed = window.confirm(
      archiveOnly
        ? `Archive "${product.name}" from public storefront?`
        : `Permanently delete "${product.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await apiFetch(`/api/admin/products/${product.id}?archive=${archiveOnly}`, {
        method: 'DELETE',
      });
      pushToast(archiveOnly ? 'Product archived' : 'Product deleted', 'info');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // --- Category Management Helpers ---
  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatSlug('');
    setCatDesc('');
    setCatParentId('');
    setCatImage('');
    setCatBannerImage('');
    setCatFeatured(true);
    setCatVisible(true);
  };

  const loadCategoryForEdit = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDesc(cat.description || '');
    setCatParentId(cat.parentId || '');
    setCatImage(cat.image || '');
    setCatBannerImage(cat.bannerImage || '');
    setCatFeatured(Boolean(cat.featured));
    setCatVisible(cat.visible !== false);
  };

  const handleCategoryImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'image' | 'bannerImage'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCatImg(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await apiFetch<{ url: string }>('/api/admin/upload', {
        method: 'POST',
        body: form,
      });
      if (field === 'image') setCatImage(res.url);
      else setCatBannerImage(res.url);
      pushToast('Category image uploaded', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingCatImg(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      const payload = {
        name: catName.trim(),
        slug: catSlug.trim() || undefined,
        description: catDesc.trim(),
        parentId: catParentId || null,
        image: catImage.trim(),
        bannerImage: catBannerImage.trim(),
        featured: catFeatured,
        visible: catVisible,
      };
      if (editingCategoryId) {
        await apiFetch(`/api/admin/categories/${editingCategoryId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        pushToast('Category updated', 'success');
      } else {
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('Category created', 'success');
      }
      resetCategoryForm();
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save category', 'error');
    } finally {
      setSavingCat(false);
    }
  };

  const handleToggleCategoryFlag = async (
    cat: Category,
    field: 'visible' | 'featured',
    nextVal: boolean
  ) => {
    try {
      await apiFetch(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: nextVal }),
      });
      pushToast(`Updated "${cat.name}"`, 'success');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const handleReorderCategory = async (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= sortedCategories.length) return;
    const copy = [...sortedCategories];
    const [item] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, item);
    try {
      await apiFetch('/api/admin/categories/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds: copy.map((c) => c.id) }),
      });
      pushToast('Category display order updated', 'success');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Reorder failed', 'error');
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (
      !window.confirm(
        `Delete category "${cat.name}"? Products inside this category will NOT be deleted—they will remain safe in your catalog.`
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
      if (editingCategoryId === cat.id) resetCategoryForm();
      pushToast('Category removed safely (products preserved)', 'info');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to remove category', 'error');
    }
  };

  const handleSaveStock = async (product: Product) => {
    const qty = stockDrafts[product.id] ?? product.stockQuantity;
    try {
      await apiFetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ stockQuantity: qty }),
      });
      pushToast(`Inventory updated for ${product.sku}`, 'success');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Inventory update failed', 'error');
    }
  };

  // --- CATEGORIES VIEW ---
  if (mode === 'categories') {
    const parentCandidates = sortedCategories.filter((c) => !c.parentId && c.id !== editingCategoryId);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#111111] flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-[#C6A15B]" />
              {editingCategoryId ? 'Edit Category' : 'Add Category / Subcategory'}
            </h2>
            {editingCategoryId && (
              <button
                type="button"
                onClick={resetCategoryForm}
                className="text-xs font-semibold text-[#8C6D34] underline cursor-pointer"
              >
                New Category
              </button>
            )}
          </div>

          <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-[#111111] mb-1">Category Name *</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Formal Shoes or Casual Wears"
                className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#111111] mb-1">URL Slug</label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="auto-generated"
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111111] mb-1">Parent Category</label>
                <select
                  value={catParentId}
                  onChange={(e) => setCatParentId(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                >
                  <option value="">None (Top-Level)</option>
                  {parentCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#111111] mb-1">Description</label>
              <textarea
                rows={2}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Collection overview shown on category banner..."
                className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block font-semibold text-[#111111]">Thumbnail Image</label>
                {catImage && (
                  <img
                    src={catImage}
                    alt="Thumb"
                    className="w-full h-20 object-cover rounded-xl border border-[#E8E8E8]"
                  />
                )}
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E8E8E8] rounded-xl cursor-pointer hover:border-[#111111] bg-[#FAF8F3]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingCatImg ? 'Uploading...' : 'Upload Thumb'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleCategoryImageUpload(e, 'image')}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="block font-semibold text-[#111111]">Banner Image</label>
                {catBannerImage && (
                  <img
                    src={catBannerImage}
                    alt="Banner"
                    className="w-full h-20 object-cover rounded-xl border border-[#E8E8E8]"
                  />
                )}
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E8E8E8] rounded-xl cursor-pointer hover:border-[#111111] bg-[#FAF8F3]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Banner</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleCategoryImageUpload(e, 'bannerImage')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catVisible}
                  onChange={(e) => setCatVisible(e.target.checked)}
                />
                <span>Visible on Storefront</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catFeatured}
                  onChange={(e) => setCatFeatured(e.target.checked)}
                />
                <span>Featured Category</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingCat}
              className="w-full py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] transition-colors cursor-pointer"
            >
              {savingCat
                ? 'Saving...'
                : editingCategoryId
                ? 'Update Category'
                : 'Create Category'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#111111]">
                Categories &amp; Display Order ({sortedCategories.length})
              </h2>
              <p className="text-xs text-[#333333]/75">
                Reorder navigation sequence, toggle storefront visibility, or inspect product counts.
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#E8E8E8]">
            {sortedCategories.map((c, idx) => {
              const parentName = c.parentId
                ? categories.find((p) => p.id === c.parentId)?.name
                : null;
              return (
                <div key={c.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.image ? (
                      <img
                        src={c.image}
                        alt={c.name}
                        className="w-11 h-11 rounded-xl object-cover border border-[#E8E8E8] shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111111] truncate">
                        {parentName ? `${parentName} → ` : ''}
                        {c.name}
                      </p>
                      <p className="text-[11px] text-[#333333]/75 font-mono-num">
                        /{c.slug} · {c.productCount ?? 0} products
                        {c.createdAt ? ` · Created ${formatDateShort(c.createdAt)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReorderCategory(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 text-neutral-500 hover:text-[#111111] disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorderCategory(idx, 1)}
                      disabled={idx === sortedCategories.length - 1}
                      className="p-1.5 text-neutral-500 hover:text-[#111111] disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryFlag(c, 'featured', !c.featured)}
                      className={`p-1.5 cursor-pointer ${
                        c.featured ? 'text-[#C6A15B]' : 'text-neutral-300 hover:text-[#C6A15B]'
                      }`}
                      title={c.featured ? 'Featured on Homepage' : 'Mark Featured'}
                    >
                      <Star className={`w-4 h-4 ${c.featured ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleCategoryFlag(c, 'visible', !(c.visible !== false))
                      }
                      className={`p-1.5 cursor-pointer ${
                        c.visible !== false ? 'text-emerald-700' : 'text-neutral-400'
                      }`}
                      title={c.visible !== false ? 'Visible on Storefront' : 'Hidden'}
                    >
                      {c.visible !== false ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => loadCategoryForEdit(c)}
                      className="p-1.5 text-neutral-500 hover:text-[#111111] cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c)}
                      className="p-1.5 text-neutral-400 hover:text-rose-700 cursor-pointer"
                      title="Delete Category (Products preserved)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- INVENTORY VIEW ---
  if (mode === 'inventory') {
    return (
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
          Inventory Management
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-[#E8E8E8] text-xs text-[#333333]/70 uppercase">
              <tr>
                <th className="py-3 pr-4">Piece</th>
                <th className="py-3 pr-4">SKU</th>
                <th className="py-3 pr-4">Price</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Stock Qty</th>
                <th className="py-3 text-right">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {products.map((p) => {
                const draft = stockDrafts[p.id] ?? p.stockQuantity;
                const isLow =
                  p.manageStock && p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold;
                const isOut = p.manageStock && p.stockQuantity === 0;

                return (
                  <tr key={p.id}>
                    <td className="py-3 pr-4 font-medium text-[#111111]">{p.name}</td>
                    <td className="py-3 pr-4 font-mono-num text-xs text-[#333333]/75">{p.sku}</td>
                    <td className="py-3 pr-4 font-mono-num">{formatNaira(p.salePrice || p.price)}</td>
                    <td className="py-3 pr-4 text-xs font-semibold">
                      {isOut ? (
                        <span className="text-rose-700">Out of Stock</span>
                      ) : isLow ? (
                        <span className="text-amber-700">Low Stock Alert</span>
                      ) : (
                        <span className="text-emerald-700">In Stock</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        min={0}
                        value={draft}
                        onChange={(e) =>
                          setStockDrafts((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                        }
                        className="w-24 border border-[#E8E8E8] rounded-xl px-2.5 py-1.5 text-xs font-mono-num"
                      />
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSaveStock(p)}
                        className="px-4 py-1.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- PRODUCTS TABLE + 10-SECTION PRODUCT EDITOR ---
  const editorTabs: { id: EditorTab; label: string }[] = [
    { id: 'general', label: '1. General' },
    { id: 'images', label: '2. Images' },
    { id: 'description', label: '3. Description' },
    { id: 'pricing', label: '4. Pricing' },
    { id: 'inventory', label: '5. Inventory' },
    { id: 'categories', label: '6. Categories' },
    { id: 'variations', label: '7. Variations' },
    { id: 'shipping', label: '8. Shipping' },
    { id: 'seo', label: '9. SEO' },
    { id: 'return_policy', label: '10. Return Policy' },
  ];

  const parentCategories = sortedCategories.filter((c) => !c.parentId);
  const subCategoriesForSelected = sortedCategories.filter(
    (c) => c.parentId && c.parentId === editingProduct?.categoryId
  );

  const rp: ProductReturnPolicy = {
    ...EMPTY_RETURN_POLICY,
    ...(editingProduct?.returnPolicy || {}),
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111111]">
              Shoes &amp; Wears Catalog ({filteredProducts.length})
            </h2>
            <p className="text-xs text-[#333333]/75">
              Create, edit, duplicate, toggle visibility, configure size variations, and customize product-level return policies.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewProduct}
            className="px-5 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] transition-colors cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={prodSearch}
              onChange={(e) => setProdSearch(e.target.value)}
              placeholder="Search product name, SKU, or brand..."
              className="w-full h-10 pl-9 pr-3 rounded-full border border-[#E8E8E8] bg-[#FAF8F3] text-xs focus:outline-none focus:border-[#111111]"
            />
          </div>
          <select
            value={prodCatFilter}
            onChange={(e) => setProdCatFilter(e.target.value)}
            className="h-10 px-4 rounded-full border border-[#E8E8E8] bg-white text-xs"
          >
            <option value="all">All Categories</option>
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `— ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-[#E8E8E8] text-xs text-[#333333]/70 uppercase">
              <tr>
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">SKU</th>
                <th className="py-3 pr-4">Category</th>
                <th className="py-3 pr-4">Price</th>
                <th className="py-3 pr-4">Stock</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.images[0] || ''}
                        alt={p.name}
                        className="w-11 h-11 rounded-xl object-cover bg-[#FAF8F3] border border-[#E8E8E8] shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-[#111111] line-clamp-1">{p.name}</span>
                        <span className="text-[11px] text-[#333333]/70 block">
                          {p.type === 'variable'
                            ? `${p.variations.length} variations`
                            : 'Simple piece'}
                          {p.returnPolicy?.enabled ? ' · Custom Return Policy' : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono-num text-xs text-[#333333]/75">{p.sku}</td>
                  <td className="py-3 pr-4 text-xs text-[#333333]/80">
                    {p.subcategoryName ? `${p.categoryName} → ${p.subcategoryName}` : p.categoryName}
                  </td>
                  <td className="py-3 pr-4 font-mono-num font-semibold">
                    {formatNaira(p.salePrice || p.price)}
                  </td>
                  <td className="py-3 pr-4 font-mono-num text-xs">{p.stockQuantity}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(p)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize cursor-pointer ${
                        p.status === 'publish'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                      }`}
                    >
                      {p.status}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onNavigateProduct(p.slug)}
                        className="p-1.5 text-neutral-500 hover:text-[#111111] cursor-pointer"
                        title="View on Storefront"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditProduct(p)}
                        className="p-1.5 text-neutral-500 hover:text-[#111111] cursor-pointer"
                        title="Edit product"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateProduct(p)}
                        className="p-1.5 text-neutral-500 hover:text-[#8C6D34] cursor-pointer"
                        title="Duplicate product"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p, true)}
                        className="p-1.5 text-neutral-500 hover:text-amber-700 cursor-pointer"
                        title="Archive product"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p, false)}
                        className="p-1.5 text-neutral-400 hover:text-rose-700 cursor-pointer"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 10-Section Product Editor Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#E8E8E8] shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 bg-[#111111] text-white flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#C6A15B] font-semibold">
                  Diamond Market Catalog Studio
                </p>
                <h3 className="font-display text-lg font-bold">
                  {editingProduct.id ? `Edit: ${editingProduct.name}` : 'Create New Shoe / Wear'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 10-Section Navigation Tabs */}
            <div className="px-6 py-2.5 bg-[#FAF8F3] border-b border-[#E8E8E8] flex gap-1.5 overflow-x-auto shrink-0">
              {editorTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEditorTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    editorTab === tab.id
                      ? 'bg-[#111111] text-[#C6A15B]'
                      : 'bg-white border border-[#E8E8E8] text-[#333333] hover:border-[#111111]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
              {/* 1. GENERAL */}
              {editorTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.name || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, name: e.target.value })
                        }
                        placeholder="e.g. Diamond Signature Leather Low-Top"
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">SKU *</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.sku || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, sku: e.target.value })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono-num"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Brand</label>
                      <input
                        type="text"
                        value={editingProduct.brand || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, brand: e.target.value })
                        }
                        placeholder="Diamond Market"
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Primary Material</label>
                      <input
                        type="text"
                        value={editingProduct.material || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, material: e.target.value })
                        }
                        placeholder="Full-grain leather / Cotton linen"
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Product Type</label>
                      <select
                        value={editingProduct.type || 'simple'}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            type: e.target.value as 'simple' | 'variable',
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 bg-white"
                      >
                        <option value="simple">Simple Product</option>
                        <option value="variable">Variable Product (Sizes / Colors)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Short Summary</label>
                    <textarea
                      rows={2}
                      value={editingProduct.shortDescription || ''}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, shortDescription: e.target.value })
                      }
                      placeholder="Concise one-sentence highlight displayed above Add to Bag..."
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                </div>
              )}

              {/* 2. IMAGES */}
              {editorTab === 'images' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#111111]">
                        Gallery &amp; Primary Thumbnail
                      </p>
                      <p className="text-xs text-[#333333]/75">
                        Upload multiple JPG, PNG, or WEBP photos. The first image is the primary storefront card thumbnail.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#C6A15B] hover:text-[#111111]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImg ? 'Uploading...' : 'Upload Images'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleMultiImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {(editingProduct.images || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#E8E8E8] bg-[#FAF8F3] p-10 text-center text-xs text-[#333333]/75">
                      No product images added yet. Click Upload Images above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {(editingProduct.images || []).map((img, i) => (
                        <div
                          key={`${img}-${i}`}
                          className="rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3] overflow-hidden flex flex-col"
                        >
                          <div className="relative aspect-square">
                            <img src={img} alt="Preview" className="w-full h-full object-cover" />
                            {i === 0 && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#111111] text-[#C6A15B] text-[10px] font-bold">
                                Primary
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setEditingProduct({
                                  ...editingProduct,
                                  images: (editingProduct.images || []).filter((_, idx) => idx !== i),
                                })
                              }
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="p-2 flex items-center justify-between gap-1 bg-white text-[11px]">
                            <button
                              type="button"
                              disabled={i === 0}
                              onClick={() => setPrimaryImage(i)}
                              className="font-semibold text-[#8C6D34] disabled:opacity-40 cursor-pointer"
                            >
                              {i === 0 ? 'Cover' : 'Set Primary'}
                            </button>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() => moveImage(i, -1)}
                                className="p-1 hover:bg-[#FAF8F3] rounded disabled:opacity-30"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={i === (editingProduct.images || []).length - 1}
                                onClick={() => moveImage(i, 1)}
                                className="p-1 hover:bg-[#FAF8F3] rounded disabled:opacity-30"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. DESCRIPTION */}
              {editorTab === 'description' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => insertDescSnippet('<h3>Key Highlights</h3>')}
                        className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-[#FAF8F3] font-semibold cursor-pointer"
                      >
                        + Subheading
                      </button>
                      <button
                        type="button"
                        onClick={() => insertDescSnippet('<p><strong>Craftsmanship:</strong> </p>')}
                        className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-[#FAF8F3] font-semibold cursor-pointer"
                      >
                        + Bold Paragraph
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertDescSnippet(
                            '<ul>\n  <li>Breathable interior lining</li>\n  <li>True-to-size fit</li>\n</ul>'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-[#FAF8F3] font-semibold cursor-pointer"
                      >
                        + Bullet List
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDescPreview((v) => !v)}
                      className="text-xs font-semibold text-[#8C6D34] underline cursor-pointer"
                    >
                      {descPreview ? 'Back to Editor' : 'Preview Formatted Prose'}
                    </button>
                  </div>

                  {descPreview ? (
                    <div
                      className="dm-prose p-5 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3] min-h-[180px]"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(editingProduct.description || '<p>No description yet.</p>'),
                      }}
                    />
                  ) : (
                    <textarea
                      rows={7}
                      value={editingProduct.description || ''}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, description: e.target.value })
                      }
                      placeholder="Write editorial craftsmanship notes, silhouette, styling inspiration, and fit details..."
                      className="w-full border border-[#E8E8E8] rounded-2xl p-4 font-mono text-xs"
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Care Instructions</label>
                      <textarea
                        rows={2}
                        value={editingProduct.careInstructions || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, careInstructions: e.target.value })
                        }
                        placeholder="e.g. Wipe suede with soft brush; store in dust bag."
                        className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Size &amp; Fit Guide</label>
                      <textarea
                        rows={2}
                        value={editingProduct.sizeGuide || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, sizeGuide: e.target.value })
                        }
                        placeholder="e.g. True to EU sizing. Size up for wider feet."
                        className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. PRICING */}
              {editorTab === 'pricing' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Regular Price (₦) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editingProduct.price ?? 0}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                      }
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Sale / Discount Price (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingProduct.salePrice ?? ''}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          salePrice: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Leave empty for no discount"
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Sale Start Date (Optional)</label>
                    <input
                      type="date"
                      value={editingProduct.saleStartDate || ''}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          saleStartDate: e.target.value || null,
                        })
                      }
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Sale End Date (Optional)</label>
                    <input
                      type="date"
                      value={editingProduct.saleEndDate || ''}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          saleEndDate: e.target.value || null,
                        })
                      }
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                </div>
              )}

              {/* 5. INVENTORY */}
              {editorTab === 'inventory' && (
                <div className="space-y-4">
                  <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct.manageStock ?? true}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, manageStock: e.target.checked })
                      }
                    />
                    <span>Track Inventory Quantity Automatically</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Stock Quantity</label>
                      <input
                        type="number"
                        min={0}
                        value={editingProduct.stockQuantity ?? 0}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            stockQuantity: Number(e.target.value),
                            inStock: Number(e.target.value) > 0,
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Low-Stock Threshold</label>
                      <input
                        type="number"
                        min={0}
                        value={editingProduct.lowStockThreshold ?? 3}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            lowStockThreshold: Number(e.target.value),
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono-num"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingProduct.inStock ?? true}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, inStock: e.target.checked })
                          }
                        />
                        <span>Marked In Stock</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. CATEGORIES & FLAGS */}
              {editorTab === 'categories' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Primary Category</label>
                      <select
                        value={editingProduct.categoryId || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            categoryId: e.target.value,
                            subcategoryId: null,
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 bg-white"
                      >
                        {(parentCategories.length > 0 ? parentCategories : sortedCategories).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Subcategory (Optional)</label>
                      <select
                        value={editingProduct.subcategoryId || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            subcategoryId: e.target.value || null,
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 bg-white"
                      >
                        <option value="">None</option>
                        {(subCategoriesForSelected.length > 0
                          ? subCategoriesForSelected
                          : sortedCategories.filter((c) => c.parentId)
                        ).map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Visibility Status</label>
                      <select
                        value={editingProduct.status || 'publish'}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            status: e.target.value as Product['status'],
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 bg-white"
                      >
                        <option value="publish">Published (Live on Storefront)</option>
                        <option value="draft">Draft (Hidden)</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={(editingProduct.tags || []).join(', ')}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          tags: e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="sneakers, leather, unisex, ogbomoso"
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-6 pt-2 text-xs font-medium">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.featured)}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, featured: e.target.checked })
                        }
                      />
                      <span>Featured Piece</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.isNewArrival)}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, isNewArrival: e.target.checked })
                        }
                      />
                      <span>Latest Arrival</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingProduct.isBestSeller)}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, isBestSeller: e.target.checked })
                        }
                      />
                      <span>Best Seller</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 7. VARIATIONS */}
              {editorTab === 'variations' && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                      Add Size / Color Variation
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                      <input
                        type="text"
                        value={varSize}
                        onChange={(e) => setVarSize(e.target.value)}
                        placeholder="Size (e.g. EU 42 / L)"
                        className="border border-[#E8E8E8] bg-white rounded-xl px-3 py-2"
                      />
                      <input
                        type="text"
                        value={varColor}
                        onChange={(e) => setVarColor(e.target.value)}
                        placeholder="Color (optional)"
                        className="border border-[#E8E8E8] bg-white rounded-xl px-3 py-2"
                      />
                      <input
                        type="number"
                        min={0}
                        value={varPrice}
                        onChange={(e) => setVarPrice(Number(e.target.value))}
                        placeholder="Price ₦"
                        className="border border-[#E8E8E8] bg-white rounded-xl px-3 py-2 font-mono-num"
                      />
                      <input
                        type="number"
                        min={0}
                        value={varSalePrice}
                        onChange={(e) => setVarSalePrice(e.target.value)}
                        placeholder="Sale ₦ (opt)"
                        className="border border-[#E8E8E8] bg-white rounded-xl px-3 py-2 font-mono-num"
                      />
                      <input
                        type="number"
                        min={0}
                        value={varStock}
                        onChange={(e) => setVarStock(Number(e.target.value))}
                        placeholder="Stock Qty"
                        className="border border-[#E8E8E8] bg-white rounded-xl px-3 py-2 font-mono-num"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addVariationRow}
                      className="px-4 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
                    >
                      + Add Variation
                    </button>
                  </div>

                  {(editingProduct.variations || []).length === 0 ? (
                    <p className="text-xs text-[#333333]/75">
                      No variations configured yet. Simple products sell without option selection; adding a variation automatically makes this product selectable by size/color.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E8E8E8] border border-[#E8E8E8] rounded-2xl">
                      {(editingProduct.variations || []).map((v, idx) => (
                        <div key={v.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-semibold text-[#111111]">
                              {Object.entries(v.attributes)
                                .map(([k, val]) => `${k}: ${val}`)
                                .join(' · ')}
                            </p>
                            <p className="font-mono-num text-[#333333]/75">SKU: {v.sku}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={0}
                              value={v.price}
                              onChange={(e) => {
                                const list = [...(editingProduct.variations || [])];
                                list[idx] = { ...v, price: Number(e.target.value) };
                                setEditingProduct({ ...editingProduct, variations: list });
                              }}
                              className="w-24 border border-[#E8E8E8] rounded-lg px-2 py-1 font-mono-num"
                            />
                            <input
                              type="number"
                              min={0}
                              value={v.stockQuantity}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                const list = [...(editingProduct.variations || [])];
                                list[idx] = { ...v, stockQuantity: qty, inStock: qty > 0 };
                                setEditingProduct({ ...editingProduct, variations: list });
                              }}
                              className="w-16 border border-[#E8E8E8] rounded-lg px-2 py-1 font-mono-num"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = (editingProduct.variations || []).filter(
                                  (row) => row.id !== v.id
                                );
                                setEditingProduct({
                                  ...editingProduct,
                                  type: next.length > 0 ? 'variable' : 'simple',
                                  variations: next,
                                });
                              }}
                              className="p-1.5 text-neutral-400 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 8. SHIPPING */}
              {editorTab === 'shipping' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={editingProduct.weightKg ?? 0.8}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            weightKg: Number(e.target.value),
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Box / Package Dimensions</label>
                      <input
                        type="text"
                        value={editingProduct.dimensions || ''}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, dimensions: e.target.value })
                        }
                        placeholder="e.g. 34 × 24 × 12 cm"
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={editingProduct.codAllowed ?? true}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, codAllowed: e.target.checked })
                      }
                    />
                    <span>Eligible for Pay on Delivery (COD)</span>
                  </label>
                </div>
              )}

              {/* 9. SEO */}
              {editorTab === 'seo' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Custom URL Slug</label>
                    <input
                      type="text"
                      value={editingProduct.slug || ''}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, slug: e.target.value })
                      }
                      placeholder="auto-generated from product name"
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">SEO Browser Title</label>
                    <input
                      type="text"
                      value={editingProduct.seoTitle || ''}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, seoTitle: e.target.value })
                      }
                      placeholder={`${editingProduct.name || 'Product'} — Diamond Market Nigeria`}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">SEO Meta Description</label>
                    <textarea
                      rows={3}
                      value={editingProduct.seoDescription || ''}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, seoDescription: e.target.value })
                      }
                      placeholder="Search engine summary for Nigerian footwear & fashion buyers..."
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* 10. RETURN POLICY */}
              {editorTab === 'return_policy' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F3] p-4 rounded-2xl border border-[#E8E8E8]">
                    <label className="flex items-center gap-2.5 text-xs font-bold text-[#111111] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rp.enabled}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            returnPolicy: { ...rp, enabled: e.target.checked },
                          })
                        }
                      />
                      <span>Enable Product-Specific Return Policy (Overrides Store Default)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingProduct({
                          ...editingProduct,
                          returnPolicy: { ...EMPTY_RETURN_POLICY, enabled: false },
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear / Reset Policy
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Return Eligibility Window (Days)</label>
                      <input
                        type="number"
                        min={0}
                        value={rp.returnWindowDays ?? 7}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            returnPolicy: {
                              ...rp,
                              enabled: true,
                              returnWindowDays: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Who Pays Return Shipping</label>
                      <select
                        value={rp.returnShippingPayer || 'depends'}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            returnPolicy: {
                              ...rp,
                              enabled: true,
                              returnShippingPayer: e.target.value as ProductReturnPolicy['returnShippingPayer'],
                            },
                          })
                        }
                        className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 bg-white"
                      >
                        <option value="depends">Depends (Store covers defects; buyer covers size swaps)</option>
                        <option value="store">Covered by Diamond Market</option>
                        <option value="customer">Covered by Customer</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Eligible Conditions</label>
                      <textarea
                        rows={2}
                        value={rp.eligibleConditions || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            returnPolicy: { ...rp, enabled: true, eligibleConditions: e.target.value },
                          })
                        }
                        placeholder="e.g. Unworn indoors on carpet, original box & dust bag intact."
                        className="w-full border border-[#E8E8E8] rounded-xl p-3"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Non-Returnable Conditions</label>
                      <textarea
                        rows={2}
                        value={rp.nonReturnableConditions || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            returnPolicy: {
                              ...rp,
                              enabled: true,
                              nonReturnableConditions: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Outdoor sole wear, scuff marks, or missing tags."
                        className="w-full border border-[#E8E8E8] rounded-xl p-3"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Exchange Rules (Sizing / Defective)</label>
                      <textarea
                        rows={2}
                        value={rp.exchangeRules || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            returnPolicy: { ...rp, enabled: true, exchangeRules: e.target.value },
                          })
                        }
                        placeholder="e.g. Complimentary EU size exchange subject to stock availability."
                        className="w-full border border-[#E8E8E8] rounded-xl p-3"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Refund Conditions</label>
                      <textarea
                        rows={2}
                        value={rp.refundConditions || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            returnPolicy: { ...rp, enabled: true, refundConditions: e.target.value },
                          })
                        }
                        placeholder="e.g. Verified Naira refund processed within 2–4 business days after inspection."
                        className="w-full border border-[#E8E8E8] rounded-xl p-3"
                      />
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="block font-semibold mb-1">
                      Rich / Formatted Return Summary (Displayed on Product Page)
                    </label>
                    <textarea
                      rows={3}
                      value={rp.formattedText || ''}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          returnPolicy: { ...rp, enabled: true, formattedText: e.target.value },
                        })
                      }
                      placeholder="<p>Try footwear on a clean indoor surface before wearing outdoors.</p>"
                      className="w-full border border-[#E8E8E8] rounded-xl p-3 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Modal Save Footer */}
              <div className="pt-4 border-t border-[#E8E8E8] flex items-center justify-between gap-3 sticky bottom-0 bg-white py-3">
                <span className="text-[11px] text-[#333333]/75">
                  Syncs to Diamond Market storefront &amp; WooCommerce REST API
                </span>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-5 py-2.5 border border-[#E8E8E8] rounded-full text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-[#111111] text-white rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Product'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
