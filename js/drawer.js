/* Task details drawer (Gantt, Network and WBS views). */
OP.drawer = (function () {
  var U = OP.util, M = OP.model, A = OP.app, S = A.S, esc = U.esc, icon = A.icon, $ = A.$;
  var VIEWS = ['gantt', 'network', 'wbs'];

  function stat(v, k) { return '<div class="stat"><b>' + v + '</b><span>' + k + '</span></div>'; }
  function opts(map, cur) {
    return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join('');
  }
  function inp(label, key, val, type, extra) {
    return '<label class="field"><span>' + label + '</span><input class="inp" data-d="' + key + '" data-fk="d:' + key + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></label>';
  }
  function unitLabel(res) {
    return !res ? '' : res.kind === 'Material' ? (res.materialLabel || 'qty') : res.kind === 'Cost' ? S.p.currency : '%';
  }

  function taskOptions(self, cur) {
    var rows = S.s.rows, me = A.rowByUid(self.uid);
    return rows.filter(function (r) {
      if (r.task.uid === self.uid) return false;
      for (var q = me.parent; q >= 0; q = rows[q].parent) if (q === r.i) return false;
      for (var q2 = r.parent; q2 >= 0; q2 = rows[q2].parent) if (q2 === me.i) return false;
      return true;
    }).map(function (r) {
      return '<option value="' + r.task.uid + '"' + (r.task.uid === cur ? ' selected' : '') + '>' + r.id + '. ' + esc(r.task.name || '(unnamed)') + '</option>';
    }).join('');
  }

  function render() {
    var d = $('#drawer');
    var t = S.sel.length === 1 ? A.taskByUid(S.sel[0]) : null;
    var show = S.drawer && t && VIEWS.indexOf(S.view) >= 0 && A.rowByUid(t.uid);
    d.classList.toggle('open', !!show);
    if (!show) { d.innerHTML = ''; return; }
    var fk = document.activeElement && d.contains(document.activeElement) ? A.captureFocus() : null;
    var r = A.rowByUid(t.uid), p = S.p, cur = p.currency, leaf = !r.summary;
    var h = [];
    h.push('<div class="drawer-head"><h2>Task ' + r.id + ' <span class="muted small">· WBS ' + r.wbs + '</span></h2>' +
      '<button class="icon-btn" data-dact="close" title="Close panel" aria-label="Close panel">' + icon('x') + '</button></div><div class="drawer-body">');
    h.push(inp('Name', 'name', t.name));
    if (r.conflict) h.push('<div class="alert inline">' + icon('alert') + esc(r.conflict) + '.</div>');
    if (r.missedDeadline) h.push('<div class="alert inline">' + icon('deadline') + 'Finishes ' + U.fmt(r.finishDn) + ', after its deadline.</div>');

    if (leaf) {
      h.push('<div class="row3">' + inp('Duration', 'duration', M.fmtDuration(r.duration)) + inp('Work (hours)', 'work', U.num(r.work)) +
        inp('% complete', 'percent', t.percent || 0, 'number', ' min="0" max="100" step="5"') + '</div>');
      h.push('<div class="row3"><label class="field"><span>Task type</span><select class="sel" data-d="type">' + opts(M.TASK_TYPES, t.type) + '</select></label>' +
        '<label class="field"><span>Effort driven</span><label class="toggle" style="height:32px;padding:0"><input type="checkbox" data-d="effortDriven"' + (t.effortDriven ? ' checked' : '') + '>Yes</label></label>' +
        '<label class="field"><span>Milestone</span><label class="toggle" style="height:32px;padding:0"><input type="checkbox" data-d="milestone"' + (t.milestone ? ' checked' : '') + '>Yes</label></label></div>');
      var dated = t.constraint !== 'ASAP' && t.constraint !== 'ALAP';
      h.push('<div class="row2"><label class="field"><span>Constraint</span><select class="sel" data-d="constraint">' + opts(M.CONSTRAINTS, t.constraint) + '</select></label>' +
        inp('Constraint date', 'constraintDate', t.constraintDate, 'date', dated ? '' : ' disabled') + '</div>');
      h.push('<div class="row2">' + inp('Deadline', 'deadline', t.deadline, 'date') + inp('Priority (0–1000)', 'priority', t.priority, 'number', ' min="0" max="1000" step="50"') + '</div>');
      h.push('<div class="row2">' + inp('Actual start', 'actualStart', t.actualStart, 'date') + inp('Actual finish', 'actualFinish', t.actualFinish, 'date') + '</div>');
    }
    h.push('<div class="row2">' + inp('Fixed cost (' + esc(cur) + ')', 'fixedCost', t.fixedCost || 0, 'number', ' min="0" step="1000"') +
      (leaf ? '' : inp('Priority (0–1000)', 'priority', t.priority, 'number', ' min="0" max="1000" step="50"')) + '</div>');

    h.push('<div class="stats">' +
      stat(U.fmt(r.startDn), 'Start') + stat(U.fmt(r.finishDn), 'Finish') + stat(M.fmtDuration(r.duration), 'Duration') +
      stat(U.num(r.slack) + 'd', 'Total slack') + stat(leaf ? U.num(r.freeSlack) + 'd' : '—', 'Free slack') +
      stat(r.critical ? '<span style="color:var(--critical)">Yes</span>' : 'No', 'Critical') +
      stat(U.num(r.es) + ' / ' + U.num(r.ef), 'ES / EF (day)') + stat(U.num(r.ls) + ' / ' + U.num(r.lf), 'LS / LF (day)') +
      stat(U.num(r.work) + 'h', 'Work') + stat(U.money(r.cost), 'Cost') + stat(U.money(r.actualCost), 'Actual cost') + stat(r.percent + '%', 'Complete') + '</div>');

    if (r.base) {
      h.push('<div class="section-title">Baseline</div><div class="stats">' +
        stat(U.fmt(r.base.startDn), 'Baseline start') + stat(U.fmt(r.base.finishDn), 'Baseline finish') + stat(U.money(r.base.cost), 'Baseline cost') +
        stat(varDays(r.startVar), 'Start variance') + stat(varDays(r.finishVar), 'Finish variance') + stat(U.money(r.costVar), 'Cost variance') + '</div>');
    }
    if (t.levelDelay) {
      h.push('<div class="section-title">Leveling delay<button class="btn ghost" data-dact="clearDelay">' + icon('x') + 'Clear</button></div>' +
        '<div class="muted small">Delayed ' + U.num(t.levelDelay) + ' working days to resolve a resource overallocation.</div>');
    }

    // Predecessors
    h.push('<div class="section-title">Predecessors<button class="btn ghost" data-dact="addpred">' + icon('plus') + 'Add</button></div><div class="mini-list">');
    if (!t.preds.length) h.push('<div class="muted small">No predecessors.</div>');
    t.preds.forEach(function (l, k) {
      h.push('<div class="mini-row pred"><select class="sel" data-pred="' + k + '" data-pf="uid">' + taskOptions(t, l.uid) + '</select>' +
        '<select class="sel" data-pred="' + k + '" data-pf="type" title="Link type">' + M.LINK_TYPES.map(function (ty) { return '<option' + (ty === l.type ? ' selected' : '') + '>' + ty + '</option>'; }).join('') + '</select>' +
        '<input class="inp" type="number" step="1" data-pred="' + k + '" data-pf="lag" data-fk="d:pl' + k + '" value="' + (l.lag || 0) + '" title="Lag (days)">' +
        '<button class="icon-btn" data-dact="rmpred" data-k="' + k + '" aria-label="Remove">' + icon('x') + '</button></div>');
    });
    h.push('</div>');

    if (leaf) {
      h.push('<div class="section-title">Resources</div><div class="mini-list">');
      t.assignments.forEach(function (a, k) {
        var res = A.resByUid(a.res);
        h.push('<div class="mini-row asg"><select class="sel" data-asg="' + k + '" data-af="res">' + p.resources.map(function (x) {
          return '<option value="' + x.uid + '"' + (x.uid === a.res ? ' selected' : '') + '>' + esc(x.name || '(unnamed)') + (x.kind !== 'Work' ? ' (' + x.kind.toLowerCase() + ')' : '') + '</option>';
        }).join('') + '</select><label class="unit-inp"><input class="inp" type="number" min="0" step="' + (res && res.kind === 'Work' ? 5 : 1) + '" data-asg="' + k + '" data-af="units" data-fk="d:au' + k + '" value="' + a.units + '"><span>' + esc(unitLabel(res)) + '</span></label>' +
          '<button class="icon-btn" data-dact="rmasg" data-k="' + k + '" aria-label="Remove">' + icon('x') + '</button></div>');
      });
      var free = p.resources.filter(function (x) { return !t.assignments.some(function (a) { return a.res === x.uid; }); });
      if (p.resources.length) {
        h.push('<select class="sel" data-d="addres" data-fk="d:addres"' + (free.length ? '' : ' disabled') + '><option value="">' + (free.length ? '+ Assign a resource…' : 'All resources assigned') + '</option>' +
          free.map(function (x) { return '<option value="' + x.uid + '">' + esc(x.name) + ' — ' + esc(x.kind === 'Work' ? (x.role || x.type) + ' (' + x.maxUnits + '%)' : x.kind) + '</option>'; }).join('') + '</select>');
      } else h.push('<div class="muted small">Add people in the Resources view first.</div>');
      h.push('<div class="muted small">Work: % of the person’s day · Material: quantity · Cost: amount. ' +
        (t.effortDriven ? 'Effort driven: adding people shortens the task, total work stays the same.' : '') + '</div></div>');

      if (!t.milestone && t.duration > 1) {
        h.push('<div class="section-title">Split task<button class="btn ghost" data-dact="addsplit">' + icon('plus') + 'Add split</button></div><div class="mini-list">');
        if (!t.splits.length) h.push('<div class="muted small">Pause the work part-way through, e.g. while waiting for feedback.</div>');
        t.splits.forEach(function (sp, k) {
          h.push('<div class="mini-row split"><span class="muted small">After</span><input class="inp" type="number" min="0.5" step="0.5" max="' + (t.duration - 0.5) + '" data-split="' + k + '" data-sf="at" value="' + sp.at + '">' +
            '<span class="muted small">days, pause</span><input class="inp" type="number" min="0.5" step="0.5" data-split="' + k + '" data-sf="gap" value="' + sp.gap + '"><span class="muted small">days</span>' +
            '<button class="icon-btn" data-dact="rmsplit" data-k="' + k + '" aria-label="Remove split">' + icon('x') + '</button></div>');
        });
        h.push('</div>');
      }
    }

    if (p.customFields.length) {
      h.push('<div class="section-title">Custom fields</div>');
      p.customFields.forEach(function (f) {
        var v = t.custom[f.id];
        h.push('<label class="field"><span>' + esc(f.name) + '</span><input class="inp" data-cf="' + f.id + '" data-fk="d:cf' + f.id + '"' + (f.type === 'number' ? ' type="number"' : '') + ' value="' + esc(v == null ? '' : v) + '"></label>');
      });
    }
    h.push('<label class="field"><span>Notes</span><textarea class="inp" data-d="notes" data-fk="d:notes">' + esc(t.notes || '') + '</textarea></label>');
    h.push('</div>');
    d.innerHTML = h.join('');
    if (fk) A.restoreFocus(fk);
  }
  function varDays(v) { return (v > 0 ? '+' : '') + U.num(v) + 'd'; }

  function bind() {
    var d = $('#drawer'), ops = OP.taskOps;
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dact]');
      if (!b) return;
      var t = A.taskByUid(S.sel[0]), a = b.dataset.dact, k = +b.dataset.k;
      if (a === 'close') { S.drawer = false; A.saveUI(); A.render(); return; }
      if (!t) return;
      if (a === 'rmpred') A.commit(function () { t.preds.splice(k, 1); });
      if (a === 'rmasg') A.commit(function () { ops.changeAssignments(t, function () { t.assignments.splice(k, 1); }); });
      if (a === 'clearDelay') A.commit(function () { t.levelDelay = 0; });
      if (a === 'addsplit') A.commit(function () { t.splits.push({ at: Math.max(0.5, Math.floor(t.duration / 2)), gap: 2 }); });
      if (a === 'rmsplit') A.commit(function () { t.splits.splice(k, 1); });
      if (a === 'addpred') {
        var idx = M.indexByUid(S.p), i = idx[t.uid], cand = null;
        for (var j = i - 1; j >= 0; j--) {
          var c = S.p.tasks[j];
          if (!M.isSummary(S.p, j) && !t.preds.some(function (l) { return l.uid === c.uid; })) { cand = c; break; }
        }
        if (!cand) { A.toast('No earlier task available to link.'); return; }
        var txt = M.formatPreds(S.p, t);
        ops.setPreds(t, (txt ? txt + ', ' : '') + (idx[cand.uid] + 1));
      }
    });
    d.addEventListener('change', function (e) {
      var el = e.target, t = A.taskByUid(S.sel[0]), r = t && A.rowByUid(t.uid);
      if (!t) return;
      if (el.dataset.d) {
        var f = el.dataset.d, v = el.value;
        if (f === 'name' || f === 'notes' || f === 'deadline') A.commit(function () { t[f] = v; });
        else if (f === 'duration') {
          var dd = M.parseDuration(v, S.p.hoursPerDay);
          if (dd == null) { A.toast('Enter a duration like 5, 5d, 2w or 16h.', true); render(); return; }
          A.commit(function () { ops.setDuration(t, dd); });
        } else if (f === 'work') {
          var hrs = parseFloat(v), err = '';
          if (!isFinite(hrs)) { render(); return; }
          A.commit(function () { err = ops.setWork(t, hrs); if (err) return false; });
          if (err) { A.toast(err, true); render(); }
        } else if (f === 'percent') OP.gantt.setPercent(t, r, Math.max(0, Math.min(100, Math.round(+v || 0))));
        else if (f === 'milestone') A.commit(function () { t.milestone = el.checked; t.duration = el.checked ? 0 : (t.duration || 1); });
        else if (f === 'effortDriven') A.commit(function () { t.effortDriven = el.checked; });
        else if (f === 'type') A.commit(function () { t.type = v; });
        else if (f === 'constraint') A.commit(function () {
          t.constraint = v;
          if (v === 'ASAP' || v === 'ALAP') t.constraintDate = '';
          else if (!t.constraintDate) t.constraintDate = U.iso(r.startDn);
        });
        else if (f === 'constraintDate') A.commit(function () { t.constraintDate = v; if (v && t.constraint === 'ASAP') t.constraint = 'SNET'; });
        else if (f === 'priority') A.commit(function () { t.priority = Math.max(0, Math.min(1000, Math.round(+v || 0))); });
        else if (f === 'fixedCost') A.commit(function () { t.fixedCost = Math.max(0, +v || 0); });
        else if (f === 'actualStart') A.commit(function () { t.actualStart = v; if (!v) { t.percent = 0; t.actualFinish = ''; } });
        else if (f === 'actualFinish') A.commit(function () { t.actualFinish = v; if (v) { t.percent = 100; if (!t.actualStart) t.actualStart = U.iso(r.startDn); } else if (t.percent >= 100) t.percent = 99; });
        else if (f === 'addres' && v) {
          var res = A.resByUid(+v);
          A.commit(function () {
            ops.changeAssignments(t, function () {
              t.assignments.push({ res: +v, units: res.kind === 'Work' ? Math.min(100, res.maxUnits) : res.kind === 'Material' ? 1 : 0 });
            });
          });
        }
      } else if (el.dataset.pred != null) {
        var k = +el.dataset.pred, l = U.clone(t.preds[k]), pf = el.dataset.pf;
        if (pf === 'uid') l.uid = +el.value; else if (pf === 'type') l.type = el.value; else l.lag = +el.value || 0;
        var trial = U.clone(S.p);
        trial.tasks.forEach(function (x) { if (x.uid === t.uid) x.preds[k] = l; });
        if (OP.schedule(trial).cycle.length) { A.toast('That link would create a dependency loop.', true); render(); return; }
        A.commit(function () { t.preds[k] = l; });
      } else if (el.dataset.asg != null) {
        var ak = +el.dataset.asg;
        A.commit(function () {
          if (el.dataset.af === 'res') t.assignments[ak].res = +el.value;
          else ops.setUnits(t, ak, Math.max(0, +el.value || 0));
        });
      } else if (el.dataset.split != null) {
        var sk = +el.dataset.split;
        A.commit(function () { t.splits[sk][el.dataset.sf] = Math.max(0.5, +el.value || 0.5); });
      } else if (el.dataset.cf) {
        var f2 = S.p.customFields.filter(function (x) { return x.id === el.dataset.cf; })[0];
        A.commit(function () { t.custom[el.dataset.cf] = f2 && f2.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value; });
      }
    });
  }

  return { render: render, bind: bind };
})();
