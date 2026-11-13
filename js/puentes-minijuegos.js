

/* V25 - BINGO CAMPING: módulo de iframe aislado, integrado sin modificar la lógica de combate ni del modo historia. */
/* V31: APUS_BINGO_CAMPING_HTML_B64 está en minijuegos/bingo-camping.html */
// V28.0.3: el control de sonido de ambos iframes gobierna también el audio del juego.

/* v28.0.8 APUS 4x4: autónomo, sin tocar combate, torneos, PeerJS o Firebase. */
/* V31: APUS_4X4_HTML_B64 está en minijuegos/apus-4x4.html */
let apus4x4Loaded=false;
function openApus4x4(){
    const shell=document.getElementById('apus-4x4-shell');
    const frame=document.getElementById('apus-4x4-frame');
    if(!shell||!frame)return;
    gameState='MENU';updateTouchControlsVisibility();showOverlay(null);
    shell.style.display='block';
    if(!apus4x4Loaded){
      apus4x4Loaded=true;
      frame.src = "minijuegos/apus-4x4.html";
    } else { sendApus4x4Theme();sendApus4x4Sound(); }
}
function sendApus4x4Sound(){
  const frame=document.getElementById('apus-4x4-frame');
  if(apus4x4Loaded&&frame?.contentWindow) frame.contentWindow.postMessage({apus4x4:'SOUND',enabled:sound.enabled,fxVolume:(window.apusAudioSettings?.fxVolume??1)},'*');
}
function sendApus4x4Theme(){
  const frame=document.getElementById('apus-4x4-frame');
  if(apus4x4Loaded&&frame?.contentWindow) frame.contentWindow.postMessage({apus4x4:'THEME',theme:currentTheme},'*');
}
function closeApus4x4(){
  document.getElementById('apus-4x4-shell').style.display='none';
  const frame=document.getElementById('apus-4x4-frame');
  if(frame){frame.removeAttribute('srcdoc');frame.src='about:blank';}
  apus4x4Loaded=false;
  gameState='MENU';updateTouchControlsVisibility();showOverlay('minigames-hub-overlay');
}
window.addEventListener('message',function apus4x4Messages(event){
  const frame=document.getElementById('apus-4x4-frame');
  if(!frame || event.source!==frame.contentWindow || !event.data) return;
  if(event.data.apus4x4==='READY') {sendApus4x4Sound();sendApus4x4Theme();}
  if (event.data.apus4x4 === 'OPEN_AUDIO_PANEL' && typeof window.apusOpenAudioPanel === 'function') window.apusOpenAudioPanel();
  if(event.data.apus4x4==='REQUEST_SOUND' && typeof event.data.enabled==='boolean') setApusGlobalSound(event.data.enabled);
  if(event.data.apus4x4==='CLOSE') closeApus4x4();
  if(event.data.apus4x4==='FINISH') saveApus4x4GlobalFinish(event.data).catch(err=>console.warn('Apus 4x4 global:',err));
});

