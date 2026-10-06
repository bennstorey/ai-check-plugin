// ── Talking to the assistant ──────────────────────────────────────────────────────────────────────────────────────
//
// The panel cannot run a model and must never hold a key, so the thinking happens in a small service
// (04-scripts/ask-service). This is the whole of the transport: one POST, a health check, and a clear story when it
// is not there.
//
// It degrades on purpose. If the service is unreachable, out of date, or over its cap, the drawer still takes one
// line and keeps it — capturing what somebody noticed is the point; the conversation is a convenience.
//
// The base URL is a constant because the plug-in is served from GitHub Pages and the service from Fly, so the two can
// drift. /health returns a contract number; a mismatch means one side is old, and we say so rather than failing in an
// interesting way. localStorage 'aicheck-ask-base' overrides it, which is how the lab points at a service running on
// this Mac (the same habit as localReports).
(function () {
  'use strict';

  var CONTRACT = 1;
  var BASE = (function () {
    try { return localStorage.getItem('aicheck-ask-base') || 'https://ask-service.fly.dev'; }
    catch (e) { return 'https://ask-service.fly.dev'; }
  })();

  var health = null;                                     // cached after the first look

  function ask(path, body, ms) {
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 45000) : null;
    return fetch(BASE + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (t) clearTimeout(t);
      return r.text().then(function (txt) {
        var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && j.error) || ('the service said ' + r.status));
        return j;
      });
    }, function (e) {
      if (t) clearTimeout(t);
      throw new Error(e && e.name === 'AbortError' ? 'it took too long to answer' : 'I could not reach it');
    });
  }

  window.AICheckMiss = {
    contract: CONTRACT,
    base: BASE,

    health: function () {
      if (health) return Promise.resolve(health);
      return ask('/health', null, 8000).then(function (h) { health = h; return h; });
    },

    // One turn. The panel keeps the conversation and resends it, so the service holds nothing between turns and a
    // reload loses nothing but the window.
    turn: function (context, turns, surface) {
      return this.health().then(function (h) {
        if (h && h.contract !== CONTRACT) throw new Error('this panel and the service are different versions');
        if (h && h.thinking === false) throw new Error('the service has no key set');
        return ask('/ask', {
          surface: surface || 'drawer',
          context: context || {},
          // the panel calls its own side 'agent'; the service reads 'person' and 'agent' alike
          turns: (turns || []).map(function (t) { return { who: t.who === 'person' ? 'person' : 'agent', text: String(t.text || '') }; })
        });
      }).then(function (r) {
        // the drawer speaks in outcomes; the service speaks in kinds
        var kind = r && r.kind;
        var out = null;
        if (kind === 'answered') out = { route: 'answered' };
        else if (kind === 'learn') out = { route: 'houseNote', houseNote: { says: r.houseNote } };
        else if (kind === 'need') out = { route: 'email', email: r.email };
        else if (kind === 'decide') out = { route: 'ask', ask: r.ask };
        else if (kind === 'findByStatus') out = { route: 'findByStatus', status: r.status };
        return { reply: r && r.reply, done: !!(r && r.done), outcome: out, kind: kind, usage: r && r.usage };
      });
    }
  };
})();
