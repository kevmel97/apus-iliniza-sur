
(function(){
  const EXTRA_STAGE_IMAGES = {"24": "assets/escenarios/imagen_f4779e8be47463.jpg", "22": "assets/escenarios/imagen_dd73c05a363059.jpg", "21": "assets/escenarios/imagen_cd1f73a401a35c.jpg", "23": "assets/escenarios/imagen_9b3df74e079b79.jpg", "20": "assets/escenarios/imagen_3b15295023bdb3.jpg"};
  const EXTRA_STAGE_NAMES = {
    20:'RUTA DE LAS CASCADAS',
    21:'MALECÓN 2000 · GUAYAQUIL',
    22:'EL REVENTADOR Y SAN RAFAEL',
    23:'LOS PICACHOS DE JIMBURA',
    24:'VOLCÁN SIERRA NEGRA',
    25:'APUS DORADO FINAL'
  };
  const APUS_MAX_FIGHT_STAGE = 24;
  Object.entries(EXTRA_STAGE_NAMES).forEach(([id,name])=>{ APUS_STAGE_NAMES[Number(id)] = name; });
  Object.entries(EXTRA_STAGE_IMAGES).forEach(([id,src])=>{
    APUS_FIGHT_PHOTOS[Number(id)] = src;
    APUS_STAGE_THUMBNAILS[Number(id)] = src;
  });

  let apusStageUnlocksLoadedV299 = false;
  window.apusUnlockFightStage = function(id){
    id = Number(id);
    if(!Number.isInteger(id) || id < 1 || id > APUS_MAX_FIGHT_STAGE) return false;
    if(apusUnlockedFightStages.has(id)) return true;
    apusUnlockedFightStages.add(id);
    try { localStorage.setItem('apus_fight_stages_v2804', JSON.stringify([...apusUnlockedFightStages].sort((a,b)=>a-b))); } catch(e){}
    try { apusRenderStagePicker(); } catch(e){}
    return true;
  };
  window.apusLoadFightStageUnlocks = function(){
    if(apusStageUnlocksLoadedV299) return;
    apusStageUnlocksLoadedV299 = true;
    try {
      const arr = JSON.parse(localStorage.getItem('apus_fight_stages_v2804') || '[]');
      if(Array.isArray(arr)) arr.forEach(id => { id = Number(id); if(Number.isInteger(id) && id >= 1 && id <= APUS_MAX_FIGHT_STAGE) apusUnlockedFightStages.add(id); });
      const progress = JSON.parse(localStorage.getItem('apus_ecuador_pixel_save_v1') || '{}');
      for(const [k,v] of Object.entries(progress.unlockedPostcards || {})){
        const id = Number(k);
        if(v && Number.isInteger(id) && id >= 1 && id <= APUS_MAX_FIGHT_STAGE) apusUnlockedFightStages.add(id);
      }
    } catch(e){}
  };
  window.apusAvailableFightStages = function(){
    apusLoadFightStageUnlocks();
    return [0, ...[...apusUnlockedFightStages].filter(n => n >= 1 && n <= APUS_MAX_FIGHT_STAGE).sort((a,b)=>a-b)];
  };
  apusLoadFightStageUnlocks();
  try { apusRenderStagePicker(); } catch(e){}

  // La imagen y el suelo se dibujan directamente ANTES de los luchadores,
  // dentro del render de combate, sin capas externas que los tapen.
  window.sendApus4x4Account = function(){
    const frame=document.getElementById('apus-4x4-frame');
    if(apus4x4Loaded && frame?.contentWindow) frame.contentWindow.postMessage({apus4x4:'ACCOUNT',name:(currentUser && currentUser.username) ? currentUser.username : 'INVITADO'},'*');
  };
  const apus4x4ReadyBridge = function(event){ if(event?.data?.apus4x4==='READY'){ try{ sendApus4x4Account(); }catch(e){} } };
  window.addEventListener('message', apus4x4ReadyBridge);
  try{ if(typeof openApus4x4 === 'function'){ const oldOpenApus4x4 = openApus4x4; window.openApus4x4 = function(){ oldOpenApus4x4.apply(this, arguments); try{ sendApus4x4Account(); }catch(e){} }; } }catch(e){}

  // V31.5.6: una sola consulta de ranking, exactamente el mismo acumulado
  // confirmado que se envía a la pantalla Friki. Pendientes y legado van aparte.
  window.loadFrikiRanking = async function(){
    const status=document.getElementById('ranking-status-msg');
    const tbody=document.getElementById('ranking-tbody');
    const my=document.getElementById('friki-ranking-my-score');
    if(status)status.textContent='🌐 CONSULTANDO ÚNICO RANKING FRIKI APUS...';
    if(tbody)tbody.replaceChildren();
    const uid=currentUser?.uid;
    if(!cloudAvailable()){
      if(status)status.textContent='⚠️ Sin conexión: el ranking mundial necesita Firebase.';
      if(my)my.textContent=uid?`⭐ Último total confirmado: ${frikiReadVerified(uid).toLocaleString('es-EC')} · ⏳ Sincronización pendiente: +${frikiPendingPoints(uid).toLocaleString('es-EC')}`:'Inicia sesión para consultar tu puntaje.';
      return;
    }
    try{
      if(uid)await frikiRefreshAccountScore();
      const snapshot=await apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).orderBy('score','desc').limit(100).get({source:'server'});
      if(apusRankingView!=='friki')return;
      const rows=snapshot.docs.map(doc=>doc.data()).filter(p=>p&&p.uid);
      if(tbody)tbody.innerHTML=rows.map((p,i)=>{
        const isMe=uid&&p.uid===uid;
        return `<tr style="${isMe?'background:rgba(247,147,30,.25);':''}"><td>${i+1}</td><td>${escapeRankingHTML(String(p.name||'MONTAÑISTA'))}${isMe?' ⭐':''}</td><td style="color:#facc15">${frikiSafeScore(p.score).toLocaleString('es-EC')}</td></tr>`;
      }).join('');
      if(status)status.textContent=`🌍 ${rows.length} JUGADORES · UNA CLASIFICACIÓN GLOBAL POR CUENTA.`;
      if(my){
        if(!uid){my.textContent='Inicia sesión para consultar tu puntaje.';return;}
        const personal=await apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).doc(uid).get({source:'server'});
        const confirmed=personal.exists?frikiSafeScore(personal.data().score):0;
        frikiStoreVerified(uid,confirmed);
        frikiPushAccountScore(uid,confirmed,'firebase');
        const pending=frikiReadPending(uid),pendingPoints=frikiPendingPoints(uid),legacy=frikiLegacyLocalScore();
        my.textContent=`⭐ Único puntaje global: ${confirmed.toLocaleString('es-EC')} puntos`+
          (pending.length?` · ⏳ Pendientes: +${pendingPoints.toLocaleString('es-EC')} (${pending.length} partidas)`:'')+
          (legacy>confirmed?` · 📜 En este dispositivo hay ${legacy.toLocaleString('es-EC')} puntos históricos sin atribuir a cuenta; se conservan para revisión, NO se suman automáticamente.`:'');
      }
    }catch(err){
      console.warn('Friki: error al consultar ranking',err);
      if(status)status.textContent='⚠️ No se pudo consultar el ranking. No se han modificado los puntos.';
      if(my&&uid)my.textContent=`⭐ Último total confirmado en este dispositivo: ${frikiReadVerified(uid).toLocaleString('es-EC')} · ⏳ Pendientes: +${frikiPendingPoints(uid).toLocaleString('es-EC')}`;
    }
  };
})();
