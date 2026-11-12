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
  // APUS_AUDIO_CUMBRE_V3154: conservar el audio propio de la animación final.
  if(typeof summitCelebrationActive!=='undefined'&&summitCelebrationActive)return true;
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
document.addEventListener('pointerdown',()=>{
 if(prefs.musicEnabled){splashMidiRoute();requestPlay(true);}
},true);
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
// APUS_MIDI_DOBLE_TOQUE_V3154: notas ORIGINALES del antiguo bgm_menu.
// Solo pantalla de doble toque; no se tocan los seis MP3 del juego.
const splashNotes=[220,261.63,329.63,440,392,329.63,293.66,246.94];
const splashBass=[110,110,130.81,130.81];
let splashMidiTimer=null,splashMidiStep=0;
function splashIsVisible(){
 const opening=document.getElementById('apus-opening');
 return typeof introActive!=='undefined'&&introActive===true&&
        (!opening||window.apusOpeningFinished===true);
}
function splashMidiStop(){
 if(splashMidiTimer!==null){clearInterval(splashMidiTimer);splashMidiTimer=null;}
 splashMidiStep=0;
}
function splashMidiNote(ctx,freq,duration,type,baseVolume){
 try{
  const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,now);
  // Es música: volumen de música, independiente de efectos de acciones.
  const volume=Math.min(.09,baseVolume*prefs.musicVolume/.58);
  if(volume<=0)return;
  gain.gain.setValueAtTime(volume,now);
  gain.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start(now);osc.stop(now+duration);
 }catch(_){ }
}
function splashMidiTick(){
 if(!splashIsVisible()||!prefs.musicEnabled||prefs.musicVolume<=0){splashMidiStop();return;}
 const ctx=sound.ctx;
 if(!ctx||ctx.state!=='running')return;
 const step=splashMidiStep++;
 splashMidiNote(ctx,splashNotes[step%splashNotes.length],.230*.85,'square',.05);
 if(step%2===0){
  splashMidiNote(ctx,splashBass[Math.floor(step/2)%splashBass.length],.230*1.6,'triangle',.07);
 }
}
function splashMidiRoute(){
 if(!splashIsVisible()||!prefs.musicEnabled||prefs.musicVolume<=0){splashMidiStop();return;}
 try{sound.initContext();}catch(_){ }
 if(splashMidiTimer!==null)return;
 splashMidiStep=0;
 splashMidiTick();
 splashMidiTimer=setInterval(splashMidiTick,230);
}

// APUS_MIDI_RESULTADOS_V3154: fanfarrias MIDI de victoria y derrota.
// Se reproducen como efectos de la cinemática, no como canción de fondo.
// La secuencia de victoria conserva las notas ascendentes clásicas de sfx_checkpoint.
let apusVersusOutcomeNodes=[];
function stopVersusOutcomeJingle(){
  const voices=apusVersusOutcomeNodes.splice(0);
  for(const node of voices){try{node.stop();}catch(_){}}
}
window.apusStopVersusOutcomeJingle=stopVersusOutcomeJingle;
// APUS_MIDI_RESULTADOS_V3155: fanfarria de checkpoint recuperada (más rápida,
// burlona y audible) y derrota diferenciada. Son EFECTOS, no música MP3.
window.apusPlayVersusOutcomeJingle=function(result){
  stopVersusOutcomeJingle();
  if(!prefs.fxEnabled||prefs.fxVolume<=0)return;
  try{
    sound.initContext();
    const ac=sound.ctx;
    if(!ac)return;
    if(ac.state==='suspended'){
      const resume=ac.resume();
      if(resume&&typeof resume.catch==='function')resume.catch(()=>{});
    }
    const win=result==='victory';
    const start=ac.currentTime+0.035;
    // La victoria conserva el motivo ORIGINAL del checkpoint:
    // 440 -> 554 -> 659 -> 880, seguido de un remate "tiri-ti-ti" burlón.
    // La derrota desciende en registro y acaba en un golpe grave.
    const notes=win
      ? [
          [440.00,0.00,.15],[554.37,.14,.15],[659.25,.28,.15],
          [880.00,.43,.24],[1046.50,.71,.11],[987.77,.84,.11],
          [880.00,.97,.11],[1046.50,1.10,.11],[1174.66,1.23,.12],
          [1318.51,1.37,.40]
        ]
      : [
          [392.00,0.00,.22],[349.23,.24,.22],[311.13,.48,.23],
          [261.63,.75,.26],[196.00,1.03,.34],[146.83,1.40,.42],
          [110.00,1.82,.48]
        ];
    // Compresor suave: más presencia sin saturar en altavoces pequeños.
    const comp=ac.createDynamicsCompressor();
    comp.threshold.value=-17;comp.knee.value=12;
    comp.ratio.value=5;comp.attack.value=.004;comp.release.value=.13;
    const output=ac.createGain();output.gain.value=.95;
    comp.connect(output);output.connect(ac.destination);
    for(let i=0;i<notes.length;i++){
      const [hz,offset,duration]=notes[i];
      const a=start+offset;
      const main=ac.createOscillator(),amp=ac.createGain();
      main.type=win?'square':'sawtooth';
      main.frequency.setValueAtTime(hz,a);
      if(!win&&i===notes.length-1){
        main.frequency.exponentialRampToValueAtTime(Math.max(65,hz*.72),a+duration);
      }
      const base=(win?.245:.27)*prefs.fxVolume;
      amp.gain.setValueAtTime(.0001,a);
      amp.gain.linearRampToValueAtTime(base,a+.012);
      amp.gain.setValueAtTime(base*.87,a+Math.min(.065,duration*.33));
      amp.gain.exponentialRampToValueAtTime(.0001,a+duration);
      main.connect(amp);amp.connect(comp);
      main.start(a);main.stop(a+duration+.006);
      apusVersusOutcomeNodes.push(main);
      // Segunda voz para darle cuerpo al MIDI; es más tenue que la principal.
      if(i%2===0||i===notes.length-1){
        const harmon=ac.createOscillator(),hgain=ac.createGain();
        harmon.type='triangle';harmon.frequency.setValueAtTime(win?hz*.5:hz*1.5,a);
        const hvol=base*(win?.45:.29);
        hgain.gain.setValueAtTime(.0001,a);
        hgain.gain.linearRampToValueAtTime(hvol,a+.012);
        hgain.gain.exponentialRampToValueAtTime(.0001,a+duration);
        harmon.connect(hgain);hgain.connect(comp);
        harmon.start(a);harmon.stop(a+duration+.006);
        apusVersusOutcomeNodes.push(harmon);
      }
    }
  }catch(error){console.warn('[APUS] MIDI victoria/derrota 31.5.5',error);}
}

function routeMusic(){
 splashMidiRoute();
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
