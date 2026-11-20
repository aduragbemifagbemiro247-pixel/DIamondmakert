import React, { useEffect, useRef, useState } from 'react';
import { useMotionPreferences } from '../hooks/useMotionPreferences.ts';

interface RevealSectionProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

export function RevealSection({ children, className = '', delayMs = 0 }: RevealSectionProps) {
  const { sectionReveal, animationIntensity } = useMotionPreferences();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!sectionReveal);

  useEffect(() => {
    if (!sectionReveal) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    // Immediate check in case section is already above or inside initial viewport
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(node);

    // Safety fallback so content is never hidden indefinitely
    const safetyTimer = window.setTimeout(() => setVisible(true), 1200);
    return () => {
      observer.disconnect();
      window.clearTimeout(safetyTimer);
    };
  }, [sectionReveal]);

  if (!sectionReveal) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`dm-reveal dm-reveal-${animationIntensity} ${visible ? 'dm-reveal-visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
