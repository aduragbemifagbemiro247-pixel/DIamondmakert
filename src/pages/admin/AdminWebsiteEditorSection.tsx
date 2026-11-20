import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Layout,
  Megaphone,
  Menu,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CmsHomepageBuilderTab } from '../../components/admin/CmsHomepageBuilderTab.tsx';
import { CmsLivePreviewModal } from '../../components/admin/CmsLivePreviewModal.tsx';
import { CmsPageEditorTab } from '../../components/admin/CmsPageEditorTab.tsx';
import { MediaLibraryBrowser, MediaPickerModal } from '../../components/admin/MediaPickerModal.tsx';
import { apiFetch } from '../../lib/api.ts';
import type {
  Category,
  CmsAdminState,
  CmsData,
  CmsFooterColumn,
  CmsNavLink,
  CmsThemeConfig,
  CmsThemePresetId,
  MediaAsset,
  MediaFolder,
  StoreSettings,
} from '../../types/commerce.ts';

type WebsiteEditorTabId =
  | 'overview'
  | 'homepage'
  | 'pages'
  | 'header'
  | 'footer'
  | 'navigation'
  | 'theme'
  | 'media'
  | 'seo'
  | 'announcement'
  | 'settings';

const EDITOR_TABS: { id: WebsiteEditorTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Website Overview', icon: Globe },
  { id: 'homepage', label: 'Homepage Builder', icon: Layers },
  { id: 'pages', label: 'Page Editor', icon: FileText },
  { id: 'header', label: 'Header Editor', icon: Layout },
  { id: 'footer', label: 'Footer Editor', icon: Layout },
  { id: 'navigation', label: 'Navigation Menu', icon: Menu },
  { id: 'theme', label: 'Theme & Branding', icon: Palette },
  { id: 'media', label: 'Media Library', icon: ImageIcon },
  { id: 'seo', label: 'SEO Settings', icon: Search },
  { id: 'announcement', label: 'Announcement Bar', icon: Megaphone },
  { id: 'settings', label: 'Website Settings', icon: Settings },
];

const THEME_PRESETS: {
  id: CmsThemePresetId;
  name: string;
  desc: string;
  patch: Partial<CmsThemeConfig>;
}[] = [
  {
    id: 'diamond_classic',
    name: 'Diamond Classic',
    desc: 'Rich Black, Champagne Gold & Soft Ivory',
    patch: {
      primaryColor: '#111111',
      secondaryColor: '#333333',
      accentColor: '#C6A15B',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#FAF8F3',
      textColor: '#111111',
      headingFont: "'Playfair Display', Georgia, 'Times New Roman', serif",
      bodyFont: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      buttonStyle: 'pill',
      cardStyle: 'bordered',
    },
  },
  {
    id: 'obsidian_gold',
    name: 'Obsidian Atelier',
    desc: 'Deep Ink, Antique Brass & Stone White',
    patch: {
      primaryColor: '#0D0E12',
      secondaryColor: '#2E3138',
      accentColor: '#D4AF63',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F4F3EF',
      textColor: '#0D0E12',
      headingFont: "'Cormorant Garamond', Georgia, serif",
      bodyFont: "'Manrope', system-ui, sans-serif",
      buttonStyle: 'rounded',
      cardStyle: 'elevated',
    },
  },
  {
    id: 'warm_ivory',
    name: 'Warm Savanna Ivory',
    desc: 'Espresso Brown, Burnished Gold & Cream',
    patch: {
      primaryColor: '#231A14',
      secondaryColor: '#4F4238',
      accentColor: '#C09246',
      backgroundColor: '#FCFBF8',
      surfaceColor: '#F5EFE3',
      textColor: '#231A14',
      headingFont: "'Lora', Georgia, serif",
      bodyFont: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'pill',
      cardStyle: 'bordered',
    },
  },
  {
    id: 'editorial_minimal',
    name: 'Minimal Monograph',
    desc: 'Sharp Noir, Graphite & Architectural Square Edges',
    patch: {
      primaryColor: '#121212',
      secondaryColor: '#525252',
      accentColor: '#B5945B',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F6F6F6',
      textColor: '#121212',
      headingFont: "'Bodoni Moda', Georgia, serif",
      bodyFont: "'Plus Jakarta Sans', system-ui, sans-serif",
      buttonStyle: 'square',
      cardStyle: 'flat',
    },
  },
  {
    id: 'midnight_slate',
    name: 'Midnight Sapphire',
    desc: 'Deep Navy Black, Amber Gold & Mist Gray',
    patch: {
      primaryColor: '#0F172A',
      secondaryColor: '#334155',
      accentColor: '#C6A15B',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F8FAFC',
      textColor: '#0F172A',
      headingFont: "'Playfair Display', Georgia, serif",
      bodyFont: "'DM Sans', system-ui, sans-serif",
      buttonStyle: 'rounded',
      cardStyle: 'bordered',
    },
  },
];

const HEADING_FONTS = [
  { label: 'Playfair Display (Luxury Editorial)', value: "'Playfair Display', Georgia, 'Times New Roman', serif" },
  { label: 'Cormorant Garamond (High Fashion)', value: "'Cormorant Garamond', Georgia, serif" },
  { label: 'Bodoni Moda (Magazine Serif)', value: "'Bodoni Moda', Georgia, serif" },
  { label: 'Lora (Classic Contemporary)', value: "'Lora', Georgia, serif" },
  { label: 'Plus Jakarta Sans (Modern Clean)', value: "'Plus Jakarta Sans', system-ui, sans-serif" },
];

