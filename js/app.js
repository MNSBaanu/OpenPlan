/* OpenPlan application shell: state, undo/redo, persistence, menus, dialogs and shared helpers.
 * Views register themselves in OP.views and use the helpers exposed on OP.app. */
OP.views = {};
OP.app = (function () {
  var U = OP.util, M = OP.model, IO = OP.io, esc = U.esc;
  var STORE = 'openplan.project', UISTORE = 'openplan.ui';

  var ICONS = {
    plus: 'M12 5v14M5 12h14', diamond: 'M12 3l8 9-8 9-8-9z',
    outdent: 'M21 6H11M21 12H11M21 18H11M7 8l-4 4 4 4', indent: 'M21 6H11M21 12H11M21 18H11M3 8l4 4-4 4',
    up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7',
    link: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5',
    unlink: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5M3 3l18 18',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3', redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
    file: 'M14 3H6v18h12V7zM14 3v4h4', upload: 'M12 15V3M7 8l5-5 5 5M4 17v3h16v-3', download: 'M12 3v12M7 10l5 5 5-5M4 17v3h16v-3',
    save: 'M5 3h11l4 4v14H5zM8 3v5h7M8 21v-7h8v7',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
    printer: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z', table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    gantt: 'M3 3v18h18M7 7h6M10 12h7M8 17h5', network: 'M3 9h5v6H3zM16 3h5v6h-5zM16 15h5v6h-5zM8 12h4M12 6v12M12 6h4M12 18h4',
    tree: 'M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    org: 'M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 7v4M5 15v-2h14v2M12 11v2',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', wallet: 'M3 7h18v13H3zM3 7l3-4h12l3 4M16 13h2',
    x: 'M18 6L6 18M6 6l12 12', chevR: 'M9 6l6 6-6 6', chevD: 'M6 9l6 6 6-6', pin: 'M12 17v5M9 3h6l-1 7 4 3H6l4-3z',
    flag: 'M4 22V4h13l-2 4 2 4H4', alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    zin: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6', zout: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
    fit: 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6', target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    note: 'M4 4h16v12l-4 4H4zM16 20v-4h4', panel: 'M3 4h18v16H3zM15 4v16', check: 'M20 6L9 17l-5-5',
    report: 'M4 3h16v18H4zM8 7h8M8 11h8M8 15h5', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
    filter: 'M3 4h18l-7 8v6l-4 2v-8z', columns: 'M3 4h18v16H3zM9 4v16M15 4v16', layers: 'M12 2l10 6-10 6L2 8zM2 14l10 6 10-6',
    balance: 'M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z', more: 'M5 12h.01M12 12h.01M19 12h.01',
    deadline: 'M6 3h12l-6 8zM12 11v10'
  };
  function icon(n) { return '<svg class="i" viewBox="0 0 24 24"><path d="' + (ICONS[n] || '') + '"/></svg>'; }

  /* ---------- state ---------- */

  var DEFAULT_COLS = ['id', 'ind', 'name', 'duration', 'start', 'finish', 'preds', 'res', 'cost'];
  var S = {
    p: null, s: null, view: 'gantt', zoom: 'week', critical: true, sel: [], anchor: null, collapsed: {},
    gridW: 600, drawer: window.innerWidth > 1100, netScope: 'all', netDates: false, netZoom: 1, wbsDepth: 99,
    filter: 'all', group: 'none', sort: 'id', cols: DEFAULT_COLS.slice(), showBaseline: true, report: 'overview', tab: 'task', timeline: true, backstage: false, bsPage: 'info',
    undo: [], redo: [], pendingFocus: null, saved: true
  };
  var UI_KEYS = ['view', 'zoom', 'critical', 'gridW', 'drawer', 'netDates', 'wbsDepth', 'filter', 'group', 'sort', 'cols', 'showBaseline', 'report', 'tab', 'timeline'];

  function loadUI() {
    try {
      var ui = JSON.parse(localStorage.getItem(UISTORE) || '{}');
      UI_KEYS.forEach(function (k) { if (ui[k] != null) S[k] = ui[k]; });
      if (ui.theme) document.documentElement.setAttribute('data-theme', ui.theme);
    } catch (e) { /* storage unavailable */ }
  }
  function saveUI() {
    try {
      var ui = { theme: document.documentElement.getAttribute('data-theme') };
      UI_KEYS.forEach(function (k) { ui[k] = S[k]; });
      localStorage.setItem(UISTORE, JSON.stringify(ui));
    } catch (e) { /* storage unavailable */ }
  }
  function persist() {
    try { localStorage.setItem(STORE, IO.toJSON(S.p)); S.saved = true; }
    catch (e) { S.saved = false; }
  }

  // Every change to the project goes through commit() so it can be undone.
  function commit(fn) {
    var before = JSON.stringify(S.p);
    var res = fn(S.p);
    if (res === false) return false;
    if (JSON.stringify(S.p) === before) return false;
    S.undo.push(before);
    if (S.undo.length > 100) S.undo.shift();
    S.redo = [];
    persist();
    S.s = OP.schedule(S.p);
    scheduleRender();
    return true;
  }
  // Deferred so a click that moved focus to another field lands before the view is rebuilt.
  var renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(function () { renderQueued = false; render(); }, 0);
  }
  function undo() {
    if (!S.undo.length) return;
    S.redo.push(JSON.stringify(S.p));
    S.p = JSON.parse(S.undo.pop());
    persist(); render();
  }
  function redo() {
    if (!S.redo.length) return;
    S.undo.push(JSON.stringify(S.p));
    S.p = JSON.parse(S.redo.pop());
    persist(); render();
  }
  function replaceProject(p, msg) {
    S.undo.push(JSON.stringify(S.p));
    S.redo = [];
    S.p = p; S.sel = []; S.collapsed = {};
    persist(); render();
    if (msg) toast(msg);
  }

  /* ---------- helpers ---------- */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var toastTimer;
  function toast(msg, err) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, err ? 4200 : 2600);
  }

  function taskByUid(uid) {
    for (var i = 0; i < S.p.tasks.length; i++) if (S.p.tasks[i].uid === uid) return S.p.tasks[i];
    return null;
  }
  function resByUid(uid) {
    for (var i = 0; i < S.p.resources.length; i++) if (S.p.resources[i].uid === uid) return S.p.resources[i];
    return null;
  }
  function rowByUid(uid) {
    var rows = S.s.rows;
    for (var i = 0; i < rows.length; i++) if (rows[i].task.uid === uid) return rows[i];
    return null;
  }

  function head(title, sub) {
    return '<div class="view-head"><h1>' + esc(title) + '</h1><span class="sub">' + esc(sub || '') + '</span></div>';
  }
  function tb(act, ic, title, extra) {
    return '<button class="icon-btn" data-tb="' + act + '" title="' + esc(title) + '" aria-label="' + esc(title) + '"' + (extra || '') + '>' + icon(ic) + '</button>';
  }

  /* ---------- rendering ---------- */

  function render() {
    S.s = OP.schedule(S.p);
    var fk = captureFocus();
    renderTop();
    (OP.views[S.view] || OP.views.gantt).render();
    $$('#sbViews button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === S.view); });
    OP.drawer.render();
    restoreFocus(fk);
  }

  function captureFocus() {
    if (S.pendingFocus) { var pf = S.pendingFocus; S.pendingFocus = null; return { key: pf, select: true }; }
    var a = document.activeElement;
    if (!a || !a.dataset || !a.dataset.fk) return null;
    return { key: a.dataset.fk, start: a.selectionStart, end: a.selectionEnd };
  }
  function restoreFocus(f) {
    if (!f) return;
    var el = document.querySelector('[data-fk="' + f.key + '"]');
    if (!el) return;
    el.focus({ preventScroll: false });
    try {
      if (f.select) el.select();
      else if (f.start != null) el.setSelectionRange(f.start, f.end);
    } catch (e) { /* non-text input */ }
  }

  function renderTop() {
    $('#titleText').textContent = S.p.name + ' - OpenPlan';
    document.title = S.p.name + ' - OpenPlan';
    $('#viewLabel').textContent = VIEW_NAMES[S.view] || '';
    $('#zoomSlider').value = ZOOMS.indexOf(S.zoom);
    $('#undoBtn').disabled = !S.undo.length;
    $('#redoBtn').disabled = !S.redo.length;
    $('#saveState').innerHTML = S.saved
      ? icon('check') + 'Saved in this browser'
      : '<span style="color:var(--warn)">' + icon('alert') + 'Browser storage unavailable — use File › Save</span>';
    OP.ribbon.render();
  }
  var VIEW_NAMES = { gantt: 'Gantt Chart', network: 'Network Diagram', wbs: 'WBS Chart', resources: 'Resource Sheet', org: 'Team Chart', workload: 'Resource Usage', budget: 'Cost & Budget', reports: 'Reports' };
  var ZOOMS = ['day', 'week', 'month', 'quarter'];
  var VIEW_TABS = { gantt: 'task', resources: 'resource', org: 'resource', workload: 'resource', reports: 'report', budget: 'report' };

  // Selection changes update highlights without rebuilding the grid, so focus is kept.
  function setSelection(uids, anchor) {
    S.sel = uids; S.anchor = anchor;
    var v = OP.views[S.view];
    if (v && v.selectionChanged) v.selectionChanged();
    OP.drawer.render();
    OP.ribbon.render();
  }

  /* ---------- dialogs ---------- */

  function openDialog(html, onSubmit) {
    var dlg = $('#dlg');
    dlg.innerHTML = '<form method="dialog">' + html + '</form>';
    var form = dlg.querySelector('form');
    form.addEventListener('submit', function (e) {
      if (e.submitter && e.submitter.value === 'cancel') return;
      if (onSubmit && onSubmit(form) === false) e.preventDefault();
    });
    dlg.showModal();
    return form;
  }
  function dlgHead(title) {
    return '<div class="dlg-head"><h2>' + esc(title) + '</h2><button class="icon-btn" value="cancel" formnovalidate aria-label="Close">' + icon('x') + '</button></div>';
  }
  function dlgFoot(ok) {
    return '<div class="dlg-foot"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn primary" value="ok">' + (ok || 'Save') + '</button></div>';
  }
  function field(label, name, val, type, extra) {
    return '<label class="field"><span>' + label + '</span><input class="inp" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></label>';
  }
  function parseDates(text, bad) {
    return String(text || '').split(/[\s,]+/).filter(Boolean).filter(function (d) {
      if (U.parseDate(d) == null) { bad.push(d); return false; }
      return true;
    });
  }

  function settingsDialog() {
    var p = S.p;
    var cf = p.customFields.map(function (f) { return f.name + (f.type === 'number' ? ' : number' : ''); }).join('\n');
    openDialog(dlgHead('Project information') + '<div class="dlg-body">' +
      field('Project name', 'name', p.name) +
      '<div class="row2">' + field('Issuing organisation', 'organization', p.organization) + field('Project manager', 'manager', p.manager) + '</div>' +
      '<div class="row2"><label class="field"><span>Status</span><select class="sel" name="status">' + ['Draft', 'In review', 'Approved', 'Baselined', 'Final'].map(function (s) {
        return '<option' + (s === p.status ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select></label>' + field('Date of issue', 'issueDate', p.issueDate, 'date') + '</div>' +
      '<div class="row2">' + field('Project start date', 'start', p.start, 'date', ' required') + field('Status date (for tracking)', 'statusDate', p.statusDate, 'date') + '</div>' +
      '<div class="row3">' + field('Budget', 'budget', p.budget, 'number', ' min="0" step="1000"') + field('Currency symbol', 'currency', p.currency) +
      field('Hours per working day', 'hoursPerDay', p.hoursPerDay, 'number', ' min="1" max="24" step="0.5"') + '</div>' +
      '<label class="field"><span>Holidays (one date per line, YYYY-MM-DD) — non-working days besides weekends</span><textarea class="inp" name="holidays" rows="3">' + esc((p.holidays || []).join('\n')) + '</textarea></label>' +
      '<label class="field"><span>Custom task fields (one per line; add “: number” for numeric fields)</span><textarea class="inp" name="custom" rows="3" placeholder="Owner&#10;Story points : number">' + esc(cf) + '</textarea></label>' +
      '</div>' + dlgFoot(),
    function (form) {
      var fd = new FormData(form), bad = [];
      var hol = parseDates(fd.get('holidays'), bad);
      if (bad.length) toast('Ignored invalid holiday dates: ' + bad.join(', '), true);
      var lines = String(fd.get('custom') || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      commit(function (pp) {
        pp.name = String(fd.get('name')).trim() || 'Untitled project';
        pp.organization = String(fd.get('organization')); pp.manager = String(fd.get('manager'));
        pp.status = String(fd.get('status')); pp.issueDate = String(fd.get('issueDate'));
        pp.start = String(fd.get('start')) || pp.start;
        pp.statusDate = String(fd.get('statusDate'));
        pp.hoursPerDay = Math.max(1, Math.min(24, +fd.get('hoursPerDay') || 8));
        pp.budget = Math.max(0, +fd.get('budget') || 0);
        pp.currency = String(fd.get('currency')).trim();
        pp.holidays = hol;
        var old = pp.customFields, next = [];
        lines.forEach(function (l, k) {
          var m = /^(.*?)\s*:\s*number$/i.exec(l), name = m ? m[1] : l;
          var prev = old.filter(function (f) { return f.name === name; })[0] || old[k];
          next.push({ id: prev ? prev.id : 'c' + Date.now().toString(36) + k, name: name, type: m ? 'number' : 'text' });
        });
        pp.customFields = next;
      });
    });
  }

  function aboutDialog() {
    openDialog(dlgHead('About OpenPlan') + '<div class="dlg-body">' +
      '<p>OpenPlan is a free, browser-based project planner: WBS, Gantt chart, critical path, network diagram, resources, leveling, baselines, tracking, earned value, budget and reports. Your project is stored only in this browser; use <b>File › Save</b> to keep a copy.</p>' +
      '<div class="logos"><img src="assets/openplan-logo.svg" alt="OpenPlan" height="40"></div>' +
      '<p><b>Keyboard</b><br><kbd>Enter</kbd>/<kbd>↑</kbd><kbd>↓</kbd> move between rows · <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd>/<kbd>←</kbd> indent/outdent · <kbd>Ins</kbd> new task · <kbd>Del</kbd> delete selected · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>Ctrl</kbd>+<kbd>S</kbd> save file</p>' +
      '<p><b>Gantt chart</b><br>Drag a bar to move it (sets a “Start no earlier than” constraint), drag its right edge to change the duration, or drag it up/down onto another bar to link the two.</p>' +
      '<p><b>Predecessors</b><br>Type task IDs separated by commas. Link types: FS (default), SS, FF, SF, with optional lag, e.g. <code>3, 5SS+2d, 7FF-1d</code>.</p>' +
      '<p><b>MS Project and ProjectLibre files</b><br>.mpp and .pod are closed binary formats that a browser cannot read or write. OpenPlan exchanges plans through MS Project XML, which both programs open and save.</p>' +
      '</div><div class="dlg-foot"><button class="btn primary" value="cancel">Close</button></div>');
  }

  /* ---------- file actions ---------- */

  function action(a) {
    closeMenus();
    var name = U.slug(S.p.name), v = OP.views[S.view];
    if (a === 'new') { if (confirm('Start a new blank project? The current one can be restored with Undo.')) replaceProject(M.blank(), 'New project created'); }
    else if (a === 'sample') replaceProject(OP.demo(), 'Sample project loaded');
    else if (a === 'open') { S.fileMode = 'open'; $('#fileInput').click(); }
    else if (a === 'insert') { S.fileMode = 'insert'; $('#fileInput').click(); }
    else if (a === 'save') { U.download(name + '.openplan.json', IO.toJSON(S.p), 'application/json'); toast('Project file downloaded'); }
    else if (a === 'xml') { U.download(name + '.xml', IO.toMSPDI(S.p), 'application/xml'); toast('MS Project XML downloaded — open it in ProjectLibre or MS Project'); }
    else if (a === 'mpp' || a === 'pod') convertDialog(a, name);
    else if (a === 'csv') { U.download(name + '-tasks.csv', '﻿' + IO.toCSV(S.p), 'text/csv'); toast('CSV downloaded'); }
    else if (a === 'png' || a === 'svg') {
      var svg = v && v.svg && v.svg();
      if (!svg) { toast('Switch to Gantt, Network, WBS or Team chart to export an image.'); return; }
      if (a === 'png') IO.exportPNG(svg, name + '-' + S.view);
      else IO.exportSVG(svg, name + '-' + S.view);
    }
    else if (a === 'print') {
      var psvg = v && v.svg && v.svg();
      if (psvg) IO.printSVG(psvg, S.p.name + ' — ' + S.view);
      else window.print();
    }
    else if (a === 'settings') settingsDialog();
    else if (a === 'about') aboutDialog();
  }

  // .mpp and .pod are proprietary binary formats: export XML and explain the one-step conversion.
  function convertDialog(kind, name) {
    var mpp = kind === 'mpp', app = mpp ? 'Microsoft Project' : 'ProjectLibre (free, projectlibre.com)';
    openDialog(dlgHead(mpp ? 'Export to MS Project (.mpp)' : 'Export to ProjectLibre (.pod)') + '<div class="dlg-body">' +
      '<p>' + (mpp ? '.mpp is Microsoft’s closed file format' : '.pod is ProjectLibre’s internal Java format') + ', so a web page cannot write it directly. ' +
      'OpenPlan saves an MS Project XML file that ' + (mpp ? 'MS Project' : 'ProjectLibre') + ' opens without losing tasks, links, resources, costs or the baseline.</p>' +
      '<ol class="steps"><li>Click <b>Download XML</b> below.</li><li>Open the file in ' + app + ' (File › Open, choose the .xml).</li>' +
      '<li>Choose <b>File › Save As</b> and pick <b>' + (mpp ? 'Project (*.mpp)' : 'ProjectLibre (*.pod)') + '</b>.</li></ol>' +
      '</div><div class="dlg-foot"><button class="btn" value="cancel" formnovalidate>Close</button><button class="btn primary" value="ok">' + icon('download') + 'Download XML</button></div>',
    function () {
      U.download(name + '.xml', IO.toMSPDI(S.p), 'application/xml');
      toast('XML downloaded — now open it in ' + (mpp ? 'MS Project' : 'ProjectLibre') + ' and Save As .' + kind);
    });
  }

  function openFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var p = IO.parseAny(String(reader.result));
        if (S.fileMode === 'insert') {
          commit(function (pp) { var uid = IO.insertProject(pp, p); S.sel = [uid]; });
          toast('Inserted ' + file.name + ' as a subproject');
        } else replaceProject(p, 'Opened ' + file.name);
      } catch (e) {
        toast('Could not open file: ' + e.message, true);
      }
    };
    reader.readAsText(file);
  }

  function closeMenus() { $$('.menu.open').forEach(function (m) { m.classList.remove('open'); }); }

  /* ---------- global wiring ---------- */

  function bind() {
    $$('[data-icon]').forEach(function (el) { el.outerHTML = icon(el.dataset.icon); });
    $('#undoBtn').innerHTML = icon('undo'); $('#redoBtn').innerHTML = icon('redo');
    $('[data-act="about"].icon-btn').innerHTML = icon('info');
    updateThemeIcon();

    $('#undoBtn').onclick = undo;
    $('#redoBtn').onclick = redo;
    $('#themeBtn').onclick = function () {
      var dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      saveUI(); updateThemeIcon(); render();
    };
    $('#fileInput').addEventListener('change', function (e) { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; });

    document.addEventListener('click', function (e) {
      var mb = e.target.closest('[data-menu]');
      if (mb) {
        var m = document.getElementById(mb.dataset.menu), was = m.classList.contains('open');
        closeMenus();
        if (!was) m.classList.add('open');
        return;
      }
      if (!e.target.closest('.menu') || e.target.closest('.menu button')) closeMenus();
      var ab = e.target.closest('[data-act]');
      if (ab && !ab.disabled) { action(ab.dataset.act); return; }
      var vb = e.target.closest('[data-view]') || e.target.closest('[data-view-go]');
      if (vb) { S.view = vb.dataset.view || vb.dataset.viewGo; S.netZoom = 1; S.backstage = false; S.tab = VIEW_TABS[S.view] || S.tab; saveUI(); render(); $('#main').scrollTop = 0; }
    });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase(), editing = tag === 'input' || tag === 'textarea' || tag === 'select';
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); action('save'); return; }
      if (mod && !editing && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && !editing && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') closeMenus();
      var v = OP.views[S.view];
      if (v && v.keydown) v.keydown(e, editing);
    });

    Object.keys(OP.views).forEach(function (k) { if (OP.views[k].bind) OP.views[k].bind(); });
    OP.drawer.bind();
    OP.ribbon.bind();
  }

  function updateThemeIcon() {
    var dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
    $('#themeBtn').innerHTML = icon(dark ? 'sun' : 'moon');
  }

  function start() {
    loadUI();
    try {
      var saved = localStorage.getItem(STORE);
      S.p = saved ? IO.fromJSON(saved) : OP.demo();
    } catch (e) {
      S.p = OP.demo();
    }
    M.normalize(S.p);
    bind();
    persist();
    render();
  }

  return {
    S: S, DEFAULT_COLS: DEFAULT_COLS, ZOOMS: ZOOMS, VIEW_NAMES: VIEW_NAMES, closeMenus: closeMenus, icon: icon, $: $, $$: $$, toast: toast, commit: commit, render: render,
    taskByUid: taskByUid, resByUid: resByUid, rowByUid: rowByUid, head: head, tb: tb, saveUI: saveUI,
    setSelection: setSelection, openDialog: openDialog, dlgHead: dlgHead, dlgFoot: dlgFoot, field: field,
    parseDates: parseDates, captureFocus: captureFocus, restoreFocus: restoreFocus, start: start
  };
})();
