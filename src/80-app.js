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
    '    <button class="btn" id="aicheck-request" disabled>Request a check at the next check-in</button>' +
    '    <label class="btn">Report file… <input type="file" id="aicheck-file" accept="application/json" hidden></label>' +
    '    <span id="aicheck-msg0" class="appmsg"></span></div>' +
    '  <div class="approw"><span id="aicheck-layoutline" class="line"></span><span id="aicheck-reportline" class="line"></span></div>' +
    '</section>';

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
      if (S.pointer && S.pointer.file) return fetch(CFG.localReports + '/localreport?path=' + encodeURIComponent(S.pointer.file), { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('local report ' + r.status); return r.json(); }).then(buildPage).catch(function (e) { say('Layout loaded. The report file is not reachable from here (' + e.message + '): load it from a file.', 'warn'); });
      say('Layout loaded.', 'ok');
    }).catch(function (e) { say(e.message, 'err'); });
  }

  function buildPage(report) {
    S.report = report; var images = {};
    (S.obj.Pages || []).forEach(function (p) { var f = (p.Files || []).filter(function (x) { return x.Rendition === 'preview'; })[0]; if (f && f.FileUrl) images[String(p.PageNumber)] = withWwApp(f.FileUrl); });
    var D = ReviewEnrich.buildData(report, images, 'Report ' + report.runId + ' on ' + S.obj.MetaData.BasicMetaData.Name + ' v' + S.obj.MetaData.WorkflowMetaData.Version + '; previews from Studio at that version.');
    if (!D.layout.template) { var tid = extraOf(S.obj, 'C_LAYOUT_TEMPLATE_ID'), tnm = extraOf(S.obj, 'C_LAYOUT_TEMPLATE_NAME'); if (tid || tnm) D.layout.template = { id: tid || null, name: tnm || null }; }
    var main = document.querySelector('.aicheck-app main.wrap'); if (main) main.hidden = false;
    $('title').textContent = (report.layout && report.layout.name || S.obj.MetaData.BasicMetaData.Name).replace(/\.indd$/, '');
    S.review = window.bootReview(D);
    $('aicheck-send').disabled = false; $('aicheck-sendtpl').disabled = false;
    say('Loaded. Tick fixes, decide labels, then send.', 'ok');
  }

  function sendFixes() {
    var out = window.REVIEW_OUT || {}, acts = out.actions || []; if (!acts.length) { say('Nothing ticked.', 'warn'); return; }
    var payload = { runId: S.report.runId, decidedAt: new Date().toISOString(), actions: acts, ignore: out.ignore || [], labels: out.labels || {} }, props = {};
    props[CFG.actionsField] = JSON.stringify(payload); props[CFG.checkField] = 'Fixes approved';
    say('Sending…'); setProps(S.obj.MetaData.BasicMetaData.ID, props).then(function () { say('Sent ' + acts.length + ' fix' + (acts.length === 1 ? '' : 'es') + '. Now open the layout in InDesign (checked out) and check it in: they apply during that check-in.', 'ok'); notify('AI Check: ' + acts.length + ' fix' + (acts.length === 1 ? '' : 'es') + ' approved for the next check-in', 'info'); listInProgress(); }).catch(function (e) { say('Send failed: ' + e.message, 'err'); });
  }
  function sendTemplateJob() {
    var out = window.REVIEW_OUT || {}, job = out.job; if (!job || !job.Actions || !job.Actions.length) { say('No template to-dos flagged.', 'warn'); return; }
    var tid = job.DocumentId; if (!/^\d+$/.test(String(tid))) { say('This layout does not name its template (no template ID property), so the template job cannot be addressed.', 'warn'); return; }
    var payload = { fromLayout: S.obj.MetaData.BasicMetaData.ID, runId: S.report.runId, decidedAt: new Date().toISOString(), actions: job.Actions, todos: out.todos }, props = {};
    props[CFG.actionsField] = JSON.stringify(payload); props[CFG.checkField] = 'Fixes approved';
    setProps(tid, props).then(function () { say('Template job sent: ' + job.Actions.length + ' change' + (job.Actions.length === 1 ? '' : 's') + ' written to the template (' + tid + '); they apply at its next check-in.', 'ok'); }).catch(function (e) { say('Template job failed: ' + e.message, 'err'); });
  }
  function requestCheck() { var p = {}; p[CFG.checkField] = 'Requested'; setProps(S.obj.MetaData.BasicMetaData.ID, p).then(function () { say('AI check set to “Requested”: it runs at the next check-in of this layout.', 'ok'); listInProgress(); }).catch(function (e) { say('Request failed: ' + e.message, 'err'); }); }

  ContentStationSdk.registerCustomApp({
    name: 'ai-check', title: 'AI Check',
    content: '<div class="aicheck-app" data-theme="light">' + PICKER + PAGE_HTML + '</div>',
    onInit: function () {
      if (!document.getElementById('aicheck-style')) { var st = document.createElement('style'); st.id = 'aicheck-style'; st.textContent = PAGE_CSS; document.head.appendChild(st); }
      var main = document.querySelector('.aicheck-app main.wrap'); if (main) main.hidden = true;
      var foot = document.getElementById('foot'); if (foot) { foot.textContent = 'AI Check plug-in ' + VERSION; foot.setAttribute('data-fixed', '1'); }
      $('aicheck-load').onclick = function () { var id = $('aicheck-id').value.trim(); if (id) loadLayout(id); };
      $('aicheck-list').onchange = function () { if (this.value) { $('aicheck-id').value = this.value; loadLayout(this.value); } };
      $('aicheck-file').onchange = function () { var f = this.files[0]; if (!f || !S.obj) { say('Load the layout first.', 'warn'); return; } var rd = new FileReader(); rd.onload = function () { try { buildPage(JSON.parse(rd.result)); } catch (e) { say('Not a runner report: ' + e.message, 'err'); } }; rd.readAsText(f); };
      $('aicheck-request').onclick = requestCheck; $('aicheck-send').onclick = sendFixes; $('aicheck-sendtpl').onclick = sendTemplateJob;
      listInProgress();
    },
    buttons: [{ label: 'Reload', type: 'secondary', callback: function () { if (S.obj) loadLayout(S.obj.MetaData.BasicMetaData.ID); listInProgress(); } }]
  });
  window.__aiCheck = { state: S, version: VERSION, loadLayout: loadLayout };
  // harness demo: window.__aiCheckDemo = { report: url, previews: {pageName: url}, name, version } — builds the page without Studio
  if (window.__aiCheckDemo) setTimeout(function () { var d = window.__aiCheckDemo; S.obj = { MetaData: { BasicMetaData: { ID: d.id || '0', Name: d.name || 'demo', Type: 'Layout' }, WorkflowMetaData: { Version: d.version || '0', State: { Name: 'demo' } }, ExtraMetaData: [] }, Pages: Object.keys(d.previews || {}).map(function (pn) { return { PageNumber: pn, Files: [{ Rendition: 'preview', FileUrl: d.previews[pn] + '?ww-app=x' }] }; }) }; fetch(d.report).then(function (r) { return r.json(); }).then(buildPage).catch(function (e) { say('demo: ' + e.message, 'err'); }); }, 50);
