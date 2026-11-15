/* Tablón de salidas Apus. Tres anuncios por cuenta, sin tocar perfiles ni rankings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApusBoard=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const PATH='apusBoard/v1',DAY=86400000;
 function whatsapp(value){
  if(!String(value||'').trim())return '';
  let u;try{u=new URL(String(value).trim());}catch(e){throw Error('Pega un enlace de invitación de grupo de WhatsApp válido.');}
  if(u.protocol!=='https:'||u.hostname!=='chat.whatsapp.com'||u.port||u.username||u.password||!/^\/[A-Za-z0-9]{10,128}$/.test(u.pathname))throw Error('Usa un enlace de grupo que comience por https://chat.whatsapp.com/');
  return u.origin+u.pathname;
 }
 function clean(input,now){
  const field=(key,min,max)=>{const v=String(input[key]||'').trim();if(v.length<min||v.length>max)throw Error('Revisa '+({mountain:'el destino (3–80 caracteres)',meeting:'el punto de encuentro (3–160)',details:'la descripción (10–1000)'}[key]||key)+'.');return v;};
  const startAt=Number(input.startAt);
  if(!Number.isInteger(startAt)||startAt<=now+60000||startAt>now+180*DAY)throw Error('Elige una salida futura, dentro de los próximos 180 días.');
  if(!['baja','media','alta','tecnica'].includes(input.difficulty))throw Error('Selecciona la dificultad.');
  return {mountain:field('mountain',3,80),meeting:field('meeting',3,160),details:field('details',10,1000),difficulty:input.difficulty,whatsapp:whatsapp(input.whatsapp),startAt,expiresAt:startAt+DAY};
 }
 function fromEcuador(date,time){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error('Completa fecha y hora.');const value=Date.parse(date+'T'+time+':00-05:00');if(!Number.isFinite(value)||new Date(value-5*3600000).toISOString().slice(0,16)!==date+'T'+time)throw Error('Fecha u hora no válida.');return value;}
 function create({db,uid,username,serverTimestamp,onChange=()=>{},onStatus=()=>{},now=Date.now,setInterval:interval=setInterval,clearInterval:clear=clearInterval}){
  let stopped=false,connected=false,offset=0,posts={},mine={},hidden={},feed=null,timer=null;
  const base=db.ref(PATH),watchers=[];
  const clock=()=>now()+offset;
  function emit(){if(stopped)return;onChange({connected,now:clock(),posts:Object.entries(posts).filter(([id,p])=>p.expiresAt>clock()&&hidden[id]!==p.updatedAt).map(([id,p])=>({id,...p})).sort((a,b)=>a.startAt-b.startAt),mine:Object.entries(mine).map(([id,p])=>({id,...p})).sort((a,b)=>a.startAt-b.startAt)});}
  function fail(e){if(!stopped)onStatus(/permission/i.test(e.code||e.message)?'denied':'error');}
  function watch(ref,fn){const handler=s=>{if(!stopped)fn(s.val());};ref.on('value',handler,fail);watchers.push([ref,handler]);return handler;}
  function refresh(){if(stopped)return;if(feed){feed.ref.off('value',feed.fn);feed=null;}const ref=base.child('posts').orderByChild('expiresAt').startAt(clock()).limitToFirst(100);const fn=s=>{if(stopped)return;posts=s.val()||{};emit();};ref.on('value',fn,fail);feed={ref,fn};}
  watch(db.ref('.info/serverTimeOffset'),v=>{offset=Number(v)||0;refresh();});
  watch(db.ref('.info/connected'),v=>{connected=!!v;if(!stopped)onStatus(connected?'ready':'offline');emit();});
  for(let slot=0;slot<3;slot++){const id=uid+'_'+slot;watch(base.child('posts/'+id),v=>{if(v)mine[id]=v;else delete mine[id];emit();});}
  watch(base.child('hidden/'+uid),v=>{hidden=v||{};emit();});
  refresh();timer=interval(()=>{emit();refresh();},60000);
  function check(){if(stopped||!connected)throw Error('Necesitas conexión para guardar cambios en el tablón.');}
  async function save(input,id){
   check();const content=clean(input,clock());
   if(id&&!Array.from({length:3},(_,i)=>uid+'_'+i).includes(id))throw Error('No puedes editar esta publicación.');
   if(!id)id=Array.from({length:3},(_,i)=>uid+'_'+i).find(id=>!mine[id]||mine[id].expiresAt<=clock());
   if(!id)throw Error('Ya tienes tres salidas publicadas. Edita o elimina una antes de crear otra.');
   const revision=input.revision??mine[id]?.updatedAt;
   const result=await base.child('posts/'+id).transaction(old=>{
    if(old?.updatedAt!==revision)return;
    return {owner:uid,organizer:String(username||'MONTAÑISTA').slice(0,24),...content,createdAt:old?.createdAt||serverTimestamp,updatedAt:serverTimestamp};
   },undefined,false);
   if(!result.committed)throw Error('La publicación cambió desde otro dispositivo. Vuelve a abrirla antes de guardar.');
   return id;
  }
  async function remove(id){check();if(!Array.from({length:3},(_,i)=>uid+'_'+i).includes(id))throw Error('No puedes eliminar esta publicación.');await base.child('posts/'+id).remove();}
  async function report(id,reason){check();const post=posts[id];if(!post||post.owner===uid)throw Error('Esta publicación ya no está disponible para reportar.');if(!['spam','contenido','enlace','otro'].includes(reason))throw Error('Selecciona el motivo.');
   await base.update({['reports/'+id+'/'+uid]:{reason,reportedAt:serverTimestamp,postUpdatedAt:post.updatedAt,owner:post.owner,mountain:post.mountain,details:post.details,whatsapp:post.whatsapp},['hidden/'+uid+'/'+id]:post.updatedAt});
  }
  function stop(){stopped=true;for(const [ref,fn]of watchers)ref.off('value',fn);if(feed)feed.ref.off('value',feed.fn);if(timer)clear(timer);}
  return {save,remove,report,refresh,stop};
 }
 return {PATH,DAY,whatsapp,clean,fromEcuador,create};
});
