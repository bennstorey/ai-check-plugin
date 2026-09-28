  // ─── Studio Server API on the cookie session (proven in three plug-ins on this server) ──────────
  var WW_APP = 'Content Station';
  var WW_APP_HEADER = { 'X-WoodWing-Application': WW_APP };
  function getTicket() { try { var info = ContentStationSdk.getInfo(); return (info && info.Ticket) || ''; } catch (e) { return ''; } }
  // Who is using the plug-in. The SDK's info block carries the ticket but no user on this server, so `decidedBy` came
  // back null and the layout agent had to infer the requester from whoever last touched the layout (2026-09-28). The
  // documented GetUserProfile answers it properly, and hands back the PublicUuid — which is exactly what an @mention in
  // the Activity hub needs, so the person who pressed Send can be told by name.
  var ME = null;
  function loadMe() {
    return callServer('GetUserProfile', { __classname__: 'WflGetUserProfileRequest' })
      .then(function (r) { var u = (r && r.CurrentUser) || {}; ME = { userId: u.UserID || '', name: u.FullName || u.UserID || '', uuid: u.PublicUuid || '' }; return ME; })
      .catch(function () { return null; });
  }
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
