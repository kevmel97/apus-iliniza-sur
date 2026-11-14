/* Apus Iliniza Sur v31.3.1 — rescate del aviso obligatorio de actualización OTA.
   Se requiere @capacitor/app en la APK para que «Ahora no» cierre Android.
   El ZIP se verifica mediante la firma nativa de Capawesome Live Update.
   Mantener CONTENT_VERSION con comillas simples: publicar-ota.sh lo sustituye.
*/
(function () {
  'use strict';
  var CONTENT_VERSION = '32.0.8';
  var OTA_SIGNED_BUILD = true;
  var MANIFEST_URL = 'https://kevmel97.github.io/apus-iliniza-sur/actualizaciones/android/latest.json';
  var ALLOWED_ROOT = 'https://kevmel97.github.io/apus-iliniza-sur/actualizaciones/android/';
  var PENDING_KEY = 'apus_ota_obligatoria_pendiente_v1';
  var NATIVE_CODE = 10;
  var gate = null;
  var state = null;
  var running = false;
  var currentManifest = null;

  function setStatus(message) {
    var el = document.getElementById('apus-ota-status');
    if (el) el.textContent = message;
    console.info('[APUS OTA]', message);
  }
  function compareVersions(a, b) {
    var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return x[i] > y[i] ? 1 : -1;
    }
    return 0;
  }
  function nativePlugins() {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return cap.Plugins || {};
  }
  function validManifest(m, nativeCode) {
    if (!m || m.enabled !== true || m.schema !== 1 || m.channel !== 'production') return false;
    if (!/^\d+\.\d+\.\d+$/.test(String(m.version || ''))) return false;
    if (!/^apus-\d+-\d+-\d+$/.test(String(m.bundleId || ''))) return false;
    if (m.bundleId !== 'apus-' + m.version.replace(/\./g, '-')) return false;
    if (!Number.isInteger(m.minNativeVersionCode) || m.minNativeVersionCode > nativeCode) return false;
    if (m.maxNativeVersionCode != null && nativeCode > m.maxNativeVersionCode) return false;
    if (typeof m.url !== 'string' || !m.url.startsWith(ALLOWED_ROOT)) return false;
    try {
      var u = new URL(m.url);
      if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash ||
          !u.pathname.endsWith('/' + m.bundleId + '.zip')) return false;
    } catch (_) { return false; }
    if (!/^[a-f\d]{64}$/i.test(String(m.checksum || ''))) return false;
    if (typeof m.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(m.signature) || m.signature.length < 100) return false;
    return true;
  }
  function readPending() {
    try {
      var version = localStorage.getItem(PENDING_KEY);
      return /^\d+\.\d+\.\d+$/.test(version || '') ? version : null;
    } catch (_) { return null; }
  }
  function recordPending(version) {
    try { localStorage.setItem(PENDING_KEY, version); } catch (_) {}
  }
  function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
  }
  function node(tag, text) {
    var n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function blockKeys(e) {
    if (gate && !gate.contains(e.target)) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }
  function lockScreen() {
    if (gate) return;
    gate = node('div');
    gate.id = 'apus-ota-gate';
    gate.setAttribute('role', 'presentation');
    gate.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;'
      + 'box-sizing:border-box;padding:calc(20px + env(safe-area-inset-top,0px)) 16px '
      + 'calc(20px + env(safe-area-inset-bottom,0px));background:rgba(2,9,20,.97);'
      + 'overflow:auto;overscroll-behavior:contain;touch-action:pan-y;';
    var card = node('section');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'apus-ota-title');
    card.style.cssText = 'width:min(440px,100%);max-height:100%;overflow:auto;padding:20px 18px;box-sizing:border-box;'
      + 'font:14px/1.5 system-ui,-apple-system,Arial,sans-serif;color:#e7f3ff;'
      + 'background:linear-gradient(165deg,#153657,#07172a);border:2px solid #67d5f1;'
      + 'border-radius:15px;box-shadow:0 20px 65px #000b;';
    gate.appendChild(card);
    document.body.appendChild(gate);
    document.addEventListener('keydown', blockKeys, true);
    state = {card:card};
  }
  function unlockScreen() {
    document.removeEventListener('keydown', blockKeys, true);
    if (gate) gate.remove();
    gate = null;
    state = null;
    // Solo iniciar logo/video al autorizar continuar tras la comprobación OTA.
    window.apusOTAAllowedToPlay = true;
    document.dispatchEvent(new Event('apus:ota-ready'));
  }
  function heading(text) {
    var h = node('h2', text);
    h.id = 'apus-ota-title';
    h.style.cssText = 'font-size:21px;line-height:1.25;margin:0 0 12px;color:#fbe7a9;';
    return h;
  }
  function paragraph(text, color) {
    var p = node('p', text);
    p.style.cssText = 'margin:8px 0 12px;color:' + (color || '#d8e7f4') + ';overflow-wrap:anywhere;';
    return p;
  }
  function button(text, primary) {
    var b = node('button', text);
    b.type = 'button';
    b.style.cssText = 'flex:1 1 150px;min-height:48px;padding:10px 13px;border-radius:9px;'
      + 'font:700 14px system-ui,Arial,sans-serif;color:white;border:1px solid '
      + (primary ? '#9ef1c4' : '#94b1c8') + ';background:' + (primary ? '#15865c' : '#394d62') + ';';
    return b;
  }
  function actionRow() {
    var r = node('div');
    r.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:15px;';
    return r;
  }
  function clearCard() {
    if (!gate) lockScreen();
    state.card.replaceChildren();
  }
  async function exitApp() {
    setStatus('🚪 Saliendo: actualización obligatoria pendiente');
    if (!gate) lockScreen();
    clearCard();
    state.card.appendChild(heading('Actualización pendiente'));
    state.card.appendChild(paragraph('El juego no se abrirá sin actualizar. Cerrando la aplicación…'));
    var app = nativePlugins() && nativePlugins().App;
    try {
      if (app && typeof app.exitApp === 'function') {
        await app.exitApp();
        // Por seguridad, la pantalla permanece bloqueada si Android mantiene el proceso.
        return;
      }
    } catch (err) { console.warn('[APUS OTA] Cierre Android:', err); }
    state.card.appendChild(paragraph('No se pudo cerrar automáticamente. Cierra la aplicación desde Android.', '#fbe7a9'));
    var r = actionRow(); var retry = button('Reintentar actualización', true);
    retry.addEventListener('click', function () { location.reload(); });
    r.appendChild(retry); state.card.appendChild(r);
  }
  function showChecking() {
    clearCard();
    state.card.appendChild(heading('🏔️ APUS ILINIZA SUR'));
    state.card.appendChild(paragraph('Comprobando actualizaciones antes de abrir el juego…'));
    state.card.appendChild(paragraph('Se necesita internet para consultar si hay una versión nueva.', '#bad6e8'));
    setStatus('🔎 Comprobando actualización…');
  }
  function showError(message) {
    clearCard();
    state.card.appendChild(heading('Actualización necesaria'));
    state.card.appendChild(paragraph(message));
    state.card.appendChild(paragraph('Para continuar, instala la versión más reciente. No se abrirá el juego desactualizado.', '#fbe7a9'));
    var row = actionRow(), retry = button('Reintentar', true), later = button('Ahora no · Salir', false);
    retry.addEventListener('click', function () { begin(); });
    later.addEventListener('click', exitApp);
    row.appendChild(later); row.appendChild(retry); state.card.appendChild(row);
    retry.focus();
  }
  function showUpdate(m) {
    lockScreen(); clearCard();
    state.card.appendChild(heading('🏔️ ¡Nueva actualización disponible!'));
    state.card.appendChild(paragraph('Contenido v' + m.version));
    var sub = paragraph('¿Qué hay de nuevo?'); sub.style.fontWeight = 'bold'; state.card.appendChild(sub);
    var notes = paragraph(typeof m.notes === 'string' && m.notes.trim() ? m.notes.slice(0,1500) : 'Mejoras y correcciones del juego.');
    notes.style.whiteSpace = 'pre-line'; notes.style.maxHeight = '180px'; notes.style.overflowY = 'auto';
    state.card.appendChild(notes);
    state.card.appendChild(paragraph('Para jugar debes instalar esta actualización. Si eliges «Ahora no», se cerrará la aplicación.', '#fbe7a9'));
    var progress = node('div'); progress.setAttribute('role','progressbar');
    progress.setAttribute('aria-valuemin','0'); progress.setAttribute('aria-valuemax','100');
    progress.setAttribute('aria-valuenow','0');
    progress.style.cssText = 'display:none;width:100%;height:9px;border-radius:8px;background:#314a60;overflow:hidden;margin:10px 0;';
    var fill = node('div'); fill.style.cssText = 'width:0%;height:100%;background:#5fe6aa;';
    progress.appendChild(fill); state.card.appendChild(progress);
    var status = paragraph(''); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    status.style.minHeight = '18px'; state.card.appendChild(status);
    var actions = actionRow(); var exit = button('Ahora no · Salir',false), install = button('⬇ Instalar actualización',true);
    exit.addEventListener('click', exitApp);
    install.addEventListener('click', function () {
      installUpdate(m,{install:install,exit:exit,status:status,progress:progress,fill:fill});
    });
    actions.appendChild(exit); actions.appendChild(install); state.card.appendChild(actions);
    install.focus();
  }
  async function fetchManifest() {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 9000);
    try {
      var r = await fetch(MANIFEST_URL + '?t=' + Date.now(), {
        cache:'no-store', signal:controller.signal, redirect:'error', credentials:'omit'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timeout); }
  }
  async function discardOldServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(function (r) { return r.scope.startsWith(location.origin + '/'); })
        .map(function (r) { return r.unregister(); }));
      if (window.caches) {
        var keys = await caches.keys();
        await Promise.all(keys.filter(function (k) {return k.startsWith('apus-iliniza-sur-');})
          .map(function (k) {return caches.delete(k);}));
      }
    } catch (err) {console.warn('[APUS OTA] Cache:',err);}
  }
  async function installUpdate(m, ui) {
    if (running) return;
    var plugins = nativePlugins(), api = plugins && plugins.LiveUpdate;
    if (!api) {showError('El actualizador Android no está disponible.');return;}
    running = true;
    ui.install.disabled = true;
    ui.exit.disabled = true;
    ui.install.style.opacity = '.6';
    ui.progress.style.display = 'block';
    var progressHandle = null;
    var etapa = 'preparación';
    try {
      etapa = 'consultar paquete actual';
      var current = await api.getCurrentBundle();
      if (current && current.bundleId === m.bundleId) {
        clearPending(); unlockScreen(); running = false; return;
      }
      etapa = 'consultar paquete pendiente';
      var next = await api.getNextBundle();
      var available = !!(next && next.bundleId === m.bundleId);
      if (!available && typeof api.getDownloadedBundles === 'function') {
        etapa = 'consultar paquetes descargados';
        var known = {bundleIds:[]};
        try { known = await api.getDownloadedBundles() || known; }
        catch (err) { console.warn('[APUS OTA] Consulta de paquetes descargados:', err); }
        available = (known.bundleIds || []).includes(m.bundleId);
      }
      if (!available) {
        ui.status.textContent = 'Descargando y verificando la actualización firmada…';
        if (typeof api.addListener === 'function') {
          etapa = 'registrar progreso de descarga';
          try {
            // addListener puede devolver directamente un handle o una promesa,
            // según la versión del puente nativo. await acepta ambos.
            progressHandle = await api.addListener('downloadBundleProgress', function (e) {
              if (e.bundleId !== m.bundleId) return;
              var p = Number(e.progress) || 0;
              var pct = Math.max(0, Math.min(100, Math.round(p <= 1 ? p * 100 : p)));
              ui.fill.style.width = pct + '%';
              ui.progress.setAttribute('aria-valuenow', String(pct));
              ui.status.textContent = 'Descargando: ' + pct + '%';
            });
          } catch (err) {
            // La barra de progreso es opcional; un fallo del listener no debe
            // impedir descargar y activar el contenido firmado.
            console.warn('[APUS OTA] Seguimiento de descarga no disponible:', err);
            progressHandle = null;
          }
        }
        etapa = 'descargar y verificar ZIP';
        await api.downloadBundle({url:m.url,bundleId:m.bundleId,artifactType:'zip',checksum:m.checksum,signature:m.signature});
      }
      ui.fill.style.width = '100%'; ui.progress.setAttribute('aria-valuenow','100');
      ui.status.textContent = 'Actualización verificada. Reiniciando el juego…';
      etapa = 'activar paquete descargado';
      await api.setNextBundle({bundleId:m.bundleId});
      // El reinicio es de la WebView; la APK nativa no cambia ni debe cerrarse.
      // Firebase puede mantener IndexedDB bloqueado: liberar conexión antes de reload().
      try {
        if (typeof apusFirebaseDb !== 'undefined' && apusFirebaseDb &&
            typeof apusFirebaseDb.terminate === 'function') await apusFirebaseDb.terminate();
      } catch (e) {console.warn('[APUS OTA] Firebase:',e);}
      setStatus('✅ Instalando contenido ' + m.version + '…');
      if (typeof api.reload !== 'function') throw new Error('LiveUpdate.reload no disponible');
      etapa = 'reiniciar interfaz';
      await api.reload();
      // Si la WebView continúa abierta después del método, mantener bloqueado.
      ui.status.textContent = 'Actualización preparada. Si no se reinició, pulsa Reintentar.';
      ui.install.textContent = 'Reintentar activación';
      ui.install.disabled = false; ui.exit.disabled = false;
      ui.install.style.opacity = '1';
    } catch (err) {
      console.error('[APUS OTA] Instalación, etapa:', etapa, err);
      var detalle = '';
      try {
        detalle = (err && (err.message || err.errorMessage || err.error || err.code)) || String(err);
        if (typeof detalle !== 'string') detalle = JSON.stringify(detalle);
      } catch (_) { detalle = 'Error sin descripción del plugin'; }
      detalle = String(detalle).replace(/[\r\n]+/g, ' ').slice(0, 450);
      ui.status.textContent = 'Fallo al ' + etapa + ': ' + detalle + '. Pulsa Reintentar.';
      ui.status.style.color = '#ffd38a';
      ui.status.style.overflowWrap = 'anywhere';
      try { sessionStorage.setItem('apus_ota_ultimo_error', etapa + ': ' + detalle); } catch (_) {}
      ui.install.textContent = 'Reintentar';
      ui.install.disabled = false; ui.exit.disabled = false;
      ui.install.style.opacity = '1';
    } finally {
      if (progressHandle) try {await progressHandle.remove();} catch (_) {}
      running = false;
    }
  }
  async function begin() {
    var plugins = nativePlugins();
    if (!plugins || !plugins.LiveUpdate) return; // Solo para Android, no GitHub Pages.
    if (running) return;
    lockScreen(); showChecking();
    running = true;
    var pending = readPending();
    try {
      var api = plugins.LiveUpdate;
      var ready = await api.ready();
      if (ready && ready.rollback) setStatus('⚠️ Se recuperó una versión anterior del juego');
      if (!OTA_SIGNED_BUILD) {showError('La firma de actualizaciones no está configurada.');return;}
      discardOldServiceWorkers();
      var info = await api.getVersionCode();
      var nativeCode = Number(info.versionCode) || NATIVE_CODE;
      var current = await api.getCurrentBundle();
      var localVersion = CONTENT_VERSION;
      if (current && current.bundleId && /^apus-\d+-\d+-\d+$/.test(current.bundleId)) {
        // El paquete activo no puede reducir la versión de referencia de la APK.
        var currentVersion = current.bundleId.replace(/^apus-/,'').replace(/-/g,'.');
        if (compareVersions(currentVersion, localVersion) > 0) localVersion = currentVersion;
      }
      if (pending && compareVersions(localVersion,pending) >= 0) {clearPending(); pending = null;}
      var m = await fetchManifest();
      if (!validManifest(m,nativeCode)) {
        if (pending && compareVersions(pending,localVersion)>0) showError('Hay una actualización pendiente, pero no se pudo verificar el paquete publicado.');
        else {clearPending(); unlockScreen(); setStatus('✅ Contenido ' + localVersion + ' · Sin novedades');}
        return;
      }
      if (compareVersions(m.version,localVersion) <= 0 || (current && current.bundleId === m.bundleId)) {
        clearPending(); unlockScreen(); setStatus('✅ Contenido ' + localVersion + ' · Actualizado');
        return;
      }
      currentManifest = m;
      recordPending(m.version);
      var blocked = {bundleIds:[]};
      try { blocked = await api.getBlockedBundles() || blocked; }
      catch (err) { console.warn('[APUS OTA] Consulta de paquetes bloqueados:', err); }
      if ((blocked.bundleIds || []).includes(m.bundleId)) {
        showError('Esta actualización ha sido bloqueada por seguridad. Necesita publicarse una versión corregida.');
        return;
      }
      setStatus('🆕 Contenido v' + m.version + ' obligatorio');
      showUpdate(m);
    } catch (err) {
      console.warn('[APUS OTA] Comprobación:',err);
      // Mantener el juego offline disponible solo cuando NO se haya confirmado
      // previamente que hay una actualización obligatoria pendiente.
      if (pending && compareVersions(pending,CONTENT_VERSION)>0) {
        showError('No hay conexión para instalar la actualización pendiente v' + pending + '.');
      } else {
        unlockScreen();
        setStatus('📦 Sin internet · Modo offline disponible');
      }
    } finally {running = false;}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',begin,{once:true});
  else begin();
})();
