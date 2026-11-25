/* APUS 32.0.23 - respaldo de niveles de Friki Apus por cuenta.
 * NO toca apusFrikiRankings, puntajes, partidas ni otros minijuegos.
 * La nube conserva siempre el maximo avance comprobado de cada UID.
 */
(function () {
  'use strict';
  const FIELD = 'frikiProgressV1';
  const KEY = 'apus_friki_progress_uid_v1_';
  const inflight = new Map();

  function uidActual() {
    try { return typeof currentUser !== 'undefined' ? String(currentUser?.uid || '') : ''; }
    catch (_) { return ''; }
  }
  function number(value, min, max, def) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : def;
  }
  function clean(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const bestScores = {}, unlockedPostcards = {}, passedLevels = {};
    if (input.bestScores && typeof input.bestScores === 'object') {
      for (const [level, raw] of Object.entries(input.bestScores)) {
        const id = number(Number(level), 1, 25, 0), score = number(Number(raw), 0, 20, -1);
        if (id && score >= 0) { bestScores[id] = score; if (score >= 11) passedLevels[id] = true; }
      }
    }
    if (input.unlockedPostcards && typeof input.unlockedPostcards === 'object') {
      for (const [level, yes] of Object.entries(input.unlockedPostcards)) {
        const id = number(Number(level), 1, 25, 0);
        if (id && yes === true) { unlockedPostcards[id] = true; passedLevels[id] = true; }
      }
    }
    if (Array.isArray(input.passedLevels)) {
      for (const level of input.passedLevels) {
        const id = number(Number(level), 1, 25, 0); if (id) passedLevels[id] = true;
      }
    }
    // Si hay constancia continua de 11+ aciertos, reconstruir el siguiente nivel.
    let derived = 1;
    while (derived < 25 && passedLevels[derived]) derived++;
    return {
      unlockedLevel: Math.max(number(Number(input.unlockedLevel), 1, 25, 1), derived),
      bestScores, unlockedPostcards,
      passedLevels: Object.keys(passedLevels).map(Number).sort((a, b) => a - b)
    };
  }
  function merge(a, b) {
    const x = clean(a), y = clean(b), bestScores = { ...x.bestScores }, postcards = { ...x.unlockedPostcards };
    for (const [id, n] of Object.entries(y.bestScores)) bestScores[id] = Math.max(bestScores[id] || 0, n);
    for (const [id, yes] of Object.entries(y.unlockedPostcards)) if (yes) postcards[id] = true;
    return clean({ unlockedLevel: Math.max(x.unlockedLevel, y.unlockedLevel),
      bestScores, unlockedPostcards: postcards, passedLevels: [...x.passedLevels, ...y.passedLevels] });
  }
  function read(uid) {
    try { return clean(JSON.parse(localStorage.getItem(KEY + uid) || 'null')); }
    catch (_) { return clean(null); }
  }
  function persist(uid, progress) {
    const merged = merge(read(uid), progress);
    try { localStorage.setItem(KEY + uid, JSON.stringify(merged)); }
    catch (err) { console.warn('[FRIKI PROGRESO] Almacenamiento local no disponible:', err); }
    return merged;
  }
  function respond(uid, progress, cloud, error) {
    if (uidActual() !== uid) return;
    const frame = document.getElementById('apus-wiki-frame');
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({apusWikiApus:'FRIKI_PROGRESS_CLOUD', uid,
      progress:clean(progress), cloud:!!cloud, error:!!error}, '*');
  }
  function canCloud() {
    try { return navigator.onLine !== false && typeof cloudAvailable === 'function' && cloudAvailable()
      && typeof apusFirebaseDb !== 'undefined' && !!apusFirebaseDb; }
    catch (_) { return false; }
  }
  async function synchronize(uid) {
    let local = read(uid);
    if (!canCloud()) { respond(uid, local, false, false); return; }
    try {
      const docRef = apusFirebaseDb.collection('apusUsers').doc(uid);
      const confirmed = await apusFirebaseDb.runTransaction(async tx => {
        const snap = await tx.get(docRef);
        const doc = snap.exists ? snap.data() || {} : {};
        const remote = clean(doc[FIELD]);
        // Evidencia adicional: medallas por niveles aprobados en versiones nuevas.
        const verified = Array.isArray(doc.achievementsV1?.frikiLevels)
          ? doc.achievementsV1.frikiLevels : [];
        const fromAchievements = clean({ passedLevels: verified });
        const combined = merge(merge(remote, read(uid)), fromAchievements);
        if (JSON.stringify(combined) !== JSON.stringify(remote)) {
          tx.set(docRef, { [FIELD]: combined }, { merge: true });
        }
        return combined;
      });
      local = persist(uid, confirmed);
      respond(uid, local, true, false);
    } catch (err) {
      console.warn('[FRIKI PROGRESO] Conservado en el dispositivo; reintento posterior:', err);
      respond(uid, read(uid), false, true);
    }
  }
  function queue(uid) {
    const previous = inflight.get(uid) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => synchronize(uid));
    inflight.set(uid, next);
    next.finally(() => { if (inflight.get(uid) === next) inflight.delete(uid); });
  }
  window.addEventListener('message', event => {
    const frame = document.getElementById('apus-wiki-frame');
    if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
    const msg = event.data;
    if (!msg || (msg.apusWikiApus !== 'FRIKI_PROGRESS_GET' && msg.apusWikiApus !== 'FRIKI_PROGRESS_PUT')) return;
    const uid = uidActual();
    if (!uid || (typeof msg.uid === 'string' && msg.uid !== uid)) return;
    if (msg.apusWikiApus === 'FRIKI_PROGRESS_PUT') persist(uid, msg.progress);
    respond(uid, read(uid), false, false);
    queue(uid);
  });
  window.addEventListener('online', () => {
    const uid = uidActual(); if (uid) queue(uid);
  });
})();
