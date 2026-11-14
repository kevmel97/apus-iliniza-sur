/* Amigos Apus: relaciones recíprocas validadas por Realtime Database. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApusFriends=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const PATH='apusSocial/v1';
 function create({db,uid,username,serverTimestamp,onChange=()=>{},onStatus=()=>{}}){
  let stopped=false,ready=false,connected=false,links={},blocks={},profiles={},revision=0;
  const watchers=[];
  const base=db.ref(PATH);
  const name=String(username||'').trim().slice(0,24);
  function status(value){if(!stopped)onStatus(value);}
  function emit(){if(!stopped)onChange({links:{...links},blocks:{...blocks},profiles:{...profiles},ready,connected});}
  function watch(ref,callback){const handler=s=>{if(!stopped)callback(s.val());};ref.on('value',handler,e=>{ready=false;status(/permission/i.test(e.code||e.message)?'denied':'error');emit();});watchers.push([ref,handler]);}
  async function loadNames(ids){
   const generation=revision;
   await Promise.all(ids.filter(id=>!profiles[id]).map(async id=>{try{const s=await base.child('profiles/'+id).once('value');if(!stopped&&generation===revision)profiles[id]=s.val()||{name:'MONTAÑISTA'};}catch(_){}}));
   emit();
  }
  const init=(async()=>{
   try{
    if(name.length<3)throw Error('Nombre de cuenta no disponible');
    await base.child('profiles/'+uid).set({name,searchName:name.toLowerCase()});
    if(stopped)return;
    profiles[uid]={name};
    watch(db.ref('.info/connected'),v=>{connected=!!v;status(connected?'ready':'offline');emit();});
    let loaded=0;
    const loadedOnce={};
    function receive(key,value){if(key==='links')links=value||{};else blocks=value||{};
     if(!loadedOnce[key]){loadedOnce[key]=true;loaded++;}ready=loaded===2;
     emit();loadNames(Object.keys(value||{}));
    }
    watch(base.child('links/'+uid),v=>receive('links',v));
    watch(base.child('blocks/'+uid),v=>receive('blocks',v));
   }catch(e){status(/permission/i.test(e.code||e.message)?'denied':'error');}
  })();
  function check(other){if(stopped||!ready||!connected)throw Error('Conéctate para gestionar tus amigos.');if(!other||other===uid||/[.#$\[\]/]/.test(other))throw Error('Jugador no válido.');}
  function pair(other,value){return {[`links/${uid}/${other}`]:value,[`links/${other}/${uid}`]:value};}
  async function search(value){
   if(stopped||!ready||!connected)throw Error('Conéctate para buscar jugadores.');
   const query=String(value).trim().toLowerCase();if(query.length<3||query.length>24)throw Error('Escribe el nombre completo (3 a 24 caracteres).');
   const s=await base.child('profiles').orderByChild('searchName').equalTo(query).limitToFirst(20).once('value');
   if(stopped)return [];
   const result=Object.entries(s.val()||{}).filter(([id])=>id!==uid).map(([id,p])=>({uid:id,name:p.name}));
   for(const p of result)profiles[p.uid]={name:p.name};emit();return result;
  }
  async function send(other){check(other);if(blocks[other])throw Error('Desbloquea primero a este jugador.');if(links[other])throw Error('Ya existe una solicitud o amistad con este jugador.');await base.update(pair(other,{sender:uid,status:'pending',updatedAt:serverTimestamp}));}
  async function accept(other){check(other);const rel=links[other];if(rel?.status!=='pending'||rel.sender===uid)throw Error('Esta solicitud ya no está pendiente.');await base.update(pair(other,{sender:rel.sender,status:'accepted',updatedAt:serverTimestamp}));}
  async function remove(other){check(other);await base.update(pair(other,null));}
  async function block(other){check(other);await base.update({...pair(other,null),[`blocks/${uid}/${other}`]:true});}
  async function unblock(other){check(other);await base.child(`blocks/${uid}/${other}`).remove();}
  function stop(){stopped=true;revision++;for(const [ref,fn]of watchers)ref.off('value',fn);watchers.length=0;links={};blocks={};profiles={};ready=false;}
  return {init,search,send,accept,remove,block,unblock,stop};
 }
 return {create,PATH};
});
