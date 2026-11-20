import { ExternalLink, Eye, Monitor, RefreshCw, Smartphone, Tablet, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { CmsData } from '../../types/commerce.ts';

interface CmsLivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftCms: CmsData;
  publishedCms: CmsData;
  initialPath?: string;
}

export function CmsLivePreviewModal({
  isOpen,
  onClose,
  draftCms,
  publishedCms,
  initialPath = '/',
}: CmsLivePreviewModalProps) {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [sourceMode, setSourceMode] = useState<'draft' | 'published'>('draft');
  const [previewPath, setPreviewPath] = useState<string>(initialPath || '/');
  const [iframeKey, setIframeKey] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (isOpen && initialPath) {
      setPreviewPath(initialPath);
    }
  }, [isOpen, initialPath]);

  const sendPreviewPayload = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'DM_CMS_PREVIEW',
        cmsData: sourceMode === 'draft' ? draftCms : publishedCms,
        previewPath,
      },
      window.location.origin
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    sendPreviewPayload();
  }, [isOpen, sourceMode, draftCms, publishedCms, previewPath]);

  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === 'DM_CMS_PREVIEW_READY') {
        sendPreviewPayload();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  if (!isOpen) return null;

  const pageOptions = [
    { label: 'Homepage (/)', value: '/' },
    { label: 'Shop Catalog (/shop)', value: '/shop' },
    { label: 'Contact Us (/contact)', value: '/contact' },
    ...(sourceMode === 'draft' ? draftCms.pages : publishedCms.pages).map((p) => ({
      label: `${p.title} (/${p.slug})`,
      value: `/${p.slug}`,
    })),
  ];

  const widthClass =
    viewport === 'mobile'
      ? 'w-[390px]'
      : viewport === 'tablet'
      ? 'w-[768px]'
      : 'w-full max-w-[1360px]';

  return (
    <div className="fixed inset-0 z-[75] bg-[#111111]/85 backdrop-blur-xs flex flex-col">
      {/* Studio Preview Top Bar */}
      <div className="bg-[#141414] border-b border-white/15 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#C6A15B] whitespace-nowrap">
            <Eye className="w-4 h-4" />
            Live Site Preview
          </span>

          <select
            value={previewPath}
            onChange={(e) => setPreviewPath(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-white/10 border border-white/15 text-xs text-white max-w-[210px]"
            aria-label="Preview page route"
          >
            {pageOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="text-[#111111]">
                {opt.label}
              </option>
            ))}
          </select>

          <div className="hidden md:flex items-center rounded-lg bg-white/10 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setSourceMode('draft')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer whitespace-nowrap ${
                sourceMode === 'draft' ? 'bg-[#C6A15B] text-[#111111]' : 'text-neutral-300'
              }`}
            >
              Draft / Unsaved Edits
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('published')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer whitespace-nowrap ${
                sourceMode === 'published' ? 'bg-white text-[#111111]' : 'text-neutral-300'
              }`}
            >
              Live Published Site
            </button>
          </div>
        </div>

        {/* Viewport Toggle + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg bg-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              title="Desktop Viewport"
              className={`p-1.5 rounded-md cursor-pointer ${
                viewport === 'desktop' ? 'bg-[#C6A15B] text-[#111111]' : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('tablet')}
              title="Tablet Viewport (768px)"
              className={`p-1.5 rounded-md cursor-pointer ${
                viewport === 'tablet' ? 'bg-[#C6A15B] text-[#111111]' : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              title="Mobile Viewport (390px)"
              className={`p-1.5 rounded-md cursor-pointer ${
                viewport === 'mobile' ? 'bg-[#C6A15B] text-[#111111]' : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Reload preview frame"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <a
            href={previewPath}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-neutral-100 whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Live Tab
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>

      {/* Responsive Frame Stage */}
      <div className="flex-1 overflow-auto p-3 sm:p-6 flex justify-center items-start bg-[#1E1E22]">
        <div
          className={`${widthClass} h-full min-h-[560px] bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/15 transition-all duration-300`}
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={`${previewPath === '/' ? '' : previewPath}/?cms_preview=1`.replace('//?', '/?')}
            title="Diamond Market Live Storefront Preview"
            className="w-full h-full border-0 bg-white"
            onLoad={sendPreviewPayload}
          />
        </div>
      </div>
    </div>
  );
}
