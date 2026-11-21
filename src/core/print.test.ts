import { describe, expect, it } from 'vitest';
import OP from './index';

const IO = OP.io;
const svgText = (W: number, H: number) => `<svg xmlns="http://www.w3.org/2000/svg" class="" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>text{fill:#000}</style><rect width="100%" height="100%" fill="#fff"/></svg>`;

describe('splitPages', () => {
  it('keeps a chart that fits on one page whole, with no repeated header', () => {
    expect(IO.splitPages(1000, 500, 40, 24, 1000, 700)).toEqual([{ y: 0, h: 500, hdr: 0 }]);
  });

  it('splits a tall chart into pages that never cut a row and repeat the header', () => {
    const W = 1000, rows = 100, hdr = 40, rowH = 24, H = hdr + rows * rowH;
    const pages = IO.splitPages(W, H, hdr, rowH, 1000, 700);
    expect(pages.length).toBe(4);                                         // 27 + 27 + 27 + 19 rows
    expect(pages.map((p: any) => p.h / rowH)).toEqual([27, 27, 27, 19]);
    pages.forEach((p: any) => { expect(p.hdr).toBe(hdr); expect(p.h % rowH).toBe(0); expect(hdr + p.h).toBeLessThanOrEqual(700); });
    // together the pages cover every row exactly once, in order
    expect(pages[0].y).toBe(hdr);
    pages.slice(1).forEach((p: any, i: number) => expect(p.y).toBe(pages[i].y + pages[i].h));
    const last = pages[pages.length - 1];
    expect(last.y + last.h).toBe(H);
  });

  it('puts at least one row on a page even on a tiny page', () => {
    const pages = IO.splitPages(1000, 40 + 5 * 24, 40, 24, 1000, 50);
    expect(pages.length).toBe(5);
    pages.forEach((p: any) => expect(p.h).toBe(24));
  });

  it('uses fewer pages when the page is wider relative to the chart', () => {
    const wide = IO.splitPages(1000, 40 + 100 * 24, 40, 24, 2000, 700).length;
    const narrow = IO.splitPages(1000, 40 + 100 * 24, 40, 24, 1000, 700).length;
    expect(wide).toBeGreaterThan(narrow);                                  // scaled up, so fewer rows fit per page
  });
});

