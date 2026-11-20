import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type {
  Category,
  CmsBackgroundTone,
  CmsSectionLayout,
  CmsSpacingSize,
  HomepageCustomCard,
  HomepageSection,
  HomepageSectionType,
} from '../../types/commerce.ts';

const SECTION_CATALOG: { type: HomepageSectionType; label: string; desc: string }[] = [
  { type: 'hero', label: 'Hero Banner', desc: 'Large editorial welcome banner with image & 2 CTAs.' },
  { type: 'announcement', label: 'Announcement Strip', desc: 'High-visibility promotional banner band.' },
  { type: 'value_pillars', label: 'Value Pillars', desc: '4-column trust badges & store guarantees.' },
  { type: 'category_showcase', label: 'Category Showcase', desc: 'Visual grid of your Shoes & Wears departments.' },
  { type: 'product_collections', label: 'Tabbed Collections Showcase', desc: 'Interactive tabs: Featured Shoes, New Arrivals, Deals & more.' },
  { type: 'featured_products', label: 'Featured Products Grid', desc: 'Showcases handpicked featured products.' },
  { type: 'new_arrivals', label: 'New Arrivals Grid', desc: 'Latest footwear & fashion drops.' },
  { type: 'best_sellers', label: 'Best Sellers Grid', desc: 'Top-performing & popular customer favorites.' },
  { type: 'deals', label: 'Deals & Discounts Grid', desc: 'Automatically pulls items with active sale prices.' },
  { type: 'promo_banner', label: 'Promotional / Why Shop Banner', desc: 'Editorial dark or custom promotional highlight block.' },
  { type: 'about', label: 'About Brand Section', desc: 'Brand story with side image & call-to-action.' },
  { type: 'testimonials', label: 'Verified Testimonials', desc: 'Approved buyer product & delivery reviews.' },
  { type: 'newsletter', label: 'Newsletter Signup Band', desc: 'Centered email capture section.' },
  { type: 'contact', label: 'Contact Callout Band', desc: 'Quick store contact, hours & WhatsApp prompt.' },
  { type: 'custom_content', label: 'Custom Content & Cards', desc: 'Flexible text/HTML block + optional showcase cards.' },
];

const QUICK_ROUTES = [
  { label: 'All Products (/shop)', value: '/shop' },
  { label: 'Shoes (/category/shoes)', value: '/category/shoes' },
  { label: 'Wears (/category/wears)', value: '/category/wears' },
  { label: 'Accessories (/category/accessories)', value: '/category/accessories' },
  { label: 'About Us (/about)', value: '/about' },
  { label: 'Contact Us (/contact)', value: '/contact' },
  { label: 'FAQ (/faq)', value: '/faq' },
  { label: 'Track Order (/track-order)', value: '/track-order' },
];

interface CmsHomepageBuilderTabProps {
  sections: HomepageSection[];
  categories: Category[];
  onChangeSections: (next: HomepageSection[]) => void;
  onOpenMediaPicker: (currentUrl: string, onPicked: (url: string) => void) => void;
}

