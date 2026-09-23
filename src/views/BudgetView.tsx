import type { ReactNode } from 'react';
import OP from '../core';
import { useStore } from '../store';
import Icon from '../components/Icon';
import type { Row } from '../types';

const U = OP.util, M = OP.model, C = OP.charts;

export function Kpi({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) {
  return <div className="card kpi"><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>;
}

function Health({ v }: { v: number | null }) {
  if (v == null) return null;
  if (v >= 1) return <span className="chip good"><Icon name="check" />On or better</span>;
  return <span className={'chip ' + (v >= 0.9 ? 'warn' : 'bad')}><Icon name="alert" />{v >= 0.9 ? 'Slightly behind' : 'Behind'}</span>;
}
const ratio = (v: number | null) => (v == null ? '—' : v.toFixed(2));

export default function BudgetView() {
  const st = useStore(), p = st.p, s = st.s, cur = p.currency, ev = s.ev;
  const budget = +p.budget || 0, cost = s.totalCost, diff = budget - cost, pct = budget ? cost / budget * 100 : 0;
  const monthly = C.monthlyCost(p, s);
  const tops = s.rows.filter((r: Row) => r.task.level === 1);
  const maxTop = Math.max(1, ...tops.map((r: Row) => r.cost));
  const maxRes = Math.max(1, ...p.resources.map(r => s.resStats[r.uid].cost));
  const actual = s.rows.reduce((a: number, r: Row) => a + (r.summary ? 0 : r.actualCost), 0);
  const fixed = s.rows.reduce((a: number, r: Row) => a + (+r.task.fixedCost || 0), 0);
  const groups = [
    ...M.RES_TYPES.map((t: string) => ({ label: t, list: p.resources.filter(r => r.kind === 'Work' && r.type === t) })),
    { label: 'Materials', list: p.resources.filter(r => r.kind === 'Material') },
    { label: 'Cost resources', list: p.resources.filter(r => r.kind === 'Cost') }
  ].filter(g => g.list.length);

  return (
    <div className="view">
      <div className="view-head"><h1>Cost &amp; budget</h1><span className="sub">Hours × rate (with rate changes), cost per use, materials, cost resources and fixed costs</span></div>
      <div className="toolbar"><button className="btn" onClick={() => st.openDialog('settings')}><Icon name="settings" />Set budget &amp; status date</button></div>
      <div className="scroll">
        <div className="kpis">
          <Kpi k="Budget" v={budget ? U.money(budget, cur) : 'Not set'} s={budget ? '' : <span className="muted">Set it in Project information</span>} />
          <Kpi k="Planned cost" v={U.money(cost, cur)} s={budget ? <span className="muted">{U.num(pct)}% of budget</span> : ''} />
          <Kpi k={diff >= 0 ? 'Remaining' : 'Over budget'} v={U.money(Math.abs(diff), cur)}
            s={budget ? (diff >= 0 ? <span className="chip good"><Icon name="check" />Within budget</span> : <span className="chip bad"><Icon name="alert" />Over budget</span>) : ''} />
          <Kpi k="Duration" v={U.num(s.duration) + ' days'} s={<span className="muted">{U.fmt(s.startDn)} → {U.fmt(s.finishDn)}</span>} />
          <Kpi k="Actual cost to date" v={U.money(actual, cur)} s={<span className="muted">from % complete</span>} />
        </div>

        {p.baseline ? <>
          <div className="section-h">Earned value <span className="muted small">at status date {U.fmt(s.statusDn)}{p.statusDate ? '' : ' (today — set a status date in Project information)'}</span></div>
          <div className="kpis">
            <Kpi k="Planned value (BCWS)" v={U.money(ev.bcws, cur)} s={<span className="muted">BAC {U.money(ev.bac, cur)}</span>} />
            <Kpi k="Earned value (BCWP)" v={U.money(ev.bcwp, cur)} />
            <Kpi k="Actual cost (ACWP)" v={U.money(ev.acwp, cur)} />
            <Kpi k="Schedule index (SPI)" v={ratio(ev.spi)} s={<><Health v={ev.spi} /> <span className="muted small">SV {U.money(ev.sv)}</span></>} />
            <Kpi k="Cost index (CPI)" v={ratio(ev.cpi)} s={<><Health v={ev.cpi} /> <span className="muted small">CV {U.money(ev.cv)}</span></>} />
            <Kpi k="Estimate at completion" v={U.money(ev.eac, cur)} s={<span className="muted">VAC {U.money(ev.vac)}</span>} />
          </div>
        </> : (
          <div className="card note-card"><Icon name="info" /><div><b>Earned value</b> (SPI, CPI, EAC) needs a baseline. Choose <b>Project › Set Baseline</b>, then record progress with % complete.</div></div>
        )}

        {monthly.length > 0 && (
          <div className="grid2">
            <div className="card"><h3>Monthly cost</h3><div className="card-sub">Planned spend per calendar month</div>
              <div className="chart" dangerouslySetInnerHTML={{ __html: C.costChart({ p, data: monthly, kind: 'monthly' }) }} /></div>
            <div className="card"><h3>Cumulative cost vs budget</h3><div className="card-sub">Dashed line = approved budget</div>
              <div className="chart" dangerouslySetInnerHTML={{ __html: C.costChart({ p, data: monthly, kind: 'cumulative' }) }} /></div>
          </div>
        )}

        <div className="grid2">
          <div className="card"><h3>Cost by work package</h3><div className="card-sub">Top-level WBS items</div>
            <div className="tbl"><table className="data">
              <thead><tr><th>WBS</th><th>Package</th><th className="num">Work (h)</th><th className="num">Cost</th>{p.baseline && <th className="num">Baseline</th>}<th style={{ width: '28%' }} /></tr></thead>
              <tbody>{tops.map((r: Row) => (
                <tr key={r.task.uid}>
                  <td>{r.wbs}</td><td>{r.task.name}<div className="muted small">{U.fmt(r.startDn)} – {U.fmt(r.finishDn)}</div></td>
                  <td className="num">{U.num(r.work)}</td><td className="num">{U.money(r.cost)}</td>
                  {p.baseline && <td className="num">{r.base ? U.money(r.base.cost) : ''}</td>}
                  <td><div className="barcell"><div className="hbar-track"><div className="hbar" style={{ width: r.cost / maxTop * 100 + '%' }} /></div>
                    <span className="muted small">{cost ? Math.round(r.cost / cost * 100) : 0}%</span></div></td>
                </tr>
              ))}</tbody>
              <tfoot><tr><td colSpan={2}>Total</td><td className="num">{U.num(s.totalWork)}</td><td className="num">{U.money(cost, cur)}</td>{p.baseline && <td className="num">{U.money(ev.bac)}</td>}<td /></tr></tfoot>
            </table></div>
          </div>
          <div className="card"><h3>Cost by resource</h3><div className="card-sub">Grouped by type</div>
            <div className="tbl"><table className="data">
              <thead><tr><th>Name</th><th>Kind</th><th className="num">Rate</th><th className="num">Hours / qty</th><th className="num">Cost</th><th style={{ width: '24%' }} /></tr></thead>
              <tbody>
                {groups.map(g => {
                  const gc = g.list.reduce((a, r) => a + s.resStats[r.uid].cost, 0);
                  return [
                    ...g.list.map(r => {
                      const rs = s.resStats[r.uid];
                      return (
                        <tr key={r.uid}>
                          <td>{r.name}</td><td className="muted">{r.kind === 'Work' ? r.type : r.kind}</td><td className="num">{r.kind === 'Cost' ? '' : U.money(r.rate)}</td>
                          <td className="num">{r.kind === 'Work' ? U.num(rs.work) + 'h' : r.kind === 'Material' ? U.num(rs.qty) : ''}</td><td className="num">{U.money(rs.cost)}</td>
                          <td><div className="hbar-track"><div className="hbar" style={{ width: rs.cost / maxRes * 100 + '%' }} /></div></td>
                        </tr>
                      );
                    }),
                    <tr key={'g' + g.label}><td colSpan={4} className="muted small"><b>{g.label} subtotal</b></td><td className="num"><b>{U.money(gc)}</b></td><td /></tr>
                  ];
                })}
                {fixed > 0 && <tr><td colSpan={4} className="muted small"><b>Fixed task costs</b></td><td className="num"><b>{U.money(fixed)}</b></td><td /></tr>}
              </tbody>
              <tfoot><tr><td colSpan={4}>Total</td><td className="num">{U.money(cost, cur)}</td><td /></tr></tfoot>
            </table></div>
          </div>
        </div>
      </div>
    </div>
  );
}
