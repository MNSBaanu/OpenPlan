// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import OP from '../core';

const PAYLOAD = '<img src=x onerror=alert(1)>';

function loadHostileProject() {
  const raw = OP.demo();
  raw.name = PAYLOAD;
  raw.tasks[1].name = PAYLOAD;
  raw.resources[0].name = PAYLOAD;
  raw.resources[0].role = PAYLOAD;
  return OP.io.fromJSON(JSON.stringify(raw));
}

function renderAllCharts() {
  const p = loadHostileProject();
  const s = OP.schedule(p);
  const gantt = OP.charts.gantt({
    p,
    s,
    rows: s.rows,
    zoom: 'week',
    critical: true,
    baseline: false,
    table: true,
  });
  const network = OP.charts.network({ s, rows: s.rows, critical: true });
  const wbs = OP.charts.wbs({ p, s });
  const org = OP.charts.org({ p });
  const cost = OP.charts.costChart({
    data: OP.charts.monthlyCost(p, s),
    p,
    kind: 'monthly',
  });
  const costSvg = typeof cost === 'string' ? cost : cost.svg;
  return [gantt.svg, network.svg, wbs.svg, org.svg, costSvg].join('\n');
}

describe('Chart escaping', () => {
  it('escapes hostile task, resource and project names in every generated SVG', () => {
    const svg = renderAllCharts();
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;img');
  });
});
