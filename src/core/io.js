import OP from './core.js';
/* File formats: OpenPlan JSON, CSV, and SVG/PNG image export. */
OP.io = (function () {
  var U = OP.util, M = OP.model;

  function toJSON(p) { return JSON.stringify(p, null, 2); }

  function fromJSON(text) {
    var p = JSON.parse(text);
    if (!p || !Array.isArray(p.tasks) || !Array.isArray(p.resources)) throw new Error('Not an OpenPlan project file.');
    return M.normalize(p);
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

  /* ---------- CSV ---------- */

  // The task table shared by the CSV and Excel exports: a header row, then one row per task.
  function taskTable(p) {
    var s = OP.schedule(p), idx = M.indexByUid(p);
    var head = ['ID', 'WBS', 'Task Name', 'Level', 'Duration (days)', 'Start', 'Finish', 'Predecessors', 'Resources',
      'Work (h)', 'Cost', 'ES', 'EF', 'LS', 'LF', 'Total Slack', 'Critical', '% Complete'];
    var lines = [head];
    s.rows.forEach(function (r) {
      lines.push([r.id, r.wbs, r.task.name, r.task.level, r.duration, U.iso(r.startDn), U.iso(r.finishDn),
        M.formatPreds(p, r.task, idx), r.names, Math.round(r.work * 10) / 10, Math.round(r.cost),
        r.es, r.ef, r.ls, r.lf, r.slack, r.critical ? 'Yes' : 'No', r.task.percent || 0]);
    });
    return lines;
  }

  function toCSV(p) {
    return taskTable(p).map(function (row) {
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

  /* ---------- printing ---------- */

  // Page sizes in millimetres, landscape (long side first).
  var PAPER = { A4: [297, 210], A3: [420, 297], Letter: [279.4, 215.9] };
  var MM = 96 / 25.4, MARGIN = 10, EXTRA = 36; // EXTRA: room for the title above and the page number below, in pixels

  // The rows that go on each page. Rows are never cut, and the header (hdr high) is repeated at the top of every
  // page. availH is the page height in chart units. Returns [{y, h, hdr}].
  function splitRows(H, hdr, rowH, availH) {
    if (H <= availH) return [{ y: 0, h: H, hdr: 0 }];
    var per = Math.max(1, Math.floor((availH - hdr) / rowH)), rows = Math.ceil((H - hdr) / rowH), pages = [];
    for (var r = 0; r < rows; r += per) pages.push({ y: hdr + r * rowH, h: Math.min(per, rows - r) * rowH, hdr: hdr });
    return pages;
  }

  // A chart scaled to the page width, split into pages down the rows.
  function splitPages(W, H, hdr, rowH, pageW, pageH) { return splitRows(H, hdr, rowH, pageH / (pageW / W)); }

  // Pages for a wide, tall chart. The chart is shown at the page width unless that would make it smaller than
  // minScale; then it is shown at minScale and split sideways too. Every sideways page repeats the first tableW
  // units (the task table) and then continues the timeline where the last one stopped.
  // Returns {scale, bands: [{x, w, left}], rows: [{y, h, hdr}]}; pages go down each band, then across.
  function layoutPages(W, H, o, pageW, pageH) {
    var scale = pageW / W, bands, min = o.minScale || 0.8;
    if (scale >= min || !o.tableW || o.tableW >= pageW / min) {
      bands = [{ x: 0, w: W, left: null }];
    } else {
      scale = min;
      var availW = pageW / scale, rw = availW - o.tableW, x = availW;
      bands = [{ x: 0, w: Math.min(W, availW), left: null }];
      while (x < W) { bands.push({ x: x, w: Math.min(rw, W - x), left: { x: 0, w: o.tableW } }); x += rw; }
    }
    return { scale: scale, bands: bands, rows: splitRows(H, o.hdr, o.rowH, pageH / scale) };
  }

  // The same picture shown through a window: x from x to x + w, y from y to y + h, drawn at the given scale.
  function windowSVG(text, x, y, w, h, scale) {
    var tag = text.match(/<svg\b[^>]*>/)[0];
    var next = tag.replace(/\swidth="[^"]*"/, ' width="' + Math.round(w * scale * 100) / 100 + '"').replace(/\sheight="[^"]*"/, ' height="' + Math.round(h * scale * 100) / 100 + '"')
      .replace(/\sviewBox="[^"]*"/, ' viewBox="' + x + ' ' + y + ' ' + w + ' ' + h + '"');
    return text.replace(tag, next);
  }

  // The page(s) for one chart as HTML.
  // opts: {paper: 'A4' | 'A3' | 'Letter', landscape, fitOne, hdr, rowH, tableW, minScale, date}.
  // With hdr and rowH a tall chart is split over pages (and, with tableW, a wide one too); otherwise, or with
  // fitOne, the whole chart is fitted onto one page.
  function printHTML(text, W, H, title, opts) {
    opts = opts || {};
    var paper = PAPER[opts.paper] || PAPER.A4, land = opts.landscape !== false;
    var wmm = land ? paper[0] : paper[1], hmm = land ? paper[1] : paper[0];
    var pageW = (wmm - 2 * MARGIN) * MM, pageH = (hmm - 2 * MARGIN) * MM - EXTRA;
    var size = (opts.paper && PAPER[opts.paper] ? opts.paper : 'A4') + ' ' + (land ? 'landscape' : 'portrait');
    var date = opts.date || new Date().toLocaleDateString();
    var pages = [];   // each: the HTML of the picture on that page
    if (opts.hdr && opts.rowH && !opts.fitOne) {
      var lay = layoutPages(W, H, opts, pageW, pageH), sc = lay.scale;
      lay.bands.forEach(function (band) {
        lay.rows.forEach(function (rp) {
          var cols = band.left ? [band.left, { x: band.x, w: band.w }] : [{ x: band.x, w: band.w }];
          var line = function (y, h) { return '<div class="r">' + cols.map(function (c) { return windowSVG(text, c.x, y, c.w, h, sc); }).join('') + '</div>'; };
          pages.push((rp.hdr ? line(0, rp.hdr) : '') + line(rp.y, rp.h));
        });
      });
    } else {
      var k = Math.min(pageW / W, pageH / H);
      pages.push('<div class="r">' + windowSVG(text, 0, 0, W, H, k) + '</div>');
    }
    var body = pages.map(function (pic, i) {
      return '<section class="page"><div class="t">' + U.esc(title) + '</div><div class="pic">' + pic + '</div>' +
        '<div class="f"><span>' + U.esc(date) + '</span><span>Page ' + (i + 1) + ' of ' + pages.length + '</span></div></section>';
    }).join('');
    return '<!doctype html><meta charset="utf-8"><title>' + U.esc(title) + '</title><style>' +
      '@page{size:' + size + ';margin:' + MARGIN + 'mm}*{box-sizing:border-box}body{margin:0;font:11px "Source Sans 3 Variable","Segoe UI",Arial,sans-serif;color:#333}' +
      '.page{break-after:page}.page:last-child{break-after:auto}.t{font-weight:700;font-size:13px;height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.r{display:flex;align-items:flex-start}.r svg{display:block;flex:none}.f{display:flex;justify-content:space-between;color:#777;font-size:10px;margin-top:6px}</style>' + body;
  }

  function printSVG(svg, title, opts) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(f);
    var w = f.contentWindow;
    w.onafterprint = function () { setTimeout(function () { f.remove(); }, 0); };
    // Some browsers (Safari) do not fire afterprint reliably.
    setTimeout(function () { f.remove(); }, 60000);
    w.document.write(printHTML(standaloneSVG(svg), +svg.getAttribute('width'), +svg.getAttribute('height'), title, opts));
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 300);
  }

  return {
    toJSON: toJSON, fromJSON: fromJSON, taskTable: taskTable, toCSV: toCSV, insertProject: insertProject, exportSVG: exportSVG, exportPNG: exportPNG, printSVG: printSVG, printHTML: printHTML, splitPages: splitPages, layoutPages: layoutPages, PAPER: PAPER
  };
})();