function setApusGlobalSound(enabled){
  if(typeof window.apusSetFxEnabled==='function')window.apusSetFxEnabled(enabled);
  else if(sound.enabled!==!!enabled)toggleSound();
  sendApusBingoSound();sendFrikiSound();sendApus4x4Sound();
}
function sendApusBingoSound(){
  const frame=document.getElementById('apus-bingo-frame');
  if(apusBingoLoaded&&frame?.contentWindow)frame.contentWindow.postMessage({apusBingo:'SOUND',enabled:sound.enabled,fxVolume:(window.apusAudioSettings?.fxVolume??1)},'*');
}
function sendFrikiSound(){
  const frame=document.getElementById('apus-wiki-frame');
  if(apusWikiLoaded&&frame?.contentWindow)frame.contentWindow.postMessage({apusWikiApus:'SOUND',enabled:sound.enabled,fxVolume:(window.apusAudioSettings?.fxVolume??1)},'*');
}
function sendFrikiAccount(){
  const frame=document.getElementById('apus-wiki-frame');
  if(apusWikiLoaded&&frame?.contentWindow)frame.contentWindow.postMessage({apusWikiApus:'ACCOUNT',signedIn:!!currentUser?.uid,uid:currentUser?.uid||'',name:currentUser?.username||''},'*');
  // El total mostrado dentro de Friki es el mismo del ranking, identificado por UID.
  if(currentUser?.uid) frikiRefreshAccountScore().catch(err=>console.warn('Friki: no se pudo consultar el puntaje',err));
}
let apusBingoLoaded = false;
function openBingoCamping() {
  const shell = document.getElementById('apus-bingo-shell');
  const frame = document.getElementById('apus-bingo-frame');
  if (!shell || !frame) return;
  gameState = "MENU";
  updateTouchControlsVisibility();
  showOverlay(null);
  shell.style.display = 'block';
  // Render all elements locally: this mini game needs the internet ONLY for online rooms.
  if (!apusBingoLoaded) {
    apusBingoLoaded = true;
    frame.src = "minijuegos/bingo-camping.html";
  } else {
    sendApusBingoAccount();
  }
}
function sendApusBingoAccount() {
  const frame = document.getElementById('apus-bingo-frame');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({apusBingo:'ACCOUNT',name:(currentUser && currentUser.username) ? currentUser.username : 'INVITADO'},'*');
}
function sendApusBingoTheme() {
  const frame = document.getElementById('apus-bingo-frame');
  if (apusBingoLoaded && frame && frame.contentWindow) {
    frame.contentWindow.postMessage({apusBingo:'THEME',theme:currentTheme},'*');
  }
}
function closeBingoCamping() {
  document.getElementById('apus-bingo-shell').style.display = 'none';
  const frame = document.getElementById('apus-bingo-frame');
  frame.removeAttribute('srcdoc');
  frame.src = 'about:blank';
  apusBingoLoaded = false;
  gameState = 'MENU';
  updateTouchControlsVisibility();
  showOverlay('minigames-hub-overlay');
}
window.addEventListener('message', function apusBingoMessages(event) {
  const frame = document.getElementById('apus-bingo-frame');
  if (!frame || event.source !== frame.contentWindow || !event.data) return;
  if (event.data.apusBingo === 'READY') {
    sendApusBingoAccount();
    sendApusBingoTheme();
    sendApusBingoSound();
  }
  if (event.data.apusBingo === 'OPEN_AUDIO_PANEL' && typeof window.apusOpenAudioPanel === 'function') window.apusOpenAudioPanel();
  if (event.data.apusBingo === 'REQUEST_SOUND' && typeof event.data.enabled === 'boolean') setApusGlobalSound(event.data.enabled);
  if (event.data.apusBingo === 'CLOSE') closeBingoCamping();
});

