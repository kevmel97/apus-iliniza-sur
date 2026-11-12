/* APUS v31.5 · reproductor único de música, separado de efectos.
   No reemplaza sonidos de juego ni toca Firebase/PeerJS. */
(function(){
'use strict';
const KEY='apus_audio_prefs_v315';
const TRACKS=Object.freeze({
  bgm_menu:'assets/musica/the-great-ascent.mp3',
  bgm_climb:'assets/musica/cold-iron-ascent.mp3',
  bgm_storm:'assets/musica/cold-iron-ascent.mp3',
  bgm_summit:'assets/musica/cold-iron-ascent.mp3',
  bgm_versus:'assets/musica/boss-rush.mp3',
  bgm_friki:'assets/musica/waltz-of-the-andean-ridge.mp3',
  bgm_bingo:'assets/musica/lucky-number-bounce.mp3',
  bgm_4x4:'assets/musica/mountain-pass-derby.mp3'
});
const prefs={fxEnabled:true,musicEnabled:true,buttonEnabled:true,fxVolume:.8,musicVolume:.58};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
  if(typeof saved.fxEnabled==='boolean')prefs.fxEnabled=saved.fxEnabled;
  if(typeof saved.musicEnabled==='boolean')prefs.musicEnabled=saved.musicEnabled;
  if(typeof saved.buttonEnabled==='boolean')prefs.buttonEnabled=saved.buttonEnabled;
  for(const k of ['fxVolume','musicVolume'])if(Number.isFinite(saved[k]))prefs[k]=Math.max(0,Math.min(1,saved[k]));
}catch(_){ }
const player=new Audio();player.loop=true;player.preload='none';player.playsInline=true;
let wanted='',current='',lastRequested=0;
// APUS_AUDIO_ESCENAS_V3153: la cinemática de derrota del 4x4 se comunica por postMessage.
let apus4x4LossAudioActive=false;
window.addEventListener('message',e=>{
  const frame=document.getElementById('apus-4x4-frame');
  if(!frame||e.source!==frame.contentWindow||e.data?.apus4x4!=='LOSS_SCENE_AUDIO')return;
  apus4x4LossAudioActive=e.data.active===true;
  routeMusic();
});
function apusOwnSceneAudio(){
  if(typeof descentExtraActive!=='undefined'&&descentExtraActive)return true;
  if(shown('apus-descent-shell'))return true;
  const state=(typeof gameState!=='undefined')?gameState:'';
  if((state==='MINIGAME'||state==='TOURNAMENT_WATCH')&&typeof vsWinner!=='undefined'&&!!vsWinner)return true;
  if(apus4x4LossAudioActive&&shown('apus-4x4-shell'))return true;
  return false;
}

const originalTone=sound.playTone.bind(sound);
const originalStopBGM=sound.stopBGM.bind(sound);
const menu=document.getElementById('apus-audio-panel');
function store(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(_){}}
function changeVolume(){player.volume=prefs.musicEnabled?prefs.musicVolume:0;}
function requestPlay(force=false){if(!current||!prefs.musicEnabled||!prefs.musicVolume||apusOwnSceneAudio())return;
  if(!force&&Date.now()-lastRequested<1800)return;
  if(typeof introActive!=='undefined'&&introActive)return;
  const intro=document.getElementById('apus-opening');
  if(intro&&!window.apusOpeningFinished)return;
  if(player.paused){lastRequested=Date.now();const result=player.play();if(result&&typeof result.catch==='function')result.catch(()=>{});}
}
function stopPlayer(){try{player.pause();player.currentTime=0;}catch(_){}}
function choose(name){
  wanted=name||'';
  const path=TRACKS[wanted]||'';
  if(wanted===current){changeVolume();requestPlay();return;}
  stopPlayer(); current=wanted;
  sound.currentTrack=wanted;
  if(!path){player.removeAttribute('src');player.load();return;}
  player.src=path;player.load();changeVolume();requestPlay();
}
sound.playBGM=function(trackName){choose(trackName);};
sound.stopBGM=function(){originalStopBGM();wanted='';current='';sound.currentTrack=null;stopPlayer();};
sound.playTone=function(freq,duration,type,vol,slideFreq){
 if(!prefs.fxEnabled)return;
 return originalTone(freq,duration,type,Math.min(0.46,Math.max(0,(vol==null?.12:vol))*2.6)*prefs.fxVolume,slideFreq);
};
// SoundSystem antiguo solo usa .enabled para efectos, no para música.
sound.enabled=prefs.fxEnabled;
function broadcast(){
  const descentFrame=document.getElementById('apus-descent-frame');
  if(descentFrame&&descentFrame.contentWindow&&typeof descentExtraActive!=='undefined'&&descentExtraActive){
    try{descentFrame.contentWindow.postMessage({apusDescent:'SOUND',enabled:prefs.fxEnabled,fxVolume:prefs.fxVolume},'*');}catch(_){}
  }
  ['apus-wiki-frame','apus-bingo-frame','apus-4x4-frame'].forEach(id=>{
    const f=document.getElementById(id);
    if(!f||!f.contentWindow)return;
    const kind=id==='apus-wiki-frame'?'apusWikiApus':id==='apus-bingo-frame'?'apusBingo':'apus4x4';
    try{f.contentWindow.postMessage({[kind]:'SOUND',enabled:prefs.fxEnabled,fxVolume:prefs.fxVolume},'*');}catch(_){ }
  });
}
function updateUi(){
 const fx=document.getElementById('apus-audio-fx'), bgm=document.getElementById('apus-audio-music');
 const buttons=document.getElementById('apus-audio-ui-buttons');
 if(buttons)buttons.checked=prefs.buttonEnabled;
 const fv=document.getElementById('apus-audio-fx-volume'),mv=document.getElementById('apus-audio-music-volume');
 if(fx)fx.checked=prefs.fxEnabled;if(bgm)bgm.checked=prefs.musicEnabled;
 if(fv)fv.value=String(Math.round(prefs.fxVolume*100));
 if(mv)mv.value=String(Math.round(prefs.musicVolume*100));
 const fvl=document.getElementById('apus-audio-fx-number'),mvl=document.getElementById('apus-audio-music-number');
 if(fvl)fvl.textContent=Math.round(prefs.fxVolume*100)+'%';
 if(mvl)mvl.textContent=Math.round(prefs.musicVolume*100)+'%';
 const btn=document.getElementById('btn-sound'),sbtn=document.getElementById('settings-sound-btn');
 const silent=!prefs.fxEnabled&&!prefs.musicEnabled&&!prefs.buttonEnabled;
 if(btn)btn.textContent=silent?'🔇 OFF':'🎵 AUDIO';
 if(sbtn)sbtn.textContent='🎵 CONFIGURAR MÚSICA Y SONIDOS';
}
function save(){sound.enabled=prefs.fxEnabled;changeVolume();
 if(!prefs.musicEnabled)player.pause();else requestPlay();
 store();updateUi();broadcast();
}
window.apusSetFxEnabled=function(v){prefs.fxEnabled=!!v;save();};
window.apusAudioSettings=prefs;
function openPanel(){if(!menu)return;updateUi();menu.hidden=false;menu.setAttribute('aria-hidden','false');}
function closePanel(){if(!menu)return;menu.hidden=true;menu.setAttribute('aria-hidden','true');requestPlay();}
window.toggleSound=openPanel;
window.apusOpenAudioPanel=openPanel;
window.apusCloseAudioPanel=closePanel;
menu?.addEventListener('click',e=>{if(e.target===menu)closePanel();});
menu?.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closePanel();}});
document.getElementById('apus-audio-close')?.addEventListener('click',closePanel);
document.getElementById('apus-audio-fx')?.addEventListener('change',e=>{prefs.fxEnabled=e.target.checked;save();});
document.getElementById('apus-audio-music')?.addEventListener('change',e=>{prefs.musicEnabled=e.target.checked;save();});
document.getElementById('apus-audio-ui-buttons')?.addEventListener('change',e=>{prefs.buttonEnabled=e.target.checked;save();});
document.getElementById('apus-audio-fx-volume')?.addEventListener('input',e=>{prefs.fxVolume=Number(e.target.value)/100;save();});
document.getElementById('apus-audio-music-volume')?.addEventListener('input',e=>{prefs.musicVolume=Number(e.target.value)/100;save();});
document.getElementById('apus-audio-mute-all')?.addEventListener('click',()=>{prefs.fxEnabled=false;prefs.musicEnabled=false;prefs.buttonEnabled=false;save();});
// APUS 31.5.2: clic de botones independiente de efectos de acciones.
// No se aplica a controles del juego (joystick/canvas) ni a los deslizadores.
let clickContext=null, clickLastPointer=null, clickLastAt=0;
function playUiClick(){
 if(!prefs.buttonEnabled||prefs.fxVolume<=0)return;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  if(!clickContext)clickContext=new Context();
  if(clickContext.state==='suspended'){
    const p=clickContext.resume();if(p?.catch)p.catch(()=>{});
  }
  const now=clickContext.currentTime;
  const oscillator=clickContext.createOscillator();
  const gain=clickContext.createGain();
  oscillator.type='triangle';
  oscillator.frequency.setValueAtTime(710,now);
  oscillator.frequency.exponentialRampToValueAtTime(1010,now+0.055);
  const volume=Math.min(.095,prefs.fxVolume*.095);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+.008);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.075);
  oscillator.connect(gain);gain.connect(clickContext.destination);
  oscillator.start(now);oscillator.stop(now+.08);
 }catch(e){console.warn('[APUS] sonido de botón',e);}
}
window.apusPlayUiClick=playUiClick;
const uiButtonSelector='button,[role="button"],input[type="button"],input[type="submit"],input[type="checkbox"]';
document.addEventListener('pointerdown',e=>{
 const button=e.target?.closest?.(uiButtonSelector);
 if(!button||button.disabled)return;
 clickLastPointer=button;clickLastAt=performance.now();playUiClick();
},true);
// Accesibilidad: clic de teclado sin sonido doble después del pointerdown.
document.addEventListener('click',e=>{
 const button=e.target?.closest?.(uiButtonSelector);
 if(!button||button.disabled)return;
 if(button===clickLastPointer&&performance.now()-clickLastAt<500)return;
 playUiClick();
},true);
// Los minijuegos emiten un evento mínimo, nunca datos privados.
window.addEventListener('message',e=>{
 if(!e.data||e.data.apusUiButtonPress!==true)return;
 const allowed=['apus-wiki-frame','apus-bingo-frame','apus-4x4-frame'].some(id=>{
  const f=document.getElementById(id);return f?.contentWindow===e.source;
 });
 if(allowed)playUiClick();
});
// Llamadas de acción también sirven para desbloquear audio en móviles.
document.addEventListener('pointerdown',()=>{if(prefs.musicEnabled)requestPlay(true);},true);
document.addEventListener('apus:opening-finished',()=>{routeMusic();});
function shown(id){const e=document.getElementById(id);return !!e&&getComputedStyle(e).display!=='none';}
function activeOverlay(){return document.querySelector('.overlay.active')?.id||'';}
function desired(){
 if(typeof introActive!=='undefined'&&introActive)return '';
 if(document.getElementById('apus-opening')&&!window.apusOpeningFinished)return '';
 if(shown('apus-4x4-shell'))return 'bgm_4x4';
 if(shown('apus-wiki-shell'))return 'bgm_friki';
 if(shown('apus-bingo-shell'))return 'bgm_bingo';
 const state=(typeof gameState!=='undefined')?gameState:'';
 const original=(state==='PAUSED'&&typeof apusSettingsReturnContext!=='undefined'&&apusSettingsReturnContext)
   ?apusSettingsReturnContext.gameState:state;
 if(['STORY','CHECKPOINT','SUMMIT'].includes(original))return 'bgm_climb';
 if(['MINIGAME','TOURNAMENT_WATCH'].includes(original))return 'bgm_versus';
 const overlay=activeOverlay();
 if(/(?:versus|tournament)/.test(overlay))return 'bgm_versus';
 return 'bgm_menu';
}
function routeMusic(){
 // En descenso, K.O. de Chugo vs Jordy y vuelco de 4x4: pausa la música MP3;
 // conserva su posición para reanudarla una vez finalice la escena.
 if(apusOwnSceneAudio()){if(!player.paused)player.pause();return;}
 const target=desired();
 if(target!==current)choose(target);
 else if(!player.paused&&(!prefs.musicEnabled||!prefs.musicVolume))player.pause();
 else if(target&&prefs.musicEnabled&&player.paused)requestPlay();
}
window.apusRouteMusic=routeMusic;
setInterval(routeMusic,350);
setInterval(()=>{if(prefs.fxEnabled)broadcast();},6000); // nuevos iframes cargados
window.addEventListener('message',e=>{if(!e.data||typeof e.data!=='object')return;
 if(['READY'].includes(e.data.apusWikiApus)||['READY'].includes(e.data.apusBingo)||['READY'].includes(e.data.apus4x4)){
    setTimeout(broadcast,30);
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)player.pause();else routeMusic();});
updateUi();broadcast();
})();
