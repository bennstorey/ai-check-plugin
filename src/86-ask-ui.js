// ── Ask Studio: the look ──────────────────────────────────────────────────────────────────────────────────────────
//
// PURE RENDER. Nothing here talks to Studio, to the service, or to the model. Every function takes a state object and
// returns HTML, so the whole surface can be drawn on a design board (ask-states.html) with no server, no key and no
// layout — which is how the finding cards got fixed in one round instead of six (Benn, 2026-10-05: "the design is not
// good enough yet, let's do that first").
//
// The vocabulary is the Re-use content plug-in's, taken whole rather than re-invented: one stage shape for every wait,
// one writer, one renderer, and clocks that tick by rewriting [data-since] spans rather than re-rendering.
//
//   a stage   { key, label, state: 'pending'|'active'|'done'|'warn'|'failed'|'skipped', detail, t0, t1 }
//   a turn    { who: 'person'|'me', text, block }      block is one of the rich blocks below, drawn inside my bubble
//   a block   { kind: 'stages'|'list'|'run'|'nothing'|'down', … }
//
// Class names are the contract: keep them, restyle freely.
(function () {
  'use strict';

  var MARK = '<svg viewBox="866 135 432 432" aria-hidden="true"><g transform="matrix(1,0,0,-1,0,700)" fill="currentColor" fill-rule="evenodd"><path d="M1040.5 333C1059.9 349.9 1071 374.2 1071 400.8 1071 433.4 1054.1 462.6 1025.9 478.9L906.9 547.6C901.8 550.6 895.3 550.6 890.2 547.6 885 544.6 881.8 539 881.8 533.1V437.9C881.8 415.1 894 394 913.7 382.6L987.5 340 1008.8 352.2C1009.1 352.4 1009.3 352.6 1009.6 352.8L924.7 401.8C911.9 409.2 903.9 423 903.9 437.9V523.8L1014.8 459.7C1036.2 447.4 1048.9 425.3 1048.9 400.7 1048.9 383.4 1042.5 367.3 1031.4 355 1031.3 355 1031.3 354.9 1031.2 354.9 1028.9 352.4 1026.5 350.1 1023.9 348 1023.6 347.8 1023.4 347.6 1023.1 347.4 1022.5 346.9 1021.9 346.4 1021.3 346L1021.3 346C1019.2 344.5 1017.1 343.1 1014.8 341.7L999.6 333 970.8 316.3C965.7 313.4 961.2 309.8 957.2 305.7H957.2C945.6 294 938.9 277.9 938.9 261V165.9C938.9 159.9 942.1 154.3 947.3 151.3 949.9 149.9 952.8 149.1 955.7 149.1 958.6 149.1 961.5 149.9 964.1 151.3L1026 187.1C1054.2 203.4 1071.1 232.6 1071.1 265.2 1071 291.8 1059.8 316.1 1040.5 333ZM1014.8 206.3 961 175.2V261C961 275.9 969.1 289.7 981.9 297.2L1021.4 320C1038.8 307.2 1048.9 287.2 1048.9 265.2 1048.9 240.6 1036.2 218.6 1014.8 206.3Z"/><path d="M1273.7 547.6C1268.5 550.6 1262.1 550.6 1257 547.6L1138 478.9C1109.7 462.6 1092.9 433.4 1092.9 400.8 1092.9 390.9 1094.4 381.2 1097.4 372.2H1097.5C1099.1 367.1 1101.3 362.1 1103.9 357.4 1103.9 357.4 1103.9 357.3 1103.9 357.3 1106.5 352.6 1109.5 348.2 1112.8 344 1112.8 344 1112.9 343.9 1112.9 343.9 1114.5 341.9 1116.2 340.1 1118 338.3 1118.2 338 1118.4 337.8 1118.7 337.5 1124.3 331.9 1130.8 326.8 1138 322.7L1142.6 320 1182 297.2C1194.9 289.8 1202.9 276 1202.9 261.1V175.3L1149.1 206.3C1127.8 218.6 1115 240.7 1115 265.3 1115 283 1121.6 299.2 1133.1 311.6L1132 312.2C1125.8 315.8 1120.1 320 1114.9 324.5 1100.8 308.4 1092.9 287.7 1092.9 265.3 1092.9 232.7 1109.8 203.5 1138 187.2L1199.9 151.5C1202.5 150 1205.4 149.2 1208.3 149.2 1211.2 149.2 1214.1 150 1216.7 151.5 1221.9 154.4 1225.1 160 1225.1 166V261.1C1225.1 283.9 1212.9 305.1 1193.2 316.4L1164.4 333.1 1250.3 382.7C1270 394.1 1282.2 415.3 1282.2 438V533.1C1282.1 539.1 1278.9 544.6 1273.7 547.6ZM1260 437.9C1260 423.1 1252 409.2 1239.2 401.8L1142.6 346C1125.2 358.8 1115 378.8 1115 400.8 1115 425.4 1127.7 447.4 1149 459.7L1260 523.8V437.9Z"/></g></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  // ── the wait ────────────────────────────────────────────────────────────────────────────────────────────────────
  // One vocabulary for every wait, so a person learns it once. A stage that is running carries [data-since]; a single
  // ticker in the app rewrites those spans every second, which is what keeps clocks moving without a re-render.
  var MARKS = { pending: '', active: '', done: '✓', warn: '!', failed: '✕', skipped: '–' };

  function clock(t0, t1) {
    if (!t0) return '';
    if (t1) return '<span class="ask-t">' + mmss(t1 - t0) + '</span>';
    return '<span class="ask-t" data-since="' + t0 + '">' + mmss(Date.now() - t0) + '</span>';
  }
  function mmss(ms) { var s = Math.max(0, Math.round(ms / 1000)); return (s < 60) ? (s + 's') : (Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2)); }

  function stagesHtml(stages) {
    if (!stages || !stages.length) return '';
    return '<ol class="ask-stages">' + stages.map(function (s) {
      return '<li class="ask-stage is-' + esc(s.state) + '">' +
        '<span class="ask-mark">' + (MARKS[s.state] || '') + '</span>' +
        '<span class="ask-slabel">' + esc(s.label) + '</span>' +
        clock(s.t0, s.t1) +
        (s.detail ? '<span class="ask-sdetail">' + esc(s.detail) + '</span>' : '') +
        '</li>';
    }).join('') + '</ol>';
  }

  // ── the list: what I found, before I touch anything ──────────────────────────────────────────────────────────────
  // Everything found is shown, including what I will not act on and why. A layout somebody has open cannot be read,
  // so it is listed, excluded and explained rather than quietly dropped.
  function listHtml(b) {
    var take = b.rows.filter(function (r) { return !r.skip; });
    return '<div class="ask-card">' +
      '<div class="ask-card-h"><b>' + b.rows.length + '</b> in ' + esc(b.status) + (b.brand ? ' · ' + esc(b.brand) : '') + '</div>' +
      '<ul class="ask-rows">' + b.rows.map(function (r) {
        return '<li class="ask-row' + (r.skip ? ' is-skip' : '') + '">' +
          '<span class="ask-rname">' + esc(r.name) + '</span>' +
          (r.pages ? '<span class="ask-rpg">' + esc(r.pages) + '</span>' : '') +
          '<span class="ask-rstate">' + esc(r.state) + '</span>' +
          (r.skip ? '<span class="ask-rskip">' + esc(r.skip) +
            (r.queue ? ' <button class="ask-link">Queue it</button>' : '') + '</span>' : '') +
          '</li>';
      }).join('') + '</ul>' +
      (b.capped ? '<p class="ask-note">That is the first ' + b.rows.length + '. There may be more — ask me again when these are through.</p>' : '') +
      '<div class="ask-card-f">' +
        '<button class="ask-cta">Check ' + take.length + (take.length === 1 ? ' layout' : ' layouts') + '</button>' +
        '<span class="ask-fnote">' + esc(b.cost) + '</span>' +
      '</div>' +
    '</div>';
  }

  // ── the run: the writes, one at a time, each read back ───────────────────────────────────────────────────────────
  // The bar counts STEPS, not layouts, so one slow layout still visibly moves — the sibling's lesson from a 56-image
  // import that looked hung for ninety seconds.
  function runHtml(b) {
    var units = b.rows.length * 2, done = 0;
    b.rows.forEach(function (r) { if (r.state === 'done') done += 2; else if (r.state === 'active') done += 1; });
    var pct = units ? Math.round(done / units * 100) : 0;
    var ok = b.rows.filter(function (r) { return r.state === 'done'; }).length;
    var bad = b.rows.filter(function (r) { return r.state === 'failed'; }).length;
    var head = b.finished
      ? (bad ? ok + ' of ' + b.rows.length + ' asked for — ' + bad + ' did not take' : 'All ' + b.rows.length + ' asked for')
      : 'Asking for ' + Math.min(ok + 1, b.rows.length) + ' of ' + b.rows.length;
    return '<div class="ask-card">' +
      '<div class="ask-card-h">' + esc(head) + clock(b.t0, b.t1) + '</div>' +
      '<div class="ask-bar"><i style="width:' + pct + '%"></i></div>' +
      '<ul class="ask-rows">' + b.rows.map(function (r) {
        return '<li class="ask-row is-' + esc(r.state) + '">' +
          '<span class="ask-mark">' + (MARKS[r.state] || '') + '</span>' +
          '<span class="ask-rname">' + esc(r.name) + '</span>' +
          '<span class="ask-rstate">' + esc(r.detail || '') + '</span>' +
          clock(r.t0, r.t1) +
          '</li>';
      }).join('') + '</ul>' +
      (b.finished ? '<p class="ask-note">' + esc(b.after) + '</p>'
                  : '<p class="ask-note">A second each. The checking itself happens on its own afterwards — that part you can walk away from.</p>') +
    '</div>';
  }

  function nothingHtml(b) {
    return '<div class="ask-card is-quiet">' +
      '<div class="ask-card-h">' + esc(b.status) + ' is empty.</div>' +
      '<p class="ask-note">Statuses I can see: ' + esc((b.known || []).join(' · ')) + '.</p>' +
    '</div>';
  }

  function downHtml(b) {
    return '<div class="ask-card is-down">' +
      '<div class="ask-card-h">I can’t check right now</div>' +
      '<p class="ask-note">The tools I need to understand what you need are offline. Studio is untouched.</p>' +
      '<div class="ask-card-f"><button class="ask-small">Tell support</button>' +
        '<span class="ask-fnote">Sends them what happened.</span></div>' +
    '</div>';
  }

  function blockHtml(b) {
    if (!b) return '';
    if (b.kind === 'stages') return stagesHtml(b.stages);
    if (b.kind === 'list') return listHtml(b);
    if (b.kind === 'run') return runHtml(b);
    if (b.kind === 'nothing') return nothingHtml(b);
    if (b.kind === 'down') return downHtml(b);
    return '';
  }

  // ── the turns ───────────────────────────────────────────────────────────────────────────────────────────────────
  function turnHtml(t) {
    if (t.who === 'person') return '<div class="ask-turn is-you"><div class="ask-bub">' + esc(t.text) + '</div></div>';
    return '<div class="ask-turn is-me">' +
      '<span class="ask-av">' + MARK + '</span>' +
      '<div class="ask-bub">' + (t.text ? '<p>' + esc(t.text) + '</p>' : '') + blockHtml(t.block) + '</div>' +
    '</div>';
  }

  // ── the front door ──────────────────────────────────────────────────────────────────────────────────────────────
  // Not a separate page: the same surface with no turns yet. One question, one box, and the things people actually
  // ask, so nobody has to guess what it can do.
  function welcomeHtml(st) {
    return '<div class="ask-welcome">' +
      '<span class="ask-av is-big">' + MARK + '</span>' +
      '<h2>What can I help you to do?</h2>' +
      '<p class="ask-lede">Tell me what you are trying to get done.</p>' +
      composerHtml(st, true) +
      recentHtml(st) +
    '</div>';
  }

  // Asked before — a dropdown, not a row of buttons (Benn, 2026-10-06). Nothing is shown until there is a history.
  function recentHtml(st) {
    var r = st.recent || [];
    if (!r.length) return '';
    return '<div class="ask-recent"><select class="ask-recentsel"><option value="">Past questions…</option>' +
      r.map(function (q, i) { return '<option value="' + i + '">' + esc(q) + '</option>'; }).join('') +
      '</select></div>';
  }

  function composerHtml(st, big) {
    return '<div class="ask-composer' + (big ? ' is-big' : '') + '">' +
      '<div class="ask-field">' +
        '<textarea class="ask-input" rows="' + (big ? 2 : 1) + '" placeholder="' + (big ? 'I’m running late and I’ve another spread to build…' : 'Say a bit more') + '"' + (st.busy ? ' disabled' : '') + '>' + esc(st.draft || '') + '</textarea>' +
        brandHtml(st) +
      '</div>' +
      '<button class="ask-send"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Thinking…' : 'Ask') + '</button>' +
    '</div>';
  }

  // WHICH BRAND IS A CHOICE, NOT AN ASSUMPTION (Benn, 2026-10-06). It sits in the box the way the Re-use plug-in puts
  // the archive there: a real <select>, so the keyboard and the option list are the browser's own.
  function brandHtml(st) {
    var bs = st.brands || [];
    if (!bs.length) return '';
    return '<select class="ask-brand" aria-label="Which brand">' + bs.map(function (b) {
      return '<option' + (b === st.brand ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') + '</select>';
  }

  function appHtml(st) {
    if (!st.turns || !st.turns.length) return '<div class="ask-app is-welcome">' + welcomeHtml(st) + '</div>';
    return '<div class="ask-app">' +
      // Start again, and get this out of the way, without leaving the app (Benn, 2026-10-06). Studio's own Apps menu
      // is how you leave entirely; this is how you drop a conversation you no longer need.
      '<div class="ask-top' + (st.writing ? ' is-writing' : '') + '">' +
        '<span class="ask-top-t">' + (st.writing ? 'Writing to Studio — a few seconds. Don’t close this.' : esc(st.brand || '')) + '</span>' +
        '<button class="ask-ib" id="ask-new" title="Start again"' + (st.writing ? ' disabled' : '') + '>New</button>' +
        '<button class="ask-ib" id="ask-close" title="Put this away"' + (st.writing ? ' disabled' : '') + '>✕</button></div>' +
      '<div class="ask-log">' + st.turns.map(turnHtml).join('') + '</div>' +
      '<div class="ask-foot">' + composerHtml(st, false) +
        '<p class="ask-foot-note">Nothing changes in Studio until you say so.</p>' +
      '</div>' +
    '</div>';
  }

  // ── the look ────────────────────────────────────────────────────────────────────────────────────────────────────
  // Tokens only for colour and radius; sizes stay literal, as in the panel. --ai is the assistant's own colour and is
  // the ONLY place the purple appears, because the slide marks it NOT FINAL.
  var CSS = [
    '.ask{--ai:#6B03FC;--ground:#f8fafc;--paper:#fff;--ink:#0f172a;--ink-2:#374151;--ink-3:#6b7280;--ink-4:#94a3b8;',
    '  --line:#e2e8f0;--line-2:#f1f5f9;--accent:#f59e0b;--accent-ink:#111827;--ok:#15803d;--bad:#c80909;--warn:#c86b00;',
    // Studio's own theme fonts (Benn, 2026-10-06): Mulish for reading, Raleway for headings. Named first and the
    // system stack behind them, so the surface still reads properly wherever the webfonts have not loaded.
    '  --font-b:Mulish,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    '  --font-h:Raleway,var(--font-b);',
    '  font:14px/1.5 var(--font-b);color:var(--ink);',
    '  container-type:inline-size;height:100%;display:flex;flex-direction:column;background:var(--ground)}',
    '.ask *{box-sizing:border-box}',
    '.ask-app{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
    '.ask-app.is-welcome{justify-content:center;align-items:center;padding:24px}',

    // the front door
    '.ask-welcome{width:min(620px,100%);text-align:center}',
    '.ask-welcome h2{margin:14px 0 4px;font-family:var(--font-h);font-size:24px;font-weight:800;letter-spacing:-.01em}',
    '.ask-lede{margin:0 0 18px;color:var(--ink-3);font-size:14px}',
    '.ask-eg{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px}',
    '.ask-egbtn{font:inherit;font-size:12.5px;color:var(--ink-2);background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}',
    '.ask-egbtn:hover{border-color:var(--ink-3)}',

    // the mark
    '.ask-av{width:28px;height:28px;flex:none;border-radius:50%;background:var(--ai);color:#fff;display:inline-flex;align-items:center;justify-content:center}',
    '.ask-av svg{width:62%;height:62%}',
    '.ask-av.is-big{width:52px;height:52px}',

    // the conversation
    '.ask-log{flex:1 1 auto;min-height:0;overflow:auto;padding:18px 20px;display:flex;flex-direction:column;gap:16px}',
    '.ask-turn{display:flex;gap:10px;align-items:flex-start}',
    '.ask-turn.is-you{justify-content:flex-end}',
    '.ask-turn.is-you .ask-bub{background:var(--paper);border:1px solid var(--line);border-radius:12px 12px 2px 12px;padding:9px 13px;max-width:min(560px,78%)}',
    '.ask-turn.is-me .ask-bub{background:transparent;max-width:min(680px,100%);flex:1 1 auto;min-width:0}',
    '.ask-turn.is-me .ask-bub>p{margin:3px 0 0;line-height:1.5}',
    '.ask-turn.is-me .ask-bub>p+.ask-card,.ask-turn.is-me .ask-bub>p+.ask-stages{margin-top:10px}',

    // the wait
    '.ask-stages{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:3px 8px;align-items:baseline}',
    '.ask-stage{display:contents}',
    '.ask-mark{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;background:var(--line-2);color:var(--ink-4)}',
    '.ask-stage.is-done .ask-mark{background:#e6f4ea;color:var(--ok)}',
    '.ask-stage.is-failed .ask-mark{background:#fdecea;color:var(--bad)}',
    '.ask-stage.is-warn .ask-mark{background:#fff6e5;color:var(--warn)}',
    '.ask-stage.is-active .ask-mark{background:transparent;border:2px solid var(--line);border-top-color:var(--ai);animation:askspin 1s linear infinite}',
    '@keyframes askspin{to{transform:rotate(360deg)}}',
    '@media (prefers-reduced-motion:reduce){.ask-stage.is-active .ask-mark{animation-duration:2.4s}}',
    '.ask-slabel{font-size:13px;color:var(--ink-2)}',
    '.ask-stage.is-pending .ask-slabel{color:var(--ink-4)}',
    '.ask-t{font-size:11.5px;color:var(--ink-4);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.ask-sdetail{grid-column:2/4;font-size:11.5px;color:var(--ink-3);margin:-1px 0 3px}',

    // the cards
    '.ask-card{background:var(--paper);border:1px solid var(--line);border-radius:10px;overflow:hidden}',
    '.ask-card.is-quiet{background:transparent}',
    '.ask-card.is-down{border-color:#fdd;background:#fff8f8}',
    '.ask-card-h{display:flex;gap:8px;align-items:baseline;padding:10px 14px;border-bottom:1px solid var(--line-2);font-family:var(--font-h);font-size:13px;font-weight:600;color:var(--ink-2)}',
    '.ask-card-h b{font-weight:700;color:var(--ink)}',
    '.ask-rows{list-style:none;margin:0;padding:0}',
    '.ask-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:4px 10px;align-items:baseline;padding:8px 14px;border-top:1px solid var(--line-2);font-size:13px}',
    '.ask-row:first-child{border-top:0}',
    '.ask-row.is-skip{color:var(--ink-4)}',
    '.ask-rname{font-family:var(--font-h);font-weight:600;overflow-wrap:anywhere}',
    '.ask-row.is-skip .ask-rname{font-weight:500}',
    '.ask-rpg{font-size:11.5px;color:var(--ink-3);font-variant-numeric:tabular-nums}',
    '.ask-rstate{font-size:11.5px;color:var(--ink-3);text-align:right}',
    '.ask-rskip{grid-column:1/4;font-size:11.5px;color:var(--ink-3)}',
    // in a run the row leads with its mark
    '.ask-card .ask-row.is-done,.ask-card .ask-row.is-active,.ask-card .ask-row.is-failed,.ask-card .ask-row.is-pending{grid-template-columns:18px minmax(0,1fr) auto auto}',
    '.ask-row.is-done .ask-mark{background:#e6f4ea;color:var(--ok)}',
    '.ask-row.is-failed .ask-mark{background:#fdecea;color:var(--bad)}',
    '.ask-row.is-active .ask-mark{background:transparent;border:2px solid var(--line);border-top-color:var(--ai);animation:askspin 1s linear infinite}',
    '.ask-bar{height:3px;background:var(--line-2)}',
    '.ask-bar i{display:block;height:100%;background:var(--ai);transition:width .3s ease}',
    '.ask-card-f{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--line-2);background:var(--ground)}',
    '.ask-note{margin:0;padding:10px 14px;font-size:12.5px;color:var(--ink-3);line-height:1.45}',
    '.ask-fnote{font-size:12.5px;color:var(--ink-3)}',

    // the one button that does something
    '.ask-cta{font:inherit;font-size:14px;font-weight:700;background:var(--accent);color:var(--accent-ink);border:1px solid var(--accent);border-radius:8px;padding:9px 18px;cursor:pointer}',
    '.ask-cta:hover{filter:brightness(1.04)}',

    // the composer
    '.ask-foot{flex:0 0 auto;border-top:1px solid var(--line);background:var(--paper);padding:10px 20px 12px}',
    '.ask-foot-note{margin:6px 0 0;font-size:11.5px;color:var(--ink-4)}',
    '.ask-composer{display:flex;gap:8px;align-items:flex-end}',
    '.ask-composer.is-big{display:block}',
    '.ask-input{flex:1 1 auto;min-width:0;font:inherit;font-size:14px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px;resize:none}',
    '.ask-composer.is-big .ask-input{width:100%;font-size:15px;padding:14px 15px;border-radius:12px;box-shadow:0 1px 2px rgba(15,23,42,.04)}',
    '.ask-input:focus{outline:2px solid var(--ai);outline-offset:-1px;border-color:var(--ai)}',
    '.ask-send{font:inherit;font-size:13.5px;font-weight:700;background:var(--accent);color:var(--accent-ink);border:1px solid var(--accent);border-radius:8px;padding:9px 16px;cursor:pointer;white-space:nowrap}',
    '.ask-composer.is-big .ask-send{margin-top:10px;padding:10px 22px;font-size:14px}',
    '.ask-send:disabled{opacity:.5;cursor:default}',

    // asked before, the brand, and the way out
    '.ask-recent{margin-top:12px}',
    '.ask-recentsel{font:inherit;font-size:12.5px;color:var(--ink-2);background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}',
    '.ask-field{flex:1 1 auto;min-width:0;position:relative;display:flex;flex-direction:column}',
    '.ask-brand{align-self:flex-start;margin:6px 0 0;font:inherit;font-size:11.5px;color:var(--ink-3);background:var(--ground);border:1px solid var(--line);border-radius:999px;padding:3px 10px;cursor:pointer;field-sizing:content}',
    '.ask-top{flex:0 0 auto;display:flex;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line);background:var(--paper)}',
    '.ask-top.is-writing{background:#fff8e8;border-bottom-color:#f0dcb4}',
    '.ask-top.is-writing .ask-top-t{color:var(--warn);font-weight:600}',
    '.ask-ib:disabled{opacity:.4;cursor:default}',
    '.ask-top-t{flex:1 1 auto;min-width:0;font-size:12px;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ask-ib{font:inherit;font-size:12px;color:var(--ink-2);background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:3px 9px;cursor:pointer}',
    '.ask-ib:hover{border-color:var(--ink-3)}',
    '.ask-link{font:inherit;font-size:11.5px;color:var(--ink-2);background:none;border:0;border-bottom:1px solid var(--line);padding:0;cursor:pointer}',
    '.ask-small{font:inherit;font-size:12.5px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:5px 11px;cursor:pointer}',
    // the pane, not the window
    '@container (max-width:560px){.ask-log{padding:14px 12px}.ask-foot{padding:10px 12px}',
    '  .ask-turn.is-you .ask-bub{max-width:88%}.ask-welcome h2{font-size:20px}',
    '  .ask-row,.ask-card .ask-row{grid-template-columns:minmax(0,1fr) auto}.ask-rstate{grid-column:1/3;text-align:left}}'
  ].join('\n');

  window.AskUI = { CSS: CSS, MARK: MARK, appHtml: appHtml, welcomeHtml: welcomeHtml, turnHtml: turnHtml,
                   stagesHtml: stagesHtml, blockHtml: blockHtml, esc: esc, mmss: mmss };
})();