/* V27.9 - FRIKI APUS: módulo extra aislado en iframe. */
/* V31: APUS_WIKI_APUS_HTML_B64 está en minijuegos/friki-apus.html */
let apusWikiLoaded = false;
function openWikiApus() {
  const shell = document.getElementById('apus-wiki-shell');
  const frame = document.getElementById('apus-wiki-frame');
  if (!shell || !frame) return;
  gameState = 'MENU';
  updateTouchControlsVisibility();
  showOverlay(null);
  shell.style.display = 'block';
  if (!apusWikiLoaded) {
    apusWikiLoaded = true;
    frame.src = "minijuegos/friki-apus.html";
  } else {
    sendWikiApusTheme();
  }
}
function sendWikiApusTheme() {
  const frame = document.getElementById('apus-wiki-frame');
  if (apusWikiLoaded && frame && frame.contentWindow) frame.contentWindow.postMessage({apusWikiApus:'THEME', theme:currentTheme}, '*');
}
function closeWikiApus() {
  document.getElementById('apus-wiki-shell').style.display = 'none';
  const frame = document.getElementById('apus-wiki-frame');
  if (frame) { frame.removeAttribute('srcdoc'); frame.src = 'about:blank'; }
  apusWikiLoaded = false;
  gameState = 'MENU';
  updateTouchControlsVisibility();
  showOverlay('minigames-hub-overlay');
}
window.addEventListener('message', function apusWikiMessages(event) {
  const frame = document.getElementById('apus-wiki-frame');
  if (!frame || event.source !== frame.contentWindow || !event.data) return;
  if (event.data.apusWikiApus === 'READY') {sendWikiApusTheme();sendFrikiSound();sendFrikiAccount();}
  if (event.data.apusWikiApus === 'OPEN_AUDIO_PANEL' && typeof window.apusOpenAudioPanel === 'function') window.apusOpenAudioPanel();
  if (event.data.apusWikiApus === 'REQUEST_SOUND' && typeof event.data.enabled === 'boolean') setApusGlobalSound(event.data.enabled);
  if (event.data.apusWikiApus === 'QUEUE_PROGRESS') {
    // Guardar inmediatamente cada avance; no enviarlo a Firebase en cada pregunta.
    const clean=frikiValidatePacket(event.data);
    if(clean&&currentUser?.uid&&frikiQueueSession(currentUser.uid,clean))
      frikiPushAccountScore(currentUser.uid,frikiReadVerified(currentUser.uid),'partida-en-curso');
  }
  if (event.data.apusWikiApus === 'SUBMIT_SCORE') saveFrikiScore(event.data);
  if (event.data.apusWikiApus === 'REQUEST_THEME' && ['dark','light'].includes(event.data.theme)) applyTheme(event.data.theme);
  if (event.data.apusWikiApus === 'POSTCARD_UNLOCKED') apusUnlockFightStage(event.data.stageId);
  if (event.data.apusWikiApus === 'POSTCARDS_SYNC' && Array.isArray(event.data.stages))
    event.data.stages.forEach(apusUnlockFightStage);
  if (event.data.apusWikiApus === 'CLOSE') {
    closeWikiApus();
    // Una partida interrumpida mantiene sus puntos pendientes por UID.
    if(currentUser?.uid)syncPendingFrikiScores(false).catch(()=>{});
  }
});

/* ============================================================================
   INIT Y CORRECCIÓN DE EJECUCIÓN (ROBUSTA Y SEGURA)
   ============================================================================ */

/* V31.5.6 - PUNTAJE ÚNICO FRIKI APUS.
   Una sola cifra oficial: apusFrikiRankings/{uid}. Nunca se reemplaza con
   gameState.totalScore (valor legado compartido por dispositivo).
   Las partidas offline se guardan por UID y se suman una sola vez mediante
   transacción; el puntaje legado NO se atribuye automáticamente a otra cuenta. */
