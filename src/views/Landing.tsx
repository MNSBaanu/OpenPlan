import { useEffect, useState } from 'react';
import OP from '../core';
import { S, ask } from '../store';
import Icon from '../components/Icon';

const REPO = 'https://github.com/MNSBaanu/OpenPlan';
// The page title from index.html; the app replaces it with the project name.
const PAGE_TITLE = document.title;

export const enterApp = () => { location.hash = 'app'; };
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

function openSample() {
  ask('Open the sample project? Your current plan can be restored with Undo.', () => {
    S().replaceProject(OP.demo(), 'Sample project loaded');
    enterApp();
  }, 'Open sample');
}

const TRUST: [string, string][] = [
  ['check', 'Free forever'],
  ['shield', 'No sign-up'],
  ['bolt', 'Works offline'],
  ['save', 'Data stays on your computer']
];

const STATS: [string, string][] = [['8', 'views of one plan'], ['10', 'ready-made reports'], ['4', 'dependency link types'], ['4', 'project templates']];

const STEPS: [string, string, string][] = [
  ['table', 'List the work', 'Type your tasks and durations, then indent them into phases. That outline becomes your WBS.'],
  ['link', 'Link the tasks', 'Say which task depends on which. OpenPlan schedules everything and finds the critical path.'],
  ['users', 'Add people and costs', 'Assign team members, rates and materials. Overloaded people are flagged and costs are totalled.'],
  ['download', 'Export the results', 'Download the Gantt chart, network diagram, WBS, budget and reports for your document.']
];

// [icon, title, text, wide]
const FEATURES: [string, string, string, boolean?][] = [
  ['gantt', 'Gantt chart', 'A task outline with summary tasks and subtasks, FS/SS/FF/SF links with lag, milestones, constraints and deadlines. Drag bars to move tasks, resize them or link them.', true],
  ['network', 'Critical path', 'Forward and backward passes give ES, EF, LS, LF, total and free slack, highlighted in every view.'],
  ['tree', 'WBS and network diagrams', 'Drawn from your outline and exported as PNG or SVG.'],
  ['users', 'Resources and leveling', 'Work, material and cost resources, calendars, vacations, a workload heatmap and leveling.'],
  ['target', 'Baselines and earned value', 'Track % complete and actual dates, then read SPI, CPI and EAC against your baseline.'],
  ['wallet', 'Budget', 'Cost by work package and by resource, with monthly and cumulative spend.'],
  ['columns', 'Task board', 'A Not started, In progress and Done board. Dragging a card updates its % complete.'],
  ['sparkle', 'Templates', 'Start from a final-year project, software sprint, event or research project.'],
  ['report', '10 printable reports', 'Project overview, critical tasks, milestones, cost, earned value, baseline variance and more. Print them one by one or all at once, or save them as PDF.', true],
  ['share', 'Share and versions', 'Share a copy of a plan as a link (nothing is uploaded) and keep named versions in your browser.']
];

const OUTPUTS = [
  'Gantt chart with milestones and the critical path',
  'Network diagram with ES, EF, LS, LF and slack',
  'Work breakdown structure (WBS)',
  'Team structure and resource allocation',
  'Budget with cost per task, phase and person',
  'Baseline, progress tracking and earned value'
];

const AUDIENCE: [string, string, string][] = [
  ['report', 'Students', 'Coursework that asks for a WBS, Gantt chart, network diagram, resource plan and budget, all produced from one plan.'],
  ['users', 'Small teams', 'Plan phases or sprints, assign people, and see who is overloaded before it becomes a problem, with no licences to buy.'],
  ['target', 'Lecturers', 'One free tool the whole class can open in a browser, with charts and reports ready to hand in.']
];

const PRIVACY: [string, string, string][] = [
  ['save', 'In your browser', 'Every change is saved automatically on this device, so you can close the tab and continue later.'],
  ['file', 'In .openplan files', 'Save to a file on your computer. In Chrome and Edge, install the app and double-click a file to open it.'],
  ['download', 'In other tools', 'Export Excel or CSV for spreadsheets, and PNG or SVG for your report.']
];

// [feature, OpenPlan, paid desktop software]; true = yes, false = no, string = text
const COMPARE: [string, boolean | string, boolean | string][] = [
  ['Price', 'Free and open source', 'Paid licence or subscription'],
  ['Account or sign-up', 'None', 'Licence needed'],
  ['Gantt chart, critical path and WBS', true, true],
  ['Resources, baselines and earned value', true, true],
  ['Charts and reports ready for coursework', true, true],
  ['Real-time team collaboration', 'Optional live sessions', true],
  ['Enterprise portfolio management', false, true]
];

