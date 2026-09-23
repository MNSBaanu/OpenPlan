/* MS Project-style ribbon (Task, Resource, Report, Project, View, Format tabs), File backstage and status bar. */
OP.ribbon = (function () {
  var U = OP.util, A = OP.app, S = A.S, esc = U.esc, icon = A.icon, $ = A.$, $$ = A.$$;

  var TABS = [['task', 'Task'], ['resource', 'Resource'], ['report', 'Report'], ['project', 'Project'], ['view', 'View'], ['format', 'Format']];
  var GANTT_TOOLS = { gantt: 1 };

  function attrs(a) { return Object.keys(a || {}).map(function (k) { return ' ' + k + '="' + esc(a[k]) + '"'; }).join(''); }
  function big(ic, label, a, disabled, cls) {
    return '<button class="rb big' + (cls ? ' ' + cls : '') + '"' + attrs(a) + (disabled ? ' disabled' : '') + ' title="' + esc(label.replace(/<[^>]+>/g, ' ')) + '">' + icon(ic) + '<span>' + label + '</span></button>';
  }
  function small(ic, label, a, disabled, cls) {
    return '<button class="rb small' + (cls ? ' ' + cls : '') + '"' + attrs(a) + (disabled ? ' disabled' : '') + ' title="' + esc(label) + '">' + icon(ic) + '<span>' + label + '</span></button>';
  }
  function iconOnly(ic, title, a, disabled, cls) {
    return '<button class="rb ico' + (cls ? ' ' + cls : '') + '"' + attrs(a) + (disabled ? ' disabled' : '') + ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + icon(ic) + '</button>';
  }
  function stack() { return '<div class="rstack">' + Array.prototype.join.call(arguments, '') + '</div>'; }
  function row() { return '<div class="rrow">' + Array.prototype.join.call(arguments, '') + '</div>'; }
  function group(label, body) { return '<div class="rgroup"><div class="rg-body">' + body + '</div><div class="rg-label">' + label + '</div></div>'; }
  function dropBig(ic, label, id, items, disabled) {
    return '<div class="menu-wrap">' + '<button class="rb big drop" data-menu="' + id + '"' + (disabled ? ' disabled' : '') + ' title="' + esc(label.replace(/<[^>]+>/g, ' ')) + '">' + icon(ic) + '<span>' + label + ' ▾</span></button>' +
      '<div class="menu left" id="' + id + '">' + items + '</div></div>';
  }
  function check(label, key, checked, disabled, title) {
    return '<label class="rcheck' + (disabled ? ' off' : '') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '><input type="checkbox" data-gsel="' + key + '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '>' + label + '</label>';
  }
  function selectRow(label, key, map, cur) {
    return '<label class="rselect"><span>' + label + '</span><select data-gsel="' + key + '">' + Object.keys(map).map(function (k) {
      return '<option value="' + esc(k) + '"' + (String(cur) === k ? ' selected' : '') + '>' + esc(map[k]) + '</option>';
    }).join('') + '</select></label>';
  }
  function viewBtn(ic, label, view) { return big(ic, label, { 'data-view': view }, false, S.view === view ? 'on' : ''); }
  function viewSmall(ic, label, view) { return small(ic, label, { 'data-view': view }, false, S.view === view ? 'on' : ''); }

  var build = {
    task: function () {
      var noSel = !S.sel.length;
      return group('View', viewBtn('gantt', 'Gantt<br>Chart', 'gantt')) +
        group('Schedule', stack(
          row([0, 25, 50, 75, 100].map(function (v) {
            return '<button class="rb pct" data-gt="pct" data-v="' + v + '"' + (noSel ? ' disabled' : '') + ' title="Mark ' + v + '% complete">' + v + '%</button>';
          }).join('')),
          row(iconOnly('outdent', 'Outdent Task (Alt+Shift+←)', { 'data-gt': 'outdent' }, noSel), iconOnly('indent', 'Indent Task (Alt+Shift+→)', { 'data-gt': 'indent' }, noSel),
            iconOnly('link', 'Link the Selected Tasks', { 'data-gt': 'link' }, S.sel.length < 2), iconOnly('unlink', 'Unlink Tasks', { 'data-gt': 'unlink' }, noSel)),
          row(small('check', 'Mark on Track', { 'data-gt': 'asScheduled' }))
        )) +
        group('Tasks', stack(small('up', 'Move Up', { 'data-gt': 'up' }, noSel), small('down', 'Move Down', { 'data-gt': 'down' }, noSel), small('trash', 'Delete', { 'data-gt': 'del' }, noSel))) +
        group('Insert', big('plus', 'Task', { 'data-gt': 'add' }, false, 'accent') +
          stack(small('diamond', 'Milestone', { 'data-gt': 'addMs' }), small('repeat', 'Recurring Task…', { 'data-gt': 'recur' }), small('layers', 'Subproject…', { 'data-act': 'insert' }))) +
        group('Properties', big('panel', 'Information', { 'data-gt': 'drawer' }, false, S.drawer ? 'on' : '') +
          stack(small('users', 'Assign Resources', { 'data-gt': 'assign' }, S.sel.length !== 1), small('target', 'Scroll to Task', { 'data-gt': 'goto' }))) +
        group('Editing', stack(small('undo', 'Undo', { 'data-rb': 'undo' }, !S.undo.length), small('redo', 'Redo', { 'data-rb': 'redo' }, !S.redo.length)));
    },
    resource: function () {
      return group('View', viewBtn('users', 'Resource<br>Sheet', 'resources') + stack(viewSmall('org', 'Team Chart', 'org'), viewSmall('grid', 'Resource Usage', 'workload'))) +
        group('Assignments', big('users', 'Assign<br>Resources', { 'data-gt': 'assign' }, S.sel.length !== 1)) +
        group('Insert', big('plus', 'Add<br>Resources', { 'data-rb': 'addres' }, false, 'accent')) +
        group('Level', big('balance', 'Level<br>All', { 'data-gt': 'level' }) + stack(small('x', 'Clear Leveling', { 'data-gt': 'clearLevel' }), small('grid', 'Next Overallocation', { 'data-rb': 'nextOver' })));
    },
    report: function () {
      var rpt = function (ic, label, id) { return big(ic, label, { 'data-rpt': id }, false, S.view === 'reports' && S.report === id ? 'on' : ''); };
      var more = [['critical', 'Critical Tasks'], ['milestones', 'Milestones'], ['who', 'Who Does What'], ['variance', 'Baseline Variance'], ['tasks', 'Task List']]
        .map(function (r) { return '<button data-rpt="' + r[0] + '">' + icon('report') + r[1] + '</button>'; }).join('');
      return group('View Reports', rpt('report', 'Dashboard', 'overview') + rpt('users', 'Resources', 'resources') + rpt('wallet', 'Costs', 'cost') +
          rpt('clock', 'In<br>Progress', 'late') + rpt('balance', 'Earned<br>Value', 'ev') + dropBig('table', 'More<br>Reports', 'rbMoreReports', more)) +
        group('Budget', big('wallet', 'Cost &amp;<br>Budget', { 'data-view': 'budget' }, false, S.view === 'budget' ? 'on' : '')) +
        group('Export', big('printer', 'Print', { 'data-act': 'print' }) + stack(small('image', 'Picture (PNG)', { 'data-act': 'png' }, !hasImage()), small('table', 'Excel (CSV)', { 'data-act': 'csv' })));
    },
    project: function () {
      var hasBase = !!S.p.baseline;
      return group('Insert', big('layers', 'Subproject', { 'data-act': 'insert' })) +
        group('Properties', big('info', 'Project<br>Information', { 'data-act': 'settings' }) + stack(small('columns', 'Custom Fields', { 'data-act': 'settings' }), small('tree', 'WBS Chart', { 'data-view': 'wbs' }), small('network', 'Network Diagram', { 'data-view': 'network' }))) +
        group('Schedule', dropBig('layers', 'Set<br>Baseline', 'rbBaseline',
          '<button data-gt="baseline">' + icon('layers') + (hasBase ? 'Update Baseline' : 'Set Baseline') + '</button>' +
          '<button data-gt="clearBaseline"' + (hasBase ? '' : ' disabled') + '>' + icon('x') + 'Clear Baseline</button>') +
          stack(small('clock', 'Status Date: ' + (S.p.statusDate ? U.fmt(U.parseDate(S.p.statusDate)) : 'NA'), { 'data-act': 'settings' }),
            small('check', 'Update Project', { 'data-gt': 'asScheduled' }), small('balance', 'Level Resources', { 'data-gt': 'level' }))) +
        group('Status', '<div class="rinfo"><div><span>Start</span><b>' + U.fmt(S.s.startDn) + '</b></div><div><span>Finish</span><b>' + U.fmt(S.s.finishDn) + '</b></div>' +
          '<div><span>Cost</span><b>' + U.money(S.s.totalCost, S.p.currency) + '</b></div></div>');
    },
    view: function () {
      var md = OP.gantt.menuData();
      return group('Task Views', viewBtn('gantt', 'Gantt<br>Chart', 'gantt') + viewBtn('network', 'Network<br>Diagram', 'network') + viewBtn('tree', 'WBS<br>Chart', 'wbs')) +
        group('Resource Views', stack(viewSmall('users', 'Resource Sheet', 'resources'), viewSmall('org', 'Team Chart', 'org'), viewSmall('grid', 'Resource Usage', 'workload'))) +
        group('Data', stack(selectRow('Sort', 'sort', md.sorts, S.sort), selectRow('Filter', 'filter', md.filters, S.filter), selectRow('Group', 'group', md.groups, S.group)) +
          dropBig('columns', 'Tables', 'colMenu', md.colMenu())) +
        group('Zoom', stack(selectRow('Timescale', 'zoom', { day: 'Days', week: 'Weeks', month: 'Months', quarter: 'Quarters' }, S.zoom),
          row(small('target', 'Selected Tasks', { 'data-gt': 'goto' })))) +
        group('Split View', stack(check('Timeline', 'timeline', S.timeline), check('Details', 'drawer', S.drawer))) +
        group('Window', big(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 'Dark<br>Mode', { 'data-rb': 'theme' }));
    },
    format: function () {
      var md = OP.gantt.menuData(), hasBase = !!S.p.baseline;
      return group('Columns', dropBig('columns', 'Insert<br>Column', 'colMenu', md.colMenu())) +
        group('Bar Styles', stack(check('Critical Tasks', 'critical', S.critical),
          check('Baseline', 'showBaseline', S.showBaseline && hasBase, !hasBase, hasBase ? '' : 'Set a baseline first (Project › Set Baseline)'),
          check('Timeline', 'timeline', S.timeline))) +
        group('Gantt Chart Style', '<div class="swatches">' + ['blue', 'green', 'orange', 'gray'].map(function (c) {
          return '<button class="swatch sw-' + c + (currentStyle() === c ? ' on' : '') + '" data-rb="style" data-v="' + c + '" title="' + c + ' bars"><i></i><i></i></button>';
        }).join('') + '</div>') +
        group('Show/Hide', stack(check('Project Summary Task', 'projSummary', false, true, 'Not available in OpenPlan'), check('Outline Numbers', 'outlineNums', S.cols.indexOf('wbs') >= 0)));
    }
  };

  function hasImage() { return !!(OP.views[S.view] && OP.views[S.view].svg); }
  function currentStyle() { return document.documentElement.getAttribute('data-bars') || 'blue'; }

  function render() {
    var tabs = ['<button class="rtab file" data-rbtab="file">File</button>'];
    TABS.forEach(function (t) {
      if (t[0] === 'format' && !GANTT_TOOLS[S.view]) return;
      tabs.push('<button class="rtab' + (S.tab === t[0] ? ' on' : '') + (t[0] === 'format' ? ' ctx' : '') + '" data-rbtab="' + t[0] + '">' + t[1] + '</button>');
    });
    if (GANTT_TOOLS[S.view]) tabs.splice(tabs.length - 1, 0, '<span class="rtab-ctx">Gantt Chart Tools</span>');
    if (S.tab === 'format' && !GANTT_TOOLS[S.view]) S.tab = 'task';
    $('#ribbonTabs').innerHTML = tabs.join('') + '<span class="rtab-fill"></span><button class="rb-collapse" data-rb="collapse" title="' + (S.ribbonMin ? 'Expand the ribbon' : 'Collapse the ribbon') + '">' + icon(S.ribbonMin ? 'chevD' : 'up') + '</button>';
    var open = $('#ribbon .menu.open');
    var openId = open && open.id;
    $('#ribbon').innerHTML = (build[S.tab] || build.task)();
    $('#ribbon').classList.toggle('min', !!S.ribbonMin);
    if (openId && $('#' + openId)) $('#' + openId).classList.add('open');
    renderBackstage();
  }

  /* ---------- File backstage ---------- */

  var PAGES = [['info', 'Info'], ['new', 'New'], ['open', 'Open'], ['save', 'Save'], ['export', 'Export'], ['print', 'Print'], ['about', 'About']];

  function renderBackstage() {
    var bs = $('#backstage');
    bs.hidden = !S.backstage;
    if (!S.backstage) return;
    var p = S.p, s = S.s, page = S.bsPage;
    var nav = '<nav class="bs-nav"><button class="bs-back" data-rb="closeBackstage" aria-label="Back">' + icon('up') + '</button>' +
      PAGES.map(function (x) { return '<button class="bs-item' + (page === x[0] ? ' on' : '') + '" data-bs="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</nav>';
    var body = '';
    if (page === 'info') {
      body = '<h1>Info</h1><div class="bs-cols"><div><h2>' + esc(p.name) + '</h2>' +
        '<button class="bs-tile" data-act="settings">' + icon('info') + '<div><b>Project Information</b><span>Name, start date, status date, budget, calendar and custom fields</span></div></button>' +
        '<button class="bs-tile" data-rb="goBaseline">' + icon('layers') + '<div><b>' + (p.baseline ? 'Baseline saved' : 'No baseline') + '</b><span>' + (p.baseline ? 'Saved ' + U.fmtLong(U.parseDate(p.baseline.savedAt.slice(0, 10))) : 'Project › Set Baseline saves the current plan for tracking') + '</span></div></button></div>' +
        '<div class="bs-props"><h3>Project Properties</h3>' + [
          ['Start', U.fmtLong(s.startDn)], ['Finish', U.fmtLong(s.finishDn)], ['Duration', U.num(s.duration) + ' days'],
          ['Cost', U.money(s.totalCost, p.currency)], ['Budget', p.budget ? U.money(p.budget, p.currency) : '—'], ['Work', U.num(s.totalWork) + ' hrs'],
          ['Tasks', p.tasks.length], ['Resources', p.resources.length], ['Status', p.status], ['Manager', p.manager || '—'], ['Organisation', p.organization || '—']
        ].map(function (x) { return '<div><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div></div>';
    } else if (page === 'new') {
      body = '<h1>New</h1><div class="bs-cards"><button class="bs-card" data-act="new"><div class="bs-thumb blank"></div><b>Blank Project</b></button>' +
        '<button class="bs-card" data-act="sample"><div class="bs-thumb sample"><i></i><i></i><i></i></div><b>Sample Project</b></button></div>';
    } else if (page === 'open') {
      body = '<h1>Open</h1><button class="bs-tile" data-act="open">' + icon('upload') + '<div><b>Browse…</b><span>OpenPlan (.json) or MS Project XML (.xml) files</span></div></button>' +
        '<button class="bs-tile" data-act="insert">' + icon('layers') + '<div><b>Insert as Subproject…</b><span>Add another project file under a new summary task</span></div></button>' +
        '<p class="bs-note">To open an .mpp or .pod file, open it in MS Project or ProjectLibre first and save it as XML.</p>';
    } else if (page === 'save') {
      body = '<h1>Save</h1><button class="bs-tile" data-act="save">' + icon('save') + '<div><b>Save Project File</b><span>Download an OpenPlan (.json) file you can open again later (Ctrl+S)</span></div></button>' +
        '<p class="bs-note">' + (S.saved ? 'Your work is also saved automatically in this browser.' : 'Browser storage is unavailable: download a project file to keep your work.') + '</p>';
    } else if (page === 'export') {
      body = '<h1>Export</h1>' +
        '<button class="bs-tile" data-act="xml">' + icon('file') + '<div><b>MS Project XML (.xml)</b><span>Opens in MS Project, ProjectLibre and Project Plan 365</span></div></button>' +
        '<button class="bs-tile" data-act="mpp">' + icon('file') + '<div><b>MS Project (.mpp)</b><span>Saves XML plus the steps to convert it in MS Project</span></div></button>' +
        '<button class="bs-tile" data-act="pod">' + icon('file') + '<div><b>ProjectLibre (.pod)</b><span>Saves XML plus the steps to convert it in ProjectLibre</span></div></button>' +
        '<button class="bs-tile" data-act="csv">' + icon('table') + '<div><b>Excel (.csv)</b><span>Task table with dates, costs and slack</span></div></button>' +
        '<button class="bs-tile" data-act="png"' + (hasImage() ? '' : ' disabled') + '>' + icon('image') + '<div><b>Picture of the ' + esc(A.VIEW_NAMES[S.view]) + ' (.png)</b><span>' + (hasImage() ? 'For Word reports' : 'Switch to Gantt, Network, WBS or Team Chart first') + '</span></div></button>' +
        '<button class="bs-tile" data-act="svg"' + (hasImage() ? '' : ' disabled') + '>' + icon('image') + '<div><b>Vector picture (.svg)</b><span>Sharp at any size</span></div></button>';
    } else if (page === 'print') {
      body = '<h1>Print</h1><button class="bs-tile" data-act="print">' + icon('printer') + '<div><b>Print ' + esc(A.VIEW_NAMES[S.view]) + '</b><span>Use “Save as PDF” in the print dialog to create a PDF</span></div></button>';
    } else if (page === 'about') {
      body = '<h1>About</h1><img src="assets/openplan-logo.svg" alt="OpenPlan" height="48"><p class="bs-note">Free, browser-based project planning: Gantt chart, critical path, network diagram, WBS, resources, leveling, baselines, tracking, earned value and reports.</p>' +
        '<button class="bs-tile" data-act="about">' + icon('info') + '<div><b>Keyboard shortcuts and help</b><span>Editing tips for the task table and Gantt chart</span></div></button>';
    }
    bs.innerHTML = nav + '<div class="bs-body">' + body + '</div>';
  }

  /* ---------- events ---------- */

  function bind() {
    // Close the backstage before any action it launches so exports use the current view.
    document.addEventListener('click', function (e) {
      if (!S.backstage) return;
      var act = e.target.closest('#backstage [data-act]');
      if (act) { S.backstage = false; $('#backstage').hidden = true; }
    }, true);

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-rbtab]');
      if (t) {
        var tab = t.dataset.rbtab;
        if (tab === 'file') { S.backstage = true; S.bsPage = 'info'; A.closeMenus(); renderBackstage(); return; }
        if (S.ribbonMin && S.tab === tab) { S.ribbonMin = false; }
        S.tab = tab; A.saveUI(); render();
        return;
      }
      var bsi = e.target.closest('[data-bs]');
      if (bsi) { S.bsPage = bsi.dataset.bs; renderBackstage(); return; }
      var z = e.target.closest('[data-zstep]');
      if (z) { setZoom(A.ZOOMS.indexOf(S.zoom) + +z.dataset.zstep); return; }
      var rb = e.target.closest('[data-rb]');
      if (!rb || rb.disabled) return;
      var k = rb.dataset.rb;
      if (k === 'closeBackstage') { S.backstage = false; renderBackstage(); }
      else if (k === 'undo') $('#undoBtn').click();
      else if (k === 'redo') $('#redoBtn').click();
      else if (k === 'theme') $('#themeBtn').click();
      else if (k === 'collapse') { S.ribbonMin = !S.ribbonMin; render(); }
      else if (k === 'addres') { S.view = 'resources'; A.saveUI(); OP.views.resources.add(); }
      else if (k === 'goBaseline') { S.backstage = false; S.tab = 'project'; A.render(); }
      else if (k === 'style') { document.documentElement.setAttribute('data-bars', rb.dataset.v); try { localStorage.setItem('openplan.bars', rb.dataset.v); } catch (err) { /* storage unavailable */ } A.render(); }
      else if (k === 'nextOver') {
        var s = S.s, first = null;
        s.rows.forEach(function (r) { if (r.over && (!first || r.startDn < first.startDn)) first = r; });
        if (!first) { A.toast('No overallocated tasks.'); return; }
        S.view = 'gantt'; A.saveUI(); A.render(); A.setSelection([first.task.uid], first.task.uid);
        var g = $('[data-gt="goto"]'); if (g) g.click();
        A.toast('Task ' + first.id + ' uses an overallocated resource');
      }
    });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.dataset.gsel === 'timeline') { e.stopImmediatePropagation(); S.timeline = el.checked; A.saveUI(); A.render(); }
      else if (el.dataset.gsel === 'drawer') { e.stopImmediatePropagation(); S.drawer = el.checked; A.saveUI(); A.render(); }
      else if (el.dataset.gsel === 'outlineNums') {
        e.stopImmediatePropagation();
        var i = S.cols.indexOf('wbs');
        if (el.checked && i < 0) S.cols.splice(3, 0, 'wbs'); else if (!el.checked && i >= 0) S.cols.splice(i, 1);
        A.saveUI(); A.render();
      }
    }, true);
    $('#zoomSlider').addEventListener('input', function (e) { setZoom(+e.target.value); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.backstage) { S.backstage = false; renderBackstage(); } });
    try { var bars = localStorage.getItem('openplan.bars'); if (bars) document.documentElement.setAttribute('data-bars', bars); } catch (err) { /* storage unavailable */ }
  }

  function setZoom(i) {
    i = Math.max(0, Math.min(A.ZOOMS.length - 1, i));
    S.zoom = A.ZOOMS[i]; A.saveUI();
    if (S.view === 'gantt') { OP.views.gantt.renderChart(); $('#zoomSlider').value = i; render(); }
    else A.render();
  }

  return { render: render, bind: bind };
})();
