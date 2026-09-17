  // ─── the custom application ───────────────────────────────────────────────────────────────────
  var CFG = { checkField: 'C_AI_CHECK', actionsField: 'C_AI_ACTIONS', reportField: 'C_AI_REPORT', localReports: 'http://localhost:8765' };
  var S = { obj: null, report: null, pointer: null, review: null };
  var $ = function (id) { return document.getElementById(id); };
  function say(msg, kind) { var main = document.querySelector('.aicheck-app main.wrap'); var e = (main && !main.hidden) ? $('aicheck-msg') : $('aicheck-msg0'); if (!e) e = $('aicheck-msg0') || $('aicheck-msg'); if (e) { e.textContent = msg; e.className = 'appmsg ' + (kind || ''); } var other = (e && e.id === 'aicheck-msg') ? $('aicheck-msg0') : $('aicheck-msg'); if (other) { other.textContent = ''; other.className = 'appmsg'; } }

  var PICKER = '' +
    '<section class="panel apppanel" id="aicheck-picker">' +
    '  <div class="approw"><label>Layout or template <input id="aicheck-id" size="7" placeholder="ID"></label>' +
    '    <button class="btn primary" id="aicheck-load">Load</button>' +
    '    <label>in progress <select id="aicheck-list"><option value="">(loading…)</option></select></label>' +
    '    <button class="btn" id="aicheck-request" disabled>Request a check</button>' +
    '    <button class="btn" id="aicheck-checktpl" disabled>Check the template</button>' +
    '    <label class="btn">Report file… <input type="file" id="aicheck-file" accept="application/json" hidden></label>' +
    '    <span id="aicheck-msg0" class="appmsg"></span></div>' +
    '  <details class="appdetails"><summary>Layout details</summary><div class="approw"><span id="aicheck-layoutline" class="line"></span></div><div class="approw"><span id="aicheck-reportline" class="line"></span></div><div class="approw"><span id="aicheck-buildline"></span></div></details>' +
    '</section>';

  // Studio does not tell the page how tall its container is: measure the room below the app's top edge, so the
  // two columns scroll inside the panel and the Send bar sits at the bottom (C31 — the page was clipped, not scrolled)
  function fitHeight() { var app = document.querySelector('.aicheck-app'); if (!app) return; var top = app.getBoundingClientRect().top; var h = window.innerHeight - top - 4; if (h > 240) app.style.height = h + 'px'; fitPage(); }
  // the page box is as wide as its column by default; cap it so the whole page fits the room the preview column has
  // (tabs, zoom bar and legend subtracted), otherwise the bottom of the page is out of view and the zoom centres there
  function fitPage() { var page = document.getElementById('page'), st = document.querySelector('.aicheck-app .stage'); if (!page || !st || !S.pageSize) return; var room = st.clientHeight - 28; if (room < 120) { page.style.maxWidth = ''; return; } var ar = String(page.style.aspectRatio || '').split('/'), w = parseFloat(ar[0]) || S.pageSize[0], h = parseFloat(ar[1]) || S.pageSize[1]; page.style.maxWidth = 'min(100%, ' + Math.floor(room * w / h) + 'px)'; }   // the stage fills the column (flex); the page box fits inside it, and the zoom uses the stage as its window
  // the divider between the columns: drag to resize, double-click to reset; the width is a per-browser convenience
  function initSplitter() {
    var sp = $('aicheck-split'), main = document.querySelector('.aicheck-app main.wrap'); if (!sp || !main) return;
    var KEY = 'aicheck-split', down = null;
    function apply(px) { var max = main.clientWidth - 380; if (px < 260) px = 260; if (px > max) px = max; main.style.gridTemplateColumns = px + 'px 8px 1fr'; return px; }
    try { var saved = parseInt(localStorage.getItem(KEY), 10); if (saved > 0) apply(saved); } catch (e) {}
    sp.addEventListener('pointerdown', function (ev) { if (ev.button !== 0) return; var vw = main.querySelector('.viewer'); down = { x: ev.clientX, w: vw ? vw.getBoundingClientRect().width : 400 }; sp.classList.add('active'); try { sp.setPointerCapture(ev.pointerId); } catch (e) {} ev.preventDefault(); });
    sp.addEventListener('pointermove', function (ev) { if (!down) return; apply(down.w + (ev.clientX - down.x)); });
    function up() { if (!down) return; down = null; sp.classList.remove('active'); var vw = main.querySelector('.viewer'); try { if (vw) localStorage.setItem(KEY, String(Math.round(vw.getBoundingClientRect().width))); } catch (e) {} }
    sp.addEventListener('pointerup', up); sp.addEventListener('pointercancel', up);
    sp.addEventListener('dblclick', function () { main.style.gridTemplateColumns = ''; try { localStorage.removeItem(KEY); } catch (e) {} });
  }

  function listInProgress() {
    var sel = $('aicheck-list'); if (!sel) return;
    var values = ['Requested', 'Checked', 'Fixes approved', 'Fixes applied'], rows = [];
    // one exact-match query per value: range/inequality operators on this server return nothing silently
    var chain = Promise.resolve();
    values.forEach(function (v) { chain = chain.then(function () { return callServer('QueryObjects', { Params: [{ Property: 'Type', Operation: '=', Value: 'Layout', __classname__: 'QueryParam' }, { Property: CFG.checkField, Operation: '=', Value: v, __classname__: 'QueryParam' }], MinimalProps: ['ID', 'Name', CFG.checkField], MaxEntries: 50, __classname__: 'WflQueryObjectsRequest' }).then(function (r) { var cols = (r.Columns || []).map(function (c) { return c.Name; }); (r.Rows || []).forEach(function (row) { var o = {}; cols.forEach(function (c, i) { o[c] = row[i]; }); rows.push(o); }); }).catch(function () {}); }); });
    chain.then(function () { sel.innerHTML = '<option value="">' + (rows.length ? 'choose…' : 'none in progress') + '</option>'; rows.forEach(function (o) { var op = document.createElement('option'); op.value = o.ID; op.textContent = o.Name + ' (' + o.ID + ') · ' + (o[CFG.checkField] || ''); sel.appendChild(op); }); });
  }

  function loadLayout(id) {
    say('Loading ' + id + '…');
    return callServer('GetObjects', { IDs: [String(id)], Lock: false, Rendition: 'preview', RequestInfo: ['MetaData', 'Pages', 'Relations'], __classname__: 'WflGetObjectsRequest' }).then(function (res) {
      var o = res.Objects[0]; S.obj = o; var md = o.MetaData;
      $('aicheck-layoutline').textContent = md.BasicMetaData.Name + ' · ' + md.BasicMetaData.Type + ' ' + md.BasicMetaData.ID + ' · v' + md.WorkflowMetaData.Version + ' · status “' + md.WorkflowMetaData.State.Name + '”' + (md.WorkflowMetaData.LockedBy ? ' · in use by ' + md.WorkflowMetaData.LockedBy : '') + ' · AI check: ' + (extraOf(o, CFG.checkField) || 'not requested');
      var ptr = extraOf(o, CFG.reportField); S.pointer = null; try { S.pointer = ptr ? JSON.parse(ptr) : null; } catch (e) {}
      $('aicheck-reportline').textContent = S.pointer ? ('Latest run ' + S.pointer.runId + ' at ' + S.pointer.at + ': ' + S.pointer.summary) : 'No report on this layout yet. Request a check, then check the layout in from InDesign.';
      $('aicheck-request').disabled = false;
      S.templateId = (md.BasicMetaData.Type === 'Layout' && /^\d+$/.test(extraOf(o, 'C_LAYOUT_TEMPLATE_ID'))) ? extraOf(o, 'C_LAYOUT_TEMPLATE_ID') : null;
      $('aicheck-checktpl').disabled = !S.templateId; $('aicheck-checktpl').title = S.templateId ? REVIEW_TIPS.checkTemplate : 'This layout does not name its template (no template ID property).';
      if (S.pointer && S.pointer.file) return fetch(CFG.localReports + '/localreport?path=' + encodeURIComponent(S.pointer.file), { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('local report ' + r.status); return r.json(); }).then(buildPage).catch(function (e) { say('Layout loaded. The report file is not reachable from here (' + e.message + '): load it from a file.', 'warn'); });
      say('Layout loaded.', 'ok');
    }).catch(function (e) { say(e.message, 'err'); });
  }

  function buildPage(report) {
    S.report = report; var images = {};
    (S.obj.Pages || []).forEach(function (p) { var f = (p.Files || []).filter(function (x) { return x.Rendition === 'preview'; })[0]; if (f && f.FileUrl) images[String(p.PageNumber)] = withWwApp(f.FileUrl); });
    var D = ReviewEnrich.buildData(report, images, 'Report ' + report.runId + ' on ' + S.obj.MetaData.BasicMetaData.Name + ' v' + S.obj.MetaData.WorkflowMetaData.Version + '; previews from Studio at that version.');
    if (!D.layout.template) { var tid = extraOf(S.obj, 'C_LAYOUT_TEMPLATE_ID'), tnm = extraOf(S.obj, 'C_LAYOUT_TEMPLATE_NAME'); if (tid || tnm) D.layout.template = { id: tid || null, name: tnm || null }; }
    var pub = S.obj.MetaData.BasicMetaData.Publication; D.layout.brand = (pub && pub.Name) || null;   // an "always" rule is scoped to the brand
    var main = document.querySelector('.aicheck-app main.wrap'); if (main) main.hidden = false;
    fitHeight();
    $('title').textContent = (report.layout && report.layout.name || S.obj.MetaData.BasicMetaData.Name).replace(/\.indd$/, '');
    S.review = window.bootReview(D); S.pageSize = D.pageSize;
    fitPage(); if (window.ResizeObserver && !S.ro) { S.ro = new ResizeObserver(function () { fitPage(); }); S.ro.observe(document.querySelector('.aicheck-app .viewer')); }
    $('aicheck-send').disabled = false;
    say('Loaded. Choose an action on each finding, decide the labels, then Send.', 'ok');
  }

  // who is deciding: the SDK's info block — field names untested on this server, so every shape is tried and '' is the fallback
  function whoAmI() { try { var i = ContentStationSdk.getInfo() || {}; var u = i.User || i.user || {}; return u.FullName || u.UserName || u.Name || i.UserName || i.FullName || i.User || ''; } catch (e) { return ''; } }
  function send() {
    var out = window.REVIEW_OUT || {}, acts = out.actions || [], rules = out.rules || [], ign = out.ignore || [], todos = out.todos || [];
    var labelsDecided = Object.keys(out.labels || {}).filter(function (k) { return out.labels[k]; }).length;
    if (!acts.length && !rules.length && !ign.length && !todos.length && !labelsDecided) { say('No decisions yet.', 'warn'); return; }
    var payload = { runId: S.report.runId, decidedAt: new Date().toISOString(), decidedBy: whoAmI(), actions: acts, ignore: ign, rules: rules, labels: out.labels || {}, labelText: out.labelText || {}, todos: todos }, props = {};
    props[CFG.actionsField] = JSON.stringify(payload);
    if (acts.length) props[CFG.checkField] = 'Fixes approved';   // nothing to apply → the decisions are recorded, the field stays as it is
    var n = acts.length, what = n + ' fix' + (n === 1 ? '' : 'es') + (rules.length ? ', ' + rules.length + ' always rule' + (rules.length === 1 ? '' : 's') : '') + (ign.length ? ', ' + ign.length + ' ignored' : '') + (todos.length ? ', ' + todos.length + ' template to-do' + (todos.length === 1 ? '' : 's') : '');
    say('Sending…'); setProps(S.obj.MetaData.BasicMetaData.ID, props).then(function () { say('Sent: ' + what + '.' + (n ? ' Now open the layout in InDesign (checked out) and check it in: the fixes apply during that check-in.' : ' Nothing to apply, so the AI check field is unchanged.'), 'ok'); if (n) notify('AI Check: ' + n + ' fix' + (n === 1 ? '' : 'es') + ' approved for the next check-in', 'info'); listInProgress(); }).catch(function (e) { say('Send failed: ' + e.message, 'err'); });
  }
  function requestCheck() { var p = {}; p[CFG.checkField] = 'Requested'; setProps(S.obj.MetaData.BasicMetaData.ID, p).then(function () { say('AI check set to “Requested”: it runs at the next check-in of this layout.', 'ok'); listInProgress(); }).catch(function (e) { say('Request failed: ' + e.message, 'err'); }); }
  function checkTemplate() { if (!S.templateId) { say('This layout does not name its template.', 'warn'); return; } var p = {}; p[CFG.checkField] = 'Requested'; setProps(S.templateId, p).then(function () { say('AI check set to “Requested” on template ' + S.templateId + ': it runs at the template\'s next check-in.', 'ok'); listInProgress(); }).catch(function (e) { say('Request on the template failed: ' + e.message, 'err'); }); }

  ContentStationSdk.registerCustomApp({
    name: 'ai-check', title: 'AI Check',
    content: '<div class="aicheck-app" data-theme="light">' + PICKER + PAGE_HTML + '</div>',
    onInit: function () {
      if (!document.getElementById('aicheck-style')) { var st = document.createElement('style'); st.id = 'aicheck-style'; st.textContent = PAGE_CSS; document.head.appendChild(st); }
      var main = document.querySelector('.aicheck-app main.wrap'); if (main) main.hidden = true;
      fitHeight(); window.addEventListener('resize', fitHeight); setTimeout(fitHeight, 300);
      var bl = $('aicheck-buildline'); if (bl) bl.textContent = 'AI Check plug-in build ' + VERSION;
      initSplitter();
      document.addEventListener('aicheck:view', function () { fitPage(); });   // the page script says when it shows a different page or spread
      var foot = document.getElementById('foot'); if (foot) { foot.textContent = 'AI Check plug-in ' + VERSION; foot.setAttribute('data-fixed', '1'); }
      $('aicheck-load').onclick = function () { var id = $('aicheck-id').value.trim(); if (id) loadLayout(id); };
      $('aicheck-list').onchange = function () { if (this.value) { $('aicheck-id').value = this.value; loadLayout(this.value); } };
      $('aicheck-file').onchange = function () { var f = this.files[0]; if (!f || !S.obj) { say('Load the layout first.', 'warn'); return; } var rd = new FileReader(); rd.onload = function () { try { buildPage(JSON.parse(rd.result)); } catch (e) { say('Not a runner report: ' + e.message, 'err'); } }; rd.readAsText(f); };
      $('aicheck-request').onclick = requestCheck; $('aicheck-request').title = REVIEW_TIPS.request;
      $('aicheck-checktpl').onclick = checkTemplate; $('aicheck-checktpl').title = REVIEW_TIPS.checkTemplate;
      $('aicheck-send').onclick = send; $('aicheck-send').title = REVIEW_TIPS.send;
      listInProgress();
    },
    buttons: [{ label: 'Reload', type: 'secondary', callback: function () { if (S.obj) loadLayout(S.obj.MetaData.BasicMetaData.ID); listInProgress(); } }]
  });
  window.__aiCheck = { state: S, version: VERSION, loadLayout: loadLayout };
  // harness demo: window.__aiCheckDemo = { report: url, previews: {pageName: url}, name, version } — builds the page without Studio
  if (window.__aiCheckDemo) setTimeout(function () { var d = window.__aiCheckDemo; S.obj = { MetaData: { BasicMetaData: { ID: d.id || '0', Name: d.name || 'demo', Type: 'Layout' }, WorkflowMetaData: { Version: d.version || '0', State: { Name: 'demo' } }, ExtraMetaData: [] }, Pages: Object.keys(d.previews || {}).map(function (pn) { return { PageNumber: pn, Files: [{ Rendition: 'preview', FileUrl: d.previews[pn] + '?ww-app=x' }] }; }) }; fetch(d.report).then(function (r) { return r.json(); }).then(buildPage).catch(function (e) { say('demo: ' + e.message, 'err'); }); }, 50);
