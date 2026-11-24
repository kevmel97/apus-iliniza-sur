/* APUS 32.0.22 · Logros y Guardián Legendario.
   Módulo aislado: no modifica mecánicas, partidas, puntuaciones ni OTA.
   Guarda progreso por UID en el documento de usuario ya utilizado en Firestore. */
(function(){
'use strict';
const COL='apusUsers', FIELD='achievementsV1', VERSION=1;
const categories=[
 {key:'ascenso',title:'ASCENSO AL ILINIZA',icon:'🏔️',medals:[
  ['asc1','Primeros pasos','Superar el nivel 1'],['asc3','Andinista de altura','Superar el nivel 3'],['asc5','Conquistador del Iliniza','Terminar los cinco niveles']]},
 {key:'combate',title:'CHUGO VS JORDY',icon:'🥊',medals:[
  ['vs1','Primer golpe','Ganar un combate'],['vs4','Luchador de los Apus','Ganar un torneo de 4'],['vs8','Campeón de los Apus','Ganar un torneo de 8']]},
 {key:'friki',title:'FRIKI APUS',icon:'🧠',medals:[
  ['friki1','Aprendiz de Miguel','Aprobar el nivel 1 (11/20)'],['friki10','Sabio de los Andes','Aprobar 10 niveles distintos'],['friki25','Maestro Friki Apus','Aprobar los 25 niveles']]},
 {key:'tractor',title:'APUS 4X4',icon:'🚜',medals:[
  ['truckShort','Conductor novato','Completar ruta corta'],['truckLong','Rey del Terreneitor','Completar expedición completa'],['truckSafe','Ganado de élite','Completar expedición completa con 6 a bordo']]},
 {key:'bingo',title:'BINGO CAMPING',icon:'🎱',medals:[
  ['bingo1','La suerte del principiante','Ganar un bingo'],['bingo5','Afortunado del campamento','Ganar cinco bingos'],['bingo10','Rey del Bingo','Ganar diez bingos']]},
 {key:'refugio',title:'REFUGIO APUS',icon:'🏕️',medals:[
  ['refVisit','Bienvenido al campamento','Visitar el Refugio'],['friends3','Compañero de cordada','Tener tres amigos aceptados'],['friends5','Leyenda del Refugio','Tener cinco amigos aceptados']]}
];
const goldIds=categories.map(c=>c.medals[2][0]);
const plain=()=>({v:VERSION,unlocked:{},storyMax:0,vsWins:0,frikiLevels:[],routes:[],bingoWins:[],
  tournamentSizes:[],refugioVisited:false,friendsMax:0,seen:[],auraVisible:true});
let uid='', confirmed=plain(), pending=[], loaded=false, loading=false, syncing=false,lastTry=0;
const el=id=>document.getElementById(id);
const username=()=>{try{return typeof currentUser!=='undefined'?currentUser?.uid||'':'';}catch{return '';}};
const cloud=()=>{try{return typeof apusFirebaseDb!=='undefined'&&apusFirebaseDb&&
  typeof cloudAvailable==='function'&&cloudAvailable()&&navigator.onLine;}catch{return false;}};
const key=id=>'apus_achievements_queue_v1_'+id;
const cacheKey=id=>'apus_achievements_confirmed_v1_'+id;
const readJSON=(k,def)=>{try{return JSON.parse(localStorage.getItem(k)||'null')||def;}catch{return def;}};
const saveJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}};
function normalize(s){
 const o=plain(),v=s&&typeof s==='object'?s:{};
 o.unlocked=v.unlocked&&typeof v.unlocked==='object'?{...v.unlocked}:{};
 o.storyMax=Math.max(0,Math.min(5,Number(v.storyMax)||0));
 o.vsWins=Math.max(0,Math.min(100000,Number(v.vsWins)||0));
 o.frikiLevels=Array.isArray(v.frikiLevels)?[...new Set(v.frikiLevels.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=25))]:[];
 o.routes=Array.isArray(v.routes)?[...new Set(v.routes.filter(x=>['short','long','safe'].includes(x)))]:[];
 o.bingoWins=Array.isArray(v.bingoWins)?[...new Set(v.bingoWins.filter(x=>typeof x==='string').slice(-100))]:[];
 o.tournamentSizes=Array.isArray(v.tournamentSizes)?[...new Set(v.tournamentSizes.filter(n=>n===4||n===8))]:[];
 o.refugioVisited=v.refugioVisited===true;
 o.friendsMax=Math.max(0,Math.min(1000,Number(v.friendsMax)||0));
 o.seen=Array.isArray(v.seen)?v.seen.filter(x=>typeof x==='string').slice(-250):[];
 o.auraVisible=v.auraVisible!==false;
 return o;
}
function evaluate(s){
 const u=s.unlocked,earned=(id,condition)=>{if(condition&&!u[id])u[id]=Date.now();};
 earned('asc1',s.storyMax>=1);earned('asc3',s.storyMax>=3);earned('asc5',s.storyMax>=5);
 earned('vs1',s.vsWins>=1);earned('vs4',s.tournamentSizes.includes(4));earned('vs8',s.tournamentSizes.includes(8));
 earned('friki1',s.frikiLevels.includes(1));earned('friki10',s.frikiLevels.length>=10);earned('friki25',s.frikiLevels.length===25);
 earned('truckShort',s.routes.includes('short'));earned('truckLong',s.routes.includes('long'));earned('truckSafe',s.routes.includes('safe'));
 earned('bingo1',s.bingoWins.length>=1);earned('bingo5',s.bingoWins.length>=5);earned('bingo10',s.bingoWins.length>=10);
 earned('refVisit',s.refugioVisited);earned('friends3',s.friendsMax>=3);earned('friends5',s.friendsMax>=5);
 earned('legend',goldIds.every(id=>!!u[id]));
 return s;
}
function apply(s,events){
 s=normalize(s);
 for(const e of events){
  if(!e||typeof e.id!=='string'||s.seen.includes(e.id))continue;
  const d=e.data||{};
  if(e.type==='story'&&Number.isInteger(d.level)&&d.level>=1&&d.level<=5)s.storyMax=Math.max(s.storyMax,d.level);
  if(e.type==='duel')s.vsWins++;
  if(e.type==='tournament'&&(d.size===4||d.size===8))s.tournamentSizes=[...new Set([...s.tournamentSizes,d.size])];
  if(e.type==='friki'&&Number.isInteger(d.level)&&d.level>=1&&d.level<=25&&d.score>=11)
    s.frikiLevels=[...new Set([...s.frikiLevels,d.level])];
  if(e.type==='truck'&&[3000,7500].includes(d.routeMeters)){
    const route=d.routeMeters===3000?'short':'long';
    s.routes=[...new Set([...s.routes,route])];
    if(route==='long'&&d.aboard===6)s.routes=[...new Set([...s.routes,'safe'])];
  }
  if(e.type==='bingo'&&typeof d.roundId==='string'&&d.roundId.length>=6&&d.roundId.length<=180)
    s.bingoWins=[...new Set([...s.bingoWins,d.roundId])].slice(-100);
  if(e.type==='refugio')s.refugioVisited=true;
  if(e.type==='friends'&&Number.isInteger(d.count)&&d.count>=0)s.friendsMax=Math.max(s.friendsMax,Math.min(1000,d.count));
  if(e.type==='aura'&&typeof d.visible==='boolean')s.auraVisible=d.visible;
  s.seen.push(e.id);if(s.seen.length>250)s.seen=s.seen.slice(-250);
 }
 return evaluate(s);
}
function displayState(){return apply(confirmed,pending);}
function isLegendary(){return !!confirmed.unlocked.legend;}
function showAura(){return isLegendary()&&confirmed.auraVisible!==false;}
function publicBadge(){return {legendary:isLegendary(),aura:showAura()};}
function authChanged(){
 const next=username();if(next===uid)return;
 uid=next;loaded=false;loading=false;syncing=false;lastTry=0;
 confirmed=uid?normalize(readJSON(cacheKey(uid),plain())):plain();
 pending=uid?readJSON(key(uid),[]):[];
 if(!Array.isArray(pending))pending=[];
 render();
}
function record(type,data={}){
 authChanged();if(!uid)return;
 if(!['story','duel','tournament','friki','truck','bingo','refugio','friends','aura'].includes(type))return;
 const id=String(Date.now())+'-'+Math.random().toString(36).slice(2,12);
 // In Bingo the source round identifies a single win, even if render repeats.
 const event={id,type,data};
 pending.push(event);if(pending.length>140)pending=pending.slice(-140);
 saveJSON(key(uid),pending);render();flush();
}
function observeFriends(count){if(Number.isInteger(count)&&count>=3&&count>displayState().friendsMax)record('friends',{count});}
function notify(text){
 let n=el('apus-logros-toast');if(!n)return;
 n.textContent=text;n.hidden=false;clearTimeout(notify.timer);
 notify.timer=setTimeout(()=>{n.hidden=true;},3600);
}
async function load(){
 if(!uid||loading||loaded||!cloud())return;
 loading=true;const owner=uid;
 try{
  const snap=await apusFirebaseDb.collection(COL).doc(owner).get();
  if(uid!==owner)return;
  confirmed=normalize(snap.exists?snap.data()?.[FIELD]:null);
  saveJSON(cacheKey(uid),confirmed);loaded=true;
  // El progreso de historia existente sí pertenece al perfil autenticado.
  const progress=snap.data()?.progress||{};
  const achieved=progress.finished===true?5:Math.max(0,Math.min(4,(Number(progress.unlocked)||1)-1));
  if(achieved>confirmed.storyMax)record('story',{level:achieved});
  render();
 }catch(e){console.warn('APUS Logros: consulta de la cuenta:',e);}
 finally{loading=false;}
 if(uid===owner&&loaded)flush();
}
async function flush(){
 if(!uid||!pending.length||syncing||!cloud())return;
 if(!loaded){load();return;}
 const owner=uid,events=pending.slice(0,50);
 syncing=true;lastTry=Date.now();
 try{
  const doc=apusFirebaseDb.collection(COL).doc(owner);
  const result=await apusFirebaseDb.runTransaction(async tx=>{
   const snap=await tx.get(doc);
   const base=normalize(snap.exists?snap.data()?.[FIELD]:null);
   const updated=apply(base,events);
   tx.set(doc,{[FIELD]:updated},{merge:true});
   return {before:base,after:updated};
  });
  if(uid!==owner)return;
  confirmed=normalize(result.after);saveJSON(cacheKey(uid),confirmed);
  const completed=new Set(events.map(e=>e.id));
  pending=pending.filter(e=>!completed.has(e.id));saveJSON(key(uid),pending);
  const earned=Object.keys(confirmed.unlocked).filter(x=>!result.before.unlocked[x]);
  if(earned.length){const name=earned.includes('legend')?'🏆 GUARDIÁN LEGENDARIO':(categories.flatMap(c=>c.medals).find(m=>m[0]===earned[0])||[])[1];
    notify('🏅 LOGRO DESBLOQUEADO · '+name);}
  render();decoratePortrait();
  try{if(typeof renderCustomCardPreview==='function')renderCustomCardPreview();}catch(_){}
 }catch(e){console.warn('APUS Logros: pendiente de sincronización:',e);}
 finally{syncing=false;}
 if(uid===owner&&pending.length&&Date.now()-lastTry>2500)flush();
}
function drawAura(ctx,x,y,scale=1,t=0){
 if(!ctx||!Number.isFinite(x)||!Number.isFinite(y))return;
 const sc=Math.min(2.7,Math.max(.45,Number(scale)||1)),phase=(Number(t)||Date.now())*.001;
 ctx.save();
 const pulse=.84+Math.sin(phase*2)*.09;
 ctx.globalAlpha=.18*pulse;ctx.fillStyle='#fff7c4';
 ctx.beginPath();ctx.ellipse(x,y,28*sc,42*sc,0,0,Math.PI*2);ctx.fill();
 ctx.globalAlpha=.25*pulse;ctx.fillStyle='#ffd770';
 ctx.beginPath();ctx.ellipse(x,y,22*sc,36*sc,0,0,Math.PI*2);ctx.fill();
 for(let i=0;i<11;i++){
  const angle=i*Math.PI*2/11+phase*.28,rx=30*sc,ry=41*sc;
  const px=Math.round(x+Math.cos(angle)*rx),py=Math.round(y+Math.sin(angle)*ry);
  ctx.globalAlpha=(.5+.4*Math.sin(phase*2+i*2))*.8;
  ctx.fillStyle=i%3===0?'#ffffff':i%2===0?'#fff3b0':'#f8cf5f';
  const size=Math.max(2,Math.round((i%4===0?5:3)*sc));
  ctx.fillRect(px,py,size,size);
 }
 ctx.restore();
}
function decoratePortrait(){
 const c=el('preview-custom-card'),label=el('custom-card-title');
 if(c)c.classList.toggle('apus-legend-frame',isLegendary());
 if(label)label.dataset.apusLegendary=String(isLegendary());
}
function paintPortrait(ctx,x,y,scale=1){
 if(showAura())drawAura(ctx,x,y,scale,performance.now());
}
function build(){
 if(el('apus-logros-overlay'))return;
 const container=el('game-container');if(!container)return;
 const overlay=document.createElement('section');
 overlay.id='apus-logros-overlay';overlay.className='overlay';overlay.setAttribute('aria-label','Mis logros y medallas');
 overlay.innerHTML='<div class="retro-box apus-logros-box"><div class="apus-logros-head"><h2>🏅 MIS LOGROS</h2><button type="button" id="apus-logros-close" class="menu-btn">✕ VOLVER</button></div><p id="apus-logros-status"></p><div id="apus-logros-profile"><canvas id="apus-logros-avatar" width="120" height="125" aria-label="Retrato de tu montañista"></canvas><div><strong id="apus-logros-username">MONTAÑISTA</strong><small id="apus-logros-title">MEDALLAS Y RECOMPENSAS</small></div></div><div id="apus-logros-grid"></div><div class="apus-logros-legend" id="apus-logros-legend"></div><label id="apus-aura-label"><input type="checkbox" id="apus-aura-checkbox"> ✨ MOSTRAR AURA LEGENDARIA</label></div>';
 container.append(overlay);
 el('apus-logros-close').addEventListener('click',()=>{if(typeof showOverlay==='function')showOverlay('menu-overlay');else overlay.classList.remove('active');});
 el('apus-aura-checkbox').addEventListener('change',e=>record('aura',{visible:e.target.checked}));
 const toast=document.createElement('div');toast.id='apus-logros-toast';toast.hidden=true;toast.setAttribute('role','status');document.body.append(toast);
 render();
}
function open(){
 build();const overlay=el('apus-logros-overlay');if(!overlay)return;
 if(typeof showOverlay==='function')showOverlay('apus-logros-overlay');
 else{overlay.classList.add('active');}
 render();
}
function render(){
 const grid=el('apus-logros-grid');if(!grid)return;
 const s=displayState(),u=s.unlocked;
 let html='';
 const icons=['🥉','🥈','🥇'];
 for(const c of categories){
  html+='<section class="apus-logros-category"><h3>'+c.icon+' '+c.title+'</h3><div class="apus-logros-medals">';
  c.medals.forEach((m,i)=>{const done=!!u[m[0]];
   html+='<article class="apus-logros-medal '+(done?'obtained':'locked')+'"><span class="apus-logros-icon">'+(done?icons[i]:'🔒')+'</span><strong>'+m[1]+'</strong><small>'+m[2]+'</small></article>';
  });html+='</div></section>';
 }
 grid.innerHTML=html;
 const total=Object.keys(u).filter(x=>x!=='legend').length;
 const status=el('apus-logros-status');
 if(status)status.textContent=!uid?'INICIA SESIÓN PARA GUARDAR TUS MEDALLAS':total+'/18 MEDALLAS'+(pending.length?' · SINCRONIZACIÓN PENDIENTE':'');
 const legendary=el('apus-logros-legend');
 if(legendary){legendary.classList.toggle('obtained',!!u.legend);
  legendary.textContent=(u.legend?'🏆 GUARDIÁN LEGENDARIO DESBLOQUEADO':'🔒 GUARDIÁN LEGENDARIO · REQUIERE LAS 6 MEDALLAS DE ORO');
 }
 const profileTitle=el('apus-logros-title'),profileName=el('apus-logros-username');
 if(profileTitle)profileTitle.textContent=u.legend?'🏆 GUARDIÁN LEGENDARIO':'MEDALLAS Y RECOMPENSAS';
 if(profileName)profileName.textContent=(typeof currentUser!=='undefined'&&currentUser?.username)||'MONTAÑISTA';
 const portrait=el('apus-logros-avatar');
 if(portrait){portrait.classList.toggle('apus-legend-frame',!!u.legend);
  const ctx=portrait.getContext('2d');if(ctx){ctx.clearRect(0,0,120,125);
   if(u.legend&&s.auraVisible!==false)drawAura(ctx,60,70,.95,performance.now());
   try{
    if(typeof drawMountaineerSprite==='function'){
     const custom=typeof customCharSlots!=='undefined'&&Array.isArray(customCharSlots)?customCharSlots[typeof activeCustomSlot!=='undefined'?activeCustomSlot:0]:null;
     drawMountaineerSprite(ctx,custom?'CUSTOM':'JORDY',60,92,{scale:1.2,facing:1,customConfig:custom});
    }
   }catch(_){}
  }
 }
 const aura=el('apus-aura-label'),input=el('apus-aura-checkbox');
 if(aura)aura.hidden=!u.legend;
 if(input)input.checked=s.auraVisible!==false;
 decoratePortrait();
}
function tick(){
 authChanged();if(!uid)return;
 if(!loaded&&!loading&&Date.now()-lastTry>9000){lastTry=Date.now();load();}
 if(loaded&&pending.length&&!syncing&&Date.now()-lastTry>8500)flush();
}
window.ApusAchievements={record,observeFriends,drawAura,paintPortrait,publicBadge,isLegendary,showAura,decoratePortrait,open,render,definitions:categories};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
window.addEventListener('online',()=>{lastTry=0;load();flush();});
document.addEventListener('apus:auth-logout',()=>{authChanged();render();});
setInterval(tick,1500);tick();
window.addEventListener('message',e=>{
 if(!e.data||!uid)return;
 const frame=(id)=>el(id)?.contentWindow===e.source;
 if(frame('apus-4x4-frame')&&e.data.apus4x4==='FINISH'){
  const d=e.data;
  if([3000,7500].includes(Number(d.routeMeters))&&Number.isFinite(Number(d.timeMs))&&Number(d.timeMs)>=1000&&Number(d.timeMs)<=3600000&&Number.isInteger(Number(d.aboard))&&d.aboard>=0&&d.aboard<=6)
   record('truck',{routeMeters:Number(d.routeMeters),aboard:Number(d.aboard)});
 }
 if(frame('apus-wiki-frame')&&e.data.apusWikiApus==='ACHIEVEMENT_LEVEL'&&e.data.passed===true){
  const lvl=Number(e.data.level),score=Number(e.data.score);
  if(Number.isInteger(lvl)&&lvl>=1&&lvl<=25&&Number.isInteger(score)&&score>=11&&score<=20)record('friki',{level:lvl,score});
 }
 if(frame('apus-bingo-frame')&&e.data.apusBingo==='ACHIEVEMENT_WIN'&&e.data.won===true&&typeof e.data.roundId==='string')
  record('bingo',{roundId:e.data.roundId});
});
})();