const APUS_FRIKI_RANKING_COLLECTION = 'apusFrikiRankings';
const FRIKI_PENDING_PREFIX = 'apus_friki_pending_2807_'; // mantener cola de versiones anteriores
const FRIKI_VERIFIED_PREFIX = 'apus_friki_confirmed_3156_';
function frikiSafeScore(value){const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER?Math.ceil(n):0;}
function frikiPendingKey(uid){return FRIKI_PENDING_PREFIX+String(uid);}
function frikiReadPending(uid){
  try{
    const records=JSON.parse(localStorage.getItem(frikiPendingKey(uid))||'[]');
    // En versiones previas slice(-100) podía eliminar partidas offline antiguas.
    return Array.isArray(records)?records.filter(r=>r&&/^friki-[a-z0-9-]{8,70}$/.test(r.sessionId)).slice(-1000):[];
  }catch(e){return [];}
}
function frikiWritePending(uid,records){
  try{localStorage.setItem(frikiPendingKey(uid),JSON.stringify(records.slice(-1000)));return true;}
  catch(e){console.warn('Friki: no se pudo guardar la cola local',e);return false;}
}
function frikiQueueSession(uid,packet){
  const pending=frikiReadPending(uid);
  const index=pending.findIndex(p=>p.sessionId===packet.sessionId);
  const next={sessionId:packet.sessionId,points:packet.points,level:packet.level,correct:packet.correct};
  if(index<0)pending.push(next);
  else if(frikiSafeScore(pending[index].points)<=packet.points)pending[index]=next;
  return frikiWritePending(uid,pending);
}
function frikiPendingPoints(uid){return frikiReadPending(uid).reduce((n,p)=>n+frikiSafeScore(p.points),0);}
function frikiReadVerified(uid){
  if(!uid)return 0;
  try{return frikiSafeScore(JSON.parse(localStorage.getItem(FRIKI_VERIFIED_PREFIX+uid)||'{}').score);}catch(e){return 0;}
}
function frikiStoreVerified(uid,score){
  if(!uid)return;
  const safe=Math.max(frikiReadVerified(uid),frikiSafeScore(score));
  try{localStorage.setItem(FRIKI_VERIFIED_PREFIX+uid,JSON.stringify({score:safe,source:'firebase-confirmed',at:Date.now()}));}catch(e){}
}
function frikiLegacyLocalScore(){
  try{
    const live=JSON.parse(localStorage.getItem('apus_ecuador_pixel_save_v1')||'{}');
    const backup=JSON.parse(localStorage.getItem('apus_friki_legacy_backup_v3156')||'{}');
    return Math.max(frikiSafeScore(live.totalScore),frikiSafeScore(backup.totalScore));
  }catch(e){return 0;}
}
function frikiPushAccountScore(uid,confirmed,source){
  if(!uid||currentUser?.uid!==uid)return;
  const frame=document.getElementById('apus-wiki-frame');
  if(!apusWikiLoaded||!frame?.contentWindow)return;
  const pending=frikiReadPending(uid);
  frame.contentWindow.postMessage({apusWikiApus:'SCORE_SYNC',uid,confirmed:frikiSafeScore(confirmed),pending:frikiPendingPoints(uid),pendingSessions:pending.length,source},'*');
}
function frikiReplySession(ok,total,message){
  const frame=document.getElementById('apus-wiki-frame');
  if(frame?.contentWindow)frame.contentWindow.postMessage({apusWikiApus:'SCORE_RESULT',ok,total,message},'*');
}
function frikiValidatePacket(packet){
  const points=Number(packet?.points),level=Number(packet?.level),correct=Number(packet?.correct),sessionId=String(packet?.sessionId||'');
  if(!Number.isSafeInteger(points)||points<0||points>20000||!Number.isInteger(level)||level<1||level>25||
     !Number.isInteger(correct)||correct<0||correct>20||!/^friki-[a-z0-9-]{8,70}$/.test(sessionId))return null;
  const min=correct*(100+level*10+15);
  const max=correct*(100+level*10)+15*(correct*(correct+1)/2);
  if(points<min||points>max)return null;
  return {points,level,correct,sessionId};
}
async function frikiCommitSession(uid,packet){
  const docRef=apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).doc(uid);
  const name=String(currentUser?.username||'MONTAÑISTA').slice(0,24);
  const backup=frikiReadVerified(uid); // solo cifras observadas previamente en Firebase
  const next=await apusFirebaseDb.runTransaction(async tx=>{
    const snap=await tx.get(docRef),prev=snap.exists?snap.data():{};
    const seen=Array.isArray(prev.recentSessions)?prev.recentSessions:[];
    const journal=Array.isArray(prev.recentSessionTotals)?prev.recentSessionTotals:[];
    const old=frikiSafeScore(prev.score),base=Math.max(old,backup);
    const known=journal.find(x=>x&&x.id===packet.sessionId);
    // Sesiones de versiones antiguas ya contadas: no volver a sumarlas.
    const already=known?frikiSafeScore(known.points):(seen.includes(packet.sessionId)?packet.points:0);
    const delta=Math.max(0,packet.points-already);
    const updated=base+delta;
    if(delta>0||base>old||!known){
      // La tabla reciente registra el máximo acreditado para la sesión.
      // Las actualizaciones parciales solo añaden la diferencia, nunca todo de nuevo.
      const history=[...journal.filter(x=>x?.id!==packet.sessionId).slice(-99),
        {id:packet.sessionId,points:Math.max(already,packet.points)}];
      tx.set(docRef,{uid,name,score:updated,
        recentSessions:[...seen.filter(x=>x!==packet.sessionId).slice(-99),packet.sessionId],
        recentSessionTotals:history,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    }
    return updated;
  });
  frikiStoreVerified(uid,next);
  return next;
}
let frikiSyncInProgress=null;
async function syncPendingFrikiScores(announce=false){
  if(frikiSyncInProgress)return frikiSyncInProgress;
  if(!currentUser?.uid||!cloudAvailable())return null;
  const uid=currentUser.uid;
  frikiSyncInProgress=(async()=>{
    let latest=null;
    const checked=new Set();
    for(let i=0;i<1000;i++){
      const session=frikiReadPending(uid).find(p=>!checked.has(p.sessionId));
      if(!session||currentUser?.uid!==uid)break;
      checked.add(session.sessionId);
      if(!frikiValidatePacket(session)){
        // Conservar la partida dañada para auditoría; nunca eliminar puntos silenciosamente.
        console.warn('Friki: sesión pendiente inválida, conservada para revisión',session.sessionId);
        continue;
      }
      try{
        latest=await frikiCommitSession(uid,session);
        // Si llegó una respuesta nueva mientras la transacción estaba en curso,
        // conservar la versión más reciente de esa misma sesión.
        if(!frikiWritePending(uid,frikiReadPending(uid).filter(r=>r.sessionId!==session.sessionId||frikiSafeScore(r.points)>session.points)))break;
        frikiPushAccountScore(uid,latest,'firebase');
      }catch(err){
        console.warn('Friki: sesión pendiente, sin borrar del dispositivo',err);
        if(announce)frikiReplySession(false,frikiReadVerified(uid),'Puntos pendientes; se sincronizarán cuando regrese internet.');
        break;
      }
    }
    if(latest!==null&&announce)frikiReplySession(true,latest,'Puntos acumulados en Firebase');
    return latest;
  })();
  try{return await frikiSyncInProgress;}finally{frikiSyncInProgress=null;}
}
let frikiRefreshPromise=null;
async function frikiRefreshAccountScore(){
  const uid=currentUser?.uid;
  if(!uid)return 0;
  frikiPushAccountScore(uid,frikiReadVerified(uid),'local-confirmado');
  if(!cloudAvailable())return frikiReadVerified(uid);
  if(frikiRefreshPromise?.uid===uid)return frikiRefreshPromise.promise;
  const promise=(async()=>{
    await syncPendingFrikiScores(false);
    const docRef=apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).doc(uid);
    // Esta lectura pretende alcanzar el servidor, no solo la caché offline.
    const snap=await docRef.get({source:'server'});
    const remote=snap.exists?frikiSafeScore(snap.data().score):0;
    const remembered=frikiReadVerified(uid);
    let confirmed=remote;
    if(remembered>remote){
      // Restaurar únicamente un valor que YA se había confirmado por Firebase
      // para este mismo UID; no subir el score local legado sin atribución.
      confirmed=await apusFirebaseDb.runTransaction(async tx=>{
        const fresh=await tx.get(docRef),data=fresh.exists?fresh.data():{};
        const old=frikiSafeScore(data.score),restored=Math.max(old,remembered);
        if(restored>old)tx.set(docRef,{uid,name:String(currentUser?.username||'MONTAÑISTA').slice(0,24),score:restored,
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
        return restored;
      });
    }
    frikiStoreVerified(uid,confirmed);
    frikiPushAccountScore(uid,confirmed,'firebase');
    return confirmed;
  })();
  frikiRefreshPromise={uid,promise};
  try{return await promise;}
  catch(err){
    frikiPushAccountScore(uid,frikiReadVerified(uid),'sin-conexion');
    return frikiReadVerified(uid);
  }finally{if(frikiRefreshPromise?.promise===promise)frikiRefreshPromise=null;}
}
async function saveFrikiScore(packet){
  const clean=frikiValidatePacket(packet);
  if(!clean){frikiReplySession(false,0,'Puntaje inválido: no se alteró el ranking.');return;}
  if(!currentUser?.uid){frikiReplySession(false,0,'Inicia sesión para publicar tu puntuación.');return;}
  const uid=currentUser.uid;
  if(!frikiQueueSession(uid,clean)){
    frikiReplySession(false,frikiReadVerified(uid),'No se pudo guardar la partida pendiente en este dispositivo.');return;
  }
  frikiPushAccountScore(uid,frikiReadVerified(uid),'partida-pendiente');
  if(!cloudAvailable()){
    frikiReplySession(false,frikiReadVerified(uid),'Partida pendiente guardada en este dispositivo.');return;
  }
  await syncPendingFrikiScores(true);
  frikiPushAccountScore(uid,frikiReadVerified(uid),'firebase');
}
window.addEventListener('online',()=>{if(currentUser?.uid)frikiRefreshAccountScore().catch(()=>{});});

let currentTheme = localStorage.getItem("apus_menu_theme") || "dark";

function applyTheme(theme) {
  currentTheme = theme;
  if(currentUser?.uid) cloudSavePreferences({theme});
  else localStorage.setItem("apus_menu_theme", theme);
  const isLight = (theme === "light");
  document.body.classList.toggle("theme-light", isLight);
  sendApusBingoTheme();
  sendWikiApusTheme();
  sendApus4x4Theme();
  const btn = document.getElementById("settings-theme-btn");
  if (btn) {
    btn.textContent = isLight ? "☀️ TEMA MENÚ: CLARO" : "🌙 TEMA MENÚ: OSCURO";
    btn.style.background = isLight ? "#f59e0b" : "#0284c7";
  }
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
  try { sound.playSFX("sfx_jump"); } catch (e) {}
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Animación de cumbre integrada (HTML autocontenido, sin dependencias externas).
const SUMMIT_ANIMATION_DATA_URI = "minijuegos/animacion-cumbre.html";

// V26.3: animación DESCENSO suministrada por el creador, integrada en el mismo HTML.
/* V31: APUS_DESCENT_ANIMATION_HTML_B64 está en minijuegos/animacion-descenso.html */

let GW = 960;
let GH = 540;
let isPortrait = false;
let summitCelebrationActive = false;
let summitPromptDismissed = false;
let summitPromptReadyAt = 0;
let rankingReturnToGameOver = false;

const FIGHT_STAGE_W = 960;
const FIGHT_MOVE_SPEED = 4.0;

let introActive = true;
let introTimer = 0;
let exitCinematicActive = false;
const INTRO_DURATION_FRAMES = 260;
// En la intro, dos pulsaciones deliberadas: no reutilizar el toque como clic del menú.
let introTapCount = 0;
let introLastTapAt = 0;
let introIgnoreClickUntil = 0;
function introRegisterActivation() {
  if (!introActive) return;
  const now = performance.now();
  if (introTapCount === 0 || now - introLastTapAt > 5000) {
    introTapCount = 1;
    introLastTapAt = now;
    return;
  }
  // Descarta eventos duplicados de un único toque de pantalla.
  if (now - introLastTapAt < 180) return;
  introTapCount = 0;
  finishIntroAndOpenMenu();
}
// Un toque en canvas seguido de un click sintetico no debe activar opciones del menu.
document.addEventListener('click', e => {
  if (performance.now() < introIgnoreClickUntil) {
    e.preventDefault(); e.stopImmediatePropagation();
  }
}, true);

function finishIntroAndOpenMenu() {
  if (!introActive) return;
  introIgnoreClickUntil = performance.now() + 650;
  introTapCount = 0;
  introLastTapAt = 0;
  introActive = false;
  exitCinematicActive = false;
  gameState = "MENU";
  showOverlay("menu-overlay");
  try { sound.playBGM("bgm_menu"); } catch (e) {}
}

function updateCanvasOrientation() {
  isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait) {
    GW = 540;
    GH = 900;
  } else {
    GW = 960;
    GH = 540;
  }
  canvas.width = GW;
  canvas.height = GH;
}

function getGroundY(inFlatSection = false) {
  if (isPortrait) {
    return inFlatSection ? 535 : 520;
  }
  return inFlatSection ? 390 : 370;
}

window.addEventListener("resize", () => {
  const prevPortrait = isPortrait;
  updateCanvasOrientation();
  if (prevPortrait !== isPortrait) {
    if (gameState === "STORY") {
      const lvl = LEVELS[storyData.levelIdx];
      const inFlat = storyData.distance < lvl.flatTutorialDist;
      player.y = getGroundY(inFlat);
      player.x = Math.min(player.x, isPortrait ? 210 : 420);
    } else if (gameState === "MINIGAME" && fighters.length === 2) {
      const fGround = isPortrait ? 535 : 390;
      fighters[0].y = fGround;
      fighters[1].y = fGround;
    }
    initSnowParticles();
  }
});