describe('printHTML', () => {
  const opts = { hdr: 40, rowH: 24, date: '21/11/2026' };
  const W = 1500, H = 40 + 80 * 24;

  it('makes one page per window, each with the header and its own rows', () => {
    const html = IO.printHTML(svgText(W, H), W, H, 'My plan', opts);
    const pages = html.match(/<section class="page">/g)!.length;
    expect(pages).toBeGreaterThan(1);
    expect(html.match(/viewBox="0 0 1500 40"/g)!.length).toBe(pages);       // the header, once per page
    expect(html).toContain('Page 1 of ' + pages);
    expect(html).toContain('Page ' + pages + ' of ' + pages);
    expect(html).toContain('21/11/2026');
    expect(html).toContain('size:A4 landscape');
  });

  it('fits the whole chart on one page when asked', () => {
    const html = IO.printHTML(svgText(W, H), W, H, 'My plan', { ...opts, fitOne: true });
    expect(html.match(/<section class="page">/g)).toHaveLength(1);
    expect(html.match(/<svg /g)).toHaveLength(1);
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`);
  });

  it('draws the chart at the page width, so nothing runs off the sheet', () => {
    const html = IO.printHTML(svgText(W, H), W, H, 't', { ...opts, fitOne: true });
    const w = +/<svg [^>]*width="([\d.]+)"/.exec(html)![1], h = +/<svg [^>]*height="([\d.]+)"/.exec(html)![1];
    expect(w).toBeLessThanOrEqual(277 * 96 / 25.4);       // A4 landscape width minus margins
    expect(h).toBeLessThanOrEqual(190 * 96 / 25.4);
    expect(w / h).toBeCloseTo(W / H, 1);                   // the shape is kept
  });

  it('shows a chart without a header (network, WBS) on one page', () => {
    const html = IO.printHTML(svgText(W, H), W, H, 'Network', {});
    expect(html.match(/<section class="page">/g)).toHaveLength(1);
  });

  it('follows the paper size and direction, and falls back to A4 landscape', () => {
    const css = (o: any) => /size:([^;]+);/.exec(IO.printHTML(svgText(W, H), W, H, 't', o))![1];
    expect([css({ paper: 'A3' }), css({ paper: 'Letter', landscape: false }), css({ paper: 'A4', landscape: true }), css({ paper: 'Tabloid' }), css({})]).toEqual(
      ['A3 landscape', 'Letter portrait', 'A4 landscape', 'A4 landscape', 'A4 landscape']);
  });

  it('portrait pages are taller, so a wide, tall chart needs fewer of them (at a smaller scale)', () => {
    const count = (o: any) => IO.printHTML(svgText(W, H), W, H, 't', { ...opts, ...o }).match(/<section class="page">/g)!.length;
    expect(count({ landscape: false })).toBeLessThan(count({ landscape: true }));
    expect(count({ paper: 'A3' })).toBeLessThanOrEqual(count({ paper: 'A4' }));      // a bigger sheet never needs more pages
  });

  it('escapes the title', () => {
    const html = IO.printHTML(svgText(W, H), W, H, '<script>alert(1)</script> & "co"', opts);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('windows the picture without changing anything else in it', () => {
    const html = IO.printHTML(svgText(W, H), W, H, 't', opts);
    expect(html).toMatch(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" class="" width="[\d.]+" height="[\d.]+" viewBox="0 40 1500 \d+">/);
    expect(html).toContain('<style>text{fill:#000}</style>');
  });
});

describe('layoutPages (wide charts)', () => {
  const A4W = 277 * 96 / 25.4, A4H = 190 * 96 / 25.4 - 36, TABLE = 536;
  const o = { hdr: 40, rowH: 24, tableW: TABLE, minScale: 0.8 };

  it('shows a chart that is not too wide at the page width, in one band', () => {
    const lay = IO.layoutPages(1200, 600, o, A4W, A4H);
    expect(lay.bands).toEqual([{ x: 0, w: 1200, left: null }]);
    expect(lay.scale).toBeCloseTo(A4W / 1200, 5);
  });

  it('splits a wide chart sideways at a readable scale, repeating the table on each later page', () => {
    const W = 4500, lay = IO.layoutPages(W, 40 + 24 * 24, o, A4W, A4H);
    expect(lay.scale).toBe(0.8);
    expect(lay.bands.length).toBe(6);
    expect(lay.bands[0]).toEqual({ x: 0, w: A4W / 0.8, left: null });                 // the first page: table and the start of the timeline
    lay.bands.slice(1).forEach((b: any) => expect(b.left).toEqual({ x: 0, w: TABLE }));
    // the timeline continues exactly where the last page stopped, and ends at the right edge
    lay.bands.slice(1).forEach((b: any, i: number) => expect(b.x).toBeCloseTo(lay.bands[i].x + (i === 0 ? lay.bands[0].w : lay.bands[i].w), 5));
    const last = lay.bands[lay.bands.length - 1];
    expect(last.x + last.w).toBeCloseTo(W, 5);
    // every page fits the sheet: the repeated table plus its slice of timeline, drawn at the scale
    lay.bands.forEach((b: any) => expect(((b.left ? b.left.w : 0) + b.w) * lay.scale).toBeLessThanOrEqual(A4W + 0.01));
  });

  it('gives a bigger sheet fewer sideways pages', () => {
    const a4 = IO.layoutPages(4500, 600, o, A4W, A4H).bands.length, a3 = IO.layoutPages(4500, 600, o, 400 * 96 / 25.4, A4H).bands.length;
    expect(a3).toBeLessThan(a4);
  });

  it('does not split sideways without a table to repeat, or when the table is wider than the page', () => {
    expect(IO.layoutPages(4500, 600, { hdr: 40, rowH: 24 }, A4W, A4H).bands).toHaveLength(1);
    expect(IO.layoutPages(4500, 600, { ...o, tableW: 5000 }, A4W, A4H).bands).toHaveLength(1);
  });

  it('prints bands by rows: all the rows of one band, then the next band', () => {
    const W = 4500, H = 40 + 100 * 24;
    const lay = IO.layoutPages(W, H, o, A4W, A4H);
    const html = IO.printHTML(svgText(W, H), W, H, 't', { ...o, date: 'd' });
    const pages = html.match(/<section class="page">/g)!.length;
    expect(pages).toBe(lay.bands.length * lay.rows.length);
    // the table header (0..536 wide) is repeated on every page after the first band
    expect((html.match(/viewBox="0 0 536 40"/g) || []).length).toBe((lay.bands.length - 1) * lay.rows.length);
    expect(html).toContain('Page ' + pages + ' of ' + pages);
  });
});