const FAQ: [string, string][] = [
  ['Is OpenPlan really free?', 'Yes. There are no accounts, trials or paid tiers, and the source code is open under the MIT License.'],
  ['How is it different from Microsoft Project?', 'OpenPlan covers the planning techniques that courses and small teams use: scheduling, the critical path, resources, baselines, earned value, budgets and reports. It runs in your browser for free, and several people can edit one plan together live. It does not open .mpp files directly and has no enterprise features. It is not affiliated with Microsoft.'],
  ['Where is my project stored?', 'In this browser, saved automatically as you work, and in .openplan files you save to your computer. Your plan is not uploaded anywhere unless you start an optional live session, and then it is encrypted in your browser before it leaves.'],
  ['Can I move a task list in from a spreadsheet?', 'Yes. Paste rows from Excel, or choose a CSV file with File › Open, and OpenPlan turns them into tasks.'],
  ['Can I bring in a plan from Microsoft Project?', 'Yes, as XML. In Microsoft Project choose File › Save As and pick XML (ProjectLibre, which is free, can do the same and can also open .mpp files). Then use File › Open › Import from Microsoft Project XML in OpenPlan. Tasks, links with lag, constraints, resources, assignments and holidays come across, and anything that cannot is listed after the import. You can also export a plan as Microsoft Project XML, so plans move both ways. OpenPlan does not open .mpp files directly.'],
  ['Can I put the charts in my report?', 'Yes. Every chart exports as PNG or SVG, and each of the 10 reports prints or saves as a PDF.'],
  ['Does it work on a phone?', 'This page does. The planner itself has a spreadsheet-style grid and a timeline, so it works best on a laptop or desktop screen.']
];

// Screenshots of the real app, taken from the sample project (see public/assets/shots).
const SHOTS = ['gantt', 'network', 'wbs', 'budget', 'reports'] as const;
type ShotKey = (typeof SHOTS)[number];

const TABS: [ShotKey, string, string, string, string][] = [
  ['gantt', 'Gantt chart', 'gantt', 'Gantt chart with milestones, links and the critical path in red.',
    'The OpenPlan Gantt chart: a task table on the left, a timeline strip above, and bars, links, milestones and the critical path in red on the right.'],
  ['network', 'Network diagram', 'network', 'Network diagram of one sprint, with ES, EF, LS, LF and slack on every task.',
    'The OpenPlan network diagram: each task is a box showing its early and late start and finish, its duration and its slack, joined by arrows.'],
  ['wbs', 'WBS', 'tree', 'Work breakdown structure, generated from your task outline.',
    'The OpenPlan work breakdown structure: the project at the top, four phases below it, and the tasks under each phase.'],
  ['budget', 'Budget', 'wallet', 'Cost and budget: planned spend against your approved budget.',
    'The OpenPlan budget view: budget, planned cost and remaining amount, with a monthly cost chart and a cumulative cost chart.'],
  ['reports', 'Reports', 'report', 'Printable reports, such as this project overview. There are ten.',
    'An OpenPlan report: the project overview with start, finish, cost and task figures, and a table of work packages.']
];