export function CmsHomepageBuilderTab({
  sections,
  categories,
  onChangeSections,
  onOpenMediaPicker,
}: CmsHomepageBuilderTabProps) {
  const ordered = useMemo(
    () => [...sections].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)),
    [sections]
  );

  const [selectedId, setSelectedId] = useState<string>(ordered[0]?.id || '');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const activeSection = ordered.find((s) => s.id === selectedId) || ordered[0] || null;

  const commitOrder = (list: HomepageSection[]) => {
    onChangeSections(
      list.map((s, idx) => ({
        ...s,
        sortOrder: idx + 1,
      }))
    );
  };

  const updateSection = (id: string, patch: Partial<HomepageSection>) => {
    onChangeSections(
      ordered.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    const idx = ordered.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= ordered.length) return;
    const copy = [...ordered];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    commitOrder(copy);
  };

  const handleDropOn = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const fromIdx = ordered.findIndex((s) => s.id === draggedId);
    const toIdx = ordered.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const copy = [...ordered];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setDraggedId(null);
    commitOrder(copy);
  };

  const duplicateSection = (sec: HomepageSection) => {
    const copy: HomepageSection = {
      ...JSON.parse(JSON.stringify(sec)),
      id: `sec-${Date.now().toString(36)}`,
      label: `${sec.label} (Copy)`,
      sortOrder: ordered.length + 1,
    };
    const next = [...ordered, copy];
    commitOrder(next);
    setSelectedId(copy.id);
  };

  const deleteSection = (id: string) => {
    const remaining = ordered.filter((s) => s.id !== id);
    commitOrder(remaining);
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id || '');
    }
  };

  const addSection = (type: HomepageSectionType, defaultLabel: string) => {
    const newSec: HomepageSection = {
      id: `sec-${Date.now().toString(36)}`,
      type,
      label: defaultLabel,
      enabled: true,
      visible: true,
      sortOrder: ordered.length + 1,
      eyebrow: 'Diamond Market Edit',
      title: defaultLabel,
      subtitle: 'Customize this section headline, description, layout, and media directly.',
      content: '',
      imageUrl: type === 'hero' || type === 'promo_banner' || type === 'about'
        ? '/src/assets/images/hero_diamond_fashion_1795178919083.jpg'
        : '',
      primaryCtaText: 'Explore Shop',
      primaryCtaUrl: '/shop',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      layout: type === 'hero' ? 'split_left' : 'default',
      background: type === 'promo_banner' ? 'ivory' : 'white',
      spacing: 'normal',
      maxItems: 4,
      items:
        type === 'value_pillars' || type === 'custom_content'
          ? [
              {
                id: `item-${Date.now().toString(36)}`,
                title: 'Highlight Item',
                description: 'Describe this highlight or feature cleanly.',
              },
            ]
          : [],
    };
    const next = [...ordered, newSec];
    commitOrder(next);
    setSelectedId(newSec.id);
    setAddModalOpen(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Reorderable Section Stack */}
      <div className="lg:col-span-5 bg-white border border-[#E8E8E8] rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-[#111111]">
              Homepage Sections ({ordered.length})
            </h3>
            <p className="text-[11px] text-[#333333]/75">
              Drag rows or use arrows to reorder the live homepage layout.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="h-9 px-3.5 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#C6A15B]" />
            Add Section
          </button>
        </div>

        <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
          {ordered.map((sec, idx) => {
            const isSelected = activeSection?.id === sec.id;
            const isActive = sec.enabled && sec.visible;
            return (
              <div
                key={sec.id}
                draggable
                onDragStart={() => setDraggedId(sec.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOn(sec.id)}
                onClick={() => setSelectedId(sec.id)}
                className={`rounded-2xl border p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#C6A15B] bg-[#FAF8F3] shadow-xs'
                    : 'border-[#E8E8E8] bg-white hover:border-[#C6A15B]/60'
                } ${draggedId === sec.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-neutral-400 shrink-0 cursor-grab" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111111] truncate">
                        {idx + 1}. {sec.label || sec.title}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-[#8C6D34] truncate">
                        {sec.type.replace(/_/g, ' ')} · {isActive ? 'Visible' : 'Hidden'}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSection(sec.id, -1)}
                      title="Move up"
                      className="w-7 h-7 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAF8F3] disabled:opacity-30 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === ordered.length - 1}
                      onClick={() => moveSection(sec.id, 1)}
                      title="Move down"
                      className="w-7 h-7 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAF8F3] disabled:opacity-30 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSection(sec.id, { visible: !sec.visible, enabled: !sec.visible || sec.enabled })}
                      title={sec.visible ? 'Hide section' : 'Show section'}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${
                        isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-neutral-200 bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateSection(sec)}
                      title="Duplicate section"
                      className="w-7 h-7 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAF8F3] flex items-center justify-center cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSection(sec.id)}
                      title="Delete section"
                      className="w-7 h-7 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Section Inspector */}
      <div className="lg:col-span-7 bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-5">
        {!activeSection ? (
          <div className="py-12 text-center text-sm text-[#333333]/75 space-y-3">
            <Layers className="w-8 h-8 mx-auto text-[#C6A15B]" />
            <p>Select a section on the left or click “Add Section” to begin building your homepage.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E8E8E8]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                  Editing {activeSection.type.replace(/_/g, ' ')}
                </p>
                <h3 className="font-display text-xl font-bold text-[#111111]">
                  {activeSection.label || activeSection.title}
                </h3>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeSection.enabled}
                    onChange={(e) => updateSection(activeSection.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeSection.visible}
                    onChange={(e) => updateSection(activeSection.id, { visible: e.target.checked })}
                  />
                  Visible
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Admin Label
                </label>
                <input
                  type="text"
                  value={activeSection.label}
                  onChange={(e) => updateSection(activeSection.id, { label: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Eyebrow / Kicker Text
                </label>
                <input
                  type="text"
                  value={activeSection.eyebrow}
                  onChange={(e) => updateSection(activeSection.id, { eyebrow: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Section Title / Headline
              </label>
              <input
                type="text"
                value={activeSection.title}
                onChange={(e) => updateSection(activeSection.id, { title: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Subtitle / Lead Copy
              </label>
              <textarea
                rows={2}
                value={activeSection.subtitle}
                onChange={(e) => updateSection(activeSection.id, { subtitle: e.target.value })}
                className="w-full p-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Body Content {activeSection.type === 'promo_banner' ? '(separate bullets with | )' : '(HTML or caption supported)'}
              </label>
              <textarea
                rows={3}
                value={activeSection.content}
                onChange={(e) => updateSection(activeSection.id, { content: e.target.value })}
                className="w-full p-3 rounded-xl border border-[#E8E8E8] text-xs font-mono-num"
              />
            </div>

            {/* Image Selector */}
            <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                  Section Image / Visual
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onOpenMediaPicker(activeSection.imageUrl, (url) =>
                      updateSection(activeSection.id, { imageUrl: url })
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#111111] text-white text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#C6A15B]" />
                  Choose / Upload Image
                </button>
              </div>
              <div className="flex items-center gap-3">
                {activeSection.imageUrl && (
                  <img
                    src={activeSection.imageUrl}
                    alt="Section preview"
                    className="w-16 h-12 rounded-xl object-cover border border-[#E8E8E8] shrink-0 bg-white"
                  />
                )}
                <input
                  type="text"
                  value={activeSection.imageUrl}
                  onChange={(e) => updateSection(activeSection.id, { imageUrl: e.target.value })}
                  placeholder="Image URL or /uploads/cms/..."
                  className="flex-1 h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                />
                {activeSection.imageUrl && (
                  <button
                    type="button"
                    onClick={() => updateSection(activeSection.id, { imageUrl: '' })}
                    className="px-2.5 h-9 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 p-3.5 rounded-2xl border border-[#E8E8E8]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                  Primary Button
                </p>
                <input
                  type="text"
                  value={activeSection.primaryCtaText}
                  onChange={(e) => updateSection(activeSection.id, { primaryCtaText: e.target.value })}
                  placeholder="Button label (e.g. Shop Shoes)"
                  className="w-full h-9 px-3 rounded-lg border border-[#E8E8E8] text-xs"
                />
                <input
                  type="text"
                  value={activeSection.primaryCtaUrl}
                  onChange={(e) => updateSection(activeSection.id, { primaryCtaUrl: e.target.value })}
                  placeholder="Destination URL (e.g. /shop)"
                  className="w-full h-9 px-3 rounded-lg border border-[#E8E8E8] text-xs"
                />
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value && updateSection(activeSection.id, { primaryCtaUrl: e.target.value })
                  }
                  className="w-full h-8 px-2 rounded-lg bg-[#FAF8F3] border border-[#E8E8E8] text-[11px]"
                >
                  <option value="">Quick-pick destination...</option>
                  {QUICK_ROUTES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 p-3.5 rounded-2xl border border-[#E8E8E8]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                  Secondary Button
                </p>
                <input
                  type="text"
                  value={activeSection.secondaryCtaText}
                  onChange={(e) => updateSection(activeSection.id, { secondaryCtaText: e.target.value })}
                  placeholder="Secondary label (optional)"
                  className="w-full h-9 px-3 rounded-lg border border-[#E8E8E8] text-xs"
                />
                <input
                  type="text"
                  value={activeSection.secondaryCtaUrl}
                  onChange={(e) => updateSection(activeSection.id, { secondaryCtaUrl: e.target.value })}
                  placeholder="Secondary URL (optional)"
                  className="w-full h-9 px-3 rounded-lg border border-[#E8E8E8] text-xs"
                />
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value && updateSection(activeSection.id, { secondaryCtaUrl: e.target.value })
                  }
                  className="w-full h-8 px-2 rounded-lg bg-[#FAF8F3] border border-[#E8E8E8] text-[11px]"
                >
                  <option value="">Quick-pick destination...</option>
                  {QUICK_ROUTES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Design, Layout, Background & Product Settings */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#333333] mb-1">Layout</label>
                <select
                  value={activeSection.layout}
                  onChange={(e) =>
                    updateSection(activeSection.id, { layout: e.target.value as CmsSectionLayout })
                  }
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="default">Default</option>
                  <option value="centered">Centered</option>
                  <option value="split_left">Split Text Left</option>
                  <option value="split_right">Split Image Left</option>
                  <option value="grid_3">3 Columns</option>
                  <option value="grid_4">4 Columns</option>
                  <option value="editorial_dark">Editorial Card</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#333333] mb-1">Background</label>
                <select
                  value={activeSection.background}
                  onChange={(e) =>
                    updateSection(activeSection.id, { background: e.target.value as CmsBackgroundTone })
                  }
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="white">Warm White</option>
                  <option value="ivory">Soft Ivory</option>
                  <option value="gold_tint">Champagne Tint</option>
                  <option value="black">Rich Black</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#333333] mb-1">Spacing</label>
                <select
                  value={activeSection.spacing}
                  onChange={(e) =>
                    updateSection(activeSection.id, { spacing: e.target.value as CmsSpacingSize })
                  }
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Standard</option>
                  <option value="spacious">Spacious</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#333333] mb-1">Max Items</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={activeSection.maxItems || 4}
                  onChange={(e) =>
                    updateSection(activeSection.id, { maxItems: Number(e.target.value || 4) })
                  }
                  className="w-full h-9 px-2.5 rounded-xl border border-[#E8E8E8] text-xs font-mono-num"
                />
              </div>
            </div>

            {['product_collections', 'featured_products', 'new_arrivals', 'best_sellers', 'deals'].includes(
              activeSection.type
            ) && (
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Optional Category Filter (Leave “All” for dynamic auto-selection)
                </label>
                <select
                  value={activeSection.categorySlug || ''}
                  onChange={(e) =>
                    updateSection(activeSection.id, { categorySlug: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="">Automatic (All Published Catalog)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name} (/{cat.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Repeater Cards for Value Pillars or Custom Content */}
            {['value_pillars', 'custom_content', 'about', 'contact'].includes(activeSection.type) && (
              <div className="pt-2 border-t border-[#E8E8E8] space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                    Highlight Cards / Pillars ({activeSection.items?.length || 0})
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const nextItems: HomepageCustomCard[] = [
                        ...(activeSection.items || []),
                        {
                          id: `card-${Date.now().toString(36)}`,
                          title: 'New Highlight Card',
                          description: 'Add supporting detail text here.',
                        },
                      ];
                      updateSection(activeSection.id, { items: nextItems });
                    }}
                    className="px-3 py-1 rounded-lg border border-[#111111] text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Card
                  </button>
                </div>

                {(activeSection.items || []).map((card, cIdx) => (
                  <div
                    key={card.id}
                    className="p-3 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) => {
                          const next = [...(activeSection.items || [])];
                          next[cIdx] = { ...card, title: e.target.value };
                          updateSection(activeSection.id, { items: next });
                        }}
                        placeholder="Card title"
                        className="flex-1 h-8 px-2.5 rounded-lg border border-[#E8E8E8] bg-white text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (activeSection.items || []).filter((i) => i.id !== card.id);
                          updateSection(activeSection.id, { items: next });
                        }}
                        className="w-8 h-8 rounded-lg border border-rose-200 bg-white text-rose-600 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={card.description}
                      onChange={(e) => {
                        const next = [...(activeSection.items || [])];
                        next[cIdx] = { ...card, description: e.target.value };
                        updateSection(activeSection.id, { items: next });
                      }}
                      placeholder="Card description"
                      className="w-full h-8 px-2.5 rounded-lg border border-[#E8E8E8] bg-white text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Section Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-[65] bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-[#E8E8E8]">
            <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between bg-[#FAF8F3]">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111111]">
                  Add Homepage Section
                </h3>
                <p className="text-xs text-[#333333]/75">
                  Choose any dynamic module to append to your homepage builder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#E8E8E8] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SECTION_CATALOG.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addSection(item.type, item.label)}
                  className="text-left p-4 rounded-2xl border border-[#E8E8E8] hover:border-[#C6A15B] hover:bg-[#FAF8F3] transition-all cursor-pointer space-y-1"
                >
                  <p className="text-xs font-bold text-[#111111]">{item.label}</p>
                  <p className="text-[11px] text-[#333333]/80">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
