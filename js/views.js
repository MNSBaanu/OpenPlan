/* Network, WBS, Resources, Team chart, Workload and Budget views. */
(function () {
  var U = OP.util, M = OP.model, C = OP.charts, A = OP.app, S = A.S, esc = U.esc, icon = A.icon, $ = A.$, $$ = A.$$;
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* ---------- shared canvas helpers ---------- */

  function placeSvg(box, svg) {
    box.innerHTML = svg;
    var el = box.querySelector('svg');
    el.dataset.w = el.getAttribute('width'); el.dataset.h = el.getAttribute('height');
    applyZoom(el, S.netZoom);
  }
  function applyZoom(el, z) {
    el.setAttribute('width', Math.round(el.dataset.w * z));
    el.setAttribute('height', Math.round(el.dataset.h * z));
  }
  function zoomCanvas(kind) {
    var el = $('#canvas svg');
    if (!el) return;
    if (kind === 'fit') {
      var box = $('#canvas');
      S.netZoom = Math.min(1.5, Math.max(0.2, Math.min((box.clientWidth - 4) / el.dataset.w, (box.clientHeight - 4) / el.dataset.h)));
    } else S.netZoom = Math.max(0.2, Math.min(2.5, S.netZoom * (kind === 'in' ? 1.2 : 1 / 1.2)));
    applyZoom(el, S.netZoom);
  }
  function canvasSvg() {
    var el = $('#canvas svg');
    if (!el) return null;
    var c = el.cloneNode(true);
    c.setAttribute('width', el.dataset.w); c.setAttribute('height', el.dataset.h);
    return c;
  }
  function zoomTools() {
    return A.tb('zout', 'zout', 'Zoom out') + A.tb('zfit', 'fit', 'Fit to window') + A.tb('zin', 'zin', 'Zoom in') +
      '<button class="btn" data-act="png">' + icon('image') + 'PNG</button>';
  }
  function selectNode(uid) {
    A.setSelection([uid], uid);
    if (!S.drawer) { S.drawer = true; A.saveUI(); OP.drawer.render(); }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button[data-tb]');
    if (!t || t.disabled) return;
    var k = t.dataset.tb;
    if (k === 'zin') zoomCanvas('in');
    else if (k === 'zout') zoomCanvas('out');
    else if (k === 'zfit') zoomCanvas('fit');
    else if (k === 'netdays' || k === 'netdates') { S.netDates = k === 'netdates'; A.saveUI(); A.render(); }
    else if (k === 'addres') addResource();
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.tb === 'crit') { S.critical = el.checked; A.saveUI(); A.render(); }
    if (el.dataset && el.dataset.tb === 'scope') { S.netScope = el.value; S.netZoom = 1; A.render(); }
  });

  /* ---------- Network ---------- */

  function scopeRows() {
    if (S.netScope === 'all') return S.s.rows;
    var r = A.rowByUid(+S.netScope);
    if (!r) { S.netScope = 'all'; return S.s.rows; }
    return r.leaves.map(function (i) { return S.s.rows[i]; });
  }

  OP.views.network = {
    svg: canvasSvg,
    render: function () {
      var tops = S.s.rows.filter(function (r) { return r.summary && r.task.level === 1; });
      var h = ['<div class="view">', A.head('Network diagram', 'Activity-on-node with ES, EF, LS, LF and total slack')];
      h.push('<div class="toolbar"><select class="sel" data-tb="scope" aria-label="Scope"><option value="all">All tasks</option>' +
        tops.map(function (r) { return '<option value="' + r.task.uid + '"' + (String(S.netScope) === String(r.task.uid) ? ' selected' : '') + '>' + r.wbs + ' ' + esc(r.task.name) + '</option>'; }).join('') + '</select>' +
        '<div class="seg"><button data-tb="netdays" class="' + (!S.netDates ? 'on' : '') + '">Day numbers</button><button data-tb="netdates" class="' + (S.netDates ? 'on' : '') + '">Dates</button></div>' +
        '<label class="toggle"><input type="checkbox" data-tb="crit"' + (S.critical ? ' checked' : '') + '>Critical path</label>' +
        '<span class="spacer"></span>' + zoomTools() + '</div>');
      h.push(S.s.rows.length ? '<div class="canvas" id="canvas"></div>' : '<div class="canvas"><div class="empty"><h3>Nothing to show</h3><div>Add tasks in the Gantt view first.</div></div></div>');
      h.push('</div>');
      $('#main').innerHTML = h.join('');
      if (!S.s.rows.length) return;
      var sr = S.netScope === 'all' ? null : A.rowByUid(+S.netScope);
      var title = sr ? sr.wbs + ' ' + sr.task.name : S.p.name + ' — activity network';
      placeSvg($('#canvas'), C.network({ p: S.p, s: S.s, rows: scopeRows(), critical: S.critical, dates: S.netDates, title: title }).svg);
      $('#canvas').addEventListener('click', function (e) { var g = e.target.closest('.nnode'); if (g) selectNode(+g.dataset.uid); });
    }
  };

  /* ---------- WBS ---------- */

  OP.views.wbs = {
    svg: canvasSvg,
    render: function () {
      var maxLv = S.s.rows.reduce(function (a, r) { return Math.max(a, r.task.level); }, 1);
      var h = ['<div class="view">', A.head('Work breakdown structure', S.s.rows.length + ' work items · ' + S.s.rows.filter(function (r) { return r.task.level === 1; }).length + ' top-level packages')];
      h.push('<div class="toolbar"><span class="muted">Show levels</span><div class="seg">');
      for (var l = 2; l <= Math.max(2, maxLv); l++) h.push('<button data-depth="' + l + '" class="' + (Math.min(S.wbsDepth, maxLv) === l ? 'on' : '') + '">' + l + '</button>');
      h.push('</div><span class="spacer"></span>' + zoomTools() + '</div>');
      h.push(S.s.rows.length ? '<div class="canvas" id="canvas"></div>' : '<div class="canvas"><div class="empty"><h3>No work items yet</h3><div>Build your task outline in the Gantt view; indented tasks become WBS levels.</div></div></div>');
      h.push('</div>');
      $('#main').innerHTML = h.join('');
      if (!S.s.rows.length) return;
      placeSvg($('#canvas'), C.wbs({ p: S.p, s: S.s, depth: S.wbsDepth }).svg);
      $('#canvas').addEventListener('click', function (e) { var g = e.target.closest('.wnode'); if (g) selectNode(+g.dataset.uid); });
    },
    bind: function () {
      document.addEventListener('click', function (e) {
        var dp = e.target.closest('[data-depth]');
        if (dp) { S.wbsDepth = +dp.dataset.depth; A.saveUI(); A.render(); }
      });
    }
  };

  /* ---------- Resources ---------- */

  function addResource() {
    A.commit(function (p) {
      var r = M.newResource(p, { name: '', type: 'Full-time', reportsTo: p.resources.length ? p.resources[0].uid : null });
      p.resources.push(r);
      S.pendingFocus = 'r' + r.uid + ':name';
    });
  }

  function resourceDialog(r) {
    var rates = (r.rates || []).map(function (e) { return e.from + ' ' + e.rate; }).join('\n');
    var days = [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      return '<label class="chk"><input type="checkbox" name="wd" value="' + d + '"' + (r.workDays.indexOf(d) >= 0 ? ' checked' : '') + '>' + DAY_NAMES[d] + '</label>';
    }).join('');
    A.openDialog(A.dlgHead(r.name || 'Resource') + '<div class="dlg-body">' +
      (r.kind === 'Work'
        ? '<label class="field"><span>Working days</span><div class="chk-row">' + days + '</div></label>' +
          '<label class="field"><span>Vacations / days off (one date per line, YYYY-MM-DD)</span><textarea class="inp" name="vacations" rows="3">' + esc(r.vacations.join('\n')) + '</textarea></label>' +
          '<label class="field"><span>Rate changes (one per line: effective date and new hourly rate)</span><textarea class="inp" name="rates" rows="3" placeholder="2026-04-01 8500">' + esc(rates) + '</textarea></label>' +
          '<p class="muted small">Working days and vacations set when this person is available: they drive overallocation warnings and resource leveling.</p>'
        : '') +
      (r.kind === 'Material' ? A.field('Material label (unit)', 'materialLabel', r.materialLabel, 'text', ' placeholder="e.g. licences, servers"') : '') +
      (r.kind !== 'Cost' ? A.field('Cost per use (' + esc(S.p.currency) + ')', 'costPerUse', r.costPerUse, 'number', ' min="0" step="100"') : '<p class="muted">Cost resources (travel, licences, fees) have no rate: enter the amount on each task assignment.</p>') +
      '</div>' + A.dlgFoot(),
    function (form) {
      var fd = new FormData(form), bad = [];
      var vac = A.parseDates(fd.get('vacations'), bad);
      var rateList = [];
      String(fd.get('rates') || '').split('\n').forEach(function (line) {
        var m = /^\s*(\d{4}-\d{2}-\d{2})[\s,;]+(\d+(?:\.\d+)?)\s*$/.exec(line);
        if (m) rateList.push({ from: m[1], rate: +m[2] });
        else if (line.trim()) bad.push(line.trim());
      });
      if (bad.length) A.toast('Ignored: ' + bad.join(', '), true);
      A.commit(function () {
        if (r.kind === 'Work') {
          r.workDays = fd.getAll('wd').map(Number).sort();
          r.vacations = vac;
          r.rates = rateList.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
        }
        if (r.kind === 'Material') r.materialLabel = String(fd.get('materialLabel') || '');
        if (r.kind !== 'Cost') r.costPerUse = Math.max(0, +fd.get('costPerUse') || 0);
      });
    });
  }

  OP.views.resources = {
    add: addResource,
    render: function () {
      var p = S.p, st = S.s.resStats, cur = p.currency, counts = {};
      p.resources.forEach(function (r) { counts[r.type] = (counts[r.type] || 0) + 1; });
      var h = ['<div class="view">', A.head('Resources', M.RES_TYPES.filter(function (t) { return counts[t]; }).map(function (t) { return counts[t] + ' ' + t.toLowerCase(); }).join(' · ') || 'Team members, materials and costs')];
      h.push('<div class="toolbar"><button class="btn primary" data-tb="addres">' + icon('plus') + 'Add resource</button><span class="spacer"></span>' +
        '<span class="muted small">Work = people (rate per hour) · Material = consumables (price per unit) · Cost = fixed amounts per task.</span></div>');
      h.push('<div class="scroll"><div class="card tbl">');
      if (!p.resources.length) {
        h.push('<div class="empty"><h3>No resources yet</h3><div>Add the people on your team, with their role, availability and hourly rate.</div></div>');
      } else {
        h.push('<table class="data"><thead><tr><th style="min-width:170px">Name</th><th style="width:70px">Initials</th><th style="min-width:140px">Role</th><th style="width:106px">Kind</th><th style="width:118px">Type</th>' +
          '<th class="num" style="width:80px">Max %</th><th class="num" style="width:110px">Rate (' + esc(cur) + ')</th><th style="min-width:140px">Reports to</th>' +
          '<th class="num">Work</th><th class="num">Cost</th><th class="num">Peak</th><th>Status</th><th></th></tr></thead><tbody>');
        p.resources.forEach(function (r) {
          var s = st[r.uid] || { work: 0, cost: 0, peak: 0 }, work = r.kind === 'Work';
          var status = s.over ? '<span class="chip bad">' + icon('alert') + 'Overallocated</span>'
            : (s.work || s.cost) ? '<span class="chip good">' + icon('check') + 'OK</span>' : '<span class="chip">Unassigned</span>';
          var extra = [];
          if (work && r.workDays.join() !== '1,2,3,4,5') extra.push(r.workDays.map(function (d) { return DAY_NAMES[d]; }).join(' '));
          if (work && r.vacations.length) extra.push(r.vacations.length + ' day' + (r.vacations.length > 1 ? 's' : '') + ' off');
          if (work && r.rates.length) extra.push(r.rates.length + ' rate change' + (r.rates.length > 1 ? 's' : ''));
          h.push('<tr data-ruid="' + r.uid + '">' +
            '<td><input class="inp" data-r="name" data-fk="r' + r.uid + ':name" value="' + esc(r.name) + '" placeholder="Name">' + (extra.length ? '<div class="muted small sub-note">' + esc(extra.join(' · ')) + '</div>' : '') + '</td>' +
            '<td><input class="inp" data-r="initials" data-fk="r' + r.uid + ':initials" value="' + esc(r.initials) + '"></td>' +
            '<td><input class="inp" data-r="role" data-fk="r' + r.uid + ':role" value="' + esc(r.role) + '" placeholder="e.g. Developer"></td>' +
            '<td><select class="sel" data-r="kind">' + M.RES_KINDS.map(function (k) { return '<option' + (k === r.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></td>' +
            '<td><select class="sel" data-r="type"' + (work ? '' : ' disabled') + '>' + M.RES_TYPES.map(function (t) { return '<option' + (t === r.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></td>' +
            '<td>' + (work ? '<input class="inp" type="number" min="1" max="1000" step="5" data-r="maxUnits" data-fk="r' + r.uid + ':max" value="' + r.maxUnits + '">' : '') + '</td>' +
            '<td>' + (r.kind !== 'Cost' ? '<input class="inp" type="number" min="0" step="100" data-r="rate" data-fk="r' + r.uid + ':rate" value="' + r.rate + '" title="' + (work ? 'Per hour' : 'Per unit') + '">' : '') + '</td>' +
            '<td>' + (work ? '<select class="sel" data-r="reportsTo"><option value="">—</option>' + p.resources.filter(function (o) { return o.uid !== r.uid && o.kind === 'Work'; }).map(function (o) {
              return '<option value="' + o.uid + '"' + (o.uid === r.reportsTo ? ' selected' : '') + '>' + esc(o.name || '(unnamed)') + '</option>';
            }).join('') + '</select>' : '') + '</td>' +
            '<td class="num">' + (work ? U.num(s.work) + 'h' : r.kind === 'Material' ? U.num(s.qty) + ' ' + esc(r.materialLabel) : '') + '</td><td class="num">' + U.money(s.cost) + '</td>' +
            '<td class="num">' + (work ? Math.round(s.peak) + '%' : '') + '</td><td>' + status + '</td>' +
            '<td class="nowrap"><button class="icon-btn" data-rdet="' + r.uid + '" title="Calendar, rates and cost per use" aria-label="Resource details">' + icon('settings') + '</button>' +
            '<button class="icon-btn" data-rdel="' + r.uid + '" title="Delete resource" aria-label="Delete resource">' + icon('trash') + '</button></td></tr>');
        });
        h.push('</tbody><tfoot><tr><td colspan="8">Total</td><td class="num">' + U.num(S.s.totalWork) + 'h</td><td class="num">' + U.money(S.s.totalCost, cur) + '</td><td colspan="3"></td></tr></tfoot></table>');
      }
      h.push('</div></div></div>');
      $('#main').innerHTML = h.join('');
    },
    bind: function () {
      document.addEventListener('change', function (e) {
        var el = e.target, tr = el.closest && el.closest('[data-ruid]');
        if (!tr || !el.dataset.r || S.view !== 'resources') return;
        var r = A.resByUid(+tr.dataset.ruid), f = el.dataset.r;
        A.commit(function () {
          if (f === 'maxUnits') r.maxUnits = Math.max(1, Math.round(+el.value || 100));
          else if (f === 'rate') r.rate = Math.max(0, +el.value || 0);
          else if (f === 'reportsTo') r.reportsTo = el.value ? +el.value : null;
          else if (f === 'kind') {
            r.kind = el.value;
            S.p.tasks.forEach(function (t) {
              t.assignments.forEach(function (a) { if (a.res === r.uid) a.units = r.kind === 'Work' ? 100 : r.kind === 'Material' ? 1 : 0; });
            });
          } else {
            r[f] = el.value;
            if (f === 'name' && !r.initials) r.initials = M.initials(el.value);
          }
        });
      });
      document.addEventListener('click', function (e) {
        if (S.view !== 'resources') return;
        var det = e.target.closest('[data-rdet]');
        if (det) { resourceDialog(A.resByUid(+det.dataset.rdet)); return; }
        var b = e.target.closest('[data-rdel]');
        if (!b) return;
        var u = +b.dataset.rdel, r = A.resByUid(u);
        var used = S.p.tasks.some(function (t) { return t.assignments.some(function (a) { return a.res === u; }); });
        if (used && !confirm('Remove ' + (r.name || 'this resource') + ' and all their task assignments?')) return;
        A.commit(function (p) {
          p.resources = p.resources.filter(function (x) { return x.uid !== u; });
          p.resources.forEach(function (x) { if (x.reportsTo === u) x.reportsTo = null; });
          p.tasks.forEach(function (t) { t.assignments = t.assignments.filter(function (a) { return a.res !== u; }); });
        });
      });
    }
  };

  /* ---------- Team chart ---------- */

  OP.views.org = {
    svg: canvasSvg,
    render: function () {
      var people = S.p.resources.filter(function (r) { return r.kind === 'Work'; });
      var h = ['<div class="view">', A.head('Team structure', 'Built from each person’s “Reports to” field')];
      h.push('<div class="toolbar"><button class="btn" data-view-go="resources">' + icon('users') + 'Edit team</button><span class="spacer"></span>' + zoomTools() + '</div>');
      h.push(people.length ? '<div class="canvas" id="canvas"></div>' : '<div class="canvas"><div class="empty"><h3>No team members yet</h3><div>Add resources and set who each person reports to.</div></div></div>');
      h.push('</div>');
      $('#main').innerHTML = h.join('');
      if (people.length) placeSvg($('#canvas'), C.org({ p: { resources: people, currency: S.p.currency } }).svg);
    }
  };

  /* ---------- Workload ---------- */

  OP.views.workload = {
    render: function () {
      var p = S.p, s = S.s;
      var h = ['<div class="view">', A.head('Workload', 'Peak daily allocation per week — red cells exceed availability (max units, working days, vacations)')];
      h.push('<div class="toolbar"><div class="legend"><span><i style="background:color-mix(in srgb,var(--bar) 18%,var(--surface))"></i>Light</span>' +
        '<span><i style="background:color-mix(in srgb,var(--bar) 62%,var(--surface))"></i>Heavy</span>' +
        '<span><i style="background:var(--critical-soft);box-shadow:inset 0 0 0 1.5px var(--critical)"></i>Overallocated</span>' +
        '<span><i class="hatch"></i>Not available</span></div><span class="spacer"></span>' +
        '<button class="btn" data-view-go="gantt">' + icon('balance') + 'Level in Gantt › Level</button></div>');
      h.push('<div class="scroll">');
      var people = p.resources.filter(function (r) { return r.kind === 'Work'; });
      if (!people.length || !s.duration) {
        h.push('<div class="card"><div class="empty"><h3>No workload yet</h3><div>Assign people to tasks to see how busy each person is.</div></div></div>');
      } else {
        var weeks = [], wkIndex = {}, n = Math.ceil(s.duration);
        for (var d = 0; d < n; d++) {
          var dn = s.cal.date(d), wk = dn - ((U.weekday(dn) + 6) % 7);
          if (wkIndex[wk] == null) { wkIndex[wk] = weeks.length; weeks.push({ dn: wk, days: [] }); }
          weeks[wkIndex[wk]].days.push(d);
        }
        h.push('<div class="card tbl" style="padding:8px"><table class="heat"><thead><tr><th class="rh">Resource</th><th>Max</th>');
        weeks.forEach(function (w) { h.push('<th>' + U.fmt(w.dn).replace(/ \d+$/, '') + '</th>'); });
        h.push('</tr></thead><tbody>');
        people.forEach(function (r) {
          var L = s.load[r.uid] || {}, st = s.resStats[r.uid];
          h.push('<tr><td class="rh"><b>' + esc(r.name || '(unnamed)') + '</b> <span class="muted small">' + esc(r.role || r.type) + '</span></td><td class="muted small">' + r.maxUnits + '%</td>');
          weeks.forEach(function (w) {
            var peak = 0, over = false, avail = 0, tasks = {};
            w.days.forEach(function (dd) {
              var cap = st.capOn(dd), l = L[dd] || 0;
              if (cap > 0) avail++;
              if (l > peak) peak = l;
              if (l > cap + 1e-9) over = true;
              (s.contrib[r.uid][dd] || []).forEach(function (i) { var row = s.rows[i]; tasks[row.id + '. ' + row.task.name] = 1; });
            });
            var lvl = over ? 'over' : !peak ? (avail ? 'l0' : 'off') : peak / 100 <= 0.34 ? 'l1' : peak / 100 <= 0.67 ? 'l2' : 'l3';
            var title = U.fmt(w.dn) + ': peak ' + Math.round(peak) + '% (max ' + r.maxUnits + '%, ' + avail + ' available days)' + (Object.keys(tasks).length ? '\n' + Object.keys(tasks).join('\n') : '');
            h.push('<td class="' + lvl + '" title="' + esc(title) + '">' + (peak ? Math.round(peak) + '%' + (over ? ' !' : '') : lvl === 'off' ? 'off' : '–') + '</td>');
          });
          h.push('</tr>');
        });
        h.push('</tbody></table></div>');
      }
      h.push('</div></div>');
      $('#main').innerHTML = h.join('');
    }
  };

  /* ---------- Budget ---------- */

  function kpi(k, v, sub) { return '<div class="card kpi"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (sub || '') + '</div></div>'; }
  function ratio(v) { return v == null ? '—' : v.toFixed(2); }
  function health(v) {
    if (v == null) return '';
    return v >= 1 ? '<span class="chip good">' + icon('check') + 'On or better</span>' : v >= 0.9 ? '<span class="chip warn">' + icon('alert') + 'Slightly behind</span>' : '<span class="chip bad">' + icon('alert') + 'Behind</span>';
  }

  OP.views.budget = {
    render: function () {
      var p = S.p, s = S.s, cur = p.currency, budget = +p.budget || 0, cost = s.totalCost, ev = s.ev;
      var diff = budget - cost, pct = budget ? cost / budget * 100 : 0;
      var h = ['<div class="view">', A.head('Cost & budget', 'Hours × rate (with rate changes), cost per use, materials, cost resources and fixed costs')];
      h.push('<div class="toolbar"><button class="btn" data-act="settings">' + icon('settings') + 'Set budget &amp; status date</button></div><div class="scroll">');
      h.push('<div class="kpis">' +
        kpi('Budget', budget ? U.money(budget, cur) : 'Not set', budget ? '' : '<span class="muted">Set it in Project information</span>') +
        kpi('Planned cost', U.money(cost, cur), budget ? '<span class="muted">' + U.num(pct) + '% of budget</span>' : '') +
        kpi(diff >= 0 ? 'Remaining' : 'Over budget', U.money(Math.abs(diff), cur), budget ? (diff >= 0 ? '<span class="chip good">' + icon('check') + 'Within budget</span>' : '<span class="chip bad">' + icon('alert') + 'Over budget</span>') : '') +
        kpi('Duration', U.num(s.duration) + ' days', '<span class="muted">' + U.fmt(s.startDn) + ' → ' + U.fmt(s.finishDn) + '</span>') +
        kpi('Actual cost to date', U.money(s.rows.reduce(function (a, r) { return a + (r.summary ? 0 : r.actualCost); }, 0), cur), '<span class="muted">from % complete</span>') + '</div>');

      if (p.baseline) {
        h.push('<div class="section-h">Earned value <span class="muted small">at status date ' + U.fmt(s.statusDn) + (p.statusDate ? '' : ' (today — set a status date in Project information)') + '</span></div><div class="kpis">' +
          kpi('Planned value (BCWS)', U.money(ev.bcws, cur), '<span class="muted">BAC ' + U.money(ev.bac, cur) + '</span>') +
          kpi('Earned value (BCWP)', U.money(ev.bcwp, cur), '') +
          kpi('Actual cost (ACWP)', U.money(ev.acwp, cur), '') +
          kpi('Schedule index (SPI)', ratio(ev.spi), health(ev.spi) + ' <span class="muted small">SV ' + U.money(ev.sv) + '</span>') +
          kpi('Cost index (CPI)', ratio(ev.cpi), health(ev.cpi) + ' <span class="muted small">CV ' + U.money(ev.cv) + '</span>') +
          kpi('Estimate at completion', U.money(ev.eac, cur), '<span class="muted">VAC ' + U.money(ev.vac) + '</span>') + '</div>');
      } else {
        h.push('<div class="card note-card">' + icon('info') + '<div><b>Earned value</b> (SPI, CPI, EAC) needs a baseline. Choose <b>Project › Set Baseline</b>, then record progress with % complete.</div></div>');
      }

      var monthly = C.monthlyCost(p, s);
      if (monthly.length) {
        h.push('<div class="grid2"><div class="card"><h3>Monthly cost</h3><div class="card-sub">Planned spend per calendar month</div><div class="chart">' +
          C.costChart({ p: p, data: monthly, kind: 'monthly' }) + '</div></div>' +
          '<div class="card"><h3>Cumulative cost vs budget</h3><div class="card-sub">Dashed line = approved budget</div><div class="chart">' +
          C.costChart({ p: p, data: monthly, kind: 'cumulative' }) + '</div></div></div>');
      }

      var tops = s.rows.filter(function (r) { return r.task.level === 1; });
      var maxTop = Math.max.apply(null, tops.map(function (r) { return r.cost; }).concat([1]));
      h.push('<div class="grid2"><div class="card"><h3>Cost by work package</h3><div class="card-sub">Top-level WBS items</div><div class="tbl"><table class="data"><thead><tr><th>WBS</th><th>Package</th><th class="num">Work (h)</th><th class="num">Cost</th>' + (p.baseline ? '<th class="num">Baseline</th>' : '') + '<th style="width:28%"></th></tr></thead><tbody>');
      tops.forEach(function (r) {
        h.push('<tr><td>' + r.wbs + '</td><td>' + esc(r.task.name) + '<div class="muted small">' + U.fmt(r.startDn) + ' – ' + U.fmt(r.finishDn) + '</div></td><td class="num">' + U.num(r.work) + '</td><td class="num">' + U.money(r.cost) + '</td>' +
          (p.baseline ? '<td class="num">' + (r.base ? U.money(r.base.cost) : '') + '</td>' : '') +
          '<td><div class="barcell"><div class="hbar-track"><div class="hbar" style="width:' + (r.cost / maxTop * 100) + '%"></div></div><span class="muted small">' + (cost ? Math.round(r.cost / cost * 100) : 0) + '%</span></div></td></tr>');
      });
      h.push('</tbody><tfoot><tr><td colspan="2">Total</td><td class="num">' + U.num(s.totalWork) + '</td><td class="num">' + U.money(cost, cur) + '</td>' + (p.baseline ? '<td class="num">' + U.money(ev.bac) + '</td>' : '') + '<td></td></tr></tfoot></table></div></div>');

      var maxRes = Math.max.apply(null, p.resources.map(function (r) { return s.resStats[r.uid].cost; }).concat([1]));
      h.push('<div class="card"><h3>Cost by resource</h3><div class="card-sub">Grouped by type</div><div class="tbl"><table class="data"><thead><tr><th>Name</th><th>Kind</th><th class="num">Rate</th><th class="num">Hours / qty</th><th class="num">Cost</th><th style="width:24%"></th></tr></thead><tbody>');
      var groups = M.RES_TYPES.map(function (t) { return { label: t, list: p.resources.filter(function (r) { return r.kind === 'Work' && r.type === t; }) }; })
        .concat([{ label: 'Materials', list: p.resources.filter(function (r) { return r.kind === 'Material'; }) }, { label: 'Cost resources', list: p.resources.filter(function (r) { return r.kind === 'Cost'; }) }]);
      groups.forEach(function (g) {
        if (!g.list.length) return;
        var gc = 0;
        g.list.forEach(function (r) {
          var st = s.resStats[r.uid];
          gc += st.cost;
          h.push('<tr><td>' + esc(r.name) + '</td><td class="muted">' + (r.kind === 'Work' ? r.type : r.kind) + '</td><td class="num">' + (r.kind === 'Cost' ? '' : U.money(r.rate)) + '</td>' +
            '<td class="num">' + (r.kind === 'Work' ? U.num(st.work) + 'h' : r.kind === 'Material' ? U.num(st.qty) : '') + '</td><td class="num">' + U.money(st.cost) + '</td>' +
            '<td><div class="hbar-track"><div class="hbar" style="width:' + (st.cost / maxRes * 100) + '%"></div></div></td></tr>');
        });
        h.push('<tr><td colspan="4" class="muted small"><b>' + g.label + ' subtotal</b></td><td class="num"><b>' + U.money(gc) + '</b></td><td></td></tr>');
      });
      var fixed = s.rows.reduce(function (a, r) { return a + (+r.task.fixedCost || 0); }, 0);
      if (fixed) h.push('<tr><td colspan="4" class="muted small"><b>Fixed task costs</b></td><td class="num"><b>' + U.money(fixed) + '</b></td><td></td></tr>');
      h.push('</tbody><tfoot><tr><td colspan="4">Total</td><td class="num">' + U.money(cost, cur) + '</td><td></td></tr></tfoot></table></div></div></div>');
      h.push('</div></div>');
      $('#main').innerHTML = h.join('');
      $$('#main .chart svg').forEach(function (el) { el.style.width = '100%'; el.style.height = 'auto'; });
    }
  };
})();
