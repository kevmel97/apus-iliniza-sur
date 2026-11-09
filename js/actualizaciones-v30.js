
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

  function frikiPendingPoints(uid){
    return frikiReadPending(uid).reduce((sum,p)=>sum+Math.max(0, Number(p?.points)||0),0);
  }
  window.loadFrikiRanking = async function(){
    const status=document.getElementById('ranking-status-msg'),tbody=document.getElementById('ranking-tbody');
    if(status)status.textContent='🌐 CONSULTANDO RANKING FRIKI APUS...';
    if(tbody)tbody.replaceChildren();
    const my=document.getElementById('friki-ranking-my-score');
    if(!cloudAvailable()){
      if(status)status.textContent='⚠️ Se necesita internet y Firebase para consultar el ranking.';
      if(my){
        if(currentUser?.uid){
          const pendingPts = frikiPendingPoints(currentUser.uid);
          const pendingN = frikiReadPending(currentUser.uid).length;
          my.textContent = `🏠 Puntaje local disponible: ${pendingPts.toLocaleString('es-EC')} puntos` + (pendingN?` · ⚠️ ${pendingN} partida(s) pendiente(s) de subir`:'' );
        } else my.textContent='Sin conexión: no se puede confirmar el total de puntos en la nube.';
      }
      return;
    }
    try{
      if(currentUser?.uid) await syncPendingFrikiScores(false);
      const snapshot=await apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).orderBy('score','desc').limit(100).get();
      if(apusRankingView!=='friki')return;
      const rows=snapshot.docs.map(doc=>doc.data());
      if(tbody)tbody.innerHTML=rows.map((p,i)=>{
        const me=currentUser?.uid&&p.uid===currentUser.uid;
        return `<tr style="${me?'background:rgba(247,147,30,.25);':''}"><td>${i+1}</td><td>${escapeRankingHTML(p.name)}${me?' ⭐':''}</td><td style="color:#facc15">${Math.max(0,Number(p.score)||0)}</td></tr>`;
      }).join('');
      if(status)status.textContent=rows.length?`🌍 ${rows.length} JUGADOR${rows.length===1?'':'ES'} · PUNTOS ACUMULADOS EN FRIKI APUS.`:'🌍 AÚN NO HAY PUNTAJES EN FRIKI APUS.';
      if(my){
        if(!currentUser?.uid) my.textContent='Inicia sesión para consultar tu total de puntos.';
        else {
          const uid=currentUser.uid;
          let confirmed=0;
          const own=rows.find(p=>p.uid===uid);
          if(own) confirmed = Number(own.score)||0;
          else {
            const ownSnap=await apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).doc(uid).get();
            if(ownSnap.exists) confirmed=Number(ownSnap.data()?.score)||0;
          }
          const pendingN = frikiReadPending(uid).length;
          const pendingPts = frikiPendingPoints(uid);
          const localTotal = Math.max(0, confirmed + pendingPts);
          my.textContent = `⭐ Puntaje real local: ${localTotal.toLocaleString('es-EC')} puntos · ☁️ Confirmado: ${Math.max(0,confirmed).toLocaleString('es-EC')}` +
            (pendingN?` · ⏳ Pendiente: +${pendingPts.toLocaleString('es-EC')} en ${pendingN} partida(s)`:'' );
        }
      }
    }catch(err){
      console.warn('Friki Apus ranking:',err);
      if(status)status.textContent='⚠️ No se pudo consultar. Comprueba internet y permisos de Firestore.';
    }
  };
})();
