/* Gantt view: editable task table, chart with drag editing, filters/grouping/sorting, tracking and leveling,
 * plus the task details drawer and the task-type rules (fixed units / work / duration, effort driven). */
(function () {
  var U = OP.util, M = OP.model, C = OP.charts, A = OP.app, S = A.S, esc = U.esc, icon = A.icon, $ = A.$, $$ = A.$$;

  /* ---------- task-type rules ---------- */

  var ops = OP.taskOps = {
    hpd: function () { return +S.p.hoursPerDay || 8; },
    work: function (t) { return M.workUnits(S.p, t) * ops.hpd() * (t.milestone ? 0 : +t.duration || 0); },
    round: function (v) { return Math.round(v * 100) / 100; },
    scaleUnits: function (t, f) {
      t.assignments.forEach(function (a) {
        var r = A.resByUid(a.res);
        if (r && r.kind === 'Work') a.units = Math.max(1, Math.round(a.units * f * 10) / 10);
      });
    },
    setDuration: function (t, d) {
      var old = +t.duration || 0;
      if (t.type === 'FixedWork' && old > 0 && d > 0 && M.workUnits(S.p, t) > 0) ops.scaleUnits(t, old / d);
      t.duration = d;
      t.milestone = d === 0;
    },
    setWork: function (t, hours) {
      var u = M.workUnits(S.p, t), d = +t.duration || 0;
      if (!u) return 'Assign a person to this task before entering work.';
      if (t.type === 'FixedDuration' && d > 0) ops.scaleUnits(t, hours / (d * u * ops.hpd()));
      else { t.duration = ops.round(hours / (u * ops.hpd())); t.milestone = t.duration === 0; }
      return '';
    },
    // Effort-driven tasks keep their total work when people are added or removed.
    changeAssignments: function (t, fn) {
      var before = ops.work(t), u0 = M.workUnits(S.p, t);
      fn();
      var u1 = M.workUnits(S.p, t);
      if (!t.effortDriven || !u0 || !u1 || u0 === u1 || t.milestone) return;
      if (t.type === 'FixedDuration') ops.scaleUnits(t, u0 / u1);
      else t.duration = ops.round(before / (u1 * ops.hpd()));
    },
    setUnits: function (t, k, units) {
      var before = ops.work(t);
      t.assignments[k].units = units;
      var r = A.resByUid(t.assignments[k].res);
      if (t.type === 'FixedWork' && r && r.kind === 'Work' && before > 0) t.duration = ops.round(before / (M.workUnits(S.p, t) * ops.hpd()));
    }
  };

  /* ---------- columns ---------- */

  function dayNum(v) { return v == null || !isFinite(v) ? '' : U.num(v); }
  function dfmt(iso) { var d = U.parseDate(iso); return d == null ? '' : U.fmt(d); }
  function money(v) { return v == null ? '' : U.money(v); }
  function signedDays(v) { return v == null ? '' : (v > 0 ? '+' : '') + U.num(v) + 'd'; }

  var COLS = {
    id: { t: 'ID', w: 44, fixed: true },
    ind: { t: '', w: 56, fixed: true },
    name: { t: 'Task Name', w: 280, fixed: true },
    wbs: { t: 'WBS', w: 64, get: function (r) { return r.wbs; } },
    duration: { t: 'Duration', w: 76, edit: 'duration', get: function (r) { return M.fmtDuration(r.duration); }, sumRo: true },
    work: { t: 'Work', w: 80, edit: 'work', num: true, get: function (r) { return U.num(r.work) + 'h'; }, sumRo: true },
    start: { t: 'Start', w: 88, get: function (r) { return U.fmt(r.startDn); } },
    finish: { t: 'Finish', w: 88, get: function (r) { return U.fmt(r.finishDn); } },
    preds: { t: 'Predecessors', w: 110, edit: 'preds' },
    res: { t: 'Resources', w: 170 },
    cost: { t: 'Cost', w: 110, num: true, get: function (r) { return U.money(r.cost); } },
    fixedCost: { t: 'Fixed cost', w: 96, num: true, edit: 'number', field: 'fixedCost', get: function (r) { return String(r.task.fixedCost || 0); } },
    percent: { t: '% Complete', w: 90, num: true, edit: 'percent', get: function (r) { return r.percent + '%'; }, sumRo: true },
    actualStart: { t: 'Actual start', w: 130, edit: 'date', field: 'actualStart', sumRo: true },
    actualFinish: { t: 'Actual finish', w: 130, edit: 'date', field: 'actualFinish', sumRo: true },
    constraint: { t: 'Constraint', w: 170, edit: 'select', field: 'constraint', options: M.CONSTRAINTS, sumRo: true },
    constraintDate: { t: 'Constraint date', w: 130, edit: 'date', field: 'constraintDate', sumRo: true },
    deadline: { t: 'Deadline', w: 130, edit: 'date', field: 'deadline', sumRo: true },
    type: { t: 'Task type', w: 130, edit: 'select', field: 'type', options: M.TASK_TYPES, sumRo: true },
    priority: { t: 'Priority', w: 74, num: true, edit: 'number', field: 'priority', get: function (r) { return String(r.task.priority); } },
    slack: { t: 'Total slack', w: 86, num: true, get: function (r) { return U.num(r.slack) + 'd'; } },
    freeSlack: { t: 'Free slack', w: 80, num: true, get: function (r) { return r.summary ? '' : U.num(r.freeSlack) + 'd'; } },
    es: { t: 'ES', w: 56, num: true, get: function (r) { return dayNum(r.es); } },
    ef: { t: 'EF', w: 56, num: true, get: function (r) { return dayNum(r.ef); } },
    ls: { t: 'LS', w: 56, num: true, get: function (r) { return dayNum(r.ls); } },
    lf: { t: 'LF', w: 56, num: true, get: function (r) { return dayNum(r.lf); } },
    bStart: { t: 'Baseline start', w: 104, get: function (r) { return r.base ? U.fmt(r.base.startDn) : ''; } },
    bFinish: { t: 'Baseline finish', w: 104, get: function (r) { return r.base ? U.fmt(r.base.finishDn) : ''; } },
    bCost: { t: 'Baseline cost', w: 110, num: true, get: function (r) { return r.base ? U.money(r.base.cost) : ''; } },
    startVar: { t: 'Start var.', w: 80, num: true, get: function (r) { return r.base ? signedDays(r.startVar) : ''; } },
    finishVar: { t: 'Finish var.', w: 80, num: true, get: function (r) { return r.base ? signedDays(r.finishVar) : ''; } },
    costVar: { t: 'Cost var.', w: 100, num: true, get: function (r) { return r.base ? U.money(r.costVar) : ''; } },
    actualCost: { t: 'Actual cost', w: 104, num: true, get: function (r) { return money(r.actualCost); } },
    bcws: { t: 'BCWS (PV)', w: 104, num: true, get: function (r) { return money(r.bcws); } },
    bcwp: { t: 'BCWP (EV)', w: 104, num: true, get: function (r) { return money(r.bcwp); } },
    acwp: { t: 'ACWP (AC)', w: 104, num: true, get: function (r) { return money(r.acwp); } },
    sv: { t: 'SV', w: 96, num: true, get: function (r) { return money(r.bcwp - r.bcws); } },
    cv: { t: 'CV', w: 96, num: true, get: function (r) { return money(r.bcwp - r.acwp); } },
    levelDelay: { t: 'Leveling delay', w: 100, num: true, get: function (r) { return r.task.levelDelay ? U.num(r.task.levelDelay) + 'd' : ''; } },
    notes: { t: 'Notes', w: 200, edit: 'text', field: 'notes' }
  };
  var COL_GROUPS = [
    ['General', ['wbs', 'duration', 'work', 'start', 'finish', 'preds', 'res', 'cost', 'fixedCost', 'priority', 'type', 'notes']],
    ['Schedule', ['constraint', 'constraintDate', 'deadline', 'slack', 'freeSlack', 'es', 'ef', 'ls', 'lf', 'levelDelay']],
    ['Tracking', ['percent', 'actualStart', 'actualFinish', 'actualCost', 'bStart', 'bFinish', 'bCost', 'startVar', 'finishVar', 'costVar']],
    ['Earned value', ['bcws', 'bcwp', 'acwp', 'sv', 'cv']]
  ];
  function col(k) {
    if (COLS[k]) return COLS[k];
    var m = /^cf:(.+)$/.exec(k), f = m && S.p.customFields.filter(function (x) { return x.id === m[1]; })[0];
    if (!f) return null;
    return { t: f.name, w: 120, num: f.type === 'number', edit: f.type === 'number' ? 'cfnum' : 'cftext', cf: f.id };
  }
  function activeCols() {
    var ks = S.cols.filter(function (k) { return col(k); });
    ['name', 'ind', 'id'].forEach(function (k) { if (ks.indexOf(k) < 0) ks.unshift(k); });
    return ks;
  }

  /* ---------- filter, group, sort ---------- */

  var FILTERS = {
    all: 'All tasks', critical: 'Critical tasks', milestones: 'Milestones', summary: 'Summary tasks',
    incomplete: 'Incomplete tasks', complete: 'Completed tasks', late: 'Behind schedule', slipped: 'Slipped vs baseline',
    overalloc: 'Overallocated resources', deadline: 'Missed deadlines', conflicts: 'Constraint conflicts'
  };
  var GROUPS = { none: 'No grouping', critical: 'Critical', milestone: 'Milestone', status: 'Progress status', resource: 'Resource', priority: 'Priority', type: 'Task type' };
  var SORTS = { id: 'ID', start: 'Start date', finish: 'Finish date', duration: 'Duration', name: 'Name', cost: 'Cost', priority: 'Priority', slack: 'Total slack' };

  function matches(r) {
    var f = S.filter, t = r.task;
    if (f === 'all') return true;
    if (f === 'summary') return r.summary;
    if (r.summary) return false;
    if (f === 'critical') return r.critical;
    if (f === 'milestones') return r.milestone;
    if (f === 'incomplete') return r.percent < 100;
    if (f === 'complete') return r.percent >= 100;
    if (f === 'late') return r.late;
    if (f === 'slipped') return !!r.slipped;
    if (f === 'overalloc') return r.over;
    if (f === 'deadline') return r.missedDeadline;
    if (f === 'conflicts') return !!r.conflict;
    var m = /^res:(\d+)$/.exec(f);
    if (m) return t.assignments.some(function (a) { return a.res === +m[1]; });
    return true;
  }
  function sortKey(r) {
    var k = S.sort;
    if (k === 'start') return r.startDn;
    if (k === 'finish') return r.finishDn;
    if (k === 'duration') return -r.duration;
    if (k === 'name') return (r.task.name || '').toLowerCase();
    if (k === 'cost') return -r.cost;
    if (k === 'priority') return -r.task.priority;
    if (k === 'slack') return r.slack;
    return r.i;
  }
  function cmp(a, b) {
    var x = sortKey(a), y = sortKey(b);
    return x < y ? -1 : x > y ? 1 : a.i - b.i;
  }
  function groupKeys(r) {
    var g = S.group, t = r.task;
    if (g === 'critical') return [r.critical ? 'Critical' : 'Not critical'];
    if (g === 'milestone') return [r.milestone ? 'Milestones' : 'Tasks'];
    if (g === 'status') return [r.percent >= 100 ? 'Complete' : r.percent > 0 ? 'In progress' : 'Not started'];
    if (g === 'priority') return ['Priority ' + t.priority];
    if (g === 'type') return [M.TASK_TYPES[t.type] || t.type];
    if (g === 'resource') {
      var names = t.assignments.map(function (a) { var res = A.resByUid(a.res); return res ? res.name || '(unnamed)' : null; }).filter(Boolean);
      return names.length ? names : ['Unassigned'];
    }
    var m = /^cf:(.+)$/.exec(g);
    if (m) { var v = t.custom && t.custom[m[1]]; return [v === '' || v == null ? '(blank)' : String(v)]; }
    return ['All'];
  }

  // Rows to display, honouring filter, grouping, sorting and collapsed summaries.
  function items() {
    var rows = S.s.rows;
    if (S.group !== 'none') {
      var groups = {}, order = [];
      rows.forEach(function (r) {
        if (r.summary || !matches(r)) return;
        groupKeys(r).forEach(function (k) {
          if (!groups[k]) { groups[k] = []; order.push(k); }
          groups[k].push(r);
        });
      });
      order.sort();
      var out = [];
      order.forEach(function (k) {
        var list = groups[k].sort(cmp), key = 'g:' + k;
        out.push({
          group: true, key: key, label: k, count: list.length,
          cost: list.reduce(function (a, r) { return a + r.cost; }, 0),
          startDn: Math.min.apply(null, list.map(function (r) { return r.startDn; })),
          finishDn: Math.max.apply(null, list.map(function (r) { return r.finishDn; }))
        });
        if (!S.collapsed[key]) out = out.concat(list);
      });
      return out;
    }
    var keep = {};
    rows.forEach(function (r) {
      if (!matches(r)) return;
      keep[r.i] = true;
      for (var q = r.parent; q >= 0; q = rows[q].parent) keep[q] = true;
    });
    var res = [];
    (function walk(list) {
      list.slice().sort(cmp).forEach(function (r) {
        if (!keep[r.i]) return;
        res.push(r);
        if (r.summary && !S.collapsed[r.task.uid]) walk(r.children.map(function (c) { return rows[c]; }));
      });
    })(rows.filter(function (r) { return r.parent < 0; }));
    return res;
  }
  function taskRows() { return items().filter(function (x) { return !x.group; }); }

  /* ---------- view ---------- */

  function selIndexes() {
    var idx = M.indexByUid(S.p);
    return S.sel.map(function (u) { return idx[u]; }).filter(function (i) { return i != null; }).sort(function (a, b) { return a - b; });
  }

  function opts(map, cur) {
    return Object.keys(map).map(function (k) { return '<option value="' + esc(k) + '"' + (String(cur) === k ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join('');
  }

  // Filter, group and sort choices (also used by the ribbon).
  function menuData() {
    var filters = {}, groups = {};
    for (var f in FILTERS) filters[f] = FILTERS[f];
    S.p.resources.forEach(function (r) { filters['res:' + r.uid] = 'Using ' + (r.name || '(unnamed)'); });
    for (var g in GROUPS) groups[g] = GROUPS[g];
    S.p.customFields.forEach(function (cf) { groups['cf:' + cf.id] = cf.name; });
    if (!filters[S.filter]) S.filter = 'all';
    if (!groups[S.group]) S.group = 'none';
    return { filters: filters, groups: groups, sorts: SORTS, opts: opts, colMenu: colMenu };
  }

  // MS Project-style timeline strip: project span, top-level phases and milestones.
  function timelineHTML() {
    var s = S.s, span = Math.max(1, s.finishDn - s.startDn + 1);
    function pct(dn) { return Math.max(0, Math.min(100, (dn - s.startDn) / span * 100)); }
    var h = ['<div class="timeline"><div class="tl-inner">'];
    h.push('<div class="tl-date start">Start<b>' + U.fmtLong(s.startDn) + '</b></div><div class="tl-track">');
    var lanes = [];
    s.rows.filter(function (r) { return r.task.level === 1 && !r.milestone; }).forEach(function (r) {
      var lane = 0;
      while (lanes[lane] != null && lanes[lane] >= r.startDn) lane++;
      lanes[lane] = r.finishDn;
      var l = pct(r.startDn), w = Math.max(0.8, pct(r.finishDn + 1) - l);
      h.push('<div class="tl-seg lane' + Math.min(lane, 2) + '" style="left:' + l + '%;width:' + w + '%" title="' + esc(r.task.name + ': ' + U.fmt(r.startDn) + ' – ' + U.fmt(r.finishDn)) + '" data-tl="' + r.task.uid + '">' +
        '<span>' + esc(r.task.name) + '</span><small>' + U.fmt(r.startDn) + ' – ' + U.fmt(r.finishDn) + '</small></div>');
    });
    s.rows.filter(function (r) { return r.milestone; }).forEach(function (r) {
      h.push('<div class="tl-ms" style="left:' + pct(r.startDn + 1) + '%" title="' + esc(r.task.name + ' — ' + U.fmt(r.startDn)) + '" data-tl="' + r.task.uid + '"><i></i></div>');
    });
    var today = U.todayDn();
    if (today >= s.startDn && today <= s.finishDn) h.push('<div class="tl-today" style="left:' + pct(today) + '%" title="Today"></div>');
    h.push('</div><div class="tl-date finish">Finish<b>' + U.fmtLong(s.finishDn) + '</b></div></div></div>');
    return h.join('');
  }

  function render() {
    var gp = $('#gridPane'), cp = $('#chartPane');
    var keep = gp && cp ? { top: gp.scrollTop, gl: gp.scrollLeft, cl: cp.scrollLeft } : null;
    var md = menuData();
    var h = ['<div class="view gantt-view">'];
    if (S.timeline && S.p.tasks.length) h.push(timelineHTML());
    if (S.s.cycle.length) h.push('<div class="alert">' + icon('alert') + 'Dependency loop between tasks ' + S.s.cycle.join(', ') + '. Remove one of the links to fix the schedule.</div>');
    var conflicts = S.s.rows.filter(function (r) { return r.conflict; }).length;
    if (conflicts && S.filter !== 'conflicts') h.push('<div class="alert warn">' + icon('alert') + conflicts + ' task' + (conflicts > 1 ? 's have' : ' has') + ' a constraint that conflicts with its links. <button class="linkbtn" data-gt="showConflicts">Show them</button></div>');
    if (S.filter !== 'all' || S.group !== 'none') h.push('<div class="alert info">' + icon('filter') + 'Showing: ' + esc(md.filters[S.filter]) + (S.group !== 'none' ? ', grouped by ' + esc(md.groups[S.group]) : '') + ' <button class="linkbtn" data-gt="clearFilter">Show all tasks</button></div>');
    h.push('<div class="split"><div class="grid-pane" id="gridPane" style="width:' + S.gridW + 'px">' + gridHTML() + '</div>' +
      '<div class="splitter" id="splitter" title="Drag to resize"></div><div class="chart-pane" id="chartPane"></div></div></div>');
    $('#main').innerHTML = h.join('');
    renderChart();
    gp = $('#gridPane'); cp = $('#chartPane');
    if (keep) { gp.scrollTop = keep.top; cp.scrollTop = keep.top; gp.scrollLeft = keep.gl; cp.scrollLeft = keep.cl; }
    bindPanes();
    var tl = $('.timeline');
    if (tl) tl.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tl]');
      if (t) { var u = +t.dataset.tl; A.setSelection([u], u); gotoSelected(); }
    });
  }
  function colMenu() {
    var h = [];
    COL_GROUPS.forEach(function (g) {
      h.push('<div class="label">' + g[0] + '</div><div class="col-grid">');
      g[1].forEach(function (k) {
        h.push('<label class="chk"><input type="checkbox" data-col="' + k + '"' + (S.cols.indexOf(k) >= 0 ? ' checked' : '') + '>' + esc(COLS[k].t) + '</label>');
      });
      h.push('</div>');
    });
    if (S.p.customFields.length) {
      h.push('<div class="label">Custom fields</div><div class="col-grid">');
      S.p.customFields.forEach(function (f) {
        h.push('<label class="chk"><input type="checkbox" data-col="cf:' + f.id + '"' + (S.cols.indexOf('cf:' + f.id) >= 0 ? ' checked' : '') + '>' + esc(f.name) + '</label>');
      });
      h.push('</div>');
    }
    h.push('<hr><button data-gt="resetCols">' + icon('undo') + 'Reset to default columns</button>');
    return h.join('');
  }

  function cellHTML(k, r, idx) {
    var c = col(k), t = r.task, u = t.uid;
    if (k === 'id') return '<td class="id" data-rowsel="' + u + '">' + r.id + '</td>';
    if (k === 'ind') {
      var ind = [];
      if (S.critical && r.critical && !r.summary) ind.push('<span class="crit" title="On the critical path">' + icon('flag') + '</span>');
      if (r.over) ind.push('<span class="over" title="A resource on this task is overallocated">' + icon('alert') + '</span>');
      if (r.conflict) ind.push('<span class="crit" title="' + esc(r.conflict) + '">' + icon('alert') + '</span>');
      if (r.missedDeadline) ind.push('<span class="crit" title="Finishes after its deadline">' + icon('deadline') + '</span>');
      if (!r.summary && t.constraint !== 'ASAP') ind.push('<span title="' + esc(M.CONSTRAINTS[t.constraint] + (t.constraintDate ? ' ' + dfmt(t.constraintDate) : '')) + '">' + icon('pin') + '</span>');
      if (r.late && !r.summary) ind.push('<span class="over" title="Behind schedule at the status date">' + icon('clock') + '</span>');
      if (r.percent >= 100) ind.push('<span class="done" title="Complete">' + icon('check') + '</span>');
      if (t.levelDelay) ind.push('<span title="Delayed ' + U.num(t.levelDelay) + 'd by leveling">' + icon('balance') + '</span>');
      if (t.notes) ind.push('<span title="' + esc(t.notes) + '">' + icon('note') + '</span>');
      return '<td class="ind"><span class="ind-icons">' + ind.join('') + '</span></td>';
    }
    if (k === 'name') {
      var lvl = S.group !== 'none' ? 1 : t.level;
      var caret = r.summary && S.group === 'none'
        ? '<button class="caret" data-toggle="' + u + '" aria-label="Expand or collapse">' + icon(S.collapsed[u] ? 'chevR' : 'chevD') + '</button>'
        : '<span class="caret none"></span>';
      return '<td><div class="namecell" style="padding-left:' + ((lvl - 1) * 16 + 4) + 'px">' + caret +
        '<input class="cell name" data-uid="' + u + '" data-f="name" data-fk="' + u + ':name" value="' + esc(t.name) + '" placeholder="Task name" spellcheck="false"></div></td>';
    }
    if (k === 'res') {
      return '<td class="ro linkish" data-openres="' + u + '" title="' + (r.summary ? '' : 'Click to assign resources') + '">' + esc(r.summary ? '' : r.names || (S.p.resources.length ? '+ assign' : '')) + '</td>';
    }
    if (k === 'preds') {
      return '<td><input class="cell" data-uid="' + u + '" data-f="preds" data-fk="' + u + ':preds" value="' + esc(M.formatPreds(S.p, t, idx)) + '" spellcheck="false"></td>';
    }
    var ro = !c.edit || (r.summary && c.sumRo);
    var val = c.get ? c.get(r) : c.cf ? (t.custom[c.cf] == null ? '' : t.custom[c.cf]) : c.field ? t[c.field] : '';
    if (ro) return '<td class="ro' + (c.num ? ' num' : '') + '">' + esc(val == null ? '' : val) + '</td>';
    var fk = u + ':' + k, base = ' data-uid="' + u + '" data-f="' + k + '" data-fk="' + fk + '"';
    if (c.edit === 'date') return '<td><input class="cell" type="date"' + base + ' value="' + esc(t[c.field] || '') + '"></td>';
    if (c.edit === 'select') return '<td><select class="cell"' + base + '>' + opts(c.options, t[c.field]) + '</select></td>';
    return '<td><input class="cell' + (c.num ? ' num' : '') + '"' + base + ' value="' + esc(val) + '" spellcheck="false"></td>';
  }

  function gridHTML() {
    var list = items(), idx = M.indexByUid(S.p), selSet = {}, ks = activeCols();
    S.sel.forEach(function (u) { selSet[u] = true; });
    var h = ['<table class="grid"><colgroup>'];
    ks.forEach(function (k) { h.push('<col style="width:' + col(k).w + 'px">'); });
    h.push('</colgroup><thead><tr>');
    ks.forEach(function (k) { h.push('<th' + (col(k).num ? ' class="num"' : '') + '>' + esc(col(k).t) + '</th>'); });
    h.push('</tr></thead><tbody>');
    list.forEach(function (r) {
      if (r.group) {
        h.push('<tr class="grouprow"><td colspan="' + ks.length + '"><div class="namecell"><button class="caret" data-toggle="' + esc(r.key) + '">' + icon(S.collapsed[r.key] ? 'chevR' : 'chevD') + '</button>' +
          '<b>' + esc(r.label) + '</b><span class="muted small">&nbsp;· ' + r.count + ' task' + (r.count === 1 ? '' : 's') + ' · ' + U.money(r.cost, S.p.currency) + '</span></div></td></tr>');
        return;
      }
      var u = r.task.uid;
      h.push('<tr data-uid="' + u + '" class="' + (selSet[u] ? 'sel ' : '') + (r.summary ? 'summary' : '') + '">');
      ks.forEach(function (k) { h.push(cellHTML(k, r, idx)); });
      h.push('</tr>');
    });
    if (S.filter === 'all' && S.group === 'none') {
      h.push('<tr class="newrow"><td class="id">' + (S.p.tasks.length + 1) + '</td><td></td><td><div class="namecell" style="padding-left:4px"><span class="caret none"></span>' +
        '<input class="cell" data-f="new" data-fk="new" placeholder="Type a new task name and press Enter…" spellcheck="false"></div></td><td colspan="' + Math.max(1, ks.length - 3) + '"></td></tr>');
    }
    h.push('</tbody></table>');
    if (!S.p.tasks.length) h.push('<div class="empty"><h3>No tasks yet</h3><div>Type a task name in the row above, or load the sample from File.</div></div>');
    else if (!list.length) h.push('<div class="empty"><h3>No matching tasks</h3><div>Change the filter to see more tasks.</div></div>');
    return h.join('');
  }

  function renderChart() {
    var cp = $('#chartPane');
    if (!cp) return;
    var selSet = {};
    S.sel.forEach(function (u) { selSet[u] = true; });
    var g = C.gantt({ p: S.p, s: S.s, rows: items(), zoom: S.zoom, critical: S.critical, selected: selSet, baseline: S.showBaseline && !!S.p.baseline });
    var top = cp.scrollTop, left = cp.scrollLeft;
    cp.innerHTML = g.svg + '<div style="height:' + (C.ROW * 2) + 'px"></div>';
    cp.scrollTop = top; cp.scrollLeft = left;
    S._gantt = g;
  }

  function selectionChanged() {
    var set = {};
    S.sel.forEach(function (u) { set[u] = true; });
    $$('#gridPane tr[data-uid]').forEach(function (tr) { tr.classList.toggle('sel', !!set[+tr.dataset.uid]); });
    renderChart();
    var none = !S.sel.length;
    ['outdent', 'indent', 'up', 'down', 'unlink', 'del'].forEach(function (k) { var b = $('[data-gt="' + k + '"]'); if (b) b.disabled = none; });
    var lb = $('[data-gt="link"]'); if (lb) lb.disabled = S.sel.length < 2;
    $$('[data-gt="pct"]').forEach(function (b) { b.disabled = none; });
  }

  /* ---------- pane events ---------- */

  function bindPanes() {
    var gp = $('#gridPane'), cp = $('#chartPane'), syncing = false;
    gp.addEventListener('scroll', function () { if (syncing) { syncing = false; return; } syncing = true; cp.scrollTop = gp.scrollTop; });
    cp.addEventListener('scroll', function () { if (syncing) { syncing = false; return; } syncing = true; gp.scrollTop = cp.scrollTop; });

    var sp = $('#splitter');
    sp.addEventListener('pointerdown', function (e) {
      var x0 = e.clientX, w0 = S.gridW;
      sp.classList.add('drag');
      sp.setPointerCapture(e.pointerId);
      function mv(ev) { S.gridW = Math.max(160, Math.min(2400, w0 + ev.clientX - x0)); gp.style.width = S.gridW + 'px'; }
      function up() { sp.classList.remove('drag'); sp.removeEventListener('pointermove', mv); sp.removeEventListener('pointerup', up); A.saveUI(); }
      sp.addEventListener('pointermove', mv);
      sp.addEventListener('pointerup', up);
    });

    gp.addEventListener('focusin', function (e) {
      var u = +e.target.dataset.uid;
      if (u && !(S.sel.length === 1 && S.sel[0] === u)) A.setSelection([u], u);
    });
    gp.addEventListener('change', function (e) { if (e.target.classList.contains('cell')) commitCell(e.target); });
    gp.addEventListener('keydown', gridKeys);
    gp.addEventListener('click', function (e) {
      var tg = e.target.closest('[data-toggle]');
      if (tg) { var k = tg.dataset.toggle, key = /^\d+$/.test(k) ? +k : k; S.collapsed[key] = !S.collapsed[key]; render(); return; }
      var rs = e.target.closest('[data-rowsel]');
      if (rs) { clickSelect(+rs.dataset.rowsel, e); return; }
      var or = e.target.closest('[data-openres]');
      if (or) {
        var ou = +or.dataset.openres;
        A.setSelection([ou], ou);
        if (!S.drawer) { S.drawer = true; A.saveUI(); OP.drawer.render(); }
        var sel = $('#drawer [data-fk="d:addres"]'); if (sel) sel.focus();
      }
    });
    cp.addEventListener('click', function (e) {
      if (drag.suppressClick) { drag.suppressClick = false; return; }
      var b = e.target.closest('.gbar');
      if (b) clickSelect(+b.dataset.uid, e);
    });
    cp.addEventListener('dblclick', function (e) {
      if (e.target.closest('.gbar')) { S.drawer = true; A.saveUI(); A.render(); }
    });
    cp.addEventListener('pointerdown', dragStart);
  }

  function clickSelect(u, e) {
    if (e.shiftKey && S.anchor != null) {
      var rows = taskRows().map(function (r) { return r.task.uid; });
      var a = rows.indexOf(S.anchor), b = rows.indexOf(u);
      if (a >= 0 && b >= 0) { A.setSelection(rows.slice(Math.min(a, b), Math.max(a, b) + 1), S.anchor); return; }
    }
    if (e.ctrlKey || e.metaKey) {
      var i = S.sel.indexOf(u), next = S.sel.slice();
      if (i >= 0) next.splice(i, 1); else next.push(u);
      A.setSelection(next, u);
      return;
    }
    A.setSelection([u], u);
  }

  /* ---------- drag editing on the chart ---------- */

  var drag = {};
  function dragStart(e) {
    var gEl = e.target.closest('.gbar');
    if (!gEl || e.button !== 0) return;
    var uid = +gEl.dataset.uid, r = A.rowByUid(uid), g = S._gantt, pos = g && g.pos[uid];
    if (!r || !pos || r.summary) return;
    var svg = $('#chartPane svg'), rect = svg.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    drag = { uid: uid, r: r, x0: e.clientX, y0: e.clientY, mode: !r.milestone && sx > pos.e - 7 ? 'resize' : 'move', moved: false, svg: svg, rect: rect, pos: pos };
    var ns = 'http://www.w3.org/2000/svg';
    drag.ghost = document.createElementNS(ns, 'rect');
    drag.ghost.setAttribute('class', 'ghost');
    drag.ghost.setAttribute('x', pos.s); drag.ghost.setAttribute('y', pos.y - 9);
    drag.ghost.setAttribute('width', Math.max(pos.e - pos.s, 4)); drag.ghost.setAttribute('height', 18);
    drag.line = document.createElementNS(ns, 'line');
    drag.line.setAttribute('class', 'ghostline');
    drag.tip = document.createElementNS(ns, 'text');
    drag.tip.setAttribute('class', 'ghost-t');
    window.addEventListener('pointermove', dragMove);
    window.addEventListener('pointerup', dragEnd, { once: true });
  }
  function dragMove(e) {
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    if (!drag.moved) { drag.moved = true; drag.svg.appendChild(drag.ghost); drag.svg.appendChild(drag.line); drag.svg.appendChild(drag.tip); }
    var g = S._gantt, pos = drag.pos;
    if (drag.mode !== 'resize' && Math.abs(dy) > C.ROW * 0.7) drag.mode = 'link';
    var days = Math.round(dx / g.ppd);
    if (drag.mode === 'link') {
      drag.ghost.style.display = 'none';
      drag.line.setAttribute('x1', pos.e); drag.line.setAttribute('y1', pos.y);
      drag.line.setAttribute('x2', e.clientX - drag.rect.left); drag.line.setAttribute('y2', e.clientY - drag.rect.top);
      setTip(e, 'Link to…');
    } else if (drag.mode === 'move') {
      drag.ghost.setAttribute('x', pos.s + days * g.ppd);
      setTip(e, 'Start ' + U.fmt(drag.r.startDn + days));
    } else {
      drag.ghost.setAttribute('width', Math.max(g.ppd, pos.e - pos.s + days * g.ppd));
      setTip(e, 'Finish ' + U.fmt(Math.max(drag.r.startDn, drag.r.finishDn + days)));
    }
  }
  function setTip(e, text) {
    drag.tip.textContent = text;
    drag.tip.setAttribute('x', e.clientX - drag.rect.left + 12);
    drag.tip.setAttribute('y', e.clientY - drag.rect.top - 10);
  }
  function dragEnd(e) {
    window.removeEventListener('pointermove', dragMove);
    if (!drag.moved) return;
    drag.suppressClick = true;
    [drag.ghost, drag.line, drag.tip].forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    var t = A.taskByUid(drag.uid), r = drag.r, cal = S.s.cal, days = Math.round((e.clientX - drag.x0) / S._gantt.ppd);
    if (drag.mode === 'link') {
      var over = document.elementFromPoint(e.clientX, e.clientY), target = over && over.closest('.gbar');
      var tu = target && +target.dataset.uid;
      if (!tu || tu === drag.uid) return;
      var tt = A.taskByUid(tu);
      if (tt.preds.some(function (l) { return l.uid === drag.uid; })) { A.toast('Those tasks are already linked.'); return; }
      var trial = U.clone(S.p);
      trial.tasks.forEach(function (x) { if (x.uid === tu) x.preds.push({ uid: drag.uid, type: 'FS', lag: 0 }); });
      if (OP.schedule(trial).cycle.length) { A.toast('That link would create a dependency loop.', true); return; }
      A.commit(function () { tt.preds.push({ uid: drag.uid, type: 'FS', lag: 0 }); });
      A.toast('Linked ' + r.id + ' → ' + A.rowByUid(tu).id + ' (finish-to-start)');
    } else if (drag.mode === 'move') {
      if (!days) return;
      var ns = cal.date(cal.indexOf(r.startDn + days));
      A.commit(function () {
        if (t.actualStart) t.actualStart = U.iso(ns);
        else { t.constraint = 'SNET'; t.constraintDate = U.iso(ns); }
      });
      A.toast(t.actualStart ? 'Actual start moved to ' + U.fmt(ns) : 'Start no earlier than ' + U.fmt(ns));
    } else {
      if (!days) return;
      var nf = Math.max(r.startDn, r.finishDn + days);
      var gapsDays = (t.splits || []).reduce(function (a, sp) { return a + (+sp.gap || 0); }, 0);
      var nd = Math.max(1, cal.finishIndex(nf) - cal.indexOf(r.startDn) - gapsDays);
      A.commit(function () { ops.setDuration(t, nd); });
    }
  }

  /* ---------- cell editing ---------- */

  function commitCell(inp) {
    var f = inp.dataset.f, v = inp.value;
    if (f === 'new') {
      if (!v.trim()) return;
      inp.value = '';
      var p = S.p, last = p.tasks[p.tasks.length - 1];
      var lvl = last ? (M.isSummary(p, p.tasks.length - 1) ? last.level + 1 : last.level) : 1;
      S.pendingFocus = 'new';
      A.commit(function (pp) { var t = M.newTask(pp, { name: v.trim(), level: lvl }); pp.tasks.push(t); S.sel = [t.uid]; });
      return;
    }
    var u = +inp.dataset.uid, t = A.taskByUid(u), r = A.rowByUid(u);
    if (!t) return;
    var c = col(f);
    if (f === 'name') A.commit(function () { t.name = v; });
    else if (f === 'preds') setPreds(t, v, inp);
    else if (f === 'duration') {
      var d = M.parseDuration(v, S.p.hoursPerDay);
      if (d == null) { A.toast('Enter a duration like 5, 5d, 2w or 16h.', true); inp.value = M.fmtDuration(r.duration); return; }
      if (!A.commit(function () { ops.setDuration(t, d); })) inp.value = M.fmtDuration(r.duration);
    } else if (f === 'work') {
      var hrs = parseFloat(String(v).replace(/[^\d.]/g, ''));
      if (!isFinite(hrs)) { A.toast('Enter work in hours, e.g. 40.', true); inp.value = U.num(r.work) + 'h'; return; }
      var err = '';
      A.commit(function () { err = ops.setWork(t, hrs); if (err) return false; });
      if (err) { A.toast(err, true); inp.value = U.num(r.work) + 'h'; }
    } else if (f === 'percent') {
      setPercent(t, r, Math.max(0, Math.min(100, Math.round(parseFloat(v) || 0))));
    } else if (c && c.edit === 'number') {
      A.commit(function () { t[c.field] = Math.max(0, +String(v).replace(/[^\d.-]/g, '') || 0); if (c.field === 'priority') t.priority = Math.min(1000, Math.round(t.priority)); });
    } else if (c && (c.edit === 'date' || c.edit === 'select' || c.edit === 'text')) {
      A.commit(function () {
        t[c.field] = v;
        if (c.field === 'constraint' && (v === 'ASAP' || v === 'ALAP')) t.constraintDate = '';
        if (c.field === 'constraint' && v !== 'ASAP' && v !== 'ALAP' && !t.constraintDate) t.constraintDate = U.iso(r.startDn);
        if (c.field === 'constraintDate' && v && t.constraint === 'ASAP') t.constraint = 'SNET';
        if (c.field === 'actualFinish' && v) { t.percent = 100; if (!t.actualStart) t.actualStart = U.iso(r.startDn); }
      });
    } else if (c && c.cf) {
      A.commit(function () { t.custom[c.cf] = c.edit === 'cfnum' ? (v === '' ? '' : +v || 0) : v; });
    }
  }

  function setPercent(t, r, v) {
    A.commit(function () {
      t.percent = v;
      if (v > 0 && !t.actualStart) t.actualStart = U.iso(r.startDn);
      if (v >= 100 && !t.actualFinish) t.actualFinish = U.iso(r.finishDn);
      if (v < 100) t.actualFinish = '';
      if (v === 0) t.actualStart = '';
    });
  }

  function setPreds(t, text, inp) {
    var res = M.parsePreds(S.p, text, t.uid);
    if (res.errors.length) {
      A.toast('Could not read "' + res.errors.join(', ') + '". Use task IDs, e.g. 3, 5SS+2d, 7FF.', true);
      if (inp) inp.value = M.formatPreds(S.p, t);
      return;
    }
    var trial = U.clone(S.p);
    trial.tasks.forEach(function (x) { if (x.uid === t.uid) x.preds = res.preds; });
    if (OP.schedule(trial).cycle.length) {
      A.toast('That link would create a dependency loop.', true);
      if (inp) inp.value = M.formatPreds(S.p, t);
      return;
    }
    A.commit(function () { t.preds = res.preds; });
  }
  ops.setPreds = setPreds;

  function gridKeys(e) {
    var inp = e.target;
    if (!inp.classList || !inp.classList.contains('cell') || inp.tagName === 'SELECT' || inp.type === 'date') return;
    var f = inp.dataset.f;
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (f === 'new') { if (e.key === 'Enter') { e.preventDefault(); commitCell(inp); } return; }
      e.preventDefault();
      var rows = taskRows().map(function (r) { return r.task.uid; });
      var i = rows.indexOf(+inp.dataset.uid) + (e.key === 'ArrowUp' ? -1 : 1);
      var target = i >= rows.length ? 'new' : i < 0 ? null : rows[i] + ':' + f;
      if (!target) return;
      S.pendingFocus = target;
      if (inp.value !== inp.defaultValue) commitCell(inp);
      if (S.pendingFocus) {
        var el = document.querySelector('[data-fk="' + S.pendingFocus + '"]') || document.querySelector('[data-fk="new"]');
        S.pendingFocus = null;
        if (el) { el.focus(); if (el.select) el.select(); }
      }
    } else if (e.key === 'Escape') {
      inp.value = inp.defaultValue;
      inp.blur();
    }
  }

  /* ---------- task commands ---------- */

  function addTask(milestone) {
    var ids = selIndexes(), p = S.p, pos, lvl;
    if (ids.length) {
      var i = ids[ids.length - 1];
      if (M.isSummary(p, i) && !S.collapsed[p.tasks[i].uid]) { pos = i + 1; lvl = p.tasks[i].level + 1; }
      else { pos = M.subtreeEnd(p, i); lvl = p.tasks[i].level; }
    } else {
      pos = p.tasks.length;
      lvl = pos ? p.tasks[pos - 1].level : 1;
    }
    A.commit(function (pp) {
      var t = M.newTask(pp, { name: milestone ? 'New milestone' : 'New task', level: lvl, duration: milestone ? 0 : 1, milestone: !!milestone });
      pp.tasks.splice(pos, 0, t);
      S.sel = [t.uid]; S.anchor = t.uid;
      S.pendingFocus = t.uid + ':name';
    });
    if (S.filter !== 'all' || S.group !== 'none') { S.filter = 'all'; S.group = 'none'; A.saveUI(); }
  }

  // Top-most selected tasks (children of a selected summary move with it).
  function selectedBlocks() {
    var ids = selIndexes(), out = [], coveredTo = -1;
    ids.forEach(function (i) {
      if (i < coveredTo) return;
      out.push(i);
      coveredTo = M.subtreeEnd(S.p, i);
    });
    return out;
  }

  function indent(dir) {
    A.commit(function (p) {
      selectedBlocks().forEach(function (i) {
        var end = M.subtreeEnd(p, i), t = p.tasks[i];
        if (dir > 0 && (i === 0 || t.level > p.tasks[i - 1].level)) return;
        if (dir < 0 && t.level <= 1) return;
        for (var k = i; k < end; k++) p.tasks[k].level += dir;
      });
      M.normalizeLevels(p);
    });
  }

  function move(dir) {
    var blocks = selectedBlocks();
    if (blocks.length !== 1) { A.toast('Select one task (or one summary) to move.'); return; }
    A.commit(function (p) {
      var i = blocks[0], end = M.subtreeEnd(p, i), lv = p.tasks[i].level, block, k;
      if (dir < 0) {
        for (k = i - 1; k >= 0 && p.tasks[k].level > lv; k--);
        if (k < 0 || p.tasks[k].level !== lv) return false;
        block = p.tasks.splice(i, end - i);
        Array.prototype.splice.apply(p.tasks, [k, 0].concat(block));
      } else {
        if (end >= p.tasks.length || p.tasks[end].level !== lv) return false;
        var end2 = M.subtreeEnd(p, end);
        block = p.tasks.splice(i, end - i);
        Array.prototype.splice.apply(p.tasks, [end2 - block.length, 0].concat(block));
      }
    });
  }

  function linkSelected() {
    var ids = selIndexes();
    if (ids.length < 2) return;
    var trial = U.clone(S.p);
    for (var k = 1; k < ids.length; k++) {
      var a = trial.tasks[ids[k - 1]], b = trial.tasks[ids[k]];
      if (!b.preds.some(function (l) { return l.uid === a.uid; })) b.preds.push({ uid: a.uid, type: 'FS', lag: 0 });
    }
    if (OP.schedule(trial).cycle.length) { A.toast('Linking these tasks would create a dependency loop.', true); return; }
    A.commit(function (p) { p.tasks = trial.tasks; });
  }

  function unlinkSelected() {
    var set = {};
    S.sel.forEach(function (u) { set[u] = true; });
    A.commit(function (p) {
      p.tasks.forEach(function (t) {
        if (S.sel.length === 1 && set[t.uid]) t.preds = [];
        else if (set[t.uid]) t.preds = t.preds.filter(function (l) { return !set[l.uid]; });
      });
    });
  }

  function deleteSelected() {
    var blocks = selectedBlocks();
    if (!blocks.length) return;
    var uids = [];
    blocks.forEach(function (i) { for (var k = i; k < M.subtreeEnd(S.p, i); k++) uids.push(S.p.tasks[k].uid); });
    if (uids.length > 1 && !confirm('Delete ' + uids.length + ' tasks (including subtasks)?')) return;
    A.commit(function (p) { M.removeTasks(p, uids); S.sel = []; });
  }

  function markPercent(v) {
    var rows = S.sel.map(A.rowByUid).filter(function (r) { return r && !r.summary; });
    if (!rows.length) { A.toast('Select tasks first (summaries are updated from their subtasks).'); return; }
    A.commit(function () {
      rows.forEach(function (r) {
        var t = r.task;
        t.percent = v;
        if (v > 0 && !t.actualStart) t.actualStart = U.iso(r.startDn);
        if (v >= 100) { if (!t.actualFinish) t.actualFinish = U.iso(r.finishDn); } else t.actualFinish = '';
        if (v === 0) t.actualStart = '';
      });
    });
  }

  // Set progress on every task to what the plan says should be done by the status date.
  function updateAsScheduled() {
    var s = S.s, cal = s.cal, statusIdx = cal.finishIndex(s.statusDn), n = 0;
    A.commit(function () {
      s.rows.forEach(function (r) {
        if (r.summary) return;
        var t = r.task, sp = r.ef - r.es;
        var pct = sp > 0 ? Math.max(0, Math.min(1, (statusIdx - r.es) / sp)) : (statusIdx >= r.es ? 1 : 0);
        pct = Math.round(pct * 100);
        if (pct <= (+t.percent || 0)) return;
        t.percent = pct; n++;
        if (!t.actualStart) t.actualStart = U.iso(r.startDn);
        if (pct >= 100 && !t.actualFinish) t.actualFinish = U.iso(r.finishDn);
      });
    });
    A.toast(n ? 'Updated ' + n + ' tasks to ' + U.fmt(s.statusDn) : 'Nothing to update — tasks are already at or ahead of the status date.');
  }

  function recurringDialog() {
    var st = S.s.startDn;
    A.openDialog(A.dlgHead('Recurring task') + '<div class="dlg-body">' +
      A.field('Task name', 'name', 'Sprint review', 'text', ' required') +
      '<div class="row3">' + A.field('Duration (days)', 'duration', 1, 'number', ' min="0" step="0.5"') +
      A.field('First occurrence', 'first', U.iso(st), 'date', ' required') + A.field('Occurrences', 'count', 4, 'number', ' min="1" max="104"') + '</div>' +
      '<div class="row2"><label class="field"><span>Repeat</span><select class="sel" name="unit"><option value="week">Weekly</option><option value="month">Monthly</option><option value="day">Daily (working days)</option></select></label>' +
      A.field('Every', 'every', 2, 'number', ' min="1" max="52"') + '</div>' +
      '<p class="muted small">Creates a summary task with one subtask per occurrence, each fixed with a “Start no earlier than” date.</p>' +
      '</div>' + A.dlgFoot('Create'),
    function (form) {
      var fd = new FormData(form), name = String(fd.get('name')).trim(), first = U.parseDate(String(fd.get('first')));
      var count = Math.max(1, Math.min(104, +fd.get('count') || 1)), every = Math.max(1, +fd.get('every') || 1), unit = fd.get('unit');
      var d = Math.max(0, +fd.get('duration') || 0), cal = S.s.cal;
      if (!name || first == null) return false;
      var ids = selIndexes(), pos = ids.length ? M.subtreeEnd(S.p, ids[ids.length - 1]) : S.p.tasks.length;
      var lvl = ids.length ? S.p.tasks[ids[ids.length - 1]].level : 1;
      A.commit(function (p) {
        var head = M.newTask(p, { name: name, level: lvl, notes: 'Recurring: every ' + every + ' ' + unit + (every > 1 ? 's' : '') + ', ' + count + ' times' });
        var list = [head];
        for (var k = 0; k < count; k++) {
          var dn;
          if (unit === 'week') dn = first + k * 7 * every;
          else if (unit === 'day') dn = cal.date(cal.indexOf(first) + k * every);
          else { var dt = U.toDate(first); dn = Math.round(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + k * every, dt.getUTCDate()) / 864e5); }
          list.push(M.newTask(p, { name: name + ' ' + (k + 1), level: lvl + 1, duration: d, milestone: d === 0, constraint: 'SNET', constraintDate: U.iso(dn) }));
        }
        Array.prototype.splice.apply(p.tasks, [pos, 0].concat(list));
        S.sel = [head.uid];
      });
    });
  }

  function bind() {
    var NEEDS_GRID = { add: 1, addMs: 1, recur: 1, indent: 1, outdent: 1, up: 1, down: 1, goto: 1, showConflicts: 1, clearFilter: 1 };
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-gt]');
      if (!t || t.disabled) return;
      var k = t.dataset.gt;
      if (NEEDS_GRID[k] && S.view !== 'gantt') { S.view = 'gantt'; A.saveUI(); A.render(); }
      if (k === 'add') addTask(false);
      else if (k === 'addMs') addTask(true);
      else if (k === 'recur') recurringDialog();
      else if (k === 'indent') indent(1);
      else if (k === 'outdent') indent(-1);
      else if (k === 'up') move(-1);
      else if (k === 'down') move(1);
      else if (k === 'link') linkSelected();
      else if (k === 'unlink') unlinkSelected();
      else if (k === 'del') deleteSelected();
      else if (k === 'drawer') { S.drawer = !S.drawer; A.saveUI(); A.render(); }
      else if (k === 'assign') {
        if (S.sel.length !== 1) { A.toast('Select one task first, then choose Assign Resources.'); return; }
        if (['gantt', 'network', 'wbs'].indexOf(S.view) < 0) S.view = 'gantt';
        S.drawer = true; A.saveUI(); A.render();
        var ar = $('#drawer [data-fk="d:addres"]'); if (ar) ar.focus();
      }
      else if (k === 'clearFilter') { S.filter = 'all'; S.group = 'none'; A.saveUI(); A.render(); }
      else if (k === 'goto') gotoSelected();
      else if (k === 'baseline') {
        if (S.p.baseline && !confirm('Replace the existing baseline with the current plan?')) return;
        S.showBaseline = true; A.saveUI();
        A.commit(function (p) { OP.setBaseline(p); if (p.status === 'Draft') p.status = 'Baselined'; });
        A.toast('Baseline saved — variances and earned value are now measured against it');
      }
      else if (k === 'clearBaseline') { if (confirm('Clear the baseline?')) A.commit(function (p) { p.baseline = null; }); }
      else if (k === 'asScheduled') updateAsScheduled();
      else if (k === 'pct') markPercent(+t.dataset.v);
      else if (k === 'level') {
        var res;
        A.commit(function (p) { res = OP.level(p); });
        if (!res || (!res.moved && !res.unresolved.length)) A.toast('No overallocations to level.');
        else A.toast(res.unresolved.length ? 'Leveled ' + res.moved + ' tasks. Still overallocated (assigned above max units): ' + res.unresolved.join(', ') : 'Leveled — delayed ' + res.moved + ' task' + (res.moved === 1 ? '' : 's'), !!res.unresolved.length);
      }
      else if (k === 'clearLevel') A.commit(function (p) { p.tasks.forEach(function (x) { x.levelDelay = 0; }); });
      else if (k === 'resetCols') { S.cols = A.DEFAULT_COLS.slice(); A.saveUI(); A.render(); }
      else if (k === 'showConflicts') { S.filter = 'conflicts'; A.saveUI(); A.render(); }
    });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.dataset.col) {
        var c = el.dataset.col, i = S.cols.indexOf(c);
        if (el.checked && i < 0) {
          var order = ['id', 'ind', 'name'].concat(COL_GROUPS.reduce(function (a, g) { return a.concat(g[1]); }, []));
          S.cols.push(c);
          S.cols.sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); });
        } else if (!el.checked && i >= 0) S.cols.splice(i, 1);
        A.saveUI();
        var keepOpen = $('#colMenu') && $('#colMenu').classList.contains('open');
        A.render();
        if (keepOpen) $('#colMenu').classList.add('open');
        return;
      }
      var gs = el.dataset.gsel;
      if (!gs) return;
      if (gs === 'critical' || gs === 'showBaseline') S[gs] = el.checked;
      else S[gs] = el.value;
      A.saveUI();
      A.render();
    });
  }

  function keydown(e, editing) {
    if (e.altKey && e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      if (editing && document.activeElement.dataset.uid) S.pendingFocus = document.activeElement.dataset.fk;
      indent(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (editing) return;
    if (e.key === 'Delete') { e.preventDefault(); deleteSelected(); }
    else if (e.key === 'Insert') { e.preventDefault(); addTask(false); }
  }

  function gotoSelected() {
    var cp = $('#chartPane'), g = S._gantt;
    if (!cp || !g) return;
    var r = S.sel.length ? A.rowByUid(S.sel[0]) : null;
    cp.scrollLeft = Math.max(0, g.X(r ? r.startDn : S.s.startDn) - 60);
  }

  function svg() {
    var str = C.gantt({ p: S.p, s: S.s, rows: items(), zoom: S.zoom, critical: S.critical, table: true, flat: S.group !== 'none', baseline: S.showBaseline && !!S.p.baseline }).svg;
    return new DOMParser().parseFromString(str, 'image/svg+xml').documentElement;
  }

  OP.views.gantt = { render: render, bind: bind, selectionChanged: selectionChanged, keydown: keydown, svg: svg, renderChart: renderChart };
  OP.gantt = { items: items, setPercent: setPercent, FILTERS: FILTERS, menuData: menuData };
})();
