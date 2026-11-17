/* Voz privada entre dos amigos: WebRTC directo, sin TURN de pago. */
(function(){
 'use strict';
 const P=window.ApusVoicePolicy;if(!P)return;
 const box=document.createElement('aside');box.id='apus-voice';box.hidden=true;box.setAttribute('aria-label','Voz entre amigos');
 box.innerHTML='<button id="voice-toggle" type="button" aria-label="Abrir llamadas de voz" aria-expanded="false"><canvas id="voice-face" width="80" height="80"></canvas><span id="voice-badge">☎</span></button><section id="voice-panel" hidden><header><strong>☎ VOZ ENTRE AMIGOS</strong><button id="voice-close" type="button" aria-label="Cerrar panel de voz">✕</button></header><p id="voice-note" role="status" aria-live="polite"></p><div id="voice-friends"></div><div id="voice-call" hidden><p id="voice-peer"></p><button id="voice-accept" type="button">ACEPTAR</button><button id="voice-mute" type="button" aria-pressed="false">SILENCIAR</button><button id="voice-play" type="button" hidden>ACTIVAR SONIDO</button><button id="voice-end" type="button">COLGAR</button></div><small>Solo voz · dos amigos · sin límite de tiempo del juego. Algunas redes no permiten conexión directa.</small></section><audio id="voice-audio" autoplay></audio>';
 document.body.append(box);const $=id=>document.getElementById(id),panel=$('voice-panel'),audio=$('voice-audio');
 let friendListKey="",serverOffset=0;
 let service=null,db=null,uid='',links={},blocks={},names={},online=false,booting=false,bootEpoch=0,epoch=0,call=null,note='Elige un amigo para llamarlo.',incoming={},seen=new Set(),lastFace='',retry=0;
 const timers=new Set();const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);return t;};
 const inCabin=()=>!!window.ApusCabanaUI?.isOpen;
 function profile(){let avatar=null;try{avatar=window.apusRefugioFase1?.voiceAvatar||null;}catch{};return {name:String(typeof currentUser!=='undefined'?currentUser?.username||'MONTAÑISTA':'MONTAÑISTA').slice(0,24),avatar:window.ApusRefugioPresence.avatar(avatar)};}
 function face(a){a=window.ApusRefugioPresence.avatar(a);const key=JSON.stringify(a);if(key===lastFace)return;lastFace=key;const c=$('voice-face'),ctx=c.getContext('2d');ctx.clearRect(0,0,80,80);ctx.fillStyle='#16384b';ctx.fillRect(0,0,80,80);try{drawMountaineerSprite(ctx,'CUSTOM',40,116,{scale:2.25,customConfig:a||profile().avatar});}catch{ctx.fillStyle='#ffc77d';ctx.fillRect(22,17,36,36);}}
 function render(){
  box.hidden=!uid||inCabin()||(!call&&!Object.keys(links).some(id=>P.friends(links,blocks,id)));if(box.hidden)panel.hidden=true;
  $('voice-toggle').setAttribute('aria-expanded',String(!panel.hidden));$('voice-note').textContent=note;
  $('voice-badge').textContent=call?(call.state==='connected'?'🎙':'☎'):'☎';box.classList.toggle('voice-active',call?.state==='connected');
  $('voice-call').hidden=!call;$('voice-friends').hidden=!!call;
  if(call){$('voice-peer').textContent=call.name||'AMIGO';$('voice-accept').hidden=call.state!=='incoming';$('voice-mute').hidden=call.state!=='connected';$('voice-mute').textContent=call.muted?'ACTIVAR MICRÓFONO':'SILENCIAR';$('voice-mute').setAttribute('aria-pressed',String(!!call.muted));$('voice-end').textContent=call.state==='incoming'?'RECHAZAR':'COLGAR';face(call.remoteAvatar||profile().avatar);}
  else{face(profile().avatar);const list=$('voice-friends'),key=JSON.stringify([links,blocks,names,online]);if(key===friendListKey)return;friendListKey=key;list.replaceChildren();for(const id of Object.keys(links).filter(id=>P.friends(links,blocks,id))){const b=document.createElement('button');b.type='button';b.textContent='☎ '+(names[id]||'AMIGO');b.disabled=!online;b.onclick=()=>dial(id);list.append(b);}if(!list.children.length)list.textContent='Agrega y acepta amigos en el Refugio.';}
 }
 function show(text){note=text;render();}
 function hangup(text='Llamada finalizada.'){epoch++;const old=call;call=null;for(const t of timers)clearTimeout(t);timers.clear();if(old){if(old.listener)old.ref.off('value',old.listener);old.pc?.close();old.stream?.getTracks().forEach(t=>t.stop());old.ref?.remove().catch(()=>{});}audio.pause();audio.srcObject=null;$('voice-play').hidden=true;show(text);}
 function fail(e){hangup(e?.name==='NotAllowedError'?'No se permitió el micrófono. Puedes habilitarlo en los ajustes.':/permission/i.test(e?.code||e?.message||'')?'La llamada no está autorizada. Comprueba la amistad y los permisos de voz.':e?.message||'No se pudo conectar la llamada.');}
 async function bounded(promise,ms,message){let t;try{return await Promise.race([promise,new Promise((_,reject)=>{t=later(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(t);timers.delete(t);}}
 async function media(c,token){
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('Este navegador no admite llamadas de voz.');
  const pending=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  pending.then(s=>{if(token!==epoch)s.getTracks().forEach(t=>t.stop());},()=>{});
  const stream=await bounded(pending,30000,'No se recibió permiso para el micrófono.');if(token!==epoch){stream.getTracks().forEach(t=>t.stop());return null;}c.stream=stream;
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}],iceCandidatePoolSize:0});c.pc=pc;for(const t of stream.getAudioTracks())pc.addTrack(t,stream);
  pc.ontrack=e=>{if(token!==epoch||e.track.kind!=='audio')return;audio.srcObject=e.streams[0]||new MediaStream([e.track]);audio.play().catch(()=>{$('voice-play').hidden=false;});};
  pc.onconnectionstatechange=()=>{if(token!==epoch)return;if(pc.connectionState==='connected'){c.state='connected';clearTimeout(c.timeout);show('Llamada de voz conectada.');}else if(['failed','closed'].includes(pc.connectionState))hangup('La red no permitió mantener la llamada directa.');else if(pc.connectionState==='disconnected'){show('Reconectando la voz…');later(()=>{if(token===epoch&&pc.connectionState==='disconnected')hangup('Se perdió la conexión. Vuelve a llamar.');},12000);}};
  c.timeout=later(()=>{if(token===epoch&&c.state!=='connected')hangup('No se pudo conectar. Tu amigo puede estar desconectado o la red no permite llamadas directas.');},45000);return pc;
 }
 async function description(pc,type){await pc.setLocalDescription(type==='offer'?await pc.createOffer():await pc.createAnswer());if(pc.iceGatheringState!=='complete')await bounded(new Promise(resolve=>{const h=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',h);resolve();}};pc.addEventListener('icegatheringstatechange',h);}),10000,'No se pudo preparar la conexión de voz.');return {type:pc.localDescription.type,sdp:pc.localDescription.sdp};}
 function listen(c,token){c.listener=async snap=>{if(token!==epoch)return;const v=snap.val();if(!v){hangup('Tu amigo rechazó o terminó la llamada.');return;}if(v.id!==c.id){hangup('La llamada cambió.');return;}if(v.answer&&c.caller&&!c.answering){c.answering=true;c.remoteAvatar=v.answer.profile?.avatar;c.name=v.answer.profile?.name||c.name;try{await c.pc.setRemoteDescription({type:'answer',sdp:v.answer.sdp});if(token===epoch)show('Conectando la voz…');}catch(e){if(token===epoch)fail(e);}}};c.ref.on('value',c.listener,e=>{if(token===epoch)fail(e);});}
 async function dial(other){
  if(call||!service?.canCall(other)||!online||inCabin())return;
  const token=++epoch,c={other,caller:true,state:'preparing',name:names[other],id:crypto.randomUUID()};c.ref=service.ref(other,uid,c.id);call=c;show('Preparando micrófono…');
  try{const pc=await media(c,token);if(!pc)return;const offer=await description(pc,'offer');if(token!==epoch)return;await bounded(c.ref.onDisconnect().remove(),10000,'No se pudo preparar la llamada.');if(token!==epoch)return;await bounded(c.ref.set({id:c.id,from:uid,to:other,createdAt:firebase.database.ServerValue.TIMESTAMP,offer,profile:profile()}),12000,'No se pudo avisar a tu amigo.');if(token!==epoch){c.ref.remove().catch(()=>{});return;}c.state='ringing';listen(c,token);show('Llamando a '+(c.name||'tu amigo')+'…');}catch(e){if(token===epoch)fail(e);}
 }
 async function accept(){
  const c=call;if(!c||c.state!=='incoming'||!service?.canCall(c.other)||inCabin())return;const token=epoch;c.state='preparing';show('Conectando con tu amigo…');
  try{const pc=await media(c,token);if(!pc)return;await pc.setRemoteDescription(c.offer);const answer=await description(pc,'answer');if(token!==epoch)return;await bounded(c.ref.onDisconnect().remove(),10000,'No se pudo preparar la llamada.');if(token!==epoch)return;await bounded(c.ref.child('answer').set({...answer,profile:profile()}),12000,'No se pudo responder a la llamada.');if(token===epoch)show('Conectando la voz…');}catch(e){if(token===epoch)fail(e);}
 }
 function receive(items){incoming=items;if(!service)return;for(const [from,sessions]of Object.entries(items))for(const [id,v] of Object.entries(sessions||{})){
  if(!v||id!==v.id)continue;
  if(seen.has(v?.id))continue;if(!service.canCall(from))continue;
  if(v.answer||!P.validOffer(v,from,uid,Date.now()+serverOffset)||inCabin()||call){service.ref(uid,from,v.id).remove().catch(()=>{});seen.add(v?.id);continue;}
  seen.add(v.id);if(seen.size>100)seen=new Set([v.id]);const token=++epoch;call={other:from,caller:false,state:'incoming',id:v.id,name:v.profile?.name||names[from]||'AMIGO',remoteAvatar:v.profile?.avatar,offer:v.offer,ref:service.ref(uid,from,v.id)};listen(call,token);panel.hidden=false;show('Tu amigo quiere hablar contigo.');later(()=>{if(token===epoch&&call?.state==='incoming')hangup('La invitación de voz caducó.');},45000);break;
 }}
 async function boot(user){
  booting=true;const generation=++bootEpoch;try{await window.ApusRefugioPresence.loadSDK();if(generation!==bootEpoch||apusFirebaseAuth.currentUser?.uid!==user.uid)return;db=firebase.app().database(window.APUS_REFUGIO_ONLINE.databaseURL);uid=user.uid;db.ref('.info/serverTimeOffset').once('value').then(s=>{serverOffset=Number(s.val())||0;}).catch(()=>{});
   service=P.create({db,uid,onFriends:(l,b)=>{links=l;blocks=b;if(call&&!P.friends(l,b,call.other))hangup('La amistad cambió; se cerró la llamada.');for(const id of Object.keys(l))if(P.friends(l,b,id)&&!names[id]){names[id]='AMIGO';db.ref('apusSocial/v1/profiles/'+id).once('value').then(s=>{if(generation===bootEpoch){names[id]=s.val()?.name||'AMIGO';render();}}).catch(()=>{});}render();queueMicrotask(()=>receive(incoming));},onIncoming:receive,onNetwork:value=>{online=value;if(!value&&call)hangup('Sin conexión. La llamada se cerró.');render();},onError:e=>{if(call)hangup('Se perdió el permiso de la llamada.');show(/permission/i.test(e.code||'')?'La voz entre amigos aún necesita activar sus permisos.':'No se pudo conectar la voz.');}});
  }catch{retry=Date.now()+10000;}finally{if(generation===bootEpoch)booting=false;}
 }
 function logout(){bootEpoch++;booting=false;hangup('Inicia sesión para usar voz.');service?.stop();service=null;uid='';links={};blocks={};names={};incoming={};seen.clear();render();}
 $('voice-toggle').onclick=()=>{panel.hidden=!panel.hidden;render();};$('voice-close').onclick=()=>{panel.hidden=true;render();};$('voice-accept').onclick=accept;$('voice-end').onclick=()=>hangup();$('voice-play').onclick=()=>audio.play().then(()=>{$('voice-play').hidden=true;}).catch(()=>show('Toca activar sonido para escuchar.'));
 $('voice-mute').onclick=()=>{if(!call?.stream)return;call.muted=!call.muted;for(const t of call.stream.getAudioTracks())t.enabled=!call.muted;render();};
 for(const e of ['pointerdown','click','keydown'])box.addEventListener(e,event=>event.stopPropagation());
 window.addEventListener('apus:meeting-open',()=>{hangup('La voz entre amigos terminó al entrar a la cabaña.');panel.hidden=true;render();});
 document.addEventListener('apus:auth-logout',logout);window.addEventListener('pagehide',()=>hangup());
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&call?.stream){call.muted=true;call.stream.getAudioTracks().forEach(t=>t.enabled=false);show('Micrófono silenciado al salir de la aplicación.');}});
 setInterval(()=>{const user=typeof apusFirebaseAuth!=='undefined'?apusFirebaseAuth?.currentUser:null;if(uid&&uid!==user?.uid)logout();if(user&&!user.isAnonymous&&!uid&&!booting&&Date.now()>=retry)boot(user);if(uid)render();},1000);
 window.ApusVoice={get inCall(){return !!call;},get panelOpen(){return !panel.hidden;},call:other=>{panel.hidden=false;dial(other);},hangup};
})();
