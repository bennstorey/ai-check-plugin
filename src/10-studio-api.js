  // ─── Studio Server API on the cookie session (proven in three plug-ins on this server) ──────────
  var WW_APP = 'Content Station';
  var WW_APP_HEADER = { 'X-WoodWing-Application': WW_APP };
  function getTicket() { try { var info = ContentStationSdk.getInfo(); return (info && info.Ticket) || ''; } catch (e) { return ''; } }
  function serverUrl(script) { var base = (window.csConfig && window.csConfig.serverUrl) || '/server/index.php'; return new URL(base.replace(/[^/]+$/, script), window.location.href).href; }
  function callServer(method, params) {
    params = params || {}; if (!('Ticket' in params) || !params.Ticket) params.Ticket = getTicket() || null;
    return fetch(serverUrl('index.php') + '?protocol=JSON&method=' + encodeURIComponent(method), { method: 'POST', credentials: 'same-origin', headers: Object.assign({ 'Content-Type': 'application/json' }, WW_APP_HEADER), body: JSON.stringify({ method: method, id: '1', params: [params], jsonrpc: '2.0' }) })
      .then(function (r) { if (!r.ok) throw new Error(method + ' failed: HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (j.error) { var e = j.error, parts = []; if (e.message) parts.push(e.message); if (e.data && e.data.detail && e.data.detail !== e.message) parts.push(e.data.detail); throw new Error(method + ' failed: ' + (parts.join(' — ') || JSON.stringify(e))); } return j.result; });
  }
  // Rendition URLs point at the Transfer Server, which wants ww-app on a cookie session
  function withWwApp(url) { if (url.indexOf('ww-app=') !== -1) return url; return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ww-app=' + encodeURIComponent(WW_APP); }
  function notify(content, type) { try { ContentStationSdk.showNotification({ content: content, type: type || 'default', timeout: 6000, showX: true }); } catch (e) { console.info(TAG + ' ' + content); } }
  function extraOf(obj, name) { var xs = (obj && obj.MetaData && obj.MetaData.ExtraMetaData) || []; for (var i = 0; i < xs.length; i++) if (xs[i].Property === name) return (xs[i].Values || [''])[0]; return ''; }
  function setProps(id, props) { var extra = []; for (var k in props) if (props.hasOwnProperty(k)) extra.push({ Property: k, Values: [String(props[k])], __classname__: 'ExtraMetaData' }); return callServer('SetObjectProperties', { ID: String(id), MetaData: { ExtraMetaData: extra, __classname__: 'MetaData' }, __classname__: 'WflSetObjectPropertiesRequest' }); }
