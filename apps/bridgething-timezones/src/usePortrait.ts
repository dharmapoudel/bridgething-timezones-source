import { useEffect, useState } from 'react';

/**
 * portrait detection for the rotated kiosk. the firmware holds the viewport
 * at 800x480 in every rotation and pins the page root to 480x800 with a css
 * transform, so window dimensions never go portrait. screen.orientation
 * follows the cdp metrics override, and the injected rotation script pins the
 * root width, so check those first and fall back to the window shape.
 */
export function isPortraitLayout(): boolean {
  try {
    if (screen.orientation?.type.startsWith('portrait')) return true;
  } catch {
    // screen.orientation unavailable; fall through to the other signals
  }
  if (document.documentElement.style.width === '480px') return true;
  return window.innerWidth < window.innerHeight;
}

export function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(isPortraitLayout);
  useEffect(() => {
    const check = () => setPortrait(isPortraitLayout());
    check();
    const orient = screen.orientation;
    try {
      orient?.addEventListener('change', check);
    } catch {
      // older chromium without the orientation change event
    }
    window.addEventListener('resize', check);
    window.addEventListener('load', check);
    return () => {
      try {
        orient?.removeEventListener('change', check);
      } catch {
        // ignore
      }
      window.removeEventListener('resize', check);
      window.removeEventListener('load', check);
    };
  }, []);
  return portrait;
}
