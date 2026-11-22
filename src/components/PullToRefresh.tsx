import { useEffect, useRef } from 'react';

// Pull down to reload, for touch screens.
// The planner fills the screen and never scrolls the page itself, so the browser's own pull-to-refresh does nothing
// (and an installed app has no reload button at all). This brings it back.
// To avoid reloading by accident while scrolling the chart or a table, a pull only counts when it starts on the top bar,
// the tab row, the landing page menu, or at the very top of the landing page.
const START_AREA = '.titlebar, .ribbon-tabs, .lp-nav';
const SHOW_AFTER = 12;     // px of finger travel before the pull starts to show
const READY_AT = 60;       // px the indicator must travel before letting go reloads
const MAX_PULL = 84;

function canStart(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (!el || !el.closest) return false;
  if (document.querySelector('dialog[open], .backstage:not([hidden])')) return false;
  if (el.closest(START_AREA)) return true;
  const landing = document.querySelector('.landing');
  return !!landing && landing.contains(el) && landing.scrollTop <= 0;
}

export function reloadPage() {
  // Let a cell that is being edited save its text, and give autosave a moment, before the page goes away.
  (document.activeElement as HTMLElement | null)?.blur?.();
  window.setTimeout(() => location.reload(), 450);
}

export default function PullToRefresh() {
  const box = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let x0 = 0, y0 = 0, mode: 'idle' | 'maybe' | 'pull' | 'busy' = 'idle', pull = 0;
    const show = (p: number, ready: boolean, busy = false) => {
      const b = box.current, l = label.current;
      if (!b || !l) return;
      b.style.transform = 'translate(-50%, ' + (p - 56) + 'px)';
      b.style.opacity = p > 4 ? '1' : '0';
      b.dataset.ready = ready ? '1' : '0';
      b.dataset.busy = busy ? '1' : '0';
      b.style.setProperty('--turn', Math.min(180, (p / READY_AT) * 180) + 'deg');
      l.textContent = busy ? 'Reloading…' : ready ? 'Release to reload' : 'Pull down to reload';
    };
    const reset = () => {
      const b = box.current; if (!b) return;
      b.classList.add('back'); show(0, false);
      window.setTimeout(() => b.classList.remove('back'), 220);
      mode = 'idle'; pull = 0;
    };
    const start = (e: TouchEvent) => {
      if (mode === 'busy') return;
      if (e.touches.length !== 1 || !canStart(e.target)) { mode = 'idle'; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; mode = 'maybe'; pull = 0;
    };
    const move = (e: TouchEvent) => {
      if (mode !== 'maybe' && mode !== 'pull') return;
      const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (mode === 'maybe') {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { mode = 'idle'; return; }   // a sideways swipe on the tab row
        if (dy < -10) { mode = 'idle'; return; }
        if (dy < SHOW_AFTER) return;
        mode = 'pull';
      }
      pull = Math.min(MAX_PULL, (dy - SHOW_AFTER) * 0.6);
      show(pull, pull >= READY_AT);
    };
    const end = () => {
      if (mode === 'pull' && pull >= READY_AT) { mode = 'busy'; show(READY_AT, true, true); reloadPage(); return; }
      if (mode === 'pull') reset(); else mode = 'idle';
    };
    const opts = { passive: true } as const;
    document.addEventListener('touchstart', start, opts);
    document.addEventListener('touchmove', move, opts);
    document.addEventListener('touchend', end, opts);
    document.addEventListener('touchcancel', reset, opts);
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', reset);
    };
  }, []);

  return (
    <div className="ptr" ref={box} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v14" /><path d="M6 12l6 6 6-6" />
      </svg>
      <span ref={label}>Pull down to reload</span>
    </div>
  );
}
