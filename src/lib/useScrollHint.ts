import { useEffect, type RefObject } from 'react';

// Marks a sideways-scrolling row with data-more="1" while more of it waits off-screen,
// so the CSS can fade its right edge as a hint that it scrolls.
export function useScrollHint(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const check = () => { el.dataset.more = el.scrollWidth - el.scrollLeft - el.clientWidth > 4 ? '1' : '0'; };
    check();
    const ro = new ResizeObserver(check); ro.observe(el);
    el.addEventListener('scroll', check, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', check); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
