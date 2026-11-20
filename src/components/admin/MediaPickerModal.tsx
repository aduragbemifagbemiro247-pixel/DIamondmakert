import {
  Check,
  Copy,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import type { MediaAsset, MediaFolder } from '../../types/commerce.ts';

const FOLDERS: { id: MediaFolder | 'all'; label: string }[] = [
  { id: 'all', label: 'All Assets' },
  { id: 'hero', label: 'Hero Banners' },
  { id: 'banners', label: 'Promo Banners' },
  { id: 'logos', label: 'Logos & Marks' },
  { id: 'pages', label: 'Pages' },
  { id: 'products', label: 'Products' },
  { id: 'general', label: 'General' },
];

interface MediaLibraryBrowserProps {
  mediaLibrary: MediaAsset[];
  defaultFolder?: MediaFolder;
  selectable?: boolean;
  selectedUrl?: string;
  onSelect?: (url: string) => void;
  onMediaUpdated: (next: MediaAsset[]) => void;
  pushToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function MediaLibraryBrowser({
  mediaLibrary,
  defaultFolder = 'general',
  selectable = false,
  selectedUrl,
  onSelect,
  onMediaUpdated,
  pushToast,
}: MediaLibraryBrowserProps) {
  const [folderFilter, setFolderFilter] = useState<MediaFolder | 'all'>('all');
  const [uploadFolder, setUploadFolder] = useState<MediaFolder>(defaultFolder);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customUrlName, setCustomUrlName] = useState('');
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mediaLibrary.filter((item) => {
      if (folderFilter !== 'all' && item.folder !== folderFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.folder.toLowerCase().includes(q)
      );
    });
  }, [mediaLibrary, folderFilter, search]);

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', uploadFolder);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
      const res = await apiFetch<{ asset: MediaAsset; mediaLibrary: MediaAsset[] }>(
        '/api/admin/media/upload',
        { method: 'POST', body: formData }
      );
      onMediaUpdated(res.mediaLibrary);
      pushToast(`Uploaded "${res.asset.name}" to Media Library.`, 'success');
      if (selectable && onSelect) {
        onSelect(res.asset.url);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Image upload failed.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('replaceAssetId', replacingId);
      const res = await apiFetch<{ asset: MediaAsset; mediaLibrary: MediaAsset[] }>(
        '/api/admin/media/upload',
        { method: 'POST', body: formData }
      );
      onMediaUpdated(res.mediaLibrary);
      pushToast(`Replaced image for "${res.asset.name}".`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Replace failed.', 'error');
    } finally {
      setUploading(false);
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const handleAddExternalUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    setUploading(true);
    try {
      const targetUrl = customUrlInput.trim();
      const name = customUrlName.trim() || 'External Brand Image';
      // Save via media/upload? No, let's check or allow quick select + save on server? Let's call direct selection or save
      if (selectable && onSelect) {
        onSelect(targetUrl);
        setCustomUrlInput('');
        setCustomUrlName('');
        pushToast('Image URL applied.', 'success');
      } else {
        pushToast(`Tip: Use Upload Image for hosted assets, or paste URL directly into any image field (${name}).`, 'info');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset: MediaAsset) => {
    try {
      const res = await apiFetch<{ mediaLibrary: MediaAsset[] }>(`/api/admin/media/${asset.id}`, {
        method: 'DELETE',
      });
      onMediaUpdated(res.mediaLibrary);
      pushToast(`Deleted "${asset.name}".`, 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not delete asset.', 'error');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    pushToast('Image URL copied to clipboard.', 'info');
  };

  return (
    <div className="space-y-5">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleUploadFiles}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleReplaceFile}
        className="hidden"
      />

      {/* Upload + Search Controls */}
      <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={uploadFolder}
            onChange={(e) => setUploadFolder(e.target.value as MediaFolder)}
            className="h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs font-semibold text-[#111111]"
            aria-label="Upload folder"
          >
            {FOLDERS.filter((f) => f.id !== 'all').map((f) => (
              <option key={f.id} value={f.id}>
                Folder: {f.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-4 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-[#C6A15B]" />
            {uploading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search images by name or URL..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#E8E8E8] bg-white text-xs text-[#111111]"
          />
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FOLDERS.map((f) => {
          const active = folderFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolderFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                active
                  ? 'bg-[#111111] text-white'
                  : 'bg-white border border-[#E8E8E8] text-[#333333] hover:border-[#C6A15B]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#C6A15B]" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Custom External URL Quick Apply (in Picker Mode) */}
      {selectable && onSelect && (
        <form onSubmit={handleAddExternalUrl} className="flex flex-wrap gap-2 items-center">
          <input
            type="url"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="Or paste an external HTTPS image URL..."
            className="flex-1 min-w-[220px] h-9 px-3 rounded-xl border border-[#E8E8E8] bg-white text-xs"
          />
          <button
            type="submit"
            disabled={!customUrlInput.trim()}
            className="h-9 px-4 rounded-xl border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-xs font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Use URL
          </button>
        </form>
      )}

      {/* Asset Grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl text-xs text-[#333333]/75 space-y-2">
          <ImageIcon className="w-7 h-7 mx-auto text-[#C6A15B]" />
          <p>No images match this folder or filter. Upload a JPG, PNG, or WEBP image above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((asset) => {
            const isSelected = selectedUrl === asset.url;
            return (
              <div
                key={asset.id}
                className={`group rounded-2xl border overflow-hidden bg-white flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'border-[#C6A15B] ring-2 ring-[#C6A15B]/30'
                    : 'border-[#E8E8E8] hover:border-[#C6A15B]'
                }`}
              >
                <div
                  onClick={() => (selectable && onSelect ? onSelect(asset.url) : setPreviewAsset(asset))}
                  className="aspect-[4/3] bg-[#FAF8F3] relative overflow-hidden cursor-pointer"
                >
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#C6A15B] text-[#111111] flex items-center justify-center shadow">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold text-white uppercase tracking-wider">
                    {asset.folder}
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-[#111111] truncate" title={asset.name}>
                    {asset.name}
                  </p>
                  <div className="flex items-center justify-between gap-1.5">
                    {selectable && onSelect ? (
                      <button
                        type="button"
                        onClick={() => onSelect(asset.url)}
                        className="flex-1 h-7 rounded-lg bg-[#111111] hover:bg-[#C6A15B] hover:text-[#111111] text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        Select
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPreviewAsset(asset)}
                        className="flex-1 h-7 rounded-lg border border-[#E8E8E8] hover:bg-[#FAF8F3] text-[#111111] text-[11px] font-semibold cursor-pointer"
                      >
                        Preview
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyUrl(asset.url)}
                      title="Copy URL"
                      className="w-7 h-7 rounded-lg border border-[#E8E8E8] hover:bg-[#FAF8F3] flex items-center justify-center text-[#333333] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {!asset.isSystemAsset && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingId(asset.id);
                            replaceInputRef.current?.click();
                          }}
                          title="Replace image file"
                          className="w-7 h-7 rounded-lg border border-[#E8E8E8] hover:bg-[#FAF8F3] flex items-center justify-center text-[#333333] cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(asset)}
                          title="Delete asset"
                          className="w-7 h-7 rounded-lg border border-rose-200 hover:bg-rose-50 flex items-center justify-center text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#E8E8E8]">
            <div className="px-5 py-3.5 border-b border-[#E8E8E8] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#111111]">{previewAsset.name}</p>
                <p className="text-[11px] font-mono-num text-[#333333]/70">{previewAsset.url}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="w-8 h-8 rounded-full border border-[#E8E8E8] flex items-center justify-center hover:bg-[#FAF8F3] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-[#FAF8F3] p-4 flex items-center justify-center max-h-[65vh] overflow-auto">
              <img
                src={previewAsset.url}
                alt={previewAsset.name}
                className="max-h-[55vh] rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MediaPickerModalProps {
  isOpen: boolean;
  mediaLibrary: MediaAsset[];
  defaultFolder?: MediaFolder;
  selectedUrl?: string;
  onSelect: (url: string) => void;
  onMediaUpdated: (next: MediaAsset[]) => void;
  onClose: () => void;
  pushToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function MediaPickerModal({
  isOpen,
  mediaLibrary,
  defaultFolder = 'general',
  selectedUrl,
  onSelect,
  onMediaUpdated,
  onClose,
  pushToast,
}: MediaPickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#E8E8E8]">
        <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between bg-[#FAF8F3]">
          <div>
            <h3 className="font-display text-lg font-bold text-[#111111]">
              Diamond Market Media Library
            </h3>
            <p className="text-xs text-[#333333]/75">
              Select an uploaded asset, upload a new image (JPG/PNG/WEBP, max 5MB), or paste an external URL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-[#E8E8E8] flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <MediaLibraryBrowser
            mediaLibrary={mediaLibrary}
            defaultFolder={defaultFolder}
            selectable
            selectedUrl={selectedUrl}
            onSelect={(url) => {
              onSelect(url);
              onClose();
            }}
            onMediaUpdated={onMediaUpdated}
            pushToast={pushToast}
          />
        </div>
      </div>
    </div>
  );
}
