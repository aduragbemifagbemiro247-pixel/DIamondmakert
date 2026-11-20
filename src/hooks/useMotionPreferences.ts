import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import type {
  CmsAnimationIntensity,
  CmsAnimationStyle,
  CmsProductHoverStyle,
} from '../types/commerce.ts';

export interface MotionPreferences {
  reducedMotion: boolean;
  canHover: boolean;
  animationsEnabled: boolean;
  animationStyle: CmsAnimationStyle;
  animationIntensity: CmsAnimationIntensity;
  heroEffects: boolean;
  sectionReveal: boolean;
  productHoverStyle: CmsProductHoverStyle;
  backgroundEffects: boolean;
  enable3DTilt: boolean;
  tiltMaxDeg: number;
}

export function useMotionPreferences(): MotionPreferences {
  const { cms } = useStore();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canHover, setCanHover] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');

    const sync = () => {
      setReducedMotion(motionMq.matches);
      setCanHover(hoverMq.matches);
    };
    sync();

    motionMq.addEventListener?.('change', sync);
    hoverMq.addEventListener?.('change', sync);
    return () => {
      motionMq.removeEventListener?.('change', sync);
      hoverMq.removeEventListener?.('change', sync);
    };
  }, []);

  const t = cms?.theme;
  const cmsEnabled = t?.animationsEnabled ?? true;
  const animationsEnabled = cmsEnabled && !reducedMotion;
  const animationStyle: CmsAnimationStyle = t?.animationStyle || 'luxury_smooth';
  const animationIntensity: CmsAnimationIntensity = t?.animationIntensity || 'balanced';
  const productHoverStyle: CmsProductHoverStyle = t?.productHoverStyle || 'tilt_3d';

  const heroEffects = animationsEnabled && (t?.heroEffects ?? true);
  const sectionReveal = animationsEnabled && (t?.sectionReveal ?? true);
  const backgroundEffects = animationsEnabled && (t?.backgroundEffects ?? true);
  const enable3DTilt = animationsEnabled && canHover && productHoverStyle === 'tilt_3d';

  const tiltMaxDeg =
    animationIntensity === 'subtle' ? 4 : animationIntensity === 'expressive' ? 9.5 : 6.5;

  return {
    reducedMotion,
    canHover,
    animationsEnabled,
    animationStyle,
    animationIntensity,
    heroEffects,
    sectionReveal,
    productHoverStyle,
    backgroundEffects,
    enable3DTilt,
    tiltMaxDeg,
  };
}