const BODY_FONTS = [
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" },
  { label: 'DM Sans', value: "'DM Sans', system-ui, sans-serif" },
  { label: 'Manrope', value: "'Manrope', system-ui, sans-serif" },
  { label: 'Lora Editorial', value: "'Lora', Georgia, serif" },
];

interface AdminWebsiteEditorSectionProps {
  cmsState: CmsAdminState;
  categories: Category[];
  storeSettings: StoreSettings;
  onRefresh: () => Promise<void>;
  onRefreshPublicStore: () => Promise<void>;
  pushToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminWebsiteEditorSection({
  cmsState,
  categories,
  storeSettings,
  onRefresh,
  onRefreshPublicStore,
  pushToast,
}: AdminWebsiteEditorSectionProps) {
  const [activeTab, setActiveTab] = useState<WebsiteEditorTabId>('overview');
  const [serverState, setServerState] = useState<CmsAdminState>(cmsState);
  const [draft, setDraft] = useState<CmsData>(() => JSON.parse(JSON.stringify(cmsState.draft)) as CmsData);
  const [mediaLibrary, setMediaLibrary] = useState<MediaAsset[]>(cmsState.mediaLibrary || []);
  const [websiteMeta, setWebsiteMeta] = useState({
    storeName: storeSettings.storeName,
    tagline: storeSettings.tagline,
    phone: storeSettings.phone,
    whatsapp: storeSettings.whatsapp,
    storeEmail: storeSettings.storeEmail,
    address: storeSettings.address,
    businessHours: storeSettings.businessHours || '',
  });

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState('/');

  const [mediaPickerState, setMediaPickerState] = useState<{
    open: boolean;
    currentUrl: string;
    folder: MediaFolder;
    onPicked: (url: string) => void;
  }>({
    open: false,
    currentUrl: '',
    folder: 'general',
    onPicked: () => {},
  });

  useEffect(() => {
    setServerState(cmsState);
    setDraft(JSON.parse(JSON.stringify(cmsState.draft)) as CmsData);
    setMediaLibrary(cmsState.mediaLibrary || []);
  }, [cmsState]);

  const hasLocalUnsavedEdits = JSON.stringify(draft) !== JSON.stringify(serverState.draft);
  const hasUnpublishedChanges =
    hasLocalUnsavedEdits || JSON.stringify(draft) !== JSON.stringify(serverState.published);

  const openMediaPicker = (
    currentUrl: string,
    onPicked: (url: string) => void,
    folder: MediaFolder = 'general'
  ) => {
    setMediaPickerState({
      open: true,
      currentUrl,
      folder,
      onPicked,
    });
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const updated = await apiFetch<CmsAdminState>('/api/admin/cms/draft', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      setServerState(updated);
      setDraft(JSON.parse(JSON.stringify(updated.draft)) as CmsData);
      await onRefresh();
      pushToast('Website draft saved cleanly.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save draft.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await apiFetch<{ cmsState: CmsAdminState }>('/api/admin/cms/publish', {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      setServerState(res.cmsState);
      setDraft(JSON.parse(JSON.stringify(res.cmsState.draft)) as CmsData);
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast('Website changes published live across Diamond Market.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to publish changes.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleResetDraft = async () => {
    setSaving(true);
    try {
      const resetState = await apiFetch<CmsAdminState>('/api/admin/cms/reset-draft', {
        method: 'POST',
      });
      setServerState(resetState);
      setDraft(JSON.parse(JSON.stringify(resetState.draft)) as CmsData);
      await onRefresh();
      pushToast('Draft reset to live published state.', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Reset failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWebsiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const syncedDraft: CmsData = {
        ...draft,
        header: {
          ...draft.header,
          storeNameDisplay: websiteMeta.storeName,
        },
        footer: {
          ...draft.footer,
          phone: websiteMeta.phone,
          email: websiteMeta.storeEmail,
          address: websiteMeta.address,
          socialLinks: {
            ...draft.footer.socialLinks,
            whatsapp: websiteMeta.whatsapp,
          },
        },
      };
      await apiFetch('/api/admin/store-settings', {
        method: 'PUT',
        body: JSON.stringify(websiteMeta),
      });
      const res = await apiFetch<{ cmsState: CmsAdminState }>('/api/admin/cms/publish', {
        method: 'POST',
        body: JSON.stringify(syncedDraft),
      });
      setServerState(res.cmsState);
      setDraft(JSON.parse(JSON.stringify(res.cmsState.draft)) as CmsData);
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast('Website settings updated and published live.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to update settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const moveHeaderLink = (idx: number, dir: -1 | 1) => {
    const links = [...draft.header.navLinks].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = idx + dir;
    if (target < 0 || target >= links.length) return;
    const [removed] = links.splice(idx, 1);
    links.splice(target, 0, removed);
    setDraft((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        navLinks: links.map((l, i) => ({ ...l, sortOrder: i + 1 })),
      },
    }));
  };

  const updateFooterColumns = (nextCols: CmsFooterColumn[]) => {
    setDraft((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        columns: nextCols,
      },
    }));
  };

  const activeSectionsCount = draft.homepageSections.filter((s) => s.enabled && s.visible).length;
  const publishedPagesCount = draft.pages.filter((p) => p.status === 'published' && p.visible).length;

  return (
    <div className="space-y-6">
      {/* Studio Action Toolbar */}
      <div className="bg-white border border-[#E8E8E8] rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg font-bold text-[#111111]">
              Diamond Market Website Studio
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                hasUnpublishedChanges
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {hasLocalUnsavedEdits
                ? 'Unsaved Edits'
                : hasUnpublishedChanges
                ? 'Draft Ahead of Live'
                : 'Published & Live'}
            </span>
          </div>
          <p className="text-xs text-[#333333]/75">
            Manage homepage sections, pages, navigation menus, header, footer, branding, SEO &amp; media.
            {serverState.lastPublishedAt && (
              <span className="ml-2 font-mono-num text-[11px] text-[#8C6D34]">
                Last published: {new Date(serverState.lastPublishedAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPreviewPath('/');
              setPreviewOpen(true);
            }}
            className="h-10 px-4 rounded-xl border border-[#E8E8E8] bg-[#FAF8F3] hover:border-[#C6A15B] text-xs font-bold uppercase tracking-wider text-[#111111] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-4 h-4 text-[#C6A15B]" />
            Live Preview
          </button>

          {hasUnpublishedChanges && (
            <button
              type="button"
              disabled={saving || publishing}
              onClick={handleResetDraft}
              className="h-10 px-3.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Draft
            </button>
          )}

          <button
            type="button"
            disabled={saving || publishing}
            onClick={handleSaveDraft}
            className="h-10 px-4 rounded-xl border border-[#111111] bg-white hover:bg-[#FAF8F3] text-[#111111] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            type="button"
            disabled={saving || publishing}
            onClick={handlePublish}
            className="h-10 px-5 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C6A15B]" />
            {publishing ? 'Publishing...' : 'Publish Changes'}
          </button>
        </div>
      </div>

      {/* Horizontal Sub-Navigation for the 11 CMS Modules */}
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-2 flex items-center gap-1.5 overflow-x-auto">
        {EDITOR_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                active
                  ? 'bg-[#111111] text-white'
                  : 'text-[#333333] hover:bg-[#FAF8F3] hover:text-[#111111]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#C6A15B]' : 'text-[#8C6D34]'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. WEBSITE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                Active Homepage Sections
              </p>
              <p className="font-mono-num text-2xl font-bold text-[#111111]">
                {activeSectionsCount} / {draft.homepageSections.length}
              </p>
              <p className="text-xs text-[#333333]/75">Visible &amp; enabled on landing page</p>
            </div>
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                Published Store Pages
              </p>
              <p className="font-mono-num text-2xl font-bold text-[#111111]">
                {publishedPagesCount} / {draft.pages.length}
              </p>
              <p className="text-xs text-[#333333]/75">About, FAQ, Policies &amp; custom pages</p>
            </div>
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                Active Theme Preset
              </p>
              <p className="font-display text-lg font-bold text-[#111111] truncate">
                {THEME_PRESETS.find((p) => p.id === draft.theme.presetId)?.name || 'Custom Theme'}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                {[draft.theme.primaryColor, draft.theme.accentColor, draft.theme.surfaceColor].map(
                  (hex, idx) => (
                    <span
                      key={idx}
                      style={{ backgroundColor: hex }}
                      className="w-4 h-4 rounded-full border border-[#E8E8E8]"
                    />
                  )
                )}
              </div>
            </div>
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                Media Library Assets
              </p>
              <p className="font-mono-num text-2xl font-bold text-[#111111]">
                {mediaLibrary.length}
              </p>
              <p className="text-xs text-[#333333]/75">Hosted &amp; starter storefront visuals</p>
            </div>
          </div>

          <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#111111]">
              Quick Website Management Shortcuts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EDITOR_TABS.filter((t) => t.id !== 'overview').map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className="p-4 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3]/60 hover:bg-[#FAF8F3] hover:border-[#C6A15B] text-left flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <span className="w-10 h-10 rounded-xl bg-[#111111] text-[#C6A15B] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">{t.label}</p>
                      <p className="text-[11px] text-[#333333]/75">Open editor workspace →</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. HOMEPAGE BUILDER */}
      {activeTab === 'homepage' && (
        <CmsHomepageBuilderTab
          sections={draft.homepageSections}
          categories={categories}
          onChangeSections={(next) => setDraft((prev) => ({ ...prev, homepageSections: next }))}
          onOpenMediaPicker={(currentUrl, onPicked) =>
            openMediaPicker(currentUrl, onPicked, 'hero')
          }
        />
      )}

      {/* 3. PAGE EDITOR */}
      {activeTab === 'pages' && (
        <CmsPageEditorTab
          pages={draft.pages}
          onPagesStateSynced={(nextState) => {
            setServerState(nextState);
            setDraft(JSON.parse(JSON.stringify(nextState.draft)) as CmsData);
          }}
          onRefreshPublicStore={onRefreshPublicStore}
          onOpenMediaPicker={(currentUrl, onPicked) =>
            openMediaPicker(currentUrl, onPicked, 'pages')
          }
          onPreviewPage={(slugPath) => {
            setPreviewPath(slugPath);
            setPreviewOpen(true);
          }}
          pushToast={pushToast}
        />
      )}

      {/* 4. HEADER EDITOR */}
      {activeTab === 'header' && (
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E8E8E8]">
            <div>
              <h3 className="font-display text-lg font-bold text-[#111111]">Header Editor</h3>
              <p className="text-xs text-[#333333]/75">
                Configure store logo, header layout, sticky behavior, and utility icons.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('navigation')}
              className="text-xs font-bold uppercase tracking-wider text-[#8C6D34] hover:underline cursor-pointer"
            >
              Edit Header Menu Links →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Header Store Title
              </label>
              <input
                type="text"
                value={draft.header.storeNameDisplay}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    header: { ...prev.header, storeNameDisplay: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Brand Subtext (under logo)
              </label>
              <input
                type="text"
                value={draft.header.subtext}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    header: { ...prev.header, subtext: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Header Layout Style
              </label>
              <select
                value={draft.header.layout}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    header: {
                      ...prev.header,
                      layout: e.target.value as CmsData['header']['layout'],
                    },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-sm"
              >
                <option value="classic_luxury">Classic Luxury (Logo Left · Nav · Search)</option>
                <option value="centered_brand">Centered Navigation Emphasis</option>
                <option value="minimal_bar">Minimal Single Bar (No Sub-Bar)</option>
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#111111]">Custom Logo Image (Optional)</p>
                <input
                  type="text"
                  value={draft.header.logoUrl}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      header: { ...prev.header, logoUrl: e.target.value },
                    }))
                  }
                  placeholder="Default geometric diamond emblem if empty"
                  className="w-full h-8 px-2.5 mt-1 rounded-lg border border-[#E8E8E8] bg-white text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  openMediaPicker(
                    draft.header.logoUrl,
                    (url) =>
                      setDraft((prev) => ({
                        ...prev,
                        header: { ...prev.header, logoUrl: url },
                      })),
                    'logos'
                  )
                }
                className="h-9 px-3 rounded-xl bg-[#111111] text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Pick Logo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-semibold">
            {[
              { key: 'visible', label: 'Show Header' },
              { key: 'sticky', label: 'Sticky Header' },
              { key: 'showSubtext', label: 'Show Brand Subtext' },
              { key: 'showCategorySubBar', label: 'Show Category Bar' },
              { key: 'showSearch', label: 'Show Search Bar' },
              { key: 'showWishlist', label: 'Show Wishlist Icon' },
              { key: 'showAccount', label: 'Show Account Button' },
              { key: 'showCart', label: 'Show Bag / Cart' },
              { key: 'showWhatsappButton', label: 'Show WhatsApp Button' },
            ].map((toggle) => (
              <label
                key={toggle.key}
                className="p-3 rounded-xl border border-[#E8E8E8] bg-[#FAF8F3] flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(draft.header[toggle.key as keyof CmsData['header']])}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      header: { ...prev.header, [toggle.key]: e.target.checked },
                    }))
                  }
                />
                {toggle.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 5. FOOTER EDITOR */}
      {activeTab === 'footer' && (
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E8E8E8]">
            <div>
              <h3 className="font-display text-lg font-bold text-[#111111]">Footer Editor</h3>
              <p className="text-xs text-[#333333]/75">
                Customize footer theme, about copy, contact info, newsletter signup, social URLs, and link columns.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.footer.visible}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, visible: e.target.checked },
                    }))
                  }
                />
                Show Footer
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.footer.showPaymentBadges}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, showPaymentBadges: e.target.checked },
                    }))
                  }
                />
                Show Payment Badges
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">Footer Surface Style</label>
              <select
                value={draft.footer.style}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, style: e.target.value as CmsData['footer']['style'] },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-sm"
              >
                <option value="obsidian_dark">Obsidian Black (#111111)</option>
                <option value="charcoal_editorial">Charcoal Slate (#1D1D1F)</option>
                <option value="ivory_light">Soft Ivory Light (#FAF8F3)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">Copyright Notice</label>
              <input
                type="text"
                value={draft.footer.copyrightText}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, copyrightText: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#111111] mb-1">Footer About Text</label>
              <textarea
                rows={2}
                value={draft.footer.aboutText}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, aboutText: e.target.value },
                  }))
                }
                className="w-full p-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>
          </div>

          {/* Footer Newsletter Strip Config */}
          <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                Footer Newsletter Section
              </p>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.footer.showNewsletter}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, showNewsletter: e.target.checked },
                    }))
                  }
                />
                Enabled
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={draft.footer.newsletterEyebrow}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, newsletterEyebrow: e.target.value },
                  }))
                }
                placeholder="Eyebrow"
                className="h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
              />
              <input
                type="text"
                value={draft.footer.newsletterButtonText}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, newsletterButtonText: e.target.value },
                  }))
                }
                placeholder="Button text"
                className="h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
              />
              <input
                type="text"
                value={draft.footer.newsletterTitle}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, newsletterTitle: e.target.value },
                  }))
                }
                placeholder="Newsletter Title"
                className="sm:col-span-2 h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
              />
            </div>
          </div>

          {/* Contact & Social */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Footer Phone</label>
              <input
                type="text"
                value={draft.footer.phone}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, phone: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Footer Email</label>
              <input
                type="email"
                value={draft.footer.email}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, email: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">WhatsApp Number</label>
              <input
                type="text"
                value={draft.footer.socialLinks.whatsapp}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: {
                      ...prev.footer,
                      socialLinks: { ...prev.footer.socialLinks, whatsapp: e.target.value },
                    },
                  }))
                }
                className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Instagram URL</label>
              <input
                type="url"
                value={draft.footer.socialLinks.instagram}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: {
                      ...prev.footer,
                      socialLinks: { ...prev.footer.socialLinks, instagram: e.target.value },
                    },
                  }))
                }
                className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Twitter / X URL</label>
              <input
                type="url"
                value={draft.footer.socialLinks.twitter}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: {
                      ...prev.footer,
                      socialLinks: { ...prev.footer.socialLinks, twitter: e.target.value },
                    },
                  }))
                }
                className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Facebook URL</label>
              <input
                type="url"
                value={draft.footer.socialLinks.facebook}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    footer: {
                      ...prev.footer,
                      socialLinks: { ...prev.footer.socialLinks, facebook: e.target.value },
                    },
                  }))
                }
                className="w-full h-9 px-3 rounded-xl border border-[#E8E8E8] text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. NAVIGATION MENU EDITOR (Header + Footer Columns) */}
      {activeTab === 'navigation' && (
        <div className="space-y-6">
          {/* Header Menu */}
          <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111111]">
                  Primary Header Navigation Links
                </h3>
                <p className="text-xs text-[#333333]/75">
                  Add, edit, reorder, hide, or remove links shown in the top bar and mobile drawer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextLink: CmsNavLink = {
                    id: `nav-${Date.now().toString(36)}`,
                    label: 'New Link',
                    url: '/shop',
                    visible: true,
                    sortOrder: draft.header.navLinks.length + 1,
                  };
                  setDraft((prev) => ({
                    ...prev,
                    header: { ...prev.header, navLinks: [...prev.header.navLinks, nextLink] },
                  }));
                }}
                className="h-9 px-3.5 rounded-xl bg-[#111111] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#C6A15B]" /> Add Menu Item
              </button>
            </div>

            <div className="space-y-2.5">
              {[...draft.header.navLinks]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((lnk, idx, arr) => (
                  <div
                    key={lnk.id}
                    className="p-3 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3] flex flex-wrap items-center gap-2.5"
                  >
                    <input
                      type="text"
                      value={lnk.label}
                      onChange={(e) => {
                        const updated = draft.header.navLinks.map((x) =>
                          x.id === lnk.id ? { ...x, label: e.target.value } : x
                        );
                        setDraft((prev) => ({
                          ...prev,
                          header: { ...prev.header, navLinks: updated },
                        }));
                      }}
                      placeholder="Label"
                      className="w-40 h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs font-semibold"
                    />
                    <input
                      type="text"
                      value={lnk.url}
                      onChange={(e) => {
                        const updated = draft.header.navLinks.map((x) =>
                          x.id === lnk.id ? { ...x, url: e.target.value } : x
                        );
                        setDraft((prev) => ({
                          ...prev,
                          header: { ...prev.header, navLinks: updated },
                        }));
                      }}
                      placeholder="URL (e.g. /shop, /faq, /size-guide)"
                      className="flex-1 min-w-[180px] h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs font-mono-num"
                    />
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const updated = draft.header.navLinks.map((x) =>
                          x.id === lnk.id ? { ...x, url: e.target.value } : x
                        );
                        setDraft((prev) => ({
                          ...prev,
                          header: { ...prev.header, navLinks: updated },
                        }));
                      }}
                      className="h-9 px-2 rounded-xl border border-[#E8E8E8] bg-white text-[11px]"
                    >
                      <option value="">Link to page...</option>
                      {draft.pages.map((p) => (
                        <option key={p.id} value={`/${p.slug}`}>
                          Page: {p.title}
                        </option>
                      ))}
                      {categories.map((c) => (
                        <option key={c.id} value={`/category/${c.slug}`}>
                          Category: {c.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveHeaderLink(idx, -1)}
                        className="w-8 h-8 rounded-lg border border-[#E8E8E8] bg-white disabled:opacity-30 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={() => moveHeaderLink(idx, 1)}
                        className="w-8 h-8 rounded-lg border border-[#E8E8E8] bg-white disabled:opacity-30 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = draft.header.navLinks.map((x) =>
                            x.id === lnk.id ? { ...x, visible: !x.visible } : x
                          );
                          setDraft((prev) => ({
                            ...prev,
                            header: { ...prev.header, navLinks: updated },
                          }));
                        }}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer ${
                          lnk.visible
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-500'
                        }`}
                      >
                        {lnk.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = draft.header.navLinks.filter((x) => x.id !== lnk.id);
                          setDraft((prev) => ({
                            ...prev,
                            header: { ...prev.header, navLinks: updated },
                          }));
                        }}
                        className="w-8 h-8 rounded-lg border border-rose-200 bg-white text-rose-600 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Footer Columns Menu Editor */}
          <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111111]">
                  Footer Link Columns ({draft.footer.columns.length})
                </h3>
                <p className="text-xs text-[#333333]/75">
                  Customize column titles and links rendered inside the footer.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateFooterColumns([
                    ...draft.footer.columns,
                    {
                      id: `col-${Date.now().toString(36)}`,
                      title: 'New Column',
                      visible: true,
                      links: [],
                    },
                  ])
                }
                className="h-9 px-3.5 rounded-xl border border-[#111111] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Column
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {draft.footer.columns.map((col, cIdx) => (
                <div
                  key={col.id}
                  className="p-4 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3] space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={col.title}
                      onChange={(e) => {
                        const copy = [...draft.footer.columns];
                        copy[cIdx] = { ...col, title: e.target.value };
                        updateFooterColumns(copy);
                      }}
                      className="flex-1 h-9 px-2.5 rounded-lg border border-[#E8E8E8] bg-white text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...draft.footer.columns];
                        copy[cIdx] = { ...col, visible: !col.visible };
                        updateFooterColumns(copy);
                      }}
                      className="w-8 h-8 rounded-lg border border-[#E8E8E8] bg-white flex items-center justify-center cursor-pointer"
                    >
                      {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {col.links.map((lnk, lIdx) => (
                      <div key={lnk.id} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={lnk.label}
                          onChange={(e) => {
                            const copy = [...draft.footer.columns];
                            const nextLinks = [...col.links];
                            nextLinks[lIdx] = { ...lnk, label: e.target.value };
                            copy[cIdx] = { ...col, links: nextLinks };
                            updateFooterColumns(copy);
                          }}
                          className="w-1/2 h-8 px-2 rounded-lg border border-[#E8E8E8] bg-white text-[11px]"
                        />
                        <input
                          type="text"
                          value={lnk.url}
                          onChange={(e) => {
                            const copy = [...draft.footer.columns];
                            const nextLinks = [...col.links];
                            nextLinks[lIdx] = { ...lnk, url: e.target.value };
                            copy[cIdx] = { ...col, links: nextLinks };
                            updateFooterColumns(copy);
                          }}
                          className="w-1/2 h-8 px-2 rounded-lg border border-[#E8E8E8] bg-white text-[11px] font-mono-num"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = [...draft.footer.columns];
                            copy[cIdx] = {
                              ...col,
                              links: col.links.filter((x) => x.id !== lnk.id),
                            };
                            updateFooterColumns(copy);
                          }}
                          className="text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const copy = [...draft.footer.columns];
                      copy[cIdx] = {
                        ...col,
                        links: [
                          ...col.links,
                          {
                            id: `fl-${Date.now().toString(36)}`,
                            label: 'New Link',
                            url: '/shop',
                            visible: true,
                            sortOrder: col.links.length + 1,
                          },
                        ],
                      };
                      updateFooterColumns(copy);
                    }}
                    className="w-full h-8 rounded-lg border border-[#E8E8E8] bg-white hover:border-[#C6A15B] text-[11px] font-semibold cursor-pointer"
                  >
                    + Add Link to {col.title}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. THEME & BRANDING */}
      {activeTab === 'theme' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-5">
            <div>
              <h3 className="font-display text-lg font-bold text-[#111111]">
                Luxury Style Presets
              </h3>
              <p className="text-xs text-[#333333]/75">
                Apply a curated brand palette &amp; typography preset or fine-tune every color and shape token below.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {THEME_PRESETS.map((preset) => {
                const active = draft.theme.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        theme: {
                          ...prev.theme,
                          ...preset.patch,
                          presetId: preset.id,
                        },
                      }))
                    }
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${
                      active
                        ? 'border-[#C6A15B] bg-[#FAF8F3] ring-2 ring-[#C6A15B]/25'
                        : 'border-[#E8E8E8] hover:border-[#C6A15B]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span
                          style={{ backgroundColor: preset.patch.primaryColor }}
                          className="w-4 h-4 rounded-full border border-black/15"
                        />
                        <span
                          style={{ backgroundColor: preset.patch.accentColor }}
                          className="w-4 h-4 rounded-full border border-black/15"
                        />
                        <span
                          style={{ backgroundColor: preset.patch.surfaceColor }}
                          className="w-4 h-4 rounded-full border border-black/15"
                        />
                      </div>
                      {active && <CheckCircle2 className="w-4 h-4 text-[#8C6D34]" />}
                    </div>
                    <p className="text-xs font-bold text-[#111111]">{preset.name}</p>
                    <p className="text-[11px] text-[#333333]/75 leading-snug">{preset.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Pickers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 border-t border-[#E8E8E8]">
              {[
                { key: 'primaryColor', label: 'Primary Color' },
                { key: 'secondaryColor', label: 'Secondary Ink' },
                { key: 'accentColor', label: 'Accent Gold' },
                { key: 'backgroundColor', label: 'Page Background' },
                { key: 'surfaceColor', label: 'Soft Surface' },
                { key: 'textColor', label: 'Body Text' },
              ].map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#111111]">{c.label}</label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-[#E8E8E8] bg-[#FAF8F3]">
                    <input
                      type="color"
                      value={String(draft.theme[c.key as keyof CmsThemeConfig] || '#111111')}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          theme: { ...prev.theme, [c.key]: e.target.value },
                        }))
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="font-mono-num text-[11px] uppercase text-[#333333]">
                      {String(draft.theme[c.key as keyof CmsThemeConfig])}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Typography, Button & Card Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-[#E8E8E8]">
              <div>
                <label className="block text-xs font-semibold mb-1">Display Heading Font</label>
                <select
                  value={draft.theme.headingFont}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, headingFont: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  {HEADING_FONTS.map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Body Copy Font</label>
                <select
                  value={draft.theme.bodyFont}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, bodyFont: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  {BODY_FONTS.map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Font Size Scale</label>
                <select
                  value={draft.theme.fontSizeScale}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        fontSizeScale: e.target.value as CmsThemeConfig['fontSizeScale'],
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="compact">Compact (94%)</option>
                  <option value="standard">Standard (100%)</option>
                  <option value="large">Editorial Large (106%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Button Shape</label>
                <select
                  value={draft.theme.buttonStyle}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        buttonStyle: e.target.value as CmsThemeConfig['buttonStyle'],
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="pill">Luxury Pill (Full Round)</option>
                  <option value="rounded">Tailored Rounded</option>
                  <option value="square">Architectural Sharp</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Product &amp; Content Card Style</label>
                <select
                  value={draft.theme.cardStyle}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        cardStyle: e.target.value as CmsThemeConfig['cardStyle'],
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="bordered">Crisp Bordered</option>
                  <option value="elevated">Soft Elevated Shadow</option>
                  <option value="flat">Ivory Minimal Surface</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Container Max Width</label>
                <select
                  value={draft.theme.containerWidth}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        containerWidth: e.target.value as CmsThemeConfig['containerWidth'],
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                >
                  <option value="standard">Standard (1280px)</option>
                  <option value="wide">Wide (1440px)</option>
                  <option value="full">Full Width</option>
                </select>
              </div>
            </div>
          </div>

          {/* Animations & Interactive UI Card */}
          <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111111]">
                  Animations &amp; Interactive UI Controls
                </h3>
                <p className="text-xs text-[#333333]/75">
                  Configure 3D product tilt, scroll reveals, hero motion, and background effects. Mobile touch devices automatically optimize 3D effects.
                </p>
              </div>
              <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-[#E8E8E8] bg-[#FAF8F3] text-xs font-semibold text-[#111111] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.theme.animationsEnabled ?? true}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, animationsEnabled: e.target.checked },
                    }))
                  }
                  className="accent-[#111111]"
                />
                <span>Enable Storefront Animations</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Animation Style</label>
                <select
                  value={draft.theme.animationStyle || 'luxury_smooth'}
                  disabled={draft.theme.animationsEnabled === false}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        animationStyle: e.target.value as CmsThemeConfig['animationStyle'],
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs disabled:opacity-50"
                >
                  <option value="luxury_smooth">Luxury Smooth (Balanced Ease)</option>
                  <option value="editorial_minimal">Editorial Minimal (Ultra Crisp)</option>
                  <option value="dynamic_studio">Dynamic Studio (Fluid Depth)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Animation Intensity</label>
                <select
                  value={draft.theme.animationIntensity || 'balanced'}
                  disabled={draft.theme.animationsEnabled === false}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        animationIntensity: e.target.value as CmsThemeConfig['animationIntensity'],
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs disabled:opacity-50"
                >
                  <option value="subtle">Subtle (4° Tilt / Gentle Fade)</option>
                  <option value="balanced">Balanced (6.5° Tilt / Smooth Reveal)</option>
                  <option value="expressive">Expressive (9.5° Tilt / Pronounced Depth)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Product Card Hover Style</label>
                <select
                  value={draft.theme.productHoverStyle || 'tilt_3d'}
                  disabled={draft.theme.animationsEnabled === false}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        productHoverStyle: e.target.value as CmsThemeConfig['productHoverStyle'],
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs disabled:opacity-50"
                >
                  <option value="tilt_3d">3D Perspective Tilt + Zoom</option>
                  <option value="lift_zoom">Smooth Card Lift + Image Zoom</option>
                  <option value="minimal">Minimal Quiet Focus</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E8E8E8]">
              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3] text-xs font-medium cursor-pointer">
                <div>
                  <p className="font-bold text-[#111111]">Hero Effects</p>
                  <p className="text-[11px] text-[#333333]/75">Entrance stagger, float &amp; scroll parallax</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.theme.heroEffects ?? true}
                  disabled={draft.theme.animationsEnabled === false}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, heroEffects: e.target.checked },
                    }))
                  }
                  className="accent-[#111111]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3] text-xs font-medium cursor-pointer">
                <div>
                  <p className="font-bold text-[#111111]">Section Reveal Effects</p>
                  <p className="text-[11px] text-[#333333]/75">Smooth scroll fade &amp; slide-up entrance</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.theme.sectionReveal ?? true}
                  disabled={draft.theme.animationsEnabled === false}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, sectionReveal: e.target.checked },
                    }))
                  }
                  className="accent-[#111111]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3] text-xs font-medium cursor-pointer">
                <div>
                  <p className="font-bold text-[#111111]">Background Effects</p>
                  <p className="text-[11px] text-[#333333]/75">Subtle champagne ambient gradient drift</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.theme.backgroundEffects ?? true}
                  disabled={draft.theme.animationsEnabled === false}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: { ...prev.theme, backgroundEffects: e.target.checked },
                    }))
                  }
                  className="accent-[#111111]"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 8. MEDIA LIBRARY */}
      {activeTab === 'media' && (
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6">
          <MediaLibraryBrowser
            mediaLibrary={mediaLibrary}
            onMediaUpdated={(next) => setMediaLibrary(next)}
            pushToast={pushToast}
          />
        </div>
      )}

      {/* 9. SEO SETTINGS */}
      {activeTab === 'seo' && (
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-5">
          <div>
            <h3 className="font-display text-lg font-bold text-[#111111]">
              Global SEO &amp; Social Sharing Metadata
            </h3>
            <p className="text-xs text-[#333333]/75">
              Synced dynamically to document titles and OpenGraph meta tags across storefront pages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Global Homepage Title</label>
              <input
                type="text"
                value={draft.seo.globalTitle}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    seo: { ...prev.seo, globalTitle: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Title Separator</label>
              <input
                type="text"
                value={draft.seo.titleSeparator}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    seo: { ...prev.seo, titleSeparator: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold">Default Meta Description</label>
                <span className="text-[11px] font-mono-num text-[#333333]/70">
                  {draft.seo.metaDescription.length} chars
                </span>
              </div>
              <textarea
                rows={3}
                value={draft.seo.metaDescription}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    seo: { ...prev.seo, metaDescription: e.target.value },
                  }))
                }
                className="w-full p-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Keywords (comma-separated)</label>
              <input
                type="text"
                value={draft.seo.metaKeywords}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    seo: { ...prev.seo, metaKeywords: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Twitter / X Handle</label>
              <input
                type="text"
                value={draft.seo.twitterHandle}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    seo: { ...prev.seo, twitterHandle: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-xs"
              />
            </div>

            <div className="md:col-span-2 p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#111111]">OpenGraph Social Share Image</p>
                <input
                  type="text"
                  value={draft.seo.ogImageUrl}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      seo: { ...prev.seo, ogImageUrl: e.target.value },
                    }))
                  }
                  className="w-full h-9 px-3 mt-1 rounded-xl border border-[#E8E8E8] bg-white text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  openMediaPicker(
                    draft.seo.ogImageUrl,
                    (url) =>
                      setDraft((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, ogImageUrl: url },
                      })),
                    'banners'
                  )
                }
                className="h-9 px-3.5 rounded-xl bg-[#111111] text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Pick Share Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. ANNOUNCEMENT BAR */}
      {activeTab === 'announcement' && (
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-[#111111]">
                Storefront Announcement Bar
              </h3>
              <p className="text-xs text-[#333333]/75">
                Highlight promo codes, free delivery thresholds, or seasonal arrivals at the very top of your site.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={draft.header.announcementEnabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    header: { ...prev.header, announcementEnabled: e.target.checked },
                  }))
                }
              />
              Enable Top Announcement Bar
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Announcement Copy</label>
              <input
                type="text"
                value={draft.header.announcementText}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    header: { ...prev.header, announcementText: e.target.value },
                  }))
                }
                className="w-full h-11 px-4 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Optional Action Link Label</label>
                <input
                  type="text"
                  value={draft.header.announcementLinkText}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      header: { ...prev.header, announcementLinkText: e.target.value },
                    }))
                  }
                  placeholder="e.g. Shop New Arrivals"
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Optional Action URL</label>
                <input
                  type="text"
                  value={draft.header.announcementLinkUrl}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      header: { ...prev.header, announcementLinkUrl: e.target.value },
                    }))
                  }
                  placeholder="e.g. /shop"
                  className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm font-mono-num"
                />
              </div>
            </div>

            {/* Authentic Top Bar Preview Strip */}
            <div className="rounded-xl overflow-hidden border border-[#E8E8E8]">
              <p className="px-3 py-1.5 bg-[#FAF8F3] text-[10px] font-bold uppercase tracking-wider text-[#8C6D34]">
                Announcement Strip Preview
              </p>
              <div className="bg-[#181818] text-neutral-100 text-xs py-2.5 px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[#C6A15B] font-bold uppercase">{draft.header.storeNameDisplay}</span>
                  <span className="truncate">{draft.header.announcementText}</span>
                  {draft.header.announcementLinkText && (
                    <span className="underline text-[#C6A15B] font-semibold">
                      {draft.header.announcementLinkText}
                    </span>
                  )}
                </div>
                <span className="font-mono-num text-[11px] text-neutral-400 shrink-0">
                  {draft.footer.phone}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. WEBSITE SETTINGS */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveWebsiteSettings}
          className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-5"
        >
          <div>
            <h3 className="font-display text-lg font-bold text-[#111111]">
              General Website Identity &amp; Contact Settings
            </h3>
            <p className="text-xs text-[#333333]/75">
              Changes saved here synchronize your global store identity across header, footer, contact page, invoices, and customer emails.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Official Store Name</label>
              <input
                type="text"
                required
                value={websiteMeta.storeName}
                onChange={(e) => setWebsiteMeta((p) => ({ ...p, storeName: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Store Tagline</label>
              <input
                type="text"
                value={websiteMeta.tagline}
                onChange={(e) => setWebsiteMeta((p) => ({ ...p, tagline: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Primary Phone Number</label>
              <input
                type="text"
                value={websiteMeta.phone}
                onChange={(e) => setWebsiteMeta((p) => ({ ...p, phone: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">WhatsApp Support Number</label>
              <input
                type="text"
                value={websiteMeta.whatsapp}
                onChange={(e) => setWebsiteMeta((p) => ({ ...p, whatsapp: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Contact Email</label>
              <input
                type="email"
                value={websiteMeta.storeEmail}
                onChange={(e) => setWebsiteMeta((p) => ({ ...p, storeEmail: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Business Hours (Optional)</label>
              <input
                type="text"
                value={websiteMeta.businessHours}
                onChange={(e) => setWebsiteMeta((p) => ({ ...p, businessHours: e.target.value }))}
                placeholder="e.g. Mon – Sat, 8:30 AM – 6:30 PM"
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Physical Store Location / Address</label>
              <input
                type="text"
                value={websiteMeta.address}
                onChange={(e) => setWebsiteMeta((p) => ({ ...p, address: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] text-sm"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-6 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#C6A15B]" />
              {saving ? 'Updating...' : 'Save & Publish Website Settings'}
            </button>
          </div>
        </form>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={mediaPickerState.open}
        mediaLibrary={mediaLibrary}
        defaultFolder={mediaPickerState.folder}
        selectedUrl={mediaPickerState.currentUrl}
        onSelect={mediaPickerState.onPicked}
        onMediaUpdated={(next) => setMediaLibrary(next)}
        onClose={() => setMediaPickerState((p) => ({ ...p, open: false }))}
        pushToast={pushToast}
      />

      {/* Responsive Live Website Preview Modal */}
      <CmsLivePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        draftCms={draft}
        publishedCms={serverState.published}
        initialPath={previewPath}
      />
    </div>
  );
}
