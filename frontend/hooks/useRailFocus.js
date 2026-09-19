'use client';

import { useEffect, useRef } from 'react';

/**
 * Keeps the active item of a horizontally scrolling rail in view (phones).
 * Scrolls only the rail itself — never the page. Re-centres when the rail's size settles
 * (fonts and styles can land after the first effect), so the first paint is right too.
 */
export function useRailFocus(activeKey, selector) {
  const ref = useRef(null);
  const settled = useRef(false);
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return undefined;
    const center = (behavior) => {
      if (rail.scrollWidth <= rail.clientWidth) return;
      const item = rail.querySelector(selector);
      if (!item) return;
      // Measure from the rail itself (offsetLeft is relative to the nearest positioned ancestor).
      const offset = item.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
      rail.scrollTo({ left: Math.max(0, offset - (rail.clientWidth - item.offsetWidth) / 2), behavior });
    };
    // First placement is instant (nothing to animate on load); later changes glide.
    center(settled.current ? 'smooth' : 'auto');
    settled.current = rail.scrollWidth > rail.clientWidth;
    const observer = new ResizeObserver(() => center('auto'));
    observer.observe(rail);
    return () => observer.disconnect();
  }, [activeKey, selector]);
  return ref;
}
