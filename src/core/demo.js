import OP from './core.js';
/* Sample project used to demonstrate the tool. */
OP.demo = function () {
  var M = OP.model;
  var p = M.blank();
  p.name = 'Library Booking App (Sample)';
  p.organization = 'Sample Organisation';
  p.manager = 'A. Perera';
  p.start = '2026-01-05';
  p.issueDate = '2026-01-02';
  p.budget = 4000000;

  var R = {};
  [
    ['pm', 'A. Perera', 'Project Manager', 'Manager', 50, 8000, null],
    ['dev1', 'N. Silva', 'Lead Developer', 'Full-time', 100, 7000, 'pm'],
    ['dev2', 'K. Fernando', 'Developer', 'Full-time', 100, 7000, 'dev1'],
    ['dev3', 'S. Jayasuriya', 'UI/UX Developer', 'Full-time', 100, 7000, 'dev1'],
    ['qa', 'R. Dias', 'QA Engineer', 'Part-time', 50, 7000, 'pm'],
    ['ba', 'M. Gunawardena', 'Business Analyst', 'Part-time', 50, 7000, 'pm'],
    ['ops', 'T. Wickrama', 'DevOps / CM', 'Part-time', 50, 7000, 'pm'],
    ['doc', 'L. Bandara', 'Technical Writer', 'Supporter', 50, 5000, 'pm']
  ].forEach(function (d) {
    R[d[0]] = M.newResource(p, { name: d[1], initials: M.initials(d[1]), role: d[2], type: d[3], maxUnits: d[4], rate: d[5] });
    R[d[0]]._boss = d[6];
    p.resources.push(R[d[0]]);
  });
  p.resources.forEach(function (r) { r.reportsTo = r._boss ? R[r._boss].uid : null; delete r._boss; });

  var T = {};
  function add(key, level, name, duration, preds, assign, extra) {
    var t = M.newTask(p, { name: name, level: level, duration: duration });
    if (duration === 0) t.milestone = true;
    t.preds = (preds || []).map(function (k) {
      var parts = k.split(':');
      return { uid: T[parts[0]].uid, type: parts[1] || 'FS', lag: +(parts[2] || 0) };
    });
    t.assignments = (assign || []).map(function (a) {
      var parts = a.split(':');
      return { res: R[parts[0]].uid, units: +(parts[1] || 100) };
    });
    for (var k in extra) t[k] = extra[k];
    if (key) T[key] = t;
    p.tasks.push(t);
  }

  add('init', 1, 'Project initiation', 0);
  add('kick', 2, 'Kick-off meeting', 1, [], ['pm:50', 'ba:50']);
  add('req', 2, 'Gather requirements & user stories', 4, ['kick'], ['ba:50', 'dev1']);
  add('plan', 2, 'Sprint planning & backlog', 2, ['req'], ['pm:50', 'dev1']);
  add('mInit', 2, 'Backlog approved', 0, ['plan']);

  add('s1', 1, 'Sprint 1 - Core booking', 0);
  add('arch', 2, 'Architecture & database design', 3, ['mInit'], ['dev1', 'dev2']);
  add('ui1', 2, 'UI wireframes', 4, ['mInit'], ['dev3']);
  add('api', 2, 'Booking API', 5, ['arch'], ['dev1', 'dev2']);
  add('scr', 2, 'Booking screens', 5, ['ui1', 'arch'], ['dev3']);
  add('t1', 2, 'Sprint 1 testing', 3, ['api', 'scr'], ['qa:50']);
  add('m1', 2, 'Sprint 1 review', 0, ['t1']);

  add('s2', 1, 'Sprint 2 - Notifications & admin', 0);
  add('notif', 2, 'Notification service', 5, ['m1'], ['dev2']);
  add('admin', 2, 'Admin dashboard', 6, ['m1'], ['dev1', 'dev3']);
  add('t2', 2, 'Sprint 2 testing', 3, ['notif', 'admin'], ['qa:50']);
  add('m2', 2, 'Sprint 2 review', 0, ['t2']);

  add('sup', 1, 'Support processes', 0);
  add('cm', 2, 'Configuration management', 5, ['mInit'], ['ops:50'], {});
  add('docs', 2, 'User documentation', 5, ['m1'], ['doc:50']);
  add('deploy', 2, 'Deployment & handover', 2, ['m2', 'docs'], ['ops:50', 'pm:50']);
  add('done', 2, 'Project closed', 0, ['deploy']);

  // Summary rows were added with duration 0 above; they are computed from children.
  p.tasks.forEach(function (t, i) { if (M.isSummary(p, i)) { t.milestone = false; t.duration = 1; } });
  return p;
};
