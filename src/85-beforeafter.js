/* Before & after — the second view of the AI Check plug-in (Benn, 2026-09-20: "it can be part of the AI check plugin,
   but it will need its own full screen of space… a tab in the same plugin that shows a different view").
   Shows the page as it was when the check read it, and as it is now that the fixes are applied, with the frames that
   changed picked out. Design cues from Studio's own layout preview: dark stage, the page centred, zoom at the bottom
   right, a panel on the right.

   Where the two pictures come from: AFTER is Studio's own page preview of the current version; BEFORE is the picture
   the reader exported when it read the layout (Studio keeps previews only for the current version), served by the
   local report server during desktop testing. What changed comes from the fixes the runner applied. */
(function () {
  var BA = { layoutId: null, obj: null, report: null, results: null, page: null, pages: [], showing: 'after', zoom: 1, fit: 1, showChanges: true };

  var BA_CSS = [
    '.ba-wrap{position:absolute;inset:0;display:flex;background:#1d2229;color:#e8eaed;font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.ba-main{flex:1;position:relative;display:flex;flex-direction:column;min-width:0}',
    '.ba-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 14px;background:#151a20;border-bottom:1px solid #000}',   // wraps onto a second row rather than clipping (Benn, 2026-09-21: "the UI is crushed and I have to zoom out")
    '.ba-top>*{white-space:nowrap}',
    '.ba-top select{max-width:220px}',
    '.ba-top .ba-name{font-weight:500;font-size:14px}.ba-top .ba-dim{color:#98a2ae}',
    '.ba-top select{background:#222933;border:1px solid #39424e;color:#e8eaed;border-radius:4px;padding:4px 6px;font:inherit}',
    '.ba-top input{width:88px;background:#222933;border:1px solid #39424e;color:#e8eaed;border-radius:4px;padding:4px 6px}',
    '.ba-btn{background:#2b333d;border:1px solid #39424e;color:#e8eaed;border-radius:4px;padding:5px 10px;cursor:pointer}',
    '.ba-btn:hover{background:#38424e}.ba-btn[disabled]{opacity:.5;cursor:default}',
    '.ba-seg{display:inline-flex;border:1px solid #39424e;border-radius:4px;overflow:hidden}',
    '.ba-seg button{background:#222933;border:0;color:#cfd6de;padding:6px 14px;cursor:pointer;font:inherit}',
    '.ba-seg button[aria-pressed="true"]{background:#f0a000;color:#20242a;font-weight:500}',
    '.ba-stage{flex:1;overflow:auto}',
    // The page is centred by a scrolling inner box, NOT by centring the stage itself: a flex item centred in its
    // scroller overflows off the start side where no scrollbar can reach it, so zoomed in you could never get back
    // to the top left of the page (2026-09-20). min-width:min-content is what makes the scroll area grow with it.
    '.ba-scroll{display:flex;align-items:center;justify-content:center;min-width:min-content;min-height:100%;padding:18px;box-sizing:border-box}',
    '.ba-page{position:relative;flex:0 0 auto;margin:auto;background:#fff;box-shadow:0 2px 18px rgba(0,0,0,.55)}',   // flex:0 0 auto — a flex item shrinks back to the stage by default, which stopped the zoom half way up the slider (2026-09-20)
    '.ba-nopic{color:#cfd6de;background:#222933;border:1px dashed #39424e;border-radius:6px;padding:22px 26px;max-width:380px;text-align:center;margin:auto}',
    '.ba-page img{display:block;width:100%;height:auto}',
    '.ba-page img.ba-hidden,.ba-page .ba-hidden{display:none}',
    // the pages of a spread, side by side, each placed where it sits on the spread (Benn, 2026-09-22: "shows one page of the spread")
    '.ba-page .ba-set{position:relative;width:100%}',
    '.ba-page .ba-set img{position:absolute;display:block;height:auto}',
    '.ba-box{position:absolute;border:2px solid rgba(240,160,0,.95);background:rgba(240,160,0,.22);pointer-events:none;border-radius:2px}',
    '.ba-box.ba-off{display:none}',
    '.ba-zoom{position:absolute;right:16px;bottom:16px;display:flex;flex-direction:column;gap:6px;align-items:center;background:rgba(21,26,32,.92);border:1px solid #39424e;border-radius:6px;padding:8px 6px}',
    '.ba-zoom button{background:transparent;border:0;color:#cfd6de;font-size:16px;cursor:pointer;line-height:1;padding:2px 4px}',
    '.ba-zoom input{writing-mode:vertical-lr;direction:rtl;width:18px;height:90px;accent-color:#f0a000}',
    '.ba-side{width:290px;flex:0 0 290px;background:#151a20;border-left:1px solid #000;display:flex;flex-direction:column}',
    '.ba-side h3{margin:0;padding:12px 14px;font-size:13px;font-weight:500;border-bottom:1px solid #000}',
    '.ba-side .ba-list{overflow:auto;flex:1}',
    '.ba-item{padding:10px 14px;border-bottom:1px solid #222933;cursor:pointer}',
    '.ba-item:hover{background:#1c222a}.ba-item.ba-sel{background:#1b3334;border-left:3px solid #2fa0a4;padding-left:11px}',
    // the SELECTED change in WoodWing green (Benn, 2026-09-22: a white box disappears on a white page)
    '.ba-box.ba-on{border:3px solid #2fa0a4;background:rgba(47,160,164,.28);box-shadow:0 0 0 2px rgba(255,255,255,.9)}',
    '.ba-item b{font-weight:500}.ba-item .ba-dim{color:#98a2ae;display:block;margin-top:2px}',
    '.ba-foot{padding:10px 14px;border-top:1px solid #000;color:#98a2ae}',
    '.ba-msg{padding:14px;color:#cfd6de}',
    '.ba-spacer{flex:1}',
    '.ba-subline{padding:8px 14px;border-bottom:1px solid #222933;white-space:normal}',
    '.ba-name{overflow:hidden;text-overflow:ellipsis;max-width:220px}'
  ].join('');

  var BA_HTML =
    '<div class="ba-wrap" id="ba-wrap">' +
    '  <div class="ba-main">' +
    '    <div class="ba-top">' +
    '      <span class="ba-name" id="ba-name">Before &amp; after</span>' +
    '      <span class="ba-dim" id="ba-pageline"></span>' +
    '      <span class="ba-seg"><button id="ba-before" aria-pressed="false">Before</button><button id="ba-after" aria-pressed="true">After</button></span>' +
    '      <select id="ba-version" title="the version the fixes were sent from"></select>' +
    '      <span class="ba-dim">→</span>' +
    '      <select id="ba-version-after" title="the version the fixes landed in"></select>' +
    '      <label><input type="checkbox" id="ba-changes" checked> show what changed</label>' +

    '    </div>' +
    '    <div class="ba-stage" id="ba-stage">' +
    '      <div class="ba-scroll" id="ba-scroll">' +
    '        <div class="ba-nopic" id="ba-nopic" hidden><b>No picture of the earlier version</b><br><span class="ba-dim" id="ba-nopic-why"></span></div>' +
    '        <div class="ba-page" id="ba-pagebox"><img id="ba-img-before" class="ba-hidden" alt="the page as the check read it"><div id="ba-img-after" class="ba-set" role="img" aria-label="the spread now"></div></div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="ba-zoom"><button id="ba-zin" title="closer">+</button><input type="range" id="ba-zrange" min="40" max="400" value="100"><button id="ba-zout" title="further away">&minus;</button><button id="ba-zfit" title="fit the page">&#9744;</button></div>' +
    '  </div>' +
    '  <div class="ba-side"><h3 id="ba-count">What changed</h3><div class="ba-dim ba-subline" id="ba-sub">load a layout that has had fixes applied</div><div class="ba-list" id="ba-list"><div class="ba-msg">Load a layout to see the fixes that were applied.</div></div><div class="ba-foot" id="ba-versions"></div></div>' +
    '</div>';

  function $ba(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function show(which) {
    BA.showing = which;
    var missing = (which === 'before' && BA.beforeMissing);
    $ba('ba-img-before').className = (which === 'before' && !missing) ? '' : 'ba-hidden';
    $ba('ba-img-after').className = 'ba-set' + ((which === 'after') ? '' : ' ba-hidden');
    $ba('ba-before').setAttribute('aria-pressed', String(which === 'before'));
    $ba('ba-after').setAttribute('aria-pressed', String(which === 'after'));
    var note = $ba('ba-nopic'); if (note) note.hidden = !missing;
    var why = $ba('ba-nopic-why'); if (why && missing) why.textContent = BA.beforeWhy || 'Studio keeps a picture of each version it still holds; this one is not among them.';
    var pb = $ba('ba-pagebox'); if (pb) pb.style.display = missing ? 'none' : '';
    drawBoxes();
  }

  // A missing picture of the earlier version says so in words. A broken image icon tells the desk nothing (2026-09-20).
  function setBefore(url) {
    var img = $ba('ba-img-before'); BA.beforeMissing = false;
    img.onerror = function () { BA.beforeMissing = true; show(BA.showing); };
    img.onload = function () { BA.beforeMissing = false; if (BA.showing === 'before') show('before'); };
    img.src = url || '';
    if (!url) { BA.beforeMissing = true; show(BA.showing); }
  }

  function setZoom(z) {
    BA.zoom = Math.max(0.4, Math.min(4, z));
    var box = $ba('ba-pagebox'); if (!box) return;
    box.style.width = Math.round(BA.baseWidth * BA.zoom) + 'px';
    $ba('ba-zrange').value = Math.round(BA.zoom * 100);
  }

  function fit() {
    var st = $ba('ba-stage'), box = $ba('ba-pagebox');
    if (!st || !box || !BA.pageSize) return;
    var room = Math.min((st.clientWidth - 48) / BA.pageSize[0], (st.clientHeight - 48) / BA.pageSize[1]);
    BA.baseWidth = BA.pageSize[0]; setZoom(room);
  }

  // The frames a fix touched, drawn over the page. Positions come from the report the check produced (points from the
  // page's top-left), and the picture is the same coordinate space scaled to its width.
  function drawBoxes() {
    var box = $ba('ba-pagebox'); if (!box) return;
    Array.prototype.slice.call(box.querySelectorAll('.ba-box')).forEach(function (b) { b.remove(); });
    if (!BA.showChanges || !BA.changes || !BA.pageSize) return;
    var scale = box.clientWidth / BA.pageSize[0], o = BA.origin || [0, 0];     // bounds are in spread coordinates
    BA.changes.forEach(function (c, i) {
      var b = (BA.showing === 'before' ? (c.boundsBefore || c.bounds) : (c.boundsAfter || c.bounds));
      if (!b) return;
      var d = document.createElement('div'); d.className = 'ba-box' + (BA.selected === i ? ' ba-on' : '');
      d.style.top = ((b[0] - o[0]) * scale) + 'px'; d.style.left = ((b[1] - o[1]) * scale) + 'px';
      d.style.height = ((b[2] - b[0]) * scale) + 'px'; d.style.width = ((b[3] - b[1]) * scale) + 'px';
      box.appendChild(d);
    });
  }

  function listChanges() {
    var host = $ba('ba-list'); if (!host) return;
    if (!BA.changes || !BA.changes.length) { host.innerHTML = '<div class="ba-msg">No applied fixes are recorded on this layout.</div>'; $ba('ba-count').textContent = 'What changed'; return; }
    $ba('ba-count').textContent = 'What changed — ' + BA.changes.length;
    host.innerHTML = BA.changes.map(function (c, i) {
      return '<div class="ba-item" data-i="' + i + '"><b>' + esc(c.title || c.op) + '</b>' +
             '<span class="ba-dim">' + esc(c.detail || '') + (c.round ? ' · ' + esc(c.round) : '') + '</span></div>';
    }).join('');
    Array.prototype.slice.call(host.querySelectorAll('.ba-item')).forEach(function (el) {
      el.onclick = function () {
        var i = parseInt(el.getAttribute('data-i'), 10);
        BA.selected = (BA.selected === i) ? null : i;          // clicking it again lets go: a highlight with no way off is a trap
        Array.prototype.slice.call(host.querySelectorAll('.ba-item')).forEach(function (o) { o.classList.remove('ba-sel'); });
        if (BA.selected === i) el.classList.add('ba-sel');
        drawBoxes();
      };
    });
  }

  // attribute and value names as the desk says them, not as InDesign spells them
  function attrName(k) {
    return ({ justification: 'alignment', pointSize: 'size', leading: 'leading', tracking: 'tracking', fillTint: 'tint',
              fillColor: 'colour', fontStyle: 'face', kerningMethod: 'kerning', firstLineIndent: 'first-line indent',
              spaceBefore: 'space above', spaceAfter: 'space below', hyphenation: 'hyphenation' })[k] || k;
  }
  function attrValue(v) {
    if (v === true) return 'on'; if (v === false) return 'off'; if (v === null || v === undefined) return '—';
    return ({ LEFT_ALIGN: 'ranged left', RIGHT_ALIGN: 'ranged right', CENTER_ALIGN: 'centred', LEFT_JUSTIFIED: 'justified',
              FULLY_JUSTIFIED: 'justified to the last line', RIGHT_JUSTIFIED: 'justified right', CENTER_JUSTIFIED: 'justified centred' })[v] || String(v);
  }

  // the tool's name in the words of the desk
  function friendly(op) {
    return ({ ResetParagraphAttributes: 'Paragraph put back to its style', ApplyParagraphStyle: 'Style applied',
              ResetTextRange: 'Type put back to its style', RepointSwatch: 'Colour repointed', AlignEdge: 'Edge aligned',
              SnapToGrid: 'Snapped to the grid', MoveInsideTypeArea: 'Moved inside the type area', MoveRule: 'Rule moved',
              FillFrameProportionally: 'Picture refitted', MoveGraphicInFrame: 'Picture moved in its frame',
              ApplyElementLabel: 'Label applied', SetFrameEdges: 'Frame edges moved' })[op] || (op || 'Fix applied');
  }

  // what a fix did, in the words a person on the desk would use
  function inWords(r, fr) {
    // name the ITEM, not its element label (Benn, 2026-09-22: the label is a background cross-check, never shown)
    var KIND = { title: 'Headline', subtitle: 'Standfirst', crosshead: 'Crosshead', byline: 'Byline', body: 'Body text', caption: 'Caption', credit: 'Picture credit', quote: 'Pull quote', image: 'Picture', graphic: 'Graphic', rule: 'Rule', furniture: 'Page furniture' };
    var own = (fr.picture && fr.picture.link) ? ' (' + fr.picture.link + ')' : (fr.snippet ? ' “' + String(fr.snippet).slice(0, 34) + (String(fr.snippet).length > 34 ? '…' : '') + '”' : '');
    var b = r.before || {}, a = r.after || {}, where = (KIND[fr.role] || (r.op === 'MoveGraphicInFrame' || r.op === 'FillFrameProportionally' ? 'Picture' : 'Item')) + own + ((fr.page || r.page) ? ' on page ' + (fr.page || r.page) : '');
    function num(x) { return (Math.round(x * 100) / 100); }
    if (b.fillColor !== undefined || a.fillColor !== undefined || b.fillTint !== undefined || a.fillTint !== undefined) {
      if (b.fillColor !== a.fillColor) return { title: 'Colour put back', detail: where + ': ' + b.fillColor + ' → ' + a.fillColor };
      if (b.fillTint !== a.fillTint) return { title: 'Tint put back', detail: where + ': ' + num(b.fillTint) + '% → ' + num(a.fillTint) + '% of the same colour' };
      return null;
    }
    // A PICTURE moved or refitted inside its frame: the frame stays where it is, so its bounds say nothing changed — the
    // picture's own bounds say what did (Benn, 2026-09-22: "Nothing changed" on picture moves that plainly changed).
    if (b.graphic && a.graphic) {
      var gb = b.graphic, ga = a.graphic, gd = [ga[0] - gb[0], ga[1] - gb[1], ga[2] - gb[2], ga[3] - gb[3]];
      var gOff = function (x) { return Math.abs(x) > 0.01; };
      if (gOff(gd[0]) || gOff(gd[1]) || gOff(gd[2]) || gOff(gd[3])) {
        var resized = gOff((ga[2] - ga[0]) - (gb[2] - gb[0])) || gOff((ga[3] - ga[1]) - (gb[3] - gb[1]));
        if (resized) return { title: 'Picture refitted to its frame', detail: where + ': ' + num(gb[3] - gb[1]) + ' × ' + num(gb[2] - gb[0]) + ' pt → ' + num(ga[3] - ga[1]) + ' × ' + num(ga[2] - ga[0]) + ' pt' };
        var gbits = []; if (gOff(gd[1])) gbits.push((gd[1] > 0 ? 'right ' : 'left ') + num(Math.abs(gd[1])) + ' pt'); if (gOff(gd[0])) gbits.push((gd[0] > 0 ? 'down ' : 'up ') + num(Math.abs(gd[0])) + ' pt');
        return { title: 'Picture moved inside its frame', detail: where + ': ' + gbits.join(' and ') };
      }
    }
    // Text put back: say EVERY attribute that changed, not just the first one found (2026-09-22: a headline reset from 54 pt
    // tracked -60 to 46 pt tracked 0 was listed as "Tracking reset -60 → 0").
    var TEXT_ATTRS = [['pointSize', 'size', ' pt'], ['leading', 'leading', ' pt'], ['tracking', 'tracking', ''], ['horizontalScale', 'width', '%'], ['baselineShift', 'baseline shift', ' pt']];
    var tbits = [];
    TEXT_ATTRS.forEach(function (t) { var k = t[0]; if (b[k] !== undefined && a[k] !== undefined && String(b[k]) !== String(a[k])) tbits.push(t[1] + ' ' + (typeof b[k] === 'number' ? num(b[k]) : b[k]) + t[2] + ' → ' + (typeof a[k] === 'number' ? num(a[k]) : a[k]) + t[2]); });
    if (tbits.length) return { title: tbits.length === 1 && b.tracking !== undefined && b.tracking !== a.tracking ? 'Tracking reset' : 'Type put back to its style', detail: where + ': ' + tbits.join(', ') };
    if (b.font !== undefined && b.font !== a.font) return { title: 'Font put back', detail: where + ': ' + b.font + ' → ' + a.font };
    if (b.bounds && a.bounds) {
      // Edge by edge: a frame whose left edge alone moved was NOT "moved 2 pt, resized" — it was pulled in on one side,
      // and the desk needs to read which side (2026-09-20: SetFrameEdges and MoveRule both came out as "Item moved").
      var db = b.bounds, da = a.bounds, d = [da[0] - db[0], da[1] - db[1], da[2] - db[2], da[3] - db[3]];
      var same = function (x, y) { return Math.abs(x - y) < 0.01; }, off = function (x) { return Math.abs(x) > 0.01; };
      if (!off(d[0]) && !off(d[1]) && !off(d[2]) && !off(d[3])) return null;
      var isRule = same(db[0], db[2]) || (r.op || r.requested) === 'MoveRule';
      function dist(v, down, up) { return (v > 0 ? down : up) + ' ' + num(Math.abs(v)) + ' pt'; }
      if (same(d[0], d[2]) && same(d[1], d[3])) {                       // every edge by the same amount: the item moved
        var bits = [];
        if (off(d[1])) bits.push(dist(d[1], 'right', 'left'));
        if (off(d[0])) bits.push(dist(d[0], 'down', 'up'));
        return { title: isRule ? 'Rule moved' : 'Item moved', detail: where + ': ' + bits.join(' and ') };
      }
      var names = ['top', 'left', 'bottom', 'right'], said = [];
      for (var i = 0; i < 4; i++) {
        if (!off(d[i])) continue;
        said.push(names[i] + ' edge ' + ((i % 2) ? dist(d[i], 'right', 'left') : dist(d[i], 'down', 'up')));
      }
      return { title: isRule ? 'Rule resized' : 'Frame edges moved', detail: where + ': ' + said.join(', ') };
    }
    if (b.style !== undefined && b.style !== a.style) return { title: 'Style applied', detail: where + ': ' + b.style + ' → ' + a.style };
    // Same style, but the hand-set overrides on top of it are gone: say what actually moved back.
    if (b.style !== undefined && b.style === a.style) {
      var bits2 = [];
      if (b.pointSize !== undefined && a.pointSize !== undefined && Math.abs(b.pointSize - a.pointSize) > 0.01) bits2.push(num(b.pointSize) + ' pt → ' + num(a.pointSize) + ' pt');
      if (b.overridden && !a.overridden) bits2.push('overrides cleared');
      if (bits2.length) return { title: 'Put back to its style', detail: where + ' (' + b.style + '): ' + bits2.join(', ') };
    }
    // Nothing recorded either side: an older round, from before the runner carried the tools' before and after through
    // (2026-09-20, live on 91908).
    if (!r.before && !r.after) return { title: friendly(r.op || r.requested), detail: where + ' — applied; what it changed was not recorded' };
    // Anything else the tools record — alignment, indents, space above, a hyphenation setting: name the attribute and
    // both values rather than falling back to the tool's name.
    var said = [], k;
    for (k in a) if (a.hasOwnProperty(k) && b[k] !== a[k] && typeof a[k] !== 'object') said.push(attrName(k) + ' ' + attrValue(b[k]) + ' → ' + attrValue(a[k]));
    if (said.length) return { title: friendly(r.op || r.requested), detail: where + ': ' + said.join(', ') };
    return { title: (r.why || r.op || r.requested), detail: where };
  }

  // what the runner applied, from the results it wrote back into the actions field, with the frame geometry the
  // report carries so each one can be drawn
  function changesFrom(report, results) {
    var frames = {}; (report && report.frames || []).forEach(function (f) { if (f.id != null) frames[String(f.id)] = f; });
    var out = [];
    // Every round that has been applied since the check read the layout, not just the newest: the two pictures span all
    // of them (Benn, 2026-09-20 — the runner now keeps `rounds`; older layouts have only the last round).
    var rounds = (results && results.rounds && results.rounds.length) ? results.rounds
               : [{ runId: (results && results.appliedRun) || null, at: (results && results.appliedAt) || null, results: (results && results.results) || [] }];
    var many = rounds.length > 1;
    rounds.forEach(function (round, ri) {
    ((round && round.results) || []).forEach(function (r) {
      if (r.ok === false) return;
      var fr = frames[String(r.frameId || (r.target && r.target.frameId))] || {};
      // A fix that reported success and changed nothing is worth seeing, not hiding: that is exactly how the tint bug
      // of 2026-09-20 hid — ResetTextRange said it had put the colour back and the type stayed at 94%.
      var w = inWords(r, fr) || { title: 'Nothing changed', detail: 'The ' + friendly(r.op || r.requested).toLowerCase() + ' fix reported success, but nothing it records moved' + ((fr.page || r.page) ? ' (page ' + (fr.page || r.page) + ')' : '') };
      if (r.article) w.detail = (window.__aiCheckArticleWords ? window.__aiCheckArticleWords(r).replace(/^ — i/, 'I') + ': ' : '') + w.detail;
      out.push({ op: r.op || r.requested, title: w.title, detail: w.detail,
                 round: many ? ('round ' + (ri + 1) + ' of ' + rounds.length + (round.afterVersion ? ', v' + round.afterVersion : '')) : null,
                 bounds: fr.bounds || null,
                 boundsBefore: (r.before && r.before.bounds) || fr.bounds || null,
                 boundsAfter: (r.after && r.after.bounds) || fr.bounds || null });
    });
    });
    return out;
  }

  // testing without a Studio session: the harness hands over the two pictures and the applied fixes directly
  function loadDemo(d) {
    BA.pageSize = d.pageSize; BA.page = { number: d.page }; BA.origin = [0, 0]; BA.spreadInfo = { pages: [BA.page], origin: [0, 0], size: d.pageSize, boxes: null };
    $ba('ba-name').textContent = d.name || 'demo layout';
    $ba('ba-pageline').textContent = 'page ' + d.page + ' of 1';
    $ba('ba-img-before').src = d.before; setAfter([d.after]);
    $ba('ba-versions').textContent = d.versions || '';
    $ba('ba-sub').textContent = d.sub || 'test data';
    return fetch(d.report).then(function (r) { return r.json(); }).then(function (rep) {
      BA.report = rep; BA.changes = changesFrom(rep, d.results); listChanges(); refit();
    });
  }


  // Studio's version history, with the picture it keeps for each version. The one the check read comes from the report
  // (its `layout.version`); the picker lets a person compare with any other version Studio still holds.
  function loadVersions(id, pointer, results, pg) {
    return callServer('ListVersions', { ID: String(id), Rendition: 'preview', __classname__: 'WflListVersionsRequest' })
      .then(function (res) {
        BA.versions = (res.Versions || []).filter(function (v) { return v.File && v.File.FileUrl; });
        var sel = $ba('ba-version'), sel2 = $ba('ba-version-after'); if (!sel) return;
        if (!BA.versions.length) { sel.hidden = true; if (sel2) sel2.hidden = true; return fallbackBefore(id, pg, 'Studio has no picture of an earlier version'); }
        var names = BA.versions.map(function (v) { return v.Version; });
        // THE PAIR THAT MATTERS is the round itself: the version the fixes were sent FROM, and the version they made
        // (Benn, 2026-09-21: "currently it selects the earliest version it can find, which is less useful").
        var rounds = (results && results.rounds) || [], beforeV = null, afterV = null, how = null;
        if (rounds.length && rounds[rounds.length - 1].beforeVersion) {
          var b = String(rounds[rounds.length - 1].beforeVersion);
          if (names.indexOf(b) >= 0) { beforeV = b; how = 'sent from'; afterV = names[names.indexOf(b) + 1] || BA.nowVersion; }
        }
        if (!beforeV) {                                   // no round recorded: fall back to the version the check read
          var rv = (BA.report && BA.report.layout && BA.report.layout.version) || null;
          if (rv && names.indexOf(rv) >= 0) { beforeV = rv; how = 'read by the check'; afterV = BA.nowVersion; }
        }
        if (!beforeV) { beforeV = names[0]; how = 'the earliest Studio still keeps'; afterV = BA.nowVersion; }
        if (!afterV || names.indexOf(afterV) < 0) afterV = BA.nowVersion;
        BA.beforeHow = how; BA.beforeDefault = beforeV;
        function opts(chosen, note) { return names.map(function (n) { return '<option value="' + esc(n) + '">v' + esc(n) + (n === BA.nowVersion ? ' (now)' : '') + (n === chosen && note ? ' · ' + note : '') + '</option>'; }).join(''); }
        sel.hidden = false; sel.innerHTML = opts(beforeV, how); sel.value = beforeV;
        if (sel2) { sel2.hidden = false; sel2.innerHTML = opts(afterV, (afterV !== BA.nowVersion) ? 'landed' : null); sel2.value = afterV; }
        showPair(beforeV, afterV, pg);
        sel.onchange = function () { showPair(this.value, sel2 ? sel2.value : afterV, pg); };
        if (sel2) sel2.onchange = function () { showPair(sel.value, this.value, pg); };
      })
      .catch(function (e) { var sel = $ba('ba-version'), s2 = $ba('ba-version-after'); if (sel) sel.hidden = true; if (s2) s2.hidden = true; return fallbackBefore(id, pg, 'could not read the version history: ' + e.message); });
  }

  // THE FIRST SPREAD, worked out from where the check found each page on the spread's ruler (the same test the review page
  // uses): a page whose left edge starts where the previous one ends is its right-hand partner. Studio's picture of a
  // version is of this spread, so before and after show the same thing.
  function firstSpread(rep) {
    var box = {};
    ((rep && rep.frames) || []).concat((rep && rep.findings) || []).forEach(function (x) { if (x && x.pageBounds && x.page != null && !box[String(x.page)]) box[String(x.page)] = x.pageBounds; });
    var p0 = BA.pages[0], out = [p0], b0 = box[p0.number];
    if (b0 && BA.pages[1]) { var b1 = box[BA.pages[1].number]; if (b1 && b1[1] > 0.5 && Math.abs(b0[3] - b1[1]) < 1 && Math.abs(b0[1]) < 0.5) out.push(BA.pages[1]); }
    var t = 1e9, l = 1e9, bo = -1e9, r = -1e9, known = true;
    out.forEach(function (p) { var b = box[p.number]; if (!b) { known = false; return; } t = Math.min(t, b[0]); l = Math.min(l, b[1]); bo = Math.max(bo, b[2]); r = Math.max(r, b[3]); });
    if (!known) return { pages: [p0], origin: [0, 0], size: [p0.width, p0.height], boxes: null };
    return { pages: out, origin: [t, l], size: [r - l, bo - t], boxes: out.map(function (p) { return box[p.number]; }) };
  }
  // after = the current page previews laid side by side; or, for an earlier version, the version's one picture
  function setAfter(urls) {
    var set = $ba('ba-img-after'); if (!set) return; set.innerHTML = '';
    var S = BA.spreadInfo, W = BA.pageSize[0], H = BA.pageSize[1];
    set.style.aspectRatio = W + ' / ' + H;
    urls.forEach(function (u, i) { if (!u) return; var im = document.createElement('img'); im.alt = 'page ' + ((S && S.pages[i]) ? S.pages[i].number : ''); im.src = u;
      var b = (S && S.boxes && urls.length > 1) ? S.boxes[i] : null;
      if (b) { im.style.left = ((b[1] - S.origin[1]) / W * 100) + '%'; im.style.top = ((b[0] - S.origin[0]) / H * 100) + '%'; im.style.width = ((b[3] - b[1]) / W * 100) + '%'; }
      else { im.style.left = '0'; im.style.top = '0'; im.style.width = '100%'; }
      set.appendChild(im); });
  }

  function versionUrl(v) {
    var hit = (BA.versions || []).filter(function (x) { return x.Version === v; })[0];
    return hit ? withWwApp(hit.File.FileUrl) : null;
  }

  // A version's picture is the whole layout's first spread, so it stands in for the page only on a single-page layout.
  function showPair(beforeV, afterV, pg) {
    // The view shows the FIRST SPREAD, which is exactly what Studio's picture of a version holds.
    if (versionUrl(beforeV)) setBefore(versionUrl(beforeV));
    else fallbackBefore(BA.layoutId, pg, 'Studio has no picture of v' + beforeV);
    // The current version has a picture PER PAGE, laid side by side; an earlier one has the single version picture.
    if (afterV === BA.nowVersion) setAfter(BA.spreadInfo.pages.map(function (p) { return p.preview ? withWwApp(p.preview.FileUrl) : null; }));
    else if (versionUrl(afterV)) setAfter([versionUrl(afterV)]);
    BA.afterShown = afterV;
    var longHow = { 'sent from': 'the version the fixes were sent from', 'read by the check': 'the version the check read', 'the earliest Studio still keeps': 'the earliest version Studio still keeps' }[BA.beforeHow] || BA.beforeHow;
    $ba('ba-versions').textContent = 'before: v' + beforeV + ((beforeV === BA.beforeDefault && BA.beforeHow) ? ' — ' + longHow : '') +
      ' · after: v' + afterV + (afterV === BA.nowVersion ? ' (now)' : '');
  }

  // Only when Studio's own history cannot answer: the picture the read exported, from the local report server.
  function fallbackBefore(id, pg, why) {
    BA.beforeWhy = why;
    setBefore(CFG.localReports + '/beforeimage?layout=' + encodeURIComponent(id) + '&page=' + encodeURIComponent(pg && pg.number));
  }

  function load(id) {
    if (window.__aiCheckDemo && window.__aiCheckDemo.ba) return loadDemo(window.__aiCheckDemo.ba);
    BA.layoutId = String(id); BA.selected = null; BA.report = null; BA.versions = null; if ($ba('ba-id')) $ba('ba-id').value = String(id);
    $ba('ba-sub').textContent = 'loading…';
    return callServer('GetObjects', { IDs: [String(id)], Lock: false, Rendition: 'preview', RequestInfo: ['MetaData', 'Pages'], __classname__: 'WflGetObjectsRequest' })
      .then(function (res) {
        var obj = res.Objects[0]; BA.obj = obj;
        var meta = obj.MetaData, name = meta.BasicMetaData.Name, version = meta.WorkflowMetaData.Version;
        var pointer = {}, results = {};
        try { pointer = JSON.parse(extraOf(obj, CFG.reportField) || '{}'); } catch (e) {}
        try { results = JSON.parse(extraOf(obj, CFG.actionsField) || '{}'); } catch (e) {}
        BA.pages = (obj.Pages || []).map(function (p) { return { number: String(p.PageNumber), width: parseFloat(p.Width), height: parseFloat(p.Height), preview: (p.Files || []).filter(function (f) { return f.Rendition === 'preview'; })[0] }; });
        var pg = BA.pages[0]; if (!pg) throw new Error('this layout has no page preview');
        BA.page = pg; BA.pageSize = [pg.width, pg.height]; BA.origin = [0, 0]; BA.spreadInfo = { pages: [pg], origin: [0, 0], size: BA.pageSize, boxes: null };
        $ba('ba-name').textContent = name;
        $ba('ba-pageline').textContent = 'page ' + pg.number + ' of ' + BA.pages.length;
        setAfter([pg.preview ? withWwApp(pg.preview.FileUrl) : null]);
        // THE EARLIER PICTURE IS ALREADY IN STUDIO. Benn, 2026-09-20: "you can go back through version history and see the
        // layout version — surely there must be a preview of the previous versions". Probed and true: ListVersions with
        // Rendition 'preview' returns one picture per version (91908 v0.98–0.103), page-sized for a single-page layout.
        // One picture per VERSION though, not per page: on a multi-page layout it is the first spread only, so for any
        // other page we fall back to the picture the read exported.
        BA.nowVersion = version;
        $ba('ba-sub').textContent = results.appliedAt ? ('fixes applied ' + results.appliedAt) : 'no fixes applied yet';
        // The report first — it names the version the check read, which is the version the picker opens on.
        var got = pointer.file ? fetch(CFG.localReports + '/localreport?path=' + encodeURIComponent(pointer.file), { mode: 'cors' }).then(function (r) { return r.json(); }).catch(function () { return null; })
                               : Promise.resolve(null);
        return got.then(function (rep) {
          BA.report = rep;
          // the first spread, as Studio's version picture holds it
          var sp = firstSpread(rep); BA.spreadInfo = sp; BA.pageSize = sp.size; BA.origin = sp.origin;
          $ba('ba-pageline').textContent = sp.pages.length > 1 ? ('pages ' + sp.pages[0].number + '–' + sp.pages[sp.pages.length - 1].number + ' (the first spread) of ' + BA.pages.length) : ('page ' + pg.number + ' of ' + BA.pages.length);
          setAfter(sp.pages.map(function (p) { return p.preview ? withWwApp(p.preview.FileUrl) : null; }));
          BA.changes = changesFrom(rep, results); listChanges(); refit();
          return loadVersions(id, pointer, results, pg);
        });
      })
      .catch(function (e) { $ba('ba-sub').textContent = 'could not load: ' + e.message; });
  }

  function initBeforeAfter() {
    if (!document.getElementById('ba-style')) { var st = document.createElement('style'); st.id = 'ba-style'; st.textContent = BA_CSS; document.head.appendChild(st); }
    // no Load of its own: the bar above both tabs chooses the layout, and this view follows it
    $ba('ba-before').onclick = function () { show('before'); };
    $ba('ba-after').onclick = function () { show('after'); };
    $ba('ba-changes').onchange = function () { BA.showChanges = this.checked; drawBoxes(); };
    $ba('ba-zin').onclick = function () { setZoom(BA.zoom * 1.25); drawBoxes(); };
    $ba('ba-zout').onclick = function () { setZoom(BA.zoom / 1.25); drawBoxes(); };
    $ba('ba-zfit').onclick = function () { fit(); drawBoxes(); };
    $ba('ba-zrange').oninput = function () { setZoom(parseInt(this.value, 10) / 100); drawBoxes(); };
    // the page flicks with the space bar, which is how a person compares two states
    document.addEventListener('keydown', function (e) {
      var w = document.getElementById('ba-wrap'); if (!w || w.offsetParent === null) return;
      if (e.code === 'Space') { e.preventDefault(); show(BA.showing === 'after' ? 'before' : 'after'); }
    });
    window.addEventListener('resize', function () { refit(); });
  }

  // The view fills whatever room is left below the tab strip — in Studio the app sits under the client's own chrome, so
  // the height cannot be read off the viewport (2026-09-20: the panel's footer was cut off the bottom of the screen).
  function refit() {
    var host = document.getElementById('aicheck-view-ba') || (document.getElementById('ba-wrap') || {}).parentNode;
    if (host && host.getBoundingClientRect) {
      var top = host.getBoundingClientRect().top;
      host.style.height = Math.max(320, Math.round((window.innerHeight || 800) - top - 2)) + 'px';
    }
    if (BA.pageSize) { fit(); drawBoxes(); }
  }

  window.AICheckBeforeAfter = { html: BA_HTML, init: initBeforeAfter, load: load, refit: refit, shownId: function () { return BA.layoutId ? String(BA.layoutId) : null; } };
})();
