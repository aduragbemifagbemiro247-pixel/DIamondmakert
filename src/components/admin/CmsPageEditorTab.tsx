import {
  CheckCircle2,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import type { CmsAdminState, CmsFaqItem, CmsPage } from '../../types/commerce.ts';

interface CmsPageEditorTabProps {
  pages: CmsPage[];
  onPagesStateSynced: (cmsState: CmsAdminState) => void;
  onRefreshPublicStore: () => Promise<void>;
  onOpenMediaPicker: (currentUrl: string, onPicked: (url: string) => void) => void;
  onPreviewPage: (slug: string) => void;
  pushToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

function emptyPageDraft(): CmsPage {
  const now = new Date().toISOString();
  return {
    id: '',
    slug: '',
    title: '',
    subtitle: '',
    eyebrow: '',
    contentHtml: '<p>Write your page content here...</p>',
    heroImageUrl: '',
    seoTitle: '',
    seoDescription: '',
    status: 'published',
    visible: true,
    isSystemPage: false,
    faqItems: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function CmsPageEditorTab({
  pages,
  onPagesStateSynced,
  onRefreshPublicStore,
  onOpenMediaPicker,
  onPreviewPage,
  pushToast,
}: CmsPageEditorTabProps) {
  const [selectedId, setSelectedId] = useState<string>(pages[0]?.id || 'new');
  const [form, setForm] = useState<CmsPage>(() => pages[0] || emptyPageDraft());
  const [saving, setSaving] = useState(false);

  const selectPage = (page: CmsPage) => {
    setSelectedId(page.id);
    setForm(JSON.parse(JSON.stringify(page)) as CmsPage);
  };

  const startNewPage = () => {
    setSelectedId('new');
    setForm(emptyPageDraft());
  };

  const autoSlug = (title: string) =>
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleSave = async (publishImmediately: boolean) => {
    if (!form.title.trim()) {
      pushToast('Page title is required.', 'error');
      return;
    }
    const cleanSlug = autoSlug(form.slug || form.title);
    if (!cleanSlug) {
      pushToast('Valid URL slug is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.isSystemPage ? form.slug : cleanSlug,
        status: publishImmediately ? 'published' : form.status,
        publishImmediately,
      };
      const isNew = !form.id;
      const res = await apiFetch<{ page: CmsPage; cmsState: CmsAdminState }>(
        isNew ? '/api/admin/cms/pages' : `/api/admin/cms/pages/${form.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          body: JSON.stringify(payload),
        }
      );
      onPagesStateSynced(res.cmsState);
      setSelectedId(res.page.id);
      setForm(res.page);
      if (publishImmediately) {
        await onRefreshPublicStore();
      }
      pushToast(
        publishImmediately
          ? `Published "/${res.page.slug}" live on the storefront.`
          : `Saved draft changes for "/${res.page.slug}".`,
        'success'
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save page.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id || form.isSystemPage) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ cmsState: CmsAdminState }>(`/api/admin/cms/pages/${form.id}`, {
        method: 'DELETE',
      });
      onPagesStateSynced(res.cmsState);
      await onRefreshPublicStore();
      const first = res.cmsState.draft.pages[0];
      if (first) selectPage(first);
      else startNewPage();
      pushToast('Custom page deleted.', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const appendHtmlSnippet = (snippet: string) => {
    setForm((prev) => ({
      ...prev,
      contentHtml: `${prev.contentHtml ? `${prev.contentHtml}\n` : ''}${snippet}`,
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Page Directory List */}
      <div className="lg:col-span-4 bg-white border border-[#E8E8E8] rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-[#111111]">
              Storefront Pages ({pages.length})
            </h3>
            <p className="text-[11px] text-[#333333]/75">
              Edit system pages or create custom routes.
            </p>
          </div>
          <button
            type="button"
            onClick={startNewPage}
            className="h-9 px-3 rounded-xl bg-[#111111] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#C6A15B]" />
            New Page
          </button>
        </div>

        <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {pages.map((p) => {
            const active = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPage(p)}
                className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  active
                    ? 'border-[#C6A15B] bg-[#FAF8F3]'
                    : 'border-[#E8E8E8] bg-white hover:border-[#C6A15B]/60'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#111111] truncate">{p.title}</p>
                  <p className="text-[11px] font-mono-num text-[#333333]/70 truncate">/{p.slug}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    p.status === 'published' && p.visible
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {p.status === 'published' ? (p.visible ? 'Live' : 'Hidden') : 'Draft'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Page Form Editor */}
      <div className="lg:col-span-8 bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E8E8E8]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#C6A15B]" />
            <div>
              <h3 className="font-display text-lg font-bold text-[#111111]">
                {form.id ? `Edit Page: ${form.title}` : 'Create New Storefront Page'}
              </h3>
              <p className="text-[11px] font-mono-num text-[#333333]/75">
                URL: /{form.slug || 'your-slug'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {form.slug && (
              <button
                type="button"
                onClick={() => onPreviewPage(`/${form.slug}`)}
                className="h-9 px-3 rounded-xl border border-[#E8E8E8] hover:bg-[#FAF8F3] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#C6A15B]" />
                Preview
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="h-9 px-4 rounded-xl border border-[#111111] bg-white hover:bg-[#FAF8F3] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="h-9 px-4 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#C6A15B]" />
              Publish Page
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">Page Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  title,
                  slug: !prev.id && !prev.isSystemPage ? autoSlug(title) : prev.slug,
                }));
              }}
              placeholder="e.g. Footwear Size Guide"
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">
              URL Slug * {form.isSystemPage && <span className="text-[10px] text-[#8C6D34]">(System Route Locked)</span>}
            </label>
            <input
              type="text"
              disabled={form.isSystemPage}
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: autoSlug(e.target.value) }))}
              placeholder="e.g. size-guide"
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm font-mono-num disabled:bg-[#FAF8F3]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">Eyebrow Label</label>
            <input
              type="text"
              value={form.eyebrow || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, eyebrow: e.target.value }))}
              placeholder="e.g. Customer Guide"
              className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
            />
          </div>
          <div className="flex items-end gap-5 pb-2 text-xs font-semibold">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) => setForm((prev) => ({ ...prev, visible: e.target.checked }))}
              />
              Visible on Public Site
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value as 'published' | 'draft' }))
              }
              className="h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs font-semibold"
            >
              <option value="published">Status: Published</option>
              <option value="draft">Status: Draft Only</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#111111] mb-1">Page Subtitle</label>
          <textarea
            rows={2}
            value={form.subtitle}
            onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
            className="w-full p-3 rounded-xl border border-[#E8E8E8] text-sm"
          />
        </div>

        {/* Hero Image Picker */}
        <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {form.heroImageUrl && (
              <img
                src={form.heroImageUrl}
                alt="Hero preview"
                className="w-14 h-10 rounded-lg object-cover border border-[#E8E8E8]"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#111111]">Page Banner / Hero Image</p>
              <input
                type="text"
                value={form.heroImageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, heroImageUrl: e.target.value }))}
                placeholder="Optional hero image URL..."
                className="w-full h-8 px-2.5 mt-1 rounded-lg border border-[#E8E8E8] bg-white text-xs"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenMediaPicker(form.heroImageUrl, (url) =>
                setForm((prev) => ({ ...prev, heroImageUrl: url }))
              )
            }
            className="h-9 px-3.5 rounded-xl bg-[#111111] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#C6A15B]" />
            Select Image
          </button>
        </div>

        {/* Content HTML Editor */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-[#111111]">
              Page Content (Rich HTML)
            </label>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => appendHtmlSnippet('<h3>New Section Heading</h3>')}
                className="px-2 py-1 rounded border border-[#E8E8E8] hover:bg-[#FAF8F3] cursor-pointer"
              >
                + Heading
              </button>
              <button
                type="button"
                onClick={() => appendHtmlSnippet('<p>Add a new informative paragraph here.</p>')}
                className="px-2 py-1 rounded border border-[#E8E8E8] hover:bg-[#FAF8F3] cursor-pointer"
              >
                + Paragraph
              </button>
              <button
                type="button"
                onClick={() => appendHtmlSnippet('<ul>\n  <li>Key point one</li>\n  <li>Key point two</li>\n</ul>')}
                className="px-2 py-1 rounded border border-[#E8E8E8] hover:bg-[#FAF8F3] cursor-pointer"
              >
                + Bullet List
              </button>
            </div>
          </div>
          <textarea
            rows={7}
            value={form.contentHtml}
            onChange={(e) => setForm((prev) => ({ ...prev, contentHtml: e.target.value }))}
            className="w-full p-3 rounded-xl border border-[#E8E8E8] text-xs font-mono-num"
          />
        </div>

        {/* Interactive FAQ Builder */}
        <div className="p-4 rounded-2xl border border-[#E8E8E8] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                FAQ Accordion Items ({form.faqItems?.length || 0})
              </p>
              <p className="text-[11px] text-[#333333]/75">
                Renders interactive Q&amp;A accordions on FAQ or any custom page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next: CmsFaqItem[] = [
                  ...(form.faqItems || []),
                  {
                    id: `faq-${Date.now().toString(36)}`,
                    question: 'New Question?',
                    answer: 'Provide a clear helpful answer for customers.',
                  },
                ];
                setForm((prev) => ({ ...prev, faqItems: next }));
              }}
              className="px-3 py-1.5 rounded-lg border border-[#111111] text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Q&amp;A
            </button>
          </div>

          {(form.faqItems || []).map((faq, idx) => (
            <div key={faq.id} className="p-3 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => {
                    const next = [...(form.faqItems || [])];
                    next[idx] = { ...faq, question: e.target.value };
                    setForm((prev) => ({ ...prev, faqItems: next }));
                  }}
                  placeholder="Question"
                  className="flex-1 h-8 px-2.5 rounded-lg border border-[#E8E8E8] bg-white text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      faqItems: (prev.faqItems || []).filter((f) => f.id !== faq.id),
                    }))
                  }
                  className="w-8 h-8 rounded-lg border border-rose-200 bg-white text-rose-600 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                rows={2}
                value={faq.answer}
                onChange={(e) => {
                  const next = [...(form.faqItems || [])];
                  next[idx] = { ...faq, answer: e.target.value };
                  setForm((prev) => ({ ...prev, faqItems: next }));
                }}
                placeholder="Answer"
                className="w-full p-2.5 rounded-lg border border-[#E8E8E8] bg-white text-xs"
              />
            </div>
          ))}
        </div>

        {/* Page SEO Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E8E8]">
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">
              Page SEO Meta Title
            </label>
            <input
              type="text"
              value={form.seoTitle}
              onChange={(e) => setForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
              className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">
              Page SEO Meta Description
            </label>
            <input
              type="text"
              value={form.seoDescription}
              onChange={(e) => setForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
              className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs"
            />
          </div>
        </div>

        {form.id && !form.isSystemPage && (
          <div className="pt-2 flex justify-between items-center border-t border-[#E8E8E8]">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Custom page active
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Custom Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
