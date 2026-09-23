/* Reports view: printable project reports in the style of MS Project's built-in reports. */
(function () {
  var U = OP.util, M = OP.model, A = OP.app, S = A.S, esc = U.esc, icon = A.icon, $ = A.$;

  var REPORTS = [
    ['overview', 'Project overview'], ['critical', 'Critical tasks'], ['milestones', 'Milestones'], ['late', 'Late & slipping tasks'],
    ['cost', 'Cost overview'], ['resources', 'Resource overview'], ['who', 'Who does what'], ['ev', 'Earned value'],
    ['variance', 'Baseline variance'], ['tasks', 'Task list']
  ];

  function money(v) { return U.money(v, S.p.currency); }
  function d(dn) { return dn == null ? '' : U.fmt(dn); }
  function sd(v) { return v == null ? '' : (v > 0 ? '+' : '') + U.num(v) + 'd'; }
  function table(head, rows, foot) {
    if (!rows.length) return '<p class="muted">Nothing to report.</p>';
    return '<table class="data rpt"><thead><tr>' + head.map(function (h) { return '<th' + (h[1] ? ' class="num"' : '') + '>' + h[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (head[i][1] ? ' class="num"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody>' + (foot ? '<tfoot><tr>' + foot.map(function (c, i) { return '<td' + (head[i][1] ? ' class="num"' : '') + '>' + c + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>';
  }
  function tile(k, v, sub) { return '<div class="kpi card"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (sub || '') + '</div></div>'; }
  function leaves() { return S.s.rows.filter(function (r) { return !r.summary; }); }
  function name(r) { return esc(r.task.name || '(unnamed)'); }
  function needBaseline() { return '<div class="card note-card">' + icon('info') + '<div>This report compares against a <b>baseline</b>. Choose <b>Project › Set Baseline</b> first.</div></div>'; }

  var build = {
    overview: function () {
      var s = S.s, p = S.p, ls = leaves();
      var done = s.rows.filter(function (r) { return r.task.level === 1; });
      var pct = (function () { var t = 0, dn = 0; ls.forEach(function (r) { t += r.duration; dn += r.duration * r.percent / 100; }); return t ? Math.round(dn / t * 100) : 0; })();
      var h = '<div class="kpis">' + tile('Start', d(s.startDn)) + tile('Finish', d(s.finishDn), U.num(s.duration) + ' working days') + tile('% complete', pct + '%') +
        tile('Cost', money(s.totalCost), p.budget ? 'Budget ' + money(p.budget) : '') +
        tile('Tasks', ls.filter(function (r) { return !r.milestone; }).length, ls.filter(function (r) { return r.critical && !r.milestone; }).length + ' critical') +
        tile('Issues', ls.filter(function (r) { return r.late || r.missedDeadline || r.conflict; }).length + s.rows.filter(function (r) { return r.over; }).length, 'late, deadline, conflict or overallocated') + '</div>';
      h += '<h3>Project information</h3>' + table([['Field'], ['Value']], [
        ['Organisation', esc(p.organization)], ['Project manager', esc(p.manager)], ['Status', esc(p.status)], ['Date of issue', d(U.parseDate(p.issueDate))],
        ['Status date', p.statusDate ? d(U.parseDate(p.statusDate)) : 'Not set (today is used)'], ['Baseline', p.baseline ? 'Saved ' + U.fmt(U.parseDate(p.baseline.savedAt.slice(0, 10))) : 'Not set']
      ]);
      h += '<h3>Work packages</h3>' + table([['WBS'], ['Name'], ['Start'], ['Finish'], ['% done', 1], ['Cost', 1]], done.map(function (r) {
        return [r.wbs, name(r), d(r.startDn), d(r.finishDn), r.percent + '%', U.money(r.cost)];
      }));
      h += '<h3>Upcoming milestones</h3>' + table([['ID'], ['Milestone'], ['Date'], ['Deadline']], ls.filter(function (r) { return r.milestone && r.percent < 100; }).slice(0, 8).map(function (r) {
        return [r.id, name(r), d(r.startDn), r.task.deadline ? d(U.parseDate(r.task.deadline)) + (r.missedDeadline ? ' <span class="chip bad">missed</span>' : '') : ''];
      }));
      return h;
    },
    critical: function () {
      var list = leaves().filter(function (r) { return r.critical; });
      return '<p class="muted">Tasks with zero (or negative) total slack: any delay moves the project finish date.</p>' +
        table([['ID'], ['Task'], ['Start'], ['Finish'], ['Duration', 1], ['Slack', 1], ['Resources'], ['Predecessors']], list.map(function (r) {
          return [r.id, name(r), d(r.startDn), d(r.finishDn), M.fmtDuration(r.duration), U.num(r.slack) + 'd', esc(r.names), esc(M.formatPreds(S.p, r.task))];
        }));
    },
    milestones: function () {
      return table([['ID'], ['WBS'], ['Milestone'], ['Date'], ['Baseline'], ['Variance', 1], ['Deadline'], ['Status']], leaves().filter(function (r) { return r.milestone; }).map(function (r) {
        return [r.id, r.wbs, name(r), d(r.startDn), r.base ? d(r.base.finishDn) : '', r.base ? sd(r.finishVar) : '',
          r.task.deadline ? d(U.parseDate(r.task.deadline)) : '', r.percent >= 100 ? '<span class="chip good">Done</span>' : r.missedDeadline ? '<span class="chip bad">Deadline missed</span>' : r.late ? '<span class="chip warn">Late</span>' : ''];
      }));
    },
    late: function () {
      var list = leaves().filter(function (r) { return r.late || r.slipped || r.missedDeadline || r.conflict; });
      return '<p class="muted">Status date: ' + d(S.s.statusDn) + '. “Behind” means less work is complete than the plan says by the status date.</p>' +
        table([['ID'], ['Task'], ['Finish'], ['% done', 1], ['Finish var.', 1], ['Problem']], list.map(function (r) {
          var why = [];
          if (r.late) why.push('Behind schedule');
          if (r.slipped) why.push('Slipped ' + sd(r.finishVar) + ' vs baseline');
          if (r.missedDeadline) why.push('Misses deadline');
          if (r.conflict) why.push('Constraint conflict');
          return [r.id, name(r), d(r.finishDn), r.percent + '%', r.base ? sd(r.finishVar) : '', esc(why.join('; '))];
        }));
    },
    cost: function () {
      var s = S.s, rows = s.rows.filter(function (r) { return r.task.level <= 2; });
      return table([['WBS'], ['Task'], ['Fixed cost', 1], ['Total cost', 1], ['Baseline', 1], ['Variance', 1], ['Actual', 1], ['Remaining', 1]], rows.map(function (r) {
        return [r.wbs, (r.task.level > 1 ? '&nbsp;&nbsp;&nbsp;' : '<b>') + name(r) + (r.task.level > 1 ? '' : '</b>'), U.money(r.task.fixedCost || 0), U.money(r.cost),
          r.base ? U.money(r.base.cost) : '', r.base ? U.money(r.costVar) : '', U.money(r.actualCost), U.money(r.cost - r.actualCost)];
      }), ['', 'Total', '', money(s.totalCost), S.p.baseline ? money(s.ev.bac) : '', '', '', '']);
    },
    resources: function () {
      var s = S.s;
      return table([['Resource'], ['Kind'], ['Max'], ['Work / qty', 1], ['Cost', 1], ['Peak', 1], ['Status']], S.p.resources.map(function (r) {
        var st = s.resStats[r.uid];
        return [esc(r.name) + '<div class="muted small">' + esc(r.role) + '</div>', r.kind === 'Work' ? r.type : r.kind, r.kind === 'Work' ? r.maxUnits + '%' : '',
          r.kind === 'Work' ? U.num(st.work) + 'h' : r.kind === 'Material' ? U.num(st.qty) + ' ' + esc(r.materialLabel) : '', U.money(st.cost),
          r.kind === 'Work' ? Math.round(st.peak) + '%' : '', st.over ? '<span class="chip bad">Overallocated (' + st.overDays.length + ' days)</span>' : st.work || st.cost ? '<span class="chip good">OK</span>' : '<span class="chip">Unassigned</span>'];
      }), ['Total', '', '', U.num(s.totalWork) + 'h', money(s.totalCost), '', '']);
    },
    who: function () {
      var s = S.s, h = '';
      S.p.resources.forEach(function (r) {
        var list = s.rows.filter(function (row) { return !row.summary && row.task.assignments.some(function (a) { return a.res === r.uid; }); });
        h += '<h3>' + esc(r.name || '(unnamed)') + ' <span class="muted small">' + esc(r.role || r.kind) + '</span></h3>' +
          table([['ID'], ['Task'], ['Start'], ['Finish'], ['Units', 1], ['Work', 1]], list.map(function (row) {
            var a = row.task.assignments.filter(function (x) { return x.res === r.uid; })[0];
            return [row.id, name(row), d(row.startDn), d(row.finishDn), r.kind === 'Work' ? a.units + '%' : U.num(a.units),
              r.kind === 'Work' ? U.num(a.units / 100 * S.p.hoursPerDay * row.duration) + 'h' : ''];
          }));
      });
      return h || '<p class="muted">No resources.</p>';
    },
    ev: function () {
      if (!S.p.baseline) return needBaseline();
      var s = S.s, ev = s.ev, tops = s.rows.filter(function (r) { return r.task.level === 1; });
      function rt(v) { return v == null ? '—' : v.toFixed(2); }
      return '<div class="kpis">' + tile('BAC', money(ev.bac)) + tile('SPI', rt(ev.spi), 'SV ' + U.money(ev.sv)) + tile('CPI', rt(ev.cpi), 'CV ' + U.money(ev.cv)) +
        tile('EAC', money(ev.eac), 'VAC ' + U.money(ev.vac)) + '</div>' +
        '<p class="muted">Status date ' + d(s.statusDn) + '. BCWS = planned value, BCWP = earned value (baseline cost × % complete), ACWP = actual cost. SPI/CPI below 1.00 means behind schedule / over cost.</p>' +
        table([['WBS'], ['Package'], ['BCWS', 1], ['BCWP', 1], ['ACWP', 1], ['SV', 1], ['CV', 1], ['SPI', 1], ['CPI', 1]], tops.map(function (r) {
          return [r.wbs, name(r), U.money(r.bcws), U.money(r.bcwp), U.money(r.acwp), U.money(r.bcwp - r.bcws), U.money(r.bcwp - r.acwp),
            r.bcws ? (r.bcwp / r.bcws).toFixed(2) : '—', r.acwp ? (r.bcwp / r.acwp).toFixed(2) : '—'];
        }), ['', 'Project', U.money(ev.bcws), U.money(ev.bcwp), U.money(ev.acwp), U.money(ev.sv), U.money(ev.cv), rt(ev.spi), rt(ev.cpi)]);
    },
    variance: function () {
      if (!S.p.baseline) return needBaseline();
      return table([['ID'], ['Task'], ['Start'], ['Baseline start'], ['Start var.', 1], ['Finish'], ['Baseline finish'], ['Finish var.', 1], ['Cost var.', 1]],
        S.s.rows.filter(function (r) { return r.base; }).map(function (r) {
          return [r.id, (r.summary ? '<b>' : '') + name(r) + (r.summary ? '</b>' : ''), d(r.startDn), d(r.base.startDn), sd(r.startVar), d(r.finishDn), d(r.base.finishDn), sd(r.finishVar), U.money(r.costVar)];
        }));
    },
    tasks: function () {
      return table([['ID'], ['WBS'], ['Task'], ['Duration', 1], ['Start'], ['Finish'], ['Predecessors'], ['Resources'], ['Cost', 1]], S.s.rows.map(function (r) {
        var pad = new Array(r.task.level).join('&nbsp;&nbsp;&nbsp;');
        return [r.id, r.wbs, pad + (r.summary ? '<b>' + name(r) + '</b>' : name(r)), M.fmtDuration(r.duration), d(r.startDn), d(r.finishDn), esc(M.formatPreds(S.p, r.task)), esc(r.names), U.money(r.cost)];
      }), ['', '', 'Total', M.fmtDuration(S.s.duration), d(S.s.startDn), d(S.s.finishDn), '', '', money(S.s.totalCost)]);
    }
  };

  OP.views.reports = {
    render: function () {
      if (!build[S.report]) S.report = 'overview';
      var title = REPORTS.filter(function (r) { return r[0] === S.report; })[0][1];
      var h = ['<div class="view"><div class="reports">'];
      h.push('<nav class="rpt-nav" aria-label="Reports">' + REPORTS.map(function (r) {
        return '<button data-rpt="' + r[0] + '" class="' + (r[0] === S.report ? 'active' : '') + '">' + r[1] + '</button>';
      }).join('') + '</nav>');
      h.push('<div class="rpt-body"><div class="toolbar rpt-tools"><span class="spacer"></span><button class="btn" data-act="print">' + icon('printer') + 'Print / Save as PDF</button></div>' +
        '<article class="paper" id="report"><header class="rpt-head"><div><div class="muted small">' + esc(S.p.name) + (S.p.organization ? ' · ' + esc(S.p.organization) : '') + '</div><h2>' + title + '</h2></div>' +
        '<div class="muted small">Generated ' + U.fmtLong(U.todayDn()) + '</div></header>' + build[S.report]() + '</article></div>');
      h.push('</div></div>');
      A.$('#main').innerHTML = h.join('');
    },
    bind: function () {
      document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rpt]');
        if (b) { S.report = b.dataset.rpt; S.view = 'reports'; A.saveUI(); A.render(); }
      });
    }
  };
})();