function Preview() {
  const [tab, setTab] = useState<ShotKey>('gantt');
  const cur = TABS.find(t => t[0] === tab)!;
  // Fetch the other screenshots shortly after the page loads, so switching tabs is instant.
  useEffect(() => {
    const t = setTimeout(() => SHOTS.forEach(k => { new Image().src = './assets/shots/' + k + '.webp'; }), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="lp-preview">
      <div className="lp-tabs" role="tablist" aria-label="Preview">
        {TABS.map(([k, label, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            <Icon name={icon} />{label}
          </button>
        ))}
      </div>
      <div className="lp-shot" role="tabpanel">
        <img src={'./assets/shots/' + tab + '.webp'} width={2400} height={1520} alt={cur[4]} decoding="async" />
      </div>
      <p className="lp-caption">{cur[3]} From the Library Booking sample project.</p>
    </div>
  );
}

function Head({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <div className="lp-head">
      <p className="lp-label">{label}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function Cell({ v }: { v: boolean | string }) {
  if (typeof v === 'string') return <>{v}</>;
  return v
    ? <span className="lp-yes"><Icon name="check" /><span className="sr">Yes</span></span>
    : <span className="lp-no"><Icon name="minus" /><span className="sr">No</span></span>;
}

export default function Landing() {
  useEffect(() => { document.title = PAGE_TITLE; }, []);
  return (
    <div className="landing">
      <header className="lp-nav">
        <a className="lp-brand" href="#" onClick={e => { e.preventDefault(); document.querySelector('.landing')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <img className="logo" src="./assets/OpenPlan.png" alt="" width={26} height={26} />OpenPlan
        </a>
        <nav className="lp-links" aria-label="Sections">
          <button onClick={() => scrollTo('features')}>Features</button>
          <button onClick={() => scrollTo('how')}>How it works</button>
          <button onClick={() => scrollTo('compare')}>Compare</button>
          <button onClick={() => scrollTo('faq')}>FAQ</button>
        </nav>
        <button className="lp-btn" onClick={enterApp}>Open the app</button>
      </header>

      <main>
        <section className="lp-hero">
          <a className="lp-pill" href={REPO} target="_blank" rel="noreferrer">
            <span>Open source</span>Free project planning, built for students and small teams <Icon name="chevR" />
          </a>
          <h1>Turn a task list into a <em>complete project plan.</em></h1>
          <p className="lp-lede">
            Enter your tasks, how long they take and what depends on what. OpenPlan builds the schedule and
            gives you the Gantt chart, critical path, network diagram, WBS, resource plan and budget,
            ready to export into your report.
          </p>
          <div className="lp-actions center">
            <button className="lp-btn lg" onClick={enterApp}>Start planning <Icon name="chevR" /></button>
            <button className="lp-btn lg ghost" onClick={openSample}>Try the sample project</button>
          </div>
          <ul className="lp-trust" aria-label="Highlights">
            {TRUST.map(([icon, label]) => <li key={label}><Icon name={icon} />{label}</li>)}
          </ul>
          <div className="lp-stage">
            <Preview />
          </div>
          <ul className="lp-stats" aria-label="At a glance">
            {STATS.map(([n, label]) => <li key={label}><b>{n}</b><span>{label}</span></li>)}
          </ul>
        </section>

        <section className="lp-block" id="features">
          <Head label="Features" title="Everything a course project plan needs" text="The parts of desktop project software that students and small teams actually use, in one free tool." />
          <div className="lp-bento">
            {FEATURES.map(([icon, title, text, wide]) => (
              <article key={title} className={'lp-card' + (wide ? ' wide' : '')}>
                <span className="lp-chip"><Icon name={icon} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-block" id="how">
          <Head label="How it works" title="From a list of tasks to a finished plan" text="Four steps. You don’t need any project management software experience." />
          <ol className="lp-steps">
            {STEPS.map(([icon, title, text], i) => (
              <li key={title}>
                <span className="lp-num">{i + 1}</span>
                <Icon name={icon} />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-block" id="outputs">
          <Head label="What you get" title="Charts that always match your schedule" text="Every chart is drawn from your plan and updates as you edit, so your diagrams never drift out of date." />
          <ul className="lp-outputs">
            {OUTPUTS.map(o => <li key={o}><Icon name="check" />{o}</li>)}
          </ul>
        </section>

        <section className="lp-block" id="compare">
          <Head label="Compare" title="Free, and honest about what it does" text="OpenPlan covers the core planning techniques without a licence. It is not a replacement for enterprise tools." />
          <div>
            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr><th scope="col"><span className="sr">Feature</span></th><th scope="col" className="us">OpenPlan</th><th scope="col">Paid desktop software<small>such as Microsoft Project</small></th></tr>
                </thead>
                <tbody>
                  {COMPARE.map(([k, a, b]) => (
                    <tr key={k}><th scope="row">{k}</th><td className="us"><Cell v={a} /></td><td><Cell v={b} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="lp-fine">OpenPlan is an independent project. It is not affiliated with or endorsed by Microsoft or ProjectLibre. Microsoft, Microsoft Project and Excel are trademarks of the Microsoft group of companies, and other names are the property of their owners. They are used here only to say which file formats OpenPlan can read and write.</p>
          </div>
        </section>

        <section className="lp-block" id="audience">
          <Head label="Who it’s for" title="Plan without buying a licence" text="Anyone who needs a proper project plan without buying desktop project management software." />
          <div className="lp-cols">
            {AUDIENCE.map(([icon, title, text]) => (
              <article key={title} className="lp-card"><span className="lp-chip"><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
        </section>

        <section className="lp-block" id="files">
          <Head label="Privacy" title="Your work stays with you" text="OpenPlan has no account, and your plan stays in your browser. Anonymous visit counts (page, referrer, screen size, browser) are collected with cookie-free GoatCounter analytics. Project data is never sent, unless you start an optional live session: it is then encrypted in your browser, and the relay only sees scrambled data." />
          <div className="lp-cols">
            {PRIVACY.map(([icon, title, text]) => (
              <article key={title} className="lp-card"><span className="lp-chip"><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
        </section>

        <section className="lp-block" id="faq">
          <Head label="FAQ" title="Questions" text="Short answers to what people usually ask first." />
          <div className="lp-faq">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}<Icon name="chevD" /></summary><p>{a}</p></details>)}
          </div>
        </section>

        <section className="lp-end">
          <div>
            <h2>Ready to plan your project?</h2>
            <p>Open the app to continue your plan, or explore the sample project first.</p>
          </div>
          <div className="lp-actions">
            <button className="lp-btn lg" onClick={enterApp}>Start planning <Icon name="chevR" /></button>
            <button className="lp-btn lg ghost" onClick={openSample}>Try the sample project</button>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-foot-brand">
          <a className="lp-brand" href="#" onClick={e => { e.preventDefault(); document.querySelector('.landing')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <img className="logo" src="./assets/OpenPlan.png" alt="" width={22} height={22} />OpenPlan
          </a>
          <p>Free, browser-based project planning.</p>
        </div>
        <nav aria-label="Footer">
          <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
          <a href={REPO + '/issues'} target="_blank" rel="noreferrer">Report an issue</a>
          <a href={REPO + '/blob/main/LICENSE'} target="_blank" rel="noreferrer">MIT License</a>
        </nav>
        <p className="lp-foot-credit">Made by <a href="https://github.com/MNSBaanu" target="_blank" rel="noreferrer">MNS Baanu</a></p>
      </footer>
    </div>
  );
}
