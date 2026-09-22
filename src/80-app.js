  // ─── the custom application ───────────────────────────────────────────────────────────────────
  var CFG = { checkField: 'C_AI_CHECK', actionsField: 'C_AI_ACTIONS', reportField: 'C_AI_REPORT', localReports: 'http://localhost:8765' };
  var S = { obj: null, report: null, pointer: null, review: null };
  var $ = function (id) { return document.getElementById(id); };
  // With a layout on screen, messages go beside Send (as in the design) so the bar stays one row; before that, in the bar.
  function say(msg, kind) { var work = document.querySelector('.aicheck-app main.wrap:not(.nowork)'); var e = (work && $('aicheck-msg')) ? $('aicheck-msg') : $('aicheck-msg0'); if (!e) e = $('aicheck-msg0') || $('aicheck-msg'); if (e) { e.textContent = msg; e.className = 'appmsg ' + (kind || ''); } var other = (e && e.id === 'aicheck-msg') ? $('aicheck-msg0') : $('aicheck-msg'); if (other) { other.textContent = ''; other.className = 'appmsg'; } }

  // THE BAR (Benn, 2026-09-22, Figma 2004:338): one row across the full width under the tabs, there whether or not a
  // layout is loaded — the ID, Load, the in-progress list and the three actions. It is shared by both tabs, so there is
  // one place to choose a layout (and Before & after no longer needs controls of its own).
  var BAR = '' +
    '<div class="aicheck-app aicheck-barwrap" data-theme="light"><div class="aicheck-bar" id="aicheck-picker">' +
    '  <label>Layout or template <input id="aicheck-id" size="7" placeholder="ID"></label>' +
    '  <button class="btn primary" id="aicheck-load">Load</button>' +
    '  <label class="dim">in progress <select id="aicheck-list"><option value="">(loading…)</option></select></label>' +
    '  <button class="btn" id="aicheck-request" disabled>Request a check</button>' +
    '  <button class="btn" id="aicheck-checktpl" disabled>Check the template</button>' +
    '  <label class="btn" title="For development: show a report from a file on this Mac, without Studio">Report file… <input type="file" id="aicheck-file" accept="application/json" hidden></label>' +
    '  <span id="aicheck-msg0" class="appmsg"></span>' +
    '</div></div>';
  // the head of the right-hand column: what became of the last fixes, and ONE fold for everything else
  // ONE fold for everything that is not the list (Benn, 2026-09-22): the last fixes and the list's controls at its top,
  // then what the check worked to, the reader's account and the layout details.
  var SIDEHEAD = '' +
    '<section class="apppanel" id="aicheck-sidehead">' +
    '  <details class="appdetails" id="aicheck-addinfo"><summary>Additional info<span class="addinfo-alert" id="aicheck-addinfo-alert"></span></summary>' +
    '    <div class="addinfo-part addinfo-top" id="aicheck-addinfo-top">' +
    '      <details class="lastpass" id="aicheck-lastpass" hidden><summary id="aicheck-lastpass-sum"></summary><ul id="aicheck-lastpass-list"></ul></details>' +
    '    </div>' +
    '    <div class="addinfo-part" id="aicheck-workedto"><h4>What this check worked to</h4><div id="aicheck-workedto-body"></div></div>' +
    '    <div class="addinfo-part"><h4>Layout details</h4><div class="approw"><span id="aicheck-layoutline" class="line"></span></div><div class="approw"><span id="aicheck-reportline" class="line"></span></div><div class="approw"><span id="aicheck-buildline" class="line"></span></div></div>' +
    '  </details>' +
    '</section>';
  var PICKER = SIDEHEAD;   // kept by name: the page assembly below puts it in the app, and onInit moves it to the right column

  // Studio does not tell the page how tall its container is: measure the room below the app's top edge, so the
  // two columns scroll inside the panel and the Send bar sits at the bottom (C31 — the page was clipped, not scrolled)
  function fitHeight() { var app = document.querySelector('#aicheck-view-check > .aicheck-app'); if (!app) return; var top = app.getBoundingClientRect().top; var h = window.innerHeight - top - 4; if (h > 240) app.style.height = h + 'px'; fitPage(); }
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

  // What became of the fixes that were last sent: the check-in scripts write a result per fix back beside the decisions.
  function showLastPass(o) {
    var box = $('aicheck-lastpass'); if (!box) return; box.hidden = true; var al0 = $('aicheck-addinfo-alert'); if (al0) al0.textContent = ''; var pj = null; try { pj = JSON.parse(extraOf(o, CFG.actionsField) || 'null'); } catch (e) {}
    // Fixes held up by an article someone else has checked out (2026-09-22): said at once, whatever came before.
    if (pj && pj.waiting && extraOf(o, CFG.checkField) === 'Fixes approved') say(waitingWords(pj.waiting), 'warn');
    if (!pj || !pj.results || !pj.results.length) return;
    // A fix sent twice is not a failure. The tools' guards refuse the second attempt because the page is already the way
    // the fix wanted it — the frame has moved since the report, the colour is already the style's — and that came out in
    // red beside a genuine refusal (Benn, 2026-09-20). Where an EARLIER ROUND applied the same op to the same item, or
    // the tool itself says there was nothing left to do, it is reported as done, not refused.
    var earlier = {};
    (pj.rounds || []).slice(0, -1).forEach(function (rd, i) {
      ((rd && rd.results) || []).forEach(function (r) { if (r.ok) earlier[(r.op || '') + '|' + (r.frameId || '')] = { round: i + 1, at: rd.at || null }; });
    });
    var NOTHING_LEFT = /nothing to reset|nothing to change|already carries|already at|is already/i;
    function standing(r) {                      // 'done' | 'refused'
      if (r.ok) return 'done';
      var had = earlier[(r.op || '') + '|' + (r.frameId || '')];
      if (had) return 'done';
      return NOTHING_LEFT.test(r.reason || '') ? 'done' : 'refused';
    }
    var okN = 0, againN = 0, badN = 0;
    pj.results.forEach(function (r) { var st = standing(r); if (r.ok) okN++; else if (st === 'done') againN++; else badN++; });
    var when = pj.appliedAt ? new Date(pj.appliedAt) : null;
    $('aicheck-lastpass-sum').textContent = 'Last fixes sent' + (when && !isNaN(when) ? ' (applied ' + when.toLocaleString() + ')' : '') + ': ' + okN + ' applied'
      + (againN ? ', ' + againN + ' already done' : '') + (badN ? ', ' + badN + ' refused' : (againN ? '' : ', none refused'));
    box.className = 'lastpass' + (badN ? ' bad' : ''); box.open = badN > 0;
    // the banner now lives inside "Additional info": a genuine refusal must still be seen without opening anything
    var alertEl = $('aicheck-addinfo-alert'), addinfo = $('aicheck-addinfo');
    if (alertEl) alertEl.textContent = badN ? ' · ' + badN + ' fix' + (badN === 1 ? '' : 'es') + ' refused' : '';
    if (addinfo && badN) addinfo.open = true;
    var ul = $('aicheck-lastpass-list'); ul.innerHTML = '';
    pj.results.forEach(function (r) { var st = standing(r), li = document.createElement('li'); li.className = r.ok ? 'ok' : (st === 'done' ? 'again' : 'bad');
      var what = (r.why || r.op || 'fix') + ' (item ' + (r.frameId || '?') + (r.page ? ', page ' + r.page : '') + ')' + articleWords(r);
      var had = earlier[(r.op || '') + '|' + (r.frameId || '')];
      var how = r.ok ? ('applied' + (r.now !== undefined && r.now !== null ? ': “' + (r.was || 'no label') + '” → “' + r.now + '”' : '') + (r.note ? '. ' + r.note : ''))
              : (st === 'done' ? ('already done' + (had ? ' — applied in an earlier round' + (had.at ? ' (' + new Date(had.at).toLocaleString() + ')' : '') : ' — the page is already the way this fix wanted it') + '. Nothing to do.')
                               : ('refused: ' + (r.reason || 'no reason given')));
      li.textContent = (r.ok ? '✓ ' : (st === 'done' ? '• ' : '✗ ')) + what + ' — ' + how;
      if (st === 'done' && !r.ok && r.reason) li.title = 'What the tool said: ' + r.reason;
      ul.appendChild(li); });
    box.hidden = false;
  }

  // a fix on placed-article text went through the ARTICLE: its own check-out, check-in and version (2026-09-22)
  function articleWords(r) { var a = r && r.article; if (!a) return ''; return ' — in the article “' + (a.name || a.articleId) + '”' + (a.versionBefore && a.versionAfter && a.versionBefore !== a.versionAfter ? ', v' + a.versionBefore + ' → v' + a.versionAfter : ''); }
  function waitingWords(w) { var who = (w.articles || []).map(function (x) { return '“' + (x.name || x.articleId) + '” is checked out by ' + (x.lockedBy || 'someone else'); }).join('; ');
    return 'Waiting: ' + who + '. The fixes are applied as soon as it is checked in; after ' + (w.minutes || 30) + ' minutes the fixes on that article are reported as not applied and the rest go ahead.'; }
  window.__aiCheckArticleWords = articleWords;

  // ONE current layout for the whole plug-in (Benn, 2026-09-21: switching in one tab left the other on the old layout).
  // Whichever tab loads it, it becomes current; the other tab catches up when it is next shown.
  function loadLayout(id) {
    S.currentId = String(id); if ($('aicheck-id')) $('aicheck-id').value = String(id);
    var baShown = document.getElementById('aicheck-view-ba'); if (baShown && !baShown.hidden && window.AICheckBeforeAfter) window.AICheckBeforeAfter.load(String(id));
    say('Loading ' + id + '…');
    return callServer('GetObjects', { IDs: [String(id)], Lock: false, Rendition: 'preview', RequestInfo: ['MetaData', 'Pages', 'Relations'], __classname__: 'WflGetObjectsRequest' }).then(function (res) {
      var o = res.Objects[0]; S.obj = o; var md = o.MetaData;
      $('aicheck-layoutline').textContent = md.BasicMetaData.Name + ' · ' + md.BasicMetaData.Type + ' ' + md.BasicMetaData.ID + ' · v' + md.WorkflowMetaData.Version + ' · status “' + md.WorkflowMetaData.State.Name + '”' + (md.WorkflowMetaData.LockedBy ? ' · in use by ' + md.WorkflowMetaData.LockedBy : '') + ' · AI check: ' + (extraOf(o, CFG.checkField) || 'not requested');
      showLastPass(o);
      var ptr = extraOf(o, CFG.reportField); S.pointer = null; try { S.pointer = ptr ? JSON.parse(ptr) : null; } catch (e) {}
      $('aicheck-reportline').textContent = S.pointer ? ('Latest run ' + S.pointer.runId + ' at ' + S.pointer.at + ': ' + S.pointer.summary) : 'No report on this layout yet. Request a check, then check the layout in from InDesign.';
      $('aicheck-request').disabled = false;
      S.templateId = (md.BasicMetaData.Type === 'Layout' && /^\d+$/.test(extraOf(o, 'C_LAYOUT_TEMPLATE_ID'))) ? extraOf(o, 'C_LAYOUT_TEMPLATE_ID') : null;
      $('aicheck-checktpl').disabled = !S.templateId; $('aicheck-checktpl').title = S.templateId ? REVIEW_TIPS.checkTemplate : 'This layout does not name its template (no template ID property).';
      if (S.pointer && S.pointer.file) return fetch(CFG.localReports + '/localreport?path=' + encodeURIComponent(S.pointer.file), { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('local report ' + r.status); return r.json(); }).then(function (rep) {
        // a report that arrived but could not be drawn is OUR fault, not "unreachable" — say which (2026-09-21)
        try { buildPage(rep); } catch (eDraw) { say('The report for ' + id + ' arrived but the page could not draw it: ' + eDraw.message + '. This is a fault in the plug-in, not in the layout.', 'err'); if (window.console) console.error(eDraw); }
      }, function (e) { say('Layout loaded. The report file is not reachable from here (' + e.message + '): load it from a file.', 'warn'); });
      say('Layout loaded.', 'ok');
    }).catch(function (e) { say(e.message, 'err'); });
  }

  // What the check worked to — the style guide, the reader's brief, the section's house notes and tolerances, and where
  // its measurements came from. Read-only for now (settings tab, slice 1 — Benn, 2026-09-20).
  function renderWorkedTo(w) {
    var box = document.getElementById('aicheck-workedto'), body = document.getElementById('aicheck-workedto-body');
    if (!box || !body) return;
    if (!w) { body.innerHTML = '<div class="approw"><span class="line">This report was made before the check recorded what it worked to. Request a new check to see it.</span></div>'; box.hidden = false; return; }
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
    function row(label, value) { return '<div class="approw"><span class="line"><b>' + esc(label) + ':</b> ' + esc(value) + '</span></div>'; }
    var html = row('Style guide', w.styleGuide) + row('Reader\'s brief', w.brief);
    if (w.houseNotes && w.houseNotes.length) {
      html += '<div class="approw"><span class="line"><b>House notes in force:</b></span></div><ul>';
      w.houseNotes.forEach(function (n) { html += '<li>' + esc(n.says) + (n.from ? ' <i>(' + esc(n.from) + ', ' + esc(n.on) + ')</i>' : '') + '</li>'; });
      html += '</ul>';
    } else html += row('House notes in force', 'none for this section');
    html += (w.tolerances && w.tolerances.length) ? row('Tolerances', w.tolerances.join('; ')) : row('Tolerances', w.tolerancesNote || 'none set');
    html += row('Earlier versions', w.history) + row('Measurements', w.measurements);
    if (w.inUseOnThisLayout) html += row('In use on this layout', w.inUseOnThisLayout.paragraphStyles + ' paragraph styles, ' + w.inUseOnThisLayout.colours + ' colours');
    html += row('Read by', w.model + (w.effort ? ' at ' + w.effort + ' effort' : '') + (w.readAt ? ' on ' + w.readAt : ''));
    body.innerHTML = html; box.hidden = false;
  }

  function buildPage(report) {
    S.report = report; var images = {};
    (S.obj.Pages || []).forEach(function (p) { var f = (p.Files || []).filter(function (x) { return x.Rendition === 'preview'; })[0]; if (f && f.FileUrl) images[String(p.PageNumber)] = withWwApp(f.FileUrl); });
    var D = ReviewEnrich.buildData(report, images, 'Report ' + report.runId + ' on ' + S.obj.MetaData.BasicMetaData.Name + ' v' + S.obj.MetaData.WorkflowMetaData.Version + '; previews from Studio at that version.');
    if (!D.layout.template) { var tid = extraOf(S.obj, 'C_LAYOUT_TEMPLATE_ID'), tnm = extraOf(S.obj, 'C_LAYOUT_TEMPLATE_NAME'); if (tid || tnm) D.layout.template = { id: tid || null, name: tnm || null }; }
    var pub = S.obj.MetaData.BasicMetaData.Publication; D.layout.brand = (pub && pub.Name) || null;   // an "always" rule is scoped to the brand
    if (window.__aiCheckShowWork) window.__aiCheckShowWork(true);
    fitHeight();
    $('title').textContent = (report.layout && report.layout.name || S.obj.MetaData.BasicMetaData.Name).replace(/\.indd$/, '');
    S.review = window.bootReview(D); S.pageSize = D.pageSize;
    fitPage(); if (window.ResizeObserver && !S.ro) { S.ro = new ResizeObserver(function () { fitPage(); }); S.ro.observe(document.querySelector('.aicheck-app .viewer')); }
    renderWorkedTo(report.workedTo);
    $('aicheck-send').disabled = false;
    say('Loaded. Choose an action on each finding, decide the labels, then Send.', 'ok');
  }

  // who is deciding: the SDK's info block — field names untested on this server, so every shape is tried and '' is the fallback
  function whoAmI() { try { var i = ContentStationSdk.getInfo() || {}; var u = i.User || i.user || {}; return u.FullName || u.UserName || u.Name || i.UserName || i.FullName || i.User || ''; } catch (e) { return ''; } }
  function send() {
    var out = window.REVIEW_OUT || {}, acts = out.actions || [], rules = out.rules || [], ign = out.ignore || [], todos = out.todos || [], houseNotes = out.houseNotes || [], corrections = out.corrections || [];
    var labelsDecided = Object.keys(out.labels || {}).filter(function (k) { return out.labels[k]; }).length;
    if (!acts.length && !rules.length && !ign.length && !todos.length && !labelsDecided && !houseNotes.length && !corrections.length) { say('No decisions yet.', 'warn'); return; }
    // which section's knowledge a house note belongs to: the guide the check worked to (its name, without the caveat a
    // guide chosen by page size alone carries in older reports)
    var sg = (S.report.workedTo || {}).styleGuide, sgName = sg ? (typeof sg === 'string' ? sg.split(' (')[0] : (sg.name || null)) : null;
    var payload = { runId: S.report.runId, styleGuide: sgName, decidedAt: new Date().toISOString(), decidedBy: whoAmI(), actions: acts, ignore: ign, rules: rules, labels: out.labels || {}, labelText: out.labelText || {}, todos: todos,
      // kept, not ignored: these go into the section's house notes, which is what the next check works to
      houseNotes: houseNotes.map(function (h) { return { says: h.says, kind: h.kind || 'keep', from: whoAmI(), on: new Date().toISOString().slice(0, 10), fromLayout: S.obj.MetaData.BasicMetaData.ID }; }),
      // where a person overruled the AI reader: who, when, on which version (Benn, 2026-09-22)
      corrections: corrections.map(function (c) { var x = {}; for (var k in c) x[k] = c[k]; x.by = whoAmI(); x.at = new Date().toISOString(); x.layout = S.obj.MetaData.BasicMetaData.ID; x.version = S.obj.MetaData.WorkflowMetaData.Version; x.runId = S.report.runId; return x; }) }, props = {};
    // Carry the rounds already applied to this layout forward: this field is written whole, so building a fresh payload
    // used to erase everything that had been applied before (2026-09-20). The runner appends this round to the list.
    try { var prior = JSON.parse(extraOf(S.obj, CFG.actionsField) || '{}'); if (prior.rounds && prior.rounds.length) payload.rounds = prior.rounds; } catch (e) {}
    props[CFG.actionsField] = JSON.stringify(payload);
    // Fixes, house notes and corrections all need the background watcher: fixes to apply them, notes and corrections to write
    // them into the section's knowledge. With nothing to apply, the watcher records them and puts the field back to Checked
    // without making a new version (2026-09-22: a note sent on its own used to sit in the field and never reach the section).
    var forWatcher = acts.length || houseNotes.length || corrections.length;
    if (forWatcher) props[CFG.checkField] = 'Fixes approved';
    var n = acts.length, what = n + ' fix' + (n === 1 ? '' : 'es') + (rules.length ? ', ' + rules.length + ' always rule' + (rules.length === 1 ? '' : 's') : '') + (ign.length ? ', ' + ign.length + ' ignored' : '') + (todos.length ? ', ' + todos.length + ' template to-do' + (todos.length === 1 ? '' : 's') : '') + (houseNotes.length ? ', ' + houseNotes.length + ' house note' + (houseNotes.length === 1 ? '' : 's') : '') + (corrections.length ? ', ' + corrections.length + ' correction' + (corrections.length === 1 ? '' : 's') + ' to the AI reader' : '');
    say('Sending…'); setProps(S.obj.MetaData.BasicMetaData.ID, props).then(function () { say('Sent: ' + what + '.' + (n ? ' They are being applied in the background; this page will show the result.' : (forWatcher ? ' Nothing to apply: the notes and corrections are written into this section\'s knowledge in the background, within a minute.' : ' Nothing to apply, so the AI check field is unchanged.')), 'ok'); if (n) notify('AI Check: ' + n + ' fix' + (n === 1 ? '' : 'es') + ' approved: applying in the background', 'info'); listInProgress(); if (n) waitForFixes(S.obj.MetaData.BasicMetaData.ID, what); }).catch(function (e) { say('Send failed: ' + e.message, 'err'); });
  }
  // After Send: watch the layout's AI check field until the background pass has applied the fixes, then show what became of each.
  function waitForFixes(id, what) {
    var started = Date.now(), tries = 0; if (S.waiting) clearTimeout(S.waiting);
    (function again() {
      S.waiting = setTimeout(function () {
        tries++; callServer('GetObjects', { IDs: [String(id)], Lock: false, Rendition: 'none', RequestInfo: ['MetaData'], __classname__: 'WflGetObjectsRequest' }).then(function (res) {
          var o = res.Objects[0], field = extraOf(o, CFG.checkField), secs = Math.round((Date.now() - started) / 1000), wm = o.MetaData.WorkflowMetaData;
          if (String(S.obj.MetaData.BasicMetaData.ID) !== String(id)) return;                       // another layout was loaded meanwhile
          if (field === 'Fixes applied') { S.obj.MetaData = o.MetaData; showLastPass(o); say('Done: the fixes were applied in the background (now v' + wm.Version + ', ' + secs + ' s). Each result is listed at the top.', 'ok'); listInProgress(); return; }
          var wpj = null; try { wpj = JSON.parse(extraOf(o, CFG.actionsField) || 'null'); } catch (e1) {}
          if (field === 'Fixes approved' && wpj && wpj.waiting) { if (secs < ((wpj.waiting.minutes || 30) * 60 + 300)) { say(waitingWords(wpj.waiting), 'warn'); again(); return; } }
          if (secs > 300) { say('Sent ' + what + ', but nothing has applied them after five minutes. Either the background watcher is not running, or the layout is open in InDesign' + (wm.LockedBy ? ' (in use by ' + wm.LockedBy + ')' : '') + '. Closing it, or checking it in from InDesign, applies them.', 'warn'); return; }
          say('Sent ' + what + '. Applying in the background… ' + secs + ' s' + (wm.LockedBy ? ' (the layout is in use by ' + wm.LockedBy + ': that is normal while the fixes are applied; if it is you in InDesign, close it)' : ''), 'info'); again();
        }).catch(function () { again(); });
      }, tries ? 8000 : 4000);
    })();
  }
  function requestCheck() { var p = {}; p[CFG.checkField] = 'Requested'; setProps(S.obj.MetaData.BasicMetaData.ID, p).then(function () { say('AI check requested. The read runs in the background and takes about three minutes; the layout then shows “Checked” in the in-progress list. You do not need to open InDesign.', 'ok'); listInProgress(); }).catch(function (e) { say('Request failed: ' + e.message, 'err'); }); }
  function checkTemplate() { if (!S.templateId) { say('This layout does not name its template.', 'warn'); return; } var p = {}; p[CFG.checkField] = 'Requested'; setProps(S.templateId, p).then(function () { say('AI check set to “Requested” on template ' + S.templateId + ': it runs at the template\'s next check-in.', 'ok'); listInProgress(); }).catch(function (e) { say('Request on the template failed: ' + e.message, 'err'); }); }

  ContentStationSdk.registerCustomApp({
    name: 'ai-check', title: 'AI Check',
    content: '<div class="aicheck-tabs"><button class="aicheck-tab" id="aicheck-tab-check" aria-pressed="true">Check</button><button class="aicheck-tab" id="aicheck-tab-ba" aria-pressed="false">Before &amp; after</button></div>' + BAR + '<div id="aicheck-view-check"><div class="aicheck-app" data-theme="light">' + PICKER + PAGE_HTML + '</div></div>' + '<div id="aicheck-view-ba" hidden></div>',
    onInit: function () {
      if (!document.getElementById('aicheck-style')) { var st = document.createElement('style'); st.id = 'aicheck-style'; st.textContent = PAGE_CSS; document.head.appendChild(st); }
      var main = document.querySelector('.aicheck-app main.wrap');
      var side = document.querySelector('.aicheck-app main.wrap > section.panel[aria-label="Findings"]');
      var sidehead = $('aicheck-sidehead'), topc = document.querySelector('.aicheck-app .top.compact');
      if (side && sidehead) { side.insertBefore(sidehead, side.firstChild); if (topc) side.insertBefore(topc, sidehead.nextSibling); }
      // Less on the screen (Benn, 2026-09-22): the reader's own account of the page goes into Additional info, and the
      // run's footnote into "Job details and Send info". The page script still writes both by id, wherever they sit.
      var addinfo = $('aicheck-addinfo'), rsum = $('readerSummary');
      if (addinfo && rsum) { var part = document.createElement('div'); part.className = 'addinfo-part'; part.innerHTML = '<h4>How the reader read this page</h4>'; part.appendChild(rsum); addinfo.insertBefore(part, addinfo.lastElementChild); }   // between what the check worked to and the layout details
      var jobfoot = $('aicheck-jobfoot'), footEl = $('foot'); if (jobfoot && footEl) jobfoot.appendChild(footEl);
      var topPart = $('aicheck-addinfo-top'), toolbar = document.querySelector('.aicheck-app .toolbar'); if (topPart && toolbar) topPart.appendChild(toolbar);
      // Nothing loaded yet: the design's card, so the app says what it is and what happens next (Figma 2015:4)
      var empty = document.createElement('div'); empty.className = 'emptystate'; empty.id = 'aicheck-empty';
      empty.innerHTML = '<div class="es-card">' +
        '<div class="es-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="1.5"></rect><rect x="3" y="13" width="8" height="8" rx="1.5"></rect><rect x="14" y="13" width="7" height="8" rx="1.5"></rect></svg></div>' +
        '<h3>No layout loaded</h3>' +
        '<p>Type a layout or template ID and press Load, or pick one from “in progress” above.</p>' +
        '<ol class="es-steps"><li><span>1</span>Load the layout you are working on</li>' +
        '<li><span>2</span>Read what the check found, and decide each one</li>' +
        '<li><span>3</span>Press Send — the fixes are applied in the background, without opening InDesign</li></ol>' +
        '<div class="es-build">AI Check plug-in ' + VERSION + '</div></div>';
      if (side) side.appendChild(empty);
      // main.wrap now holds the picker, so it can never be hidden: the viewer and the list hide instead until a layout loads
      var viewer = document.querySelector('.aicheck-app main.wrap > section.viewer');
      function showWork(on) { if (viewer) viewer.hidden = !on; var es = $('aicheck-empty'); if (es) es.hidden = on; var sp = $('aicheck-split'); if (sp) sp.hidden = !on;
        ['aicheck-groups-host', 'toolbar', 'groups'].forEach(function (id) { var e = document.getElementById(id); if (e) e.hidden = !on; });
        var tb = document.querySelector('.aicheck-app .toolbar'), out = document.querySelector('.aicheck-app .out'); if (tb) tb.hidden = !on; if (out) out.hidden = !on;
        if (topc) topc.hidden = !on; if (sidehead) sidehead.hidden = !on;
        if (main) main.classList.toggle('nowork', !on); }
      window.__aiCheckShowWork = showWork; showWork(false);
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
      // the second view: its own full screen, a tab away (Benn, 2026-09-20)
      var baHost = document.getElementById('aicheck-view-ba');
      if (baHost && window.AICheckBeforeAfter) { baHost.innerHTML = window.AICheckBeforeAfter.html; window.AICheckBeforeAfter.init(); }
      if (!document.getElementById('aicheck-tabstyle')) {
        var ts = document.createElement('style'); ts.id = 'aicheck-tabstyle';
        ts.textContent = '.aicheck-tabs{display:flex;gap:2px;background:#151a20;padding:6px 8px 0}' +
          '.aicheck-tab{background:#222933;border:1px solid #39424e;border-bottom:0;color:#cfd6de;padding:6px 16px;border-radius:6px 6px 0 0;cursor:pointer;font:13px system-ui,sans-serif}' +
          '.aicheck-tab[aria-pressed="true"]{background:#fff;color:#20242a;font-weight:500}' +
          '#aicheck-view-ba{position:relative;height:calc(100vh - 46px)}';   // a first guess; refit() measures the real room
        document.head.appendChild(ts);
      }
      function showView(which) {
        var c = document.getElementById('aicheck-view-check'), b = document.getElementById('aicheck-view-ba');
        c.hidden = (which !== 'check'); b.hidden = (which !== 'ba');
        $('aicheck-tab-check').setAttribute('aria-pressed', String(which === 'check'));
        $('aicheck-tab-ba').setAttribute('aria-pressed', String(which === 'ba'));
        if (which === 'ba' && window.AICheckBeforeAfter) {
          window.AICheckBeforeAfter.refit();
          // compare with the layout the view actually SHOWS, not with the text in its box
          var id = S.currentId || (S.obj && String(S.obj.MetaData.BasicMetaData.ID)) || $('aicheck-id').value.trim();
          if (id && window.AICheckBeforeAfter.shownId() !== String(id)) window.AICheckBeforeAfter.load(String(id));
        } else {
          fitHeight();
          if (S.currentId && (!S.obj || String(S.obj.MetaData.BasicMetaData.ID) !== S.currentId)) loadLayout(S.currentId);   // loaded in the other tab
        }
      }
      $('aicheck-tab-check').onclick = function () { showView('check'); };
      $('aicheck-tab-ba').onclick = function () { showView('ba'); };
      listInProgress();
    },
    buttons: [{ label: 'Reload', type: 'secondary', callback: function () { if (S.obj) loadLayout(S.obj.MetaData.BasicMetaData.ID); listInProgress(); } }]
  });
  window.__aiCheck = { state: S, version: VERSION, loadLayout: loadLayout };
  window.__aiCheckSetCurrent = function (id) { S.currentId = String(id); if ($('aicheck-id')) $('aicheck-id').value = String(id); };
  // harness demo: window.__aiCheckDemo = { report: url, previews: {pageName: url}, name, version } — builds the page without Studio
  if (window.__aiCheckDemo) setTimeout(function () { var d = window.__aiCheckDemo; S.obj = { MetaData: { BasicMetaData: { ID: d.id || '0', Name: d.name || 'demo', Type: 'Layout' }, WorkflowMetaData: { Version: d.version || '0', State: { Name: 'demo' } }, ExtraMetaData: (d.extra || []) }, Pages: Object.keys(d.previews || {}).map(function (pn) { return { PageNumber: pn, Files: [{ Rendition: 'preview', FileUrl: d.previews[pn] + '?ww-app=x' }] }; }) }; showLastPass(S.obj); fetch(d.report).then(function (r) { return r.json(); }).then(buildPage).catch(function (e) { say('demo: ' + e.message, 'err'); }); }, 50);
