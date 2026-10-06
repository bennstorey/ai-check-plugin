// ── Ask Studio ────────────────────────────────────────────────────────────────────────────────────────────────────
//
// The assistant's front door: its own entry in Studio's Apps menu, where somebody starts with a sentence about their
// day rather than a layout. View 1 of the AI-views slide — "you start with the AI; it knows nothing yet, so it asks".
//
// The one thing it can set running is a check on every layout in a workflow status. Five beats:
//
//   the ask        a person types what they are trying to get done
//   the answer     the service works out what they mean; the PANEL does the finding, on their own session
//   the confirm    everything found is shown — including what will be left alone, and why — and nothing moves yet
//   the work       one layout at a time, each read back, with the requester written down
//   the handoff    the watcher checks them and says so on each layout; AI Check takes it from there
//
// It writes nothing the person has not agreed to, and it holds the view while it writes, because those few seconds
// happen in this browser (Benn, 2026-10-06: "either the watcher should do the writing… or we just don't allow the
// user to close the panel until the work is written").
(function () {
  'use strict';
  if (typeof ContentStationSdk === 'undefined') return;

  var UI = window.AskUI;
  if (!UI) return;                                        // the look lives in 86-ask-ui.js; without it there is nothing to draw

  var ROOT = 'askst';                                     // every id in here is namespaced: two apps, one bundle
  var st = { turns: [], draft: '', busy: false, writing: false, brands: [], brand: null, statuses: [], checks: [],
             recent: [], me: null };

  function $(id) { return document.getElementById(ROOT + '-' + id); }
  function recentKey() { return 'askst-recent'; }
  var BRAND_KEY = 'askst-brand';
  function rememberBrand() { try { if (st.brand) localStorage.setItem(BRAND_KEY, st.brand.name); } catch (e) {} }
  function lastBrand() { try { return localStorage.getItem(BRAND_KEY); } catch (e) { return null; } }
  function loadRecent() { try { st.recent = JSON.parse(localStorage.getItem(recentKey()) || '[]'); } catch (e) { st.recent = []; } }
  function keepRecent(q) {
    st.recent = [q].concat((st.recent || []).filter(function (x) { return x !== q; })).slice(0, 8);
    try { localStorage.setItem(recentKey(), JSON.stringify(st.recent)); } catch (e) {}
  }

  // ── what Studio knows ───────────────────────────────────────────────────────────────────────────────────────────
  function brands() {
    return callServer('GetPublications', { __classname__: 'WflGetPublicationsRequest' }).then(function (r) {
      st.brands = ((r && r.Publications) || []).map(function (p) { return { id: p.Id, name: p.Name }; });
      if (!st.brand && st.brands.length) {
        var want = lastBrand();
        st.brand = (want && st.brands.filter(function (b) { return b.name === want; })[0]) || st.brands[0];
      }
      return st.brands;
    });
  }
  // The statuses are read BEFORE anything is matched, because an exact-match query is the only one this server
  // honours: a status name that is nearly right comes back as nothing at all, silently, and reads as "none found".
  function statuses() {
    if (!st.brand) return Promise.resolve([]);
    // The shape matters and is not obvious: Publication is an OBJECT with an Id, not a PublicationId string. Getting
    // that wrong returns an error, and swallowing the error made the app say "I can't see any statuses" as though the
    // brand had none — a lie about Studio rather than a fault of mine (live in the lab, 2026-10-06).
    st.statusError = null;
    return callServer('GetStates', { Publication: { Id: String(st.brand.id), __classname__: 'Publication' },
                                     Issue: null, Section: null, Type: 'Layout', __classname__: 'WflGetStatesRequest' })
      .then(function (r) { st.statuses = ((r && r.States) || []).map(function (s) { return s.Name; }); return st.statuses; })
      .catch(function (e) { st.statuses = []; st.statusError = String((e && e.message) || e); return st.statuses; });
  }
  // The AI check's own values, read from Studio rather than remembered. C_AI_CHECK is a list property, so the server
  // holds the only true list; on the lab today it is Not requested · Requested · Checked · Fixes approved ·
  // Fixes applied · Skip. Hard-coding it would make the panel lie the first time a brand's list differed.
  function checkValues() {
    return callServer('GetCustomProperties', { __classname__: 'WflGetCustomPropertiesRequest' })
      .then(function (r) {
        var found = null;
        ((r && r.ObjectTypeProperties) || []).forEach(function (g) {
          ((g && g.Properties) || []).forEach(function (p) {
            if (p && p.Name === 'C_AI_CHECK' && p.ValueList && p.ValueList.length) found = p.ValueList;
          });
        });
        st.checks = (found || []).filter(function (v) { return v; });
        return st.checks;
      })
      .catch(function () { st.checks = []; return st.checks; });   // not fatal: the status route still works
  }

  // One finder, two columns. `State` is the workflow status; `C_AI_CHECK` is how far the check itself has got. Both
  // are exact-match only on this server, so the value is matched against a list read from Studio before it is used.
  function layoutsIn(status) { return layoutsBy('State', status); }
  function layoutsByCheck(value) { return layoutsBy('C_AI_CHECK', value); }
  function layoutsBy(prop, value) {
    var p = [{ Property: 'Type', Operation: '=', Value: 'Layout', __classname__: 'QueryParam' },
             { Property: prop, Operation: '=', Value: value, __classname__: 'QueryParam' }];
    if (st.brand) p.push({ Property: 'Publication', Operation: '=', Value: st.brand.name, __classname__: 'QueryParam' });
    return callServer('QueryObjects', { Params: p, MaxEntries: 25,
      MinimalProps: ['ID', 'Name', 'State', 'LockedBy', 'PageRange', 'Version', 'C_AI_CHECK'],
      __classname__: 'WflQueryObjectsRequest' }).then(function (res) {
      var cols = ((res && res.Columns) || []).map(function (c) { return c.Name; });
      return ((res && res.Rows) || []).map(function (row) {
        var o = {}; cols.forEach(function (c, i) { o[c] = row[i]; });
        return { id: String(o.ID), name: o.Name, state: o.State, pages: o.PageRange || '', lockedBy: o.LockedBy || '',
                 version: o.Version, check: o.C_AI_CHECK || '' };
      });
    });
  }

  // ── asking for a check ──────────────────────────────────────────────────────────────────────────────────────────
  // WHO ASKED, written down. The watcher tells whoever is named in C_AI_ACTIONS that their layout has been checked,
  // and falls back to whoever last touched it — which, after this write, would be whoever is running the plug-in, or
  // worse, last round's reviewer out of a stale payload. So the requester goes in explicitly, and any rounds already
  // applied are carried forward rather than wiped (watcher.py asked_for_it; 80-app.js send).
  function requestOne(row) {
    return callServer('GetObjects', { IDs: [row.id], Lock: false, Rendition: 'none', RequestInfo: ['MetaData'],
                                      __classname__: 'WflGetObjectsRequest' })
      .then(function (r) {
        var obj = (r && r.Objects && r.Objects[0]) || null, prior = {};
        try { prior = JSON.parse(extraOf(obj, 'C_AI_ACTIONS') || '{}') || {}; } catch (e) {}
        var me = st.me || {};
        var payload = { requestedBy: me.name || '', requestedByUuid: me.uuid || '', requestedAt: new Date().toISOString(),
                        requestedVia: 'ask-studio',
                        decidedBy: me.name || '', decidedByUuid: me.uuid || '' };
        if (prior.rounds && prior.rounds.length) payload.rounds = prior.rounds;
        return setProps(row.id, { C_AI_ACTIONS: JSON.stringify(payload), C_AI_CHECK: 'Requested' });
      })
      // read it back: written-and-checked, never fire-and-forget
      .then(function () {
        return callServer('GetObjects', { IDs: [row.id], Lock: false, Rendition: 'none', RequestInfo: ['MetaData'],
                                          __classname__: 'WflGetObjectsRequest' });
      })
      .then(function (r) {
        var got = extraOf((r && r.Objects && r.Objects[0]) || null, 'C_AI_CHECK');
        if (got !== 'Requested') throw new Error('it did not take — the field says “' + (got || 'nothing') + '”');
        return true;
      });
  }

  function runRequests(rows) {
    var run = { kind: 'run', t0: Date.now(), rows: rows.map(function (r) { return { name: r.name, state: 'pending', detail: '' }; }) };
    var turn = { who: 'me', text: 'On it.', block: run };
    st.turns.push(turn); st.writing = true; render();

    rememberBrand();
    var chain = Promise.resolve(), done = 0, failed = 0;
    rows.forEach(function (row, i) {
      chain = chain.then(function () {
        run.rows[i].state = 'active'; run.rows[i].detail = 'writing'; run.rows[i].t0 = Date.now(); render();
        return requestOne(row).then(function () {
          run.rows[i].state = 'done'; run.rows[i].detail = 'asked for'; run.rows[i].t1 = Date.now(); done++;
        }, function (e) {
          run.rows[i].state = 'failed'; run.rows[i].detail = String(e.message || e).slice(0, 90); run.rows[i].t1 = Date.now(); failed++;
        }).then(render);
      });
    });
    return chain.then(function () {
      run.finished = true; run.t1 = Date.now(); st.writing = false;
      var mins = Math.max(1, Math.round(done * 2.5));
      run.after = done
        ? ('In the queue. Get on with your spread — I’ll message you on each one, about ' + mins + ' minute' + (mins === 1 ? '' : 's') + ' for ' + done + '.')
        : 'None of them took. Nothing has changed.';
      if (failed && done) run.after += ' ' + failed + ' didn’t take — ask me again in a minute.';
      render();
    });
  }

  // ── the conversation ────────────────────────────────────────────────────────────────────────────────────────────
  function say(text, block) { st.turns.push({ who: 'me', text: text || '', block: block || null }); }

  function stage(list, key, state, detail) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) {
        if (state === 'active' && !list[i].t0) list[i].t0 = Date.now();
        if (state !== 'active' && state !== 'pending' && list[i].t0 && !list[i].t1) list[i].t1 = Date.now();
        list[i].state = state; if (detail) list[i].detail = detail;
      } else if (state === 'active' && list[i].state === 'active' && list[i].t0 && !list[i].t1) {
        list[i].t1 = Date.now();                           // an earlier clock stops when a later stage starts
      }
    }
    render();
  }

  function ask(text) {
    st.turns.push({ who: 'person', text: text }); st.draft = ''; st.busy = true; keepRecent(text); render();

    var stages = [{ key: 'read', label: 'Reading what you asked', state: 'active', t0: Date.now() },
                  { key: 'st', label: 'Checking the statuses', state: 'pending' },
                  { key: 'find', label: 'Finding what’s in it', state: 'pending' },
                  { key: 'show', label: 'Showing you before anything moves', state: 'pending' }];
    var turn = { who: 'me', text: '', block: { kind: 'stages', stages: stages } };
    st.turns.push(turn);

    var ctx = { brand: st.brand && st.brand.name, statuses: st.statuses, aiCheckValues: st.checks,
                me: (st.me && st.me.name) || null };
    if (st.statusError) ctx.statusesCouldNotBeRead = st.statusError;   // never let it claim a brand has no statuses
    var convo = st.turns.filter(function (t) { return t.text; }).map(function (t) { return { who: t.who === 'person' ? 'person' : 'agent', text: t.text }; });

    return window.AICheckMiss.turn(ctx, convo, 'front').then(function (r) {
      stage(stages, 'read', 'done');
      var byCheck = (r.kind === 'findByCheck' && r.outcome && r.outcome.check);
      var byStatus = (r.kind === 'findByStatus' && r.outcome && r.outcome.status);
      if (!byCheck && !byStatus) {
        stages.length = 0; turn.text = r.reply; st.busy = false; render(); return;
      }
      // Two columns, one path. What differs is the list the value is checked against, the word used for it, and
      // whether the answer ends in a button.
      var lookup = !!byCheck;
      var status = lookup ? r.outcome.check : r.outcome.status;
      var known = (lookup ? st.checks : st.statuses).indexOf(status) >= 0;
      var noun = lookup ? 'AI check' : 'status';
      var seen = lookup ? st.checks : st.statuses;
      turn.text = r.reply;
      stage(stages, 'st', 'active');
      stage(stages, 'st', known ? 'done' : 'warn', known ? status + ' is there' : 'no ' + noun + ' called ' + status);
      if (!known) {
        stages.length = 0; st.busy = false;
        say(st.statusError && !lookup
          ? 'I couldn’t read the statuses for ' + (st.brand ? st.brand.name : 'this brand') + ' — ' + st.statusError + '. That is my end, not yours.'
          : (seen.length
              ? 'There’s no ' + noun + ' called “' + status + '” in ' + (st.brand ? st.brand.name : 'this brand') + '. The ones I can see: ' + seen.join(' · ') + '.'
              : 'I couldn’t read the ' + noun + ' list for ' + (st.brand ? st.brand.name : 'this brand') + '. That is my end, not yours.'));
        render(); return;
      }
      stage(stages, 'find', 'active');
      return (lookup ? layoutsByCheck(status) : layoutsIn(status)).then(function (rows) {
        stage(stages, 'find', 'done', rows.length + (rows.length === 1 ? ' layout' : ' layouts'));
        stage(stages, 'show', 'done');
        st.busy = false;
        if (!rows.length) { say('', { kind: 'nothing', status: status, brand: st.brand && st.brand.name, known: seen, lookup: lookup }); render(); return; }
        var take = rows.filter(function (r2) { return !r2.lockedBy; });
        var list = {
          kind: 'list', status: status, brand: st.brand && st.brand.name, capped: rows.length >= 25, lookup: lookup,
          rows: rows.map(function (r2) {
            // In a lookup the useful column is where the check has got to; in the status route it is the workflow.
            return { name: r2.name, pages: r2.pages ? 'p' + r2.pages : '', state: lookup ? (r2.state || '') : r2.state,
                     skip: (!lookup && r2.lockedBy) ? (r2.lockedBy + ' has it open — I can’t read a layout someone’s in.') : null };
          }),
          cost: 'About ' + Math.max(1, Math.round(take.length * 2.5)) + ' minutes. I’ll message you as each lands.',
          _take: take
        };
        var left = rows.length - take.length;
        if (lookup) {
          say(rows.length + (rows.length === 1 ? ' layout is' : ' layouts are') + ' at ' + status + '.', list);
        } else {
          say(rows.length + ' in ' + status + '. I’ll do ' + take.length +
              (left ? ' — ' + (left === 1 ? 'one is' : left + ' are') + ' open with someone else.' : '.'), list);
        }
        render();
      });
    }).catch(function (e) {
      st.busy = false; stages.length = 0;
      say('', { kind: 'down', why: String((e && e.message) || e) });
      render();
    });
  }

  // ── drawing it ──────────────────────────────────────────────────────────────────────────────────────────────────
  function render() {
    var host = $('app'); if (!host) return;
    var focused = document.activeElement, wasInput = focused && focused.className === 'ask-input';
    var caret = wasInput ? focused.selectionStart : null;
    // the look takes brands as names; this side keeps them as objects, because a write needs the id
    var view = { turns: st.turns, draft: st.draft, busy: st.busy, writing: st.writing, recent: st.recent,
                 brands: st.brands.map(function (b) { return b.name; }), brand: st.brand && st.brand.name };
    host.innerHTML = UI.appHtml(view);
    wire(host);
    var box = host.querySelector('.ask-input');
    if (box && wasInput) { box.focus(); try { box.setSelectionRange(caret, caret); } catch (e) {} }
    var log = host.querySelector('.ask-log'); if (log) log.scrollTop = log.scrollHeight;
  }

  function wire(host) {
    var box = host.querySelector('.ask-input');
    if (box) {
      box.oninput = function () { st.draft = box.value; };
      box.onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); go(); } };
    }
    var send = host.querySelector('.ask-send'); if (send) send.onclick = go;
    var brand = host.querySelector('.ask-brand');
    if (brand) brand.onchange = function () {
      st.brand = st.brands.filter(function (b) { return b.name === brand.value; })[0] || st.brand;
      rememberBrand();
      statuses().then(render);
    };
    var rec = host.querySelector('.ask-recentsel');
    if (rec) rec.onchange = function () { if (rec.value === '') return; st.draft = st.recent[+rec.value]; render(); };
    var neu = host.querySelector('#ask-new');
    if (neu) neu.onclick = function () {
      if (st.writing) return;                              // never mid-write: those seconds are ours to finish
      st.turns = []; st.draft = ''; st.busy = false; render();
    };
    var x = host.querySelector('#ask-close');
    if (x) x.onclick = function () { if (!st.writing) { st.turns = []; st.draft = ''; st.busy = false; render(); } };
    var cta = host.querySelector('.ask-cta');
    if (cta) cta.onclick = function () {
      var list = null;
      for (var i = st.turns.length - 1; i >= 0; i--) { var b = st.turns[i].block; if (b && b.kind === 'list') { list = b; break; } }
      if (!list || !list._take || !list._take.length) return;
      cta.disabled = true;
      runRequests(list._take);
    };
    var q = host.querySelector('.ask-link');                // "Queue it" on a layout somebody has open
    if (q) q.onclick = function () {
      say('I’ll ask for it anyway — the check waits for whoever has it to check it back in, then reads it.');
      render();
    };
    function go() { var v = (st.draft || '').trim(); if (!v || st.busy || st.writing) return; ask(v); }
  }

  // ── the app ─────────────────────────────────────────────────────────────────────────────────────────────────────
  ContentStationSdk.registerCustomApp({
    name: 'ask-studio',
    title: 'Ask Studio',
    iconUrl: (function () {
      try { var s = document.querySelector('script[src*="ai-check-plugin"]'); return s ? s.src.replace(/[^/]+$/, 'icons/ai-dot.svg') : ''; } catch (e) { return ''; }
    })(),
    content: '<div class="ask" id="' + ROOT + '-app"></div>',
    onInit: function () {
      if (!document.getElementById(ROOT + '-css')) {
        var s = document.createElement('style'); s.id = ROOT + '-css'; s.textContent = UI.CSS; document.head.appendChild(s);
      }
      loadRecent();
      render();
      loadMe().then(function (me) { st.me = me; return brands(); })
        .then(function () { return Promise.all([statuses(), checkValues()]); })
        .then(render).catch(function (e) {
        say('I can’t see your brands — ' + ((e && e.message) || e)); render();
      });
    }
  });
})();
