import { useState } from 'react';
import { useApp } from '../store';
import Icon from './Icon';

// A getting-started checklist for new users. Steps tick themselves off as the plan fills in.
export default function Guide() {
  const st = useApp();
  const [exported, setExported] = useState(false);
  if (!st.guide) return null;
  const tasks = st.p.tasks;
  const steps: [string, string, boolean, string, () => void][] = [
    ['List the work', 'Type tasks and durations in the table; indent them into phases.', tasks.length >= 2, 'Show the table', () => st.setView('gantt')],
    ['Link the tasks', 'Enter predecessors, e.g. 2 or 3SS+1d, to build the schedule.', tasks.some(t => t.preds.length > 0), 'Show the table', () => st.setView('gantt')],
    ['Add people and costs', 'Add team members and rates, then assign them to tasks.', tasks.some(t => t.assignments.length > 0), 'Resource Sheet', () => st.setView('resources')],
    ['Export the results', 'Download charts, reports or an Excel file for your document.', exported, 'Open Export', () => { setExported(true); st.setUI({ backstage: true, bsPage: 'export' }); }]
  ];
  const done = steps.filter(s => s[2]).length;
  return (
    <aside className="guide" aria-label="Getting started">
      <div className="guide-head">
        <b>Getting started</b><span className="muted">{done} of {steps.length}</span>
        <button className="icon-btn" title="Hide the guide" aria-label="Hide the guide" onClick={() => st.setUI({ guide: false })}><Icon name="x" /></button>
      </div>
      <ol>
        {steps.map(([title, text, ok, action, run]) => (
          <li key={title} className={ok ? 'ok' : ''}>
            <span className="guide-mark" aria-hidden="true">{ok ? <Icon name="check" /> : null}</span>
            <div><b>{title}</b><span>{text}</span>{!ok && <button className="linkbtn" onClick={run}>{action}</button>}</div>
          </li>
        ))}
      </ol>
      {!tasks.length && <p className="guide-tip">New here? Start from a template in <button className="linkbtn" onClick={() => st.setUI({ backstage: true, bsPage: 'new' })}>File › New</button>.</p>}
    </aside>
  );
}
