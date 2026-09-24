import OP from './core.js';
/* File formats: OpenPlan JSON, MS Project XML (MSPDI), CSV, and SVG/PNG image export. */
OP.io = (function () {
  var U = OP.util, M = OP.model;
  var LINK_CODE = { FF: 0, FS: 1, SF: 2, SS: 3 };
  var LINK_NAME = ['FF', 'FS', 'SF', 'SS'];
  var CONSTRAINT_CODE = { ASAP: 0, ALAP: 1, MSO: 2, MFO: 3, SNET: 4, SNLT: 5, FNET: 6, FNLT: 7 };
  var CONSTRAINT_NAME = ['ASAP', 'ALAP', 'MSO', 'MFO', 'SNET', 'SNLT', 'FNET', 'FNLT'];
  var TYPE_CODE = { FixedUnits: 0, FixedDuration: 1, FixedWork: 2 };
  var TYPE_NAME = ['FixedUnits', 'FixedDuration', 'FixedWork'];
  var KIND_CODE = { Material: 0, Work: 1, Cost: 2 };
  var KIND_NAME = ['Material', 'Work', 'Cost'];

  function toJSON(p) { return JSON.stringify(p, null, 2); }

  function fromJSON(text) {
    var p = JSON.parse(text);
    if (!p || !Array.isArray(p.tasks) || !Array.isArray(p.resources)) throw new Error('Not an OpenPlan project file.');
    return M.normalize(p);
  }

  // Read any supported project file (OpenPlan JSON or MS Project XML).
  function parseAny(text) {
    return /^\s*</.test(text) ? fromMSPDI(text) : fromJSON(text);
  }

  // Append another project as a summary task (subproject). Resources and custom fields are matched by name.
  // Returns the new summary task's uid and notes about data that could not be carried over.
  function insertProject(p, sub) {
    var resMap = {}, taskMap = {}, copies = [], cfMap = {}, warnings = [];
    sub.customFields.forEach(function (f) {
      var same = p.customFields.filter(function (x) { return x.name === f.name && x.type === f.type; })[0];
      if (!same) { same = { id: 'c' + Date.now().toString(36) + p.customFields.length, name: f.name, type: f.type }; p.customFields.push(same); }
      cfMap[f.id] = same.id;
    });
    var newHol = sub.holidays.filter(function (h) { return p.holidays.indexOf(h) < 0; }).length;
    if (newHol) warnings.push(newHol + ' holiday' + (newHol > 1 ? 's were' : ' was') + ' not added to this calendar');
    if (sub.baseline) warnings.push('its baseline was not copied');
    sub.resources.forEach(function (r) {
      var same = p.resources.filter(function (x) { return x.name && x.name === r.name; })[0];
      if (same) { resMap[r.uid] = same.uid; return; }
      var copy = U.clone(r);
      copy.uid = p.nextUid++;
      resMap[r.uid] = copy.uid;
      copies.push(copy);
      p.resources.push(copy);
    });
    copies.forEach(function (c) { c.reportsTo = c.reportsTo != null && resMap[c.reportsTo] ? resMap[c.reportsTo] : null; });
    var head = M.newTask(p, { name: sub.name || 'Subproject', level: 1, notes: 'Inserted from ' + (sub.name || 'another project') });
    p.tasks.push(head);
    sub.tasks.forEach(function (t) { taskMap[t.uid] = p.nextUid++; });
    sub.tasks.forEach(function (t) {
      var c = U.clone(t);
      c.uid = taskMap[t.uid];
      c.level = t.level + 1;
      c.preds = t.preds.filter(function (l) { return taskMap[l.uid]; }).map(function (l) { return { uid: taskMap[l.uid], type: l.type, lag: l.lag }; });
      c.assignments = t.assignments.filter(function (a) { return resMap[a.res]; }).map(function (a) { return { res: resMap[a.res], units: a.units }; });
      c.custom = {};
      for (var k in t.custom) if (cfMap[k]) c.custom[cfMap[k]] = t.custom[k];
      p.tasks.push(c);
    });
    M.normalizeLevels(p);
    return { uid: head.uid, warnings: warnings };
  }

  /* ---------- MS Project XML ---------- */

  function x(s) { return U.esc(s); }
  function hours(h) { return 'PT' + Math.round(h * 100) / 100 + 'H0M0S'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60) + ':00'; }
  var CURRENCY_CODE = { 'Rs.': 'LKR', 'Rs': 'LKR', '$': 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', 'A$': 'AUD' };

  function toMSPDI(p) {
    var s = OP.schedule(p), hpd = +p.hoursPerDay || 8, out = [];
    function el(tag, v) { out.push('<' + tag + '>' + x(v) + '</' + tag + '>'); }
    var resUid = {};
    p.resources.forEach(function (r, i) { resUid[r.uid] = i + 1; });
    // Working day: 08:00 with a 12:00-13:00 lunch break; long days start at midnight and have no break.
    var dayStart = hpd > 15 ? 0 : 480, lunch = hpd > 4 && hpd <= 15;
    var dayEnd = Math.min(dayStart + Math.round(hpd * 60) + (lunch ? 60 : 0), 1439);
    var startTime = tm(dayStart), finishTime = tm(dayEnd);
    var workTimes = (lunch ? [[dayStart, 720], [780, dayEnd]] : [[dayStart, dayEnd]]).map(function (w) {
      return '<WorkingTime><FromTime>' + tm(w[0]) + '</FromTime><ToTime>' + tm(w[1]) + '</ToTime></WorkingTime>';
    }).join('');

    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    out.push('<Project xmlns="http://schemas.microsoft.com/project">');
    el('SaveVersion', 14);
    el('Name', p.name + '.xml'); el('Title', p.name); el('Company', p.organization); el('Author', p.manager);
    el('ScheduleFromStart', 1);
    el('StartDate', U.iso(s.startDn) + 'T' + startTime);
    el('FinishDate', U.iso(s.finishDn) + 'T' + finishTime);
    if (p.statusDate) el('StatusDate', p.statusDate + 'T' + finishTime);
    el('CalendarUID', 1);
    el('DefaultStartTime', startTime); el('DefaultFinishTime', finishTime);
    el('MinutesPerDay', hpd * 60); el('MinutesPerWeek', hpd * 300); el('DaysPerMonth', 20);
    el('CurrencySymbol', p.currency);
    el('CurrencyCode', CURRENCY_CODE[p.currency] || (/^[A-Z]{3}$/.test(p.currency) ? p.currency : ''));

    if (p.customFields.length) {
      out.push('<ExtendedAttributes>');
      p.customFields.forEach(function (cf, k) {
        var num = cf.type === 'number';
        out.push('<ExtendedAttribute><FieldID>' + (num ? 188743767 + k : 188743731 + k) + '</FieldID><FieldName>' + (num ? 'Number' : 'Text') + (k + 1) + '</FieldName><Alias>' + x(cf.name) + '</Alias></ExtendedAttribute>');
      });
      out.push('</ExtendedAttributes>');
    }

    out.push('<Calendars>');
    function calendar(uid, name, workDays, exceptions, baseUid) {
      out.push('<Calendar><UID>' + uid + '</UID><Name>' + x(name) + '</Name><IsBaseCalendar>' + (baseUid < 0 ? 1 : 0) + '</IsBaseCalendar><BaseCalendarUID>' + baseUid + '</BaseCalendarUID><WeekDays>');
      for (var d = 1; d <= 7; d++) {
        if (workDays.indexOf(d - 1) < 0) out.push('<WeekDay><DayType>' + d + '</DayType><DayWorking>0</DayWorking></WeekDay>');
        else out.push('<WeekDay><DayType>' + d + '</DayType><DayWorking>1</DayWorking><WorkingTimes>' + workTimes + '</WorkingTimes></WeekDay>');
      }
      exceptions.forEach(function (h) {
        if (!U.parseDate(h)) return;
        out.push('<WeekDay><DayType>0</DayType><DayWorking>0</DayWorking><TimePeriod><FromDate>' + h + 'T00:00:00</FromDate><ToDate>' + h + 'T23:59:00</ToDate></TimePeriod></WeekDay>');
      });
      out.push('</WeekDays></Calendar>');
    }
    calendar(1, 'Standard', [1, 2, 3, 4, 5], p.holidays || [], -1);
    p.resources.forEach(function (r, i) {
      if (r.kind === 'Work') calendar(100 + i, r.name || 'Resource ' + (i + 1), r.workDays, (p.holidays || []).concat(r.vacations || []), 1);
    });
    out.push('</Calendars>');

    out.push('<Tasks>');
    s.rows.forEach(function (r) {
      var t = r.task;
      out.push('<Task>');
      el('UID', t.uid); el('ID', r.id); el('Name', t.name); el('Type', TYPE_CODE[t.type] || 0); el('IsNull', 0);
      el('WBS', r.wbs); el('OutlineNumber', r.wbs); el('OutlineLevel', t.level);
      el('Priority', t.priority);
      el('Start', U.iso(r.startDn) + 'T' + startTime);
      el('Finish', U.iso(r.finishDn) + 'T' + finishTime);
      el('Duration', hours(r.duration * hpd)); el('DurationFormat', 7);
      el('Work', hours(r.work));
      el('EffortDriven', t.effortDriven ? 1 : 0);
      el('Milestone', r.milestone ? 1 : 0); el('Summary', r.summary ? 1 : 0);
      el('Critical', r.critical ? 1 : 0);
      el('PercentComplete', r.percent || 0);
      el('Cost', Math.round(r.cost * 100));
      el('FixedCost', Math.round((+t.fixedCost || 0) * 100));
      el('FixedCostAccrual', 3);
      el('ActualCost', Math.round(r.actualCost * 100));
      if (t.actualStart) el('ActualStart', t.actualStart + 'T' + startTime);
      if (t.actualFinish) el('ActualFinish', t.actualFinish + 'T' + finishTime);
      el('ConstraintType', r.summary ? 0 : CONSTRAINT_CODE[t.constraint] || 0);
      if (!r.summary && t.constraintDate && t.constraint !== 'ASAP' && t.constraint !== 'ALAP') el('ConstraintDate', t.constraintDate + 'T' + startTime);
      if (t.deadline) el('Deadline', t.deadline + 'T' + finishTime);
      if (t.levelDelay) { el('LevelingDelay', Math.round(t.levelDelay * hpd * 600)); el('LevelingDelayFormat', 7); }
      if (t.notes) el('Notes', t.notes);
      t.preds.forEach(function (l) {
        out.push('<PredecessorLink><PredecessorUID>' + l.uid + '</PredecessorUID><Type>' + LINK_CODE[l.type] +
          '</Type><CrossProject>0</CrossProject><LinkLag>' + Math.round(l.lag * hpd * 600) + '</LinkLag><LagFormat>7</LagFormat></PredecessorLink>');
      });
      p.customFields.forEach(function (cf, k) {
        var v = t.custom && t.custom[cf.id];
        if (v == null || v === '') return;
        var num = cf.type === 'number';
        out.push('<ExtendedAttribute><FieldID>' + (num ? 188743767 + k : 188743731 + k) + '</FieldID><Value>' + x(v) + '</Value></ExtendedAttribute>');
      });
      if (r.base) {
        out.push('<Baseline><Number>0</Number><Start>' + U.iso(r.base.startDn) + 'T' + startTime + '</Start><Finish>' + U.iso(r.base.finishDn) + 'T' + finishTime +
          '</Finish><Duration>' + hours(r.base.duration * hpd) + '</Duration><DurationFormat>7</DurationFormat><Work>' + hours(r.base.work) + '</Work><Cost>' + Math.round(r.base.cost * 100) + '</Cost></Baseline>');
      }
      out.push('</Task>');
    });
    out.push('</Tasks>');

    out.push('<Resources>');
    p.resources.forEach(function (r, i) {
      var st = s.resStats[r.uid];
      out.push('<Resource>');
      el('UID', i + 1); el('ID', i + 1); el('Name', r.name); el('Type', KIND_CODE[r.kind]); el('IsNull', 0);
      el('Initials', r.initials); el('Group', r.type);
      if (r.kind === 'Material' && r.materialLabel) el('MaterialLabel', r.materialLabel);
      if (r.kind === 'Work') el('MaxUnits', (r.maxUnits / 100).toFixed(2));
      if (r.kind !== 'Cost') { el('StandardRate', r.rate); el('StandardRateFormat', r.kind === 'Material' ? 7 : 2); el('CostPerUse', Math.round((+r.costPerUse || 0) * 100)); }
      el('Work', hours(st.work)); el('Cost', Math.round(st.cost * 100));
      if (r.kind === 'Work') el('CalendarUID', 100 + i);
      if (r.role) el('Notes', r.role);
      if (r.kind === 'Work' && r.rates.length) {
        out.push('<Rates>');
        var list = [{ from: '1984-01-01', rate: r.rate }].concat(r.rates.slice().sort(function (a, b) { return a.from < b.from ? -1 : 1; }));
        list.forEach(function (e, k) {
          var to = list[k + 1] ? U.iso(U.parseDate(list[k + 1].from) - 1) + 'T23:59:00' : '2049-12-31T23:59:00';
          out.push('<Rate><RatesFrom>' + e.from + 'T00:00:00</RatesFrom><RatesTo>' + to + '</RatesTo><RateTable>0</RateTable><StandardRate>' + e.rate + '</StandardRate><StandardRateFormat>2</StandardRateFormat></Rate>');
        });
        out.push('</Rates>');
      }
      out.push('</Resource>');
    });
    out.push('</Resources>');

    out.push('<Assignments>');
    var aUid = 1, byUid = {};
    p.resources.forEach(function (r) { byUid[r.uid] = r; });
    s.rows.forEach(function (r) {
      if (r.summary) return;
      r.task.assignments.forEach(function (a) {
        var res = byUid[a.res];
        if (!res) return;
        out.push('<Assignment>');
        el('UID', aUid++); el('TaskUID', r.task.uid); el('ResourceUID', resUid[a.res]);
        if (res.kind === 'Work') { el('Units', (a.units / 100).toFixed(2)); el('Work', hours(a.units / 100 * hpd * r.duration)); }
        else if (res.kind === 'Material') el('Units', a.units);
        else el('Cost', Math.round(a.units * 100));
        el('Start', U.iso(r.startDn) + 'T' + startTime); el('Finish', U.iso(r.finishDn) + 'T' + finishTime);
        out.push('</Assignment>');
      });
    });
    out.push('</Assignments>');
    out.push('</Project>');
    return out.join('\n');
  }

  // PT40H0M0S -> hours
  function parseIsoHours(s) {
    var m = /PT(\d+(?:\.\d+)?)H(\d+(?:\.\d+)?)M(\d+(?:\.\d+)?)S/.exec(s || '');
    return m ? +m[1] + m[2] / 60 + m[3] / 3600 : 0;
  }

  function fromMSPDI(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('The file is not valid XML.');
    var root = doc.documentElement;
    if (root.localName !== 'Project') throw new Error('Not a Microsoft Project XML file.');
    function kids(node, name) {
      var outArr = [];
      for (var c = node.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) outArr.push(c);
      return outArr;
    }
    function val(node, name) { var k = kids(node, name)[0]; return k ? k.textContent : ''; }
    function list(parent, child) { var pn = kids(root, parent)[0]; return pn ? kids(pn, child) : []; }
    function day(v) { return v ? v.slice(0, 10) : ''; }

    var p = M.blank();
    p.name = val(root, 'Title') || (val(root, 'Name') || 'Imported project').replace(/\.(xml|mpp)$/i, '');
    p.organization = val(root, 'Company');
    p.manager = val(root, 'Author');
    var mpd = +val(root, 'MinutesPerDay') || 480;
    p.hoursPerDay = mpd / 60;
    if (val(root, 'CurrencySymbol')) p.currency = val(root, 'CurrencySymbol');
    if (val(root, 'StartDate')) p.start = day(val(root, 'StartDate'));
    p.statusDate = day(val(root, 'StatusDate'));

    var cfByField = {};
    list('ExtendedAttributes', 'ExtendedAttribute').forEach(function (ea) {
      var fname = val(ea, 'FieldName'), id = 'c' + (p.customFields.length + 1);
      if (!/^(Text|Number)\d+$/.test(fname)) return;
      p.customFields.push({ id: id, name: val(ea, 'Alias') || fname, type: /^Number/.test(fname) ? 'number' : 'text' });
      cfByField[val(ea, 'FieldID')] = id;
    });

    function exceptionsOf(c) {
      var outD = [], seenD = {}, wd = kids(c, 'WeekDays')[0], work = [1, 2, 3, 4, 5];
      if (wd) kids(wd, 'WeekDay').forEach(function (w) {
        var dt = +val(w, 'DayType');
        if (dt >= 1 && dt <= 7) {
          var on = val(w, 'DayWorking') === '1', k = dt - 1, at = work.indexOf(k);
          if (on && at < 0) work.push(k);
          if (!on && at >= 0) work.splice(at, 1);
          return;
        }
        if (dt !== 0 || val(w, 'DayWorking') !== '0') return;
        var tp = kids(w, 'TimePeriod')[0];
        if (!tp) return;
        addRange(tp);
      });
      // Project 2007+ and ProjectLibre store holidays as <Exceptions>.
      var ex = kids(c, 'Exceptions')[0];
      if (ex) kids(ex, 'Exception').forEach(function (e) {
        if (val(e, 'DayWorking') === '1') return;
        var tp = kids(e, 'TimePeriod')[0];
        if (tp) addRange(tp);
      });
      return { days: outD, work: work.sort() };
      function addRange(tp) {
        var a = U.parseDate(val(tp, 'FromDate')), b = U.parseDate(val(tp, 'ToDate'));
        for (var dn = a; a != null && b != null && dn <= b && dn - a < 3660; dn++) if (!seenD[dn]) { seenD[dn] = true; outD.push(U.iso(dn)); }
      }
    }
    var cals = {}, baseUid = val(root, 'CalendarUID');
    list('Calendars', 'Calendar').forEach(function (c) { cals[val(c, 'UID')] = exceptionsOf(c); });
    var baseCal = cals[baseUid] || cals[Object.keys(cals)[0]];
    if (baseCal) p.holidays = baseCal.days.slice();

    var resMap = {};
    list('Resources', 'Resource').forEach(function (r) {
      if (val(r, 'UID') === '0' || val(r, 'IsNull') === '1' || !val(r, 'Name')) return;
      var group = val(r, 'Group'), kind = KIND_NAME[+(val(r, 'Type') || 1)] || 'Work';
      var res = M.newResource(p, {
        name: val(r, 'Name'),
        initials: val(r, 'Initials') || M.initials(val(r, 'Name')),
        role: val(r, 'Notes'),
        type: M.RES_TYPES.indexOf(group) >= 0 ? group : 'Full-time',
        kind: kind,
        materialLabel: val(r, 'MaterialLabel'),
        maxUnits: Math.round((val(r, 'MaxUnits') === '' ? 1 : +val(r, 'MaxUnits')) * 100),
        rate: +val(r, 'StandardRate') || 0,
        costPerUse: (+val(r, 'CostPerUse') || 0) / 100
      });
      var rc = cals[val(r, 'CalendarUID')];
      if (rc) {
        res.workDays = rc.work;
        res.vacations = rc.days.filter(function (d) { return p.holidays.indexOf(d) < 0; });
      }
      var rates = kids(kids(r, 'Rates')[0] || r, 'Rate').filter(function (e) { return val(e, 'RateTable') === '0' || val(e, 'RateTable') === ''; });
      if (rates.length > 1) {
        res.rate = +val(rates[0], 'StandardRate') || res.rate;
        res.rates = rates.slice(1).map(function (e) { return { from: day(val(e, 'RatesFrom')), rate: +val(e, 'StandardRate') || 0 }; });
      }
      resMap[val(r, 'UID')] = res;
      p.resources.push(res);
    });

    var taskMap = {}, rawPreds = [];
    list('Tasks', 'Task').forEach(function (t) {
      if (val(t, 'UID') === '0' || val(t, 'IsNull') === '1') return;
      var durH = parseIsoHours(val(t, 'Duration'));
      var ct = CONSTRAINT_NAME[+val(t, 'ConstraintType')] || 'ASAP';
      var task = M.newTask(p, {
        name: val(t, 'Name'),
        level: Math.max(1, +val(t, 'OutlineLevel') || 1),
        duration: Math.round(durH / p.hoursPerDay * 100) / 100,
        milestone: val(t, 'Milestone') === '1',
        percent: +val(t, 'PercentComplete') || 0,
        notes: val(t, 'Notes'),
        type: TYPE_NAME[+val(t, 'Type')] || 'FixedUnits',
        effortDriven: val(t, 'EffortDriven') !== '0',
        priority: +val(t, 'Priority') || 500,
        fixedCost: (+val(t, 'FixedCost') || 0) / 100,
        constraint: ct,
        constraintDate: ct === 'ASAP' || ct === 'ALAP' ? '' : day(val(t, 'ConstraintDate')),
        deadline: day(val(t, 'Deadline')),
        actualStart: day(val(t, 'ActualStart')),
        actualFinish: day(val(t, 'ActualFinish')),
        levelDelay: val(t, 'LevelingDelay') ? Math.round((+val(t, 'LevelingDelay') || 0) / (mpd * 10) * 100) / 100 : 0
      });
      kids(t, 'ExtendedAttribute').forEach(function (ea) {
        var id = cfByField[val(ea, 'FieldID')];
        if (id) task.custom[id] = val(ea, 'Value');
      });
      var bl = kids(t, 'Baseline').filter(function (b) { return val(b, 'Number') === '0'; })[0];
      if (bl && val(bl, 'Start')) {
        p.baseline = p.baseline || { savedAt: new Date().toISOString(), tasks: {} };
        p.baseline.tasks[task.uid] = {
          start: day(val(bl, 'Start')), finish: day(val(bl, 'Finish')),
          duration: Math.round(parseIsoHours(val(bl, 'Duration')) / p.hoursPerDay * 100) / 100,
          work: parseIsoHours(val(bl, 'Work')), cost: (+val(bl, 'Cost') || 0) / 100
        };
      }
      taskMap[val(t, 'UID')] = task;
      kids(t, 'PredecessorLink').forEach(function (l) {
        rawPreds.push({
          task: task, pred: val(l, 'PredecessorUID'),
          type: LINK_NAME[+val(l, 'Type')] || 'FS',
          lag: Math.round((+val(l, 'LinkLag') || 0) / (mpd * 10) * 100) / 100
        });
      });
      p.tasks.push(task);
    });
    rawPreds.forEach(function (l) {
      if (taskMap[l.pred]) l.task.preds.push({ uid: taskMap[l.pred].uid, type: l.type, lag: l.lag });
    });
    list('Assignments', 'Assignment').forEach(function (a) {
      var task = taskMap[val(a, 'TaskUID')], res = resMap[val(a, 'ResourceUID')];
      if (!task || !res) return;
      var units = res.kind === 'Cost' ? (+val(a, 'Cost') || 0) / 100
        : res.kind === 'Material' ? +val(a, 'Units') || 0
        : Math.round((val(a, 'Units') === '' ? 1 : +val(a, 'Units')) * 100);
      task.assignments.push({ res: res.uid, units: units });
    });
    M.normalize(p);
    p.tasks.forEach(function (t, i) { if (M.isSummary(p, i)) t.assignments = []; });
    return p;
  }

  /* ---------- CSV ---------- */

  function toCSV(p) {
    var s = OP.schedule(p), idx = M.indexByUid(p);
    var head = ['ID', 'WBS', 'Task Name', 'Level', 'Duration (days)', 'Start', 'Finish', 'Predecessors', 'Resources',
      'Work (h)', 'Cost', 'ES', 'EF', 'LS', 'LF', 'Total Slack', 'Critical', '% Complete'];
    var lines = [head];
    s.rows.forEach(function (r) {
      lines.push([r.id, r.wbs, r.task.name, r.task.level, r.duration, U.iso(r.startDn), U.iso(r.finishDn),
        M.formatPreds(p, r.task, idx), r.names, Math.round(r.work * 10) / 10, Math.round(r.cost),
        r.es, r.ef, r.ls, r.lf, r.slack, r.critical ? 'Yes' : 'No', r.task.percent || 0]);
    });
    return lines.map(function (row) {
      return row.map(function (raw) {
        var v = String(raw == null ? '' : raw);
        // Text starting with a formula character would run as a formula in Excel or Sheets.
        if (typeof raw === 'string' && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
  }

  /* ---------- images ---------- */

  // Resolve var(--token) references (always with the light theme, for documents) so the SVG renders outside the page.
  function standaloneSVG(svg) {
    var root = document.documentElement, prevTheme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    var cs = getComputedStyle(root), vars = {};
    var text = new XMLSerializer().serializeToString(svg);
    text.replace(/var\((--[\w-]+)\)/g, function (_, name) { vars[name] = cs.getPropertyValue(name).trim() || '#000'; });
    var bgColor = cs.getPropertyValue('--surface').trim() || '#fff';
    if (prevTheme == null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prevTheme);
    text = text.replace(/var\((--[\w-]+)\)/g, function (_, name) { return vars[name]; });
    if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(text)) text = text.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return text.replace(/(<style>[\s\S]*?<\/style>)/, '$1<rect width="100%" height="100%" fill="' + bgColor + '"/>');
  }

  function exportSVG(svg, name) {
    U.download(name + '.svg', standaloneSVG(svg), 'image/svg+xml');
  }

  function exportPNG(svg, name) {
    var w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
    // Browsers cap canvas side length and total area (about 16 megapixels on Safari).
    var scale = Math.min(2, 16000 / Math.max(w, h), Math.sqrt(16e6 / (w * h)));
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      var ctx = c.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(function (b) {
        if (b) U.download(name + '.png', b);
        else OP.notify('The chart is too large for a PNG. Try the SVG export instead.');
      }, 'image/png');
    };
    img.onerror = function () { OP.notify('Could not create the image. Try the SVG export instead.'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(standaloneSVG(svg));
  }

  function printSVG(svg, title) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(f);
    var w = f.contentWindow;
    w.onafterprint = function () { setTimeout(function () { f.remove(); }, 0); };
    // Some browsers (Safari) do not fire afterprint reliably.
    setTimeout(function () { f.remove(); }, 60000);
    w.document.write('<!doctype html><title>' + U.esc(title) + '</title><style>@page{size:landscape;margin:10mm}body{margin:0}svg{width:100%;height:auto}</style>' +
      standaloneSVG(svg));
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 300);
  }

  return {
    toJSON: toJSON, fromJSON: fromJSON, toMSPDI: toMSPDI, fromMSPDI: fromMSPDI, toCSV: toCSV,
    parseAny: parseAny, insertProject: insertProject, exportSVG: exportSVG, exportPNG: exportPNG, printSVG: printSVG
  };
})();
