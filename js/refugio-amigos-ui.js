/* Panel de amigos. No modifica cuentas, rankings ni el movimiento del mapa. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),panel=$('apus-friends-panel'),launch=$('apus-friends-open');
 if(!panel||!launch)return;
 let service=null,uid='',generation=0,searchId=0,tab='friends',visitors=[],results=[],busy=false,status='connecting';
 let state={links:{},blocks:{},profiles:{},ready:false,connected:false};
 let inertBefore=[];
 const list=$('apus-friends-list'),message=$('apus-friends-message'),form=$('apus-friends-search');
 const label=id=>state.profiles[id]?.name||visitors.find(p=>p.uid===id)?.username||'MONTAÑISTA';
 function notice(value){message.textContent=value;}
 function close(){panel.hidden=true;for(const [el,value]of inertBefore)el.inert=value;inertBefore=[];launch.focus();}
 function open(){panel.hidden=false;window.dispatchEvent(new Event('apus:friends-open'));inertBefore=[...panel.parentElement.children].filter(el=>el!==panel).map(el=>[el,el.inert]);for(const [el]of inertBefore)el.inert=true;render();$('apus-friends-close').focus();}
 const connected=id=>visitors.some(v=>v.uid===id);
 function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
 function button(text,fn){const b=node('button',text,'ref-btn');b.type='button';b.disabled=busy||!state.ready||!state.connected;b.addEventListener('click',fn);return b;}
 function errorText(e){return /permission/i.test(e.code||e.message)?'No se pudo completar. Puede haber cambiado la solicitud o el jugador no admite solicitudes. Actualiza la lista e inténtalo otra vez.':e.message||'No se pudo conectar. Inténtalo de nuevo.';}
 async function action(method,id){
  if(busy||!service)return;
  if(['remove','block'].includes(method)&&state.links[id]?.status==='accepted'&&!window.confirm((method==='block'?'¿Bloquear':'¿Eliminar de tus amigos a')+' '+label(id)+'?'))return;
  if(method==='block'&&state.links[id]?.status!=='accepted'&&!window.confirm('¿Bloquear las solicitudes de '+label(id)+'?'))return;
  const current=service,epoch=generation;busy=true;render();notice('GUARDANDO…');
  try{await current[method](id);if(epoch!==generation)return;notice({send:'SOLICITUD ENVIADA',accept:'AMISTAD ACEPTADA',remove:'SOLICITUD O AMISTAD ELIMINADA',block:'JUGADOR BLOQUEADO PARA SOLICITUDES',unblock:'JUGADOR DESBLOQUEADO'}[method]);}
  catch(e){if(epoch===generation)notice(errorText(e));}
  finally{if(epoch===generation){busy=false;render();}}
 }
 function row(id,name,sub,actions){
  const item=node('li',undefined,'ref-friend-row'),info=node('div',undefined,'ref-friend-info');
  info.append(node('strong',name),node('small',sub+' · ID '+id.slice(-6)));item.append(info);
  const buttons=node('div',undefined,'ref-friend-buttons');for(const [text,method]of actions)buttons.append(button(text,()=>action(method,id)));item.append(buttons);list.append(item);
 }
 function relationActions(id){const rel=state.links[id];return state.blocks[id]?[['DESBLOQUEAR','unblock']]:rel?.status==='accepted'?[['ELIMINAR','remove'],['BLOQUEAR','block']]:rel?.status==='pending'?(rel.sender===uid?[['CANCELAR','remove']]:[['ACEPTAR','accept'],['RECHAZAR','remove'],['BLOQUEAR','block']]):[['AGREGAR','send'],['BLOQUEAR','block']];}
 function render(){
  const received=Object.values(state.links).filter(r=>r.status==='pending'&&r.sender!==uid).length;
  launch.textContent='👥 AMIGOS'+(received?' ('+received+')':'');
  $('apus-friends-received').textContent='RECIBIDAS'+(received?' ('+received+')':'');
  if(panel.hidden)return;
  for(const b of panel.querySelectorAll('[data-friend-tab]'))b.setAttribute('aria-pressed',String(b.dataset.friendTab===tab));
  form.hidden=tab!=='search';form.querySelector('button').disabled=busy||!state.ready||!state.connected;
  list.replaceChildren();
  if(!state.ready||!state.connected){list.append(node('li',status==='denied'?'Amigos aún no está activado. Falta publicar las reglas de amigos en Firebase.':status==='error'?'No se pudo conectar. Sal del Refugio y vuelve a entrar para reintentar.':status==='offline'?'Sin conexión. Tus amistades guardadas se cargarán al reconectarte.':'Conectando con tus amigos…'));return;}
  if(tab==='search'){
   for(const p of results)row(p.uid,p.name,connected(p.uid)?'EN EL REFUGIO':'NO ESTÁ EN EL REFUGIO',relationActions(p.uid));
   if(!results.length)list.append(node('li','Busca el nombre completo de la cuenta. El jugador debe haber abierto el Refugio con esta versión.'));
   return;
  }
  if(tab==='nearby'){
   for(const p of visitors.filter(p=>!state.blocks[p.uid]))row(p.uid,p.username,'EN EL REFUGIO',relationActions(p.uid));
  }else if(tab==='blocked'){
   for(const id of Object.keys(state.blocks))row(id,label(id),'SOLICITUDES BLOQUEADAS',[['DESBLOQUEAR','unblock']]);
  }else{
   const entries=Object.entries(state.links).filter(([id,r])=>!state.blocks[id]&&(tab==='friends'?r.status==='accepted':r.status==='pending'&&(tab==='received'?r.sender!==uid:r.sender===uid)));
   entries.sort((a,b)=>Number(connected(b[0]))-Number(connected(a[0])));
   for(const [id]of entries)row(id,label(id),connected(id)?'EN EL REFUGIO':'NO ESTÁ EN EL REFUGIO',relationActions(id));
  }
  if(!list.children.length)list.append(node('li',{friends:'Todavía no tienes amigos. Busca una cuenta o agrega a alguien desde «En el Refugio».',received:'No tienes solicitudes recibidas.',sent:'No tienes solicitudes enviadas.',nearby:'No hay otros jugadores en el Refugio ahora.',blocked:'No tienes jugadores bloqueados.'}[tab]));
 }
 function disconnect(){
  generation++;searchId++;service?.stop();service=null;uid='';busy=false;visitors=[];results=[];
  state={links:{},blocks:{},profiles:{},ready:false,connected:false};status='connecting';if(!panel.hidden)close();notice('');render();
 }
 function connect(options){
  if(service&&uid===options.uid)return;
  disconnect();uid=options.uid;const epoch=generation;
  service=window.ApusFriends.create({...options,onChange:s=>{if(epoch===generation){state=s;render();}},onStatus:s=>{if(epoch===generation){status=s;render();}}});
 }
 launch.addEventListener('click',open);$('apus-friends-close').addEventListener('click',close);
 for(const b of panel.querySelectorAll('[data-friend-tab]'))b.addEventListener('click',()=>{tab=b.dataset.friendTab;notice('');render();});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!service||busy)return;const epoch=generation,id=++searchId;busy=true;render();notice('BUSCANDO…');
  try{const found=await service.search($('apus-friends-name').value);if(epoch!==generation||id!==searchId)return;results=found;notice(found.length?found.length+' RESULTADO(S)':'No encontrado. Comprueba el nombre completo y que esa cuenta haya abierto el Refugio actualizado.');}
  catch(e){if(epoch===generation)notice(errorText(e));}
  finally{if(epoch===generation&&id===searchId){busy=false;render();}}
 });
 panel.addEventListener('keydown',e=>{
  e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}
  if(e.key==='Tab'){const focusable=[...panel.querySelectorAll('button:not([disabled]),input')].filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 });
 window.ApusFriendsUI={connect,disconnect,get isOpen(){return !panel.hidden;},setVisitors(list){const next=list.map(p=>({uid:p.uid,username:p.username}));if(JSON.stringify(next)!==JSON.stringify(visitors)){visitors=next;render();}}};
})();
