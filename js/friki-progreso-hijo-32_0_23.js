/* APUS 32.0.23 - Friki: lectura/escritura por UID con respaldo cloud.
 * Solo niveles y postales; no altera los puntos ni la partida principal.
 */
(function () {
  'use strict';
  const KEY = 'apus_friki_progress_uid_v1_';
  const LEGACY = 'apus_ecuador_pixel_save_v1';
  const LEGACY_BACKUP = 'apus_friki_progress_legacy_backup_v1';
  const LEGACY_OWNER = 'apus_friki_progress_legacy_owner_v1';
  let activeUid = '', lastSent = '', statusNode = null, legacyButton = null;

  const blank = () => ({totalScore:0, unlockedLevel:1, bestScores:{}, unlockedPostcards:{}});
  function int(value,min,max,def) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : def;
  }
  function clean(value) {
    const a = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = blank(), passed = new Set();
    result.unlockedLevel = int(a.unlockedLevel, 1, 25, 1);
    result.totalScore = int(a.totalScore, 0, Number.MAX_SAFE_INTEGER, 0);
    if (a.bestScores && typeof a.bestScores === 'object') {
      for (const [level, correct] of Object.entries(a.bestScores)) {
        const id=int(level,1,25,0), n=int(correct,0,20,-1);
        if (id && n >= 0) { result.bestScores[id]=n; if(n >= 11) passed.add(id); }
      }
    }
    if (a.unlockedPostcards && typeof a.unlockedPostcards === 'object') {
      for (const [level, yes] of Object.entries(a.unlockedPostcards)) {
        const id=int(level,1,25,0);
        if(id && yes === true) { result.unlockedPostcards[id]=true; passed.add(id); }
      }
    }
    if (Array.isArray(a.passedLevels)) for (const level of a.passedLevels) {
      const id=int(level,1,25,0); if(id) passed.add(id);
    }
    let derived = 1; while(derived < 25 && passed.has(derived)) derived++;
    result.unlockedLevel=Math.max(result.unlockedLevel,derived);
    result.passedLevels=[...passed].sort((x,y)=>x-y);
    return result;
  }
  function merge(a,b) {
    const x=clean(a), y=clean(b), score={...x.bestScores}, post={...x.unlockedPostcards};
    for(const [id,n] of Object.entries(y.bestScores)) score[id]=Math.max(score[id]||0,n);
    for(const [id,v] of Object.entries(y.unlockedPostcards)) if(v) post[id]=true;
    return clean({totalScore:Math.max(x.totalScore,y.totalScore),
      unlockedLevel:Math.max(x.unlockedLevel,y.unlockedLevel),bestScores:score,
      unlockedPostcards:post,passedLevels:[...x.passedLevels,...y.passedLevels]});
  }
  function read(key) {try {return JSON.parse(localStorage.getItem(key)||'null');} catch (_) {return null;}}
  function write(key,data) {try {localStorage.setItem(key,JSON.stringify(data));return true;} catch (_) {return false;}}
  function progressData(){return clean(gameState);}
  function fingerprint(value){const v=clean(value);return JSON.stringify([v.unlockedLevel,v.bestScores,v.unlockedPostcards,v.passedLevels]);}
  function post(op) {
    if(!activeUid || window.parent === window)return;
    try {window.parent.postMessage({apusWikiApus:op,uid:activeUid,progress:progressData()},'*');}catch(_){}
  }
  function status(message) {
    if (!statusNode) {
      const box=document.querySelector('#screen-menu .pixel-box');
      if (!box) return;
      statusNode=document.createElement('div');
      statusNode.id='friki-progreso-nube';
      statusNode.style.cssText='font:16px/1.4 VT323,monospace;color:#facc15;margin:7px 0;max-width:95%;overflow-wrap:anywhere';
      box.appendChild(statusNode);
    }
    statusNode.textContent=message||'';
  }
  function renderCurrentState() {
    try { updateHeaderUI(); } catch(_) {}
    try {
      const map=document.getElementById('screen-map');
      if(map && !map.classList.contains('hidden')) {
        renderLevelGrid(); selectMapLevel(Math.max(selectedMapLevel,gameState.unlockedLevel));
      }
    } catch(_) {}
  }
  function saveScoped(shouldSend=true) {
    if (!activeUid) return;
    const state = merge(read(KEY + activeUid), gameState);
    // La memoria por UID nunca retrocede incluso al recibir eventos fuera de orden.
    gameState = {...gameState, ...state};
    write(KEY + activeUid, gameState);
    renderCurrentState();
    const now=fingerprint(state);
    if (shouldSend && now !== lastSent) {lastSent=now;post('FRIKI_PROGRESS_PUT');}
  }
  // El motor antiguo escribe en una clave comun: sustituir SOLO el destino de
  // guardado cuando hay una cuenta activa, sin alterar reglas ni puntuaciones.
  // El sincronizador antiguo de postales usa una lista local sin propietario.
  // Para cuentas autenticadas NO mezclar postales de otros usuarios del teléfono.
  const originalMergePostcards=mergeUnlockedPostcards;
  mergeUnlockedPostcards=function(stages){
    if(activeUid)return false;
    return originalMergePostcards(stages);
  };
  const originalSaveProgress=saveProgress;
  saveProgress=function(){
    if(!activeUid)return originalSaveProgress();
    saveScoped(true);
  };

  function saveOriginalLegacySnapshot() {
    const original=read(LEGACY), existing=read(LEGACY_BACKUP);
    const merged=merge(existing,original);
    if(merged.unlockedLevel>1 || merged.passedLevels.length || Object.keys(merged.bestScores).length)
      write(LEGACY_BACKUP, merged);
  }
  saveOriginalLegacySnapshot();
  function candidateLegacy() {
    const owner=String(localStorage.getItem(LEGACY_OWNER)||'');
    if(owner && owner!==activeUid)return null;
    const legacy=merge(read(LEGACY_BACKUP),read(LEGACY));
    return legacy.unlockedLevel>gameState.unlockedLevel?legacy:null;
  }
  function restoreUI() {
    if (!activeUid) {if(legacyButton){legacyButton.hidden=true;legacyButton.style.display='none';}return;}
    const legacy=candidateLegacy();
    if(!legacy) {if(legacyButton){legacyButton.hidden=true;legacyButton.style.display='none';}return;}
    if(!legacyButton) {
      const box=document.querySelector('#screen-menu .pixel-box');
      if(!box)return;
      legacyButton=document.createElement('button');
      legacyButton.type='button';legacyButton.id='friki-recuperar-progreso';
      legacyButton.className='pixel-btn bg-teal-700 text-white py-2 px-4 text-xs';
      legacyButton.style.cssText='margin:8px auto;max-width:95%;min-height:44px;';
      box.appendChild(legacyButton);
      legacyButton.addEventListener('click',()=>{
        const old=candidateLegacy();if(!activeUid||!old)return;
        const ok=window.confirm('RECUPERAR PROGRESO ANTIGUO DE FRIKI APUS\n\n'+
          'Se encontró nivel '+old.unlockedLevel+' guardado en ESTE dispositivo.\n\n'+
          'El guardado antiguo no identifica al propietario. Confirma SOLO si este avance pertenece a la cuenta con la que has iniciado sesión.\n\n'+
          'No modifica puntajes ni rankings. ¿Recuperar el mayor nivel?');
        if(!ok)return;
        write(LEGACY_OWNER,activeUid);
        gameState=merge(gameState,old);
        saveScoped(true);
        restoreUI();
        status('✅ Recuperación local solicitada; se sincronizará con tu cuenta.');
      });
    }
    legacyButton.hidden=false;legacyButton.style.display='block';
    legacyButton.textContent='📜 RECUPERAR AVANCE ANTIGUO · NIVEL '+legacy.unlockedLevel;
  }
  function changeAccount(uid) {
    if(uid===activeUid)return;
    // Guardar una posible copia antigua ANTES de cambiar el estado actual.
    if(!activeUid)saveOriginalLegacySnapshot();
    activeUid=uid;lastSent='';
    if(!uid) {
      gameState={...blank(),...clean(read(LEGACY))};
      renderCurrentState();status('');restoreUI();return;
    }
    gameState={...blank(),...clean(read(KEY+uid))};
    renderCurrentState();
    status('☁️ Comprobando el nivel guardado en tu cuenta…');
    restoreUI();
    post('FRIKI_PROGRESS_GET');
  }
  window.addEventListener('message', event=>{
    if(event.source!==window.parent||!event.data)return;
    const msg=event.data;
    if(msg.apusWikiApus==='ACCOUNT'){
      changeAccount(msg.signedIn===true?String(msg.uid||''):'');
    }else if(msg.apusWikiApus==='FRIKI_PROGRESS_CLOUD' && activeUid && msg.uid===activeUid){
      const previous=fingerprint(gameState), before=gameState.unlockedLevel;
      gameState=merge(gameState,msg.progress);
      saveScoped(false);
      if(fingerprint(gameState)!==previous)post('FRIKI_PROGRESS_PUT');
      status(msg.cloud?'☁️ Progreso protegido en tu cuenta · Nivel '+gameState.unlockedLevel:
        msg.error?'⚠️ Avance guardado en este dispositivo; falta sincronizarlo.':
        '📱 Progreso local · Nivel '+gameState.unlockedLevel);
      if(before<gameState.unlockedLevel)renderCurrentState();
      restoreUI();
    }
  });
})();
