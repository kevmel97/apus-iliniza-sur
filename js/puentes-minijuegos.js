

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
  if(apusWikiLoaded&&frame?.contentWindow)frame.contentWindow.postMessage({apusWikiApus:'ACCOUNT',signedIn:!!currentUser?.uid,name:currentUser?.username||''},'*');
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
  if (event.data.apusWikiApus === 'SUBMIT_SCORE') saveFrikiScore(event.data);
  if (event.data.apusWikiApus === 'REQUEST_THEME' && ['dark','light'].includes(event.data.theme)) applyTheme(event.data.theme);
  if (event.data.apusWikiApus === 'POSTCARD_UNLOCKED') apusUnlockFightStage(event.data.stageId);
  if (event.data.apusWikiApus === 'POSTCARDS_SYNC' && Array.isArray(event.data.stages))
    event.data.stages.forEach(apusUnlockFightStage);
  if (event.data.apusWikiApus === 'CLOSE') closeWikiApus();
});

/* ============================================================================
   INIT Y CORRECCIÓN DE EJECUCIÓN (ROBUSTA Y SEGURA)
   ============================================================================ */

/* V28.0.7 - Friki Apus: puntos reales de cada partida + reintentos por cuenta.
   No cambia el ranking de ascenso ni la conexión online de combate. */
const APUS_FRIKI_RANKING_COLLECTION = 'apusFrikiRankings';
const FRIKI_PENDING_PREFIX = 'apus_friki_pending_2807_';
function frikiPendingKey(uid){return FRIKI_PENDING_PREFIX + String(uid);}
function frikiReadPending(uid){
  try{
    const records=JSON.parse(localStorage.getItem(frikiPendingKey(uid))||'[]');
    return Array.isArray(records)?records.filter(r=>r && /^friki-[a-z0-9-]{8,70}$/.test(r.sessionId)).slice(-100):[];
  }catch(e){return [];}
}
function frikiWritePending(uid,records){
  try{localStorage.setItem(frikiPendingKey(uid),JSON.stringify(records.slice(-100)));}catch(e){}
}
function frikiQueueSession(uid,packet){
  const pending=frikiReadPending(uid);
  if(!pending.some(p=>p.sessionId===packet.sessionId))pending.push({
    sessionId:packet.sessionId, points:packet.points, level:packet.level, correct:packet.correct
  });
  frikiWritePending(uid,pending);
}
function frikiReplySession(ok,total,message){
  const frame=document.getElementById('apus-wiki-frame');
  if(frame?.contentWindow)frame.contentWindow.postMessage({apusWikiApus:'SCORE_RESULT',ok,total,message},'*');
}
function frikiValidatePacket(packet){
  const points=Number(packet?.points),level=Number(packet?.level),correct=Number(packet?.correct),sessionId=String(packet?.sessionId||'');
  if(!Number.isInteger(points)||points<0||points>20000||!Number.isInteger(level)||level<1||level>25||
     !Number.isInteger(correct)||correct<0||correct>20||!/^friki-[a-z0-9-]{8,70}$/.test(sessionId))return null;
  // A 20-question session cannot exceed the actual 20-correct streak score for that level.
  const min=correct*(100+level*10+15);
  const max=correct*(100+level*10)+15*(correct*(correct+1)/2);
  if(points<min||points>max)return null;
  return {points,level,correct,sessionId};
}
async function frikiCommitSession(uid,packet){
  const docRef=apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).doc(uid);
  const name=String(currentUser?.username || 'MONTAÑISTA').slice(0,30);
  return apusFirebaseDb.runTransaction(async tx=>{
    const snap=await tx.get(docRef),prev=snap.exists?snap.data():{};
    const seen=Array.isArray(prev.recentSessions)?prev.recentSessions:[];
    const old=Math.max(0,Number(prev.score)||0);
    if(seen.includes(packet.sessionId))return old;
    const next=old+packet.points;
    tx.set(docRef,{uid,name,score:next,recentSessions:[...seen.slice(-99),packet.sessionId],
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    return next;
  });
}
let frikiSyncInProgress=null;
async function syncPendingFrikiScores(announce=false){
  if(frikiSyncInProgress)return frikiSyncInProgress;
  if(!currentUser?.uid||!cloudAvailable())return null;
  const uid=currentUser.uid;
  frikiSyncInProgress=(async()=>{
    let latest=null;
    const checked=new Set();
    for(let i=0;i<120;i++){
      const session=frikiReadPending(uid).find(p=>!checked.has(p.sessionId));
      if(!session||!currentUser||currentUser.uid!==uid)break;
      checked.add(session.sessionId);
      try{
        latest=await frikiCommitSession(uid,session);
        frikiWritePending(uid,frikiReadPending(uid).filter(r=>r.sessionId!==session.sessionId));
      }catch(err){
        console.warn('Friki Apus: puntuación pendiente de sincronización',err);
        if(announce)frikiReplySession(false,0,'Puntos pendientes de subir. Usa SINCRONIZAR cuando tengas conexión.');
        break;
      }
    }
    if(latest!==null && announce)frikiReplySession(true,latest,'Puntos reales guardados en Firebase');
    return latest;
  })();
  try{return await frikiSyncInProgress;}finally{frikiSyncInProgress=null;}
}
async function saveFrikiScore(packet){
  const clean=frikiValidatePacket(packet);
  if(!clean){frikiReplySession(false,0,'Puntaje no válido');return;}
  if(!currentUser?.uid){frikiReplySession(false,0,'Inicia sesión para publicar tu puntuación.');return;}
  frikiQueueSession(currentUser.uid,clean);
  if(!cloudAvailable()){
    frikiReplySession(false,0,'Puntos guardados como pendientes: conecta a internet y pulsa SINCRONIZAR.');
    return;
  }
  try{
    const total=await syncPendingFrikiScores(true);
    if(total===null && frikiReadPending(currentUser.uid).some(p=>p.sessionId===clean.sessionId))
      frikiReplySession(false,0,'Puntuación pendiente de sincronización.');
  }catch(err){
    console.warn('Friki Apus: no se pudo subir el puntaje',err);
    frikiReplySession(false,0,'Puntuación pendiente de sincronización.');
  }
}

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

