/* Refugio Apus: presencia efímera, sin partidas ni datos privados. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ApusRefugioPresence=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const PATH='apusRefugio/v1/rooms/base/members';
  const colors=['hairColor','helmetColor','glassesColor','jacketColor','pantsColor','packColor','harnessColor','bootsColor'];
  const defaults={name:'MONTAÑISTA',gender:'M',skin:'MESTIZO',hairLength:'CORTO',expression:'FELIZ',helmetBrand:'PETZL',axeBrand:'PETZL',hasGlasses:true,beardStyle:0};
  const enums={gender:['M','F'],skin:['BLANCO','MESTIZO','NEGRO'],hairLength:['CALVO','CORTO','MEDIO','LARGO'],expression:['NORMAL','FELIZ','SERIA','ENOJADA'],helmetBrand:['PETZL','BD','SIMOND','SINGING_ROCK','EDELRID','GRIVEL'],axeBrand:['PETZL','BD','SIMOND','SINGING_ROCK','EDELRID','GRIVEL','POLICE']};
  function cleanText(v,max,fallback){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max)||fallback:fallback;}
  function avatar(input){
    const a=input||{},out={...defaults,name:cleanText(a.name,18,'MONTAÑISTA')};
    for(const k of Object.keys(enums))if(enums[k].includes(a[k]))out[k]=a[k];
    for(const k of colors)out[k]=typeof a[k]==='string'&&/^#[a-f0-9]{6}$/i.test(a[k])?a[k]:'#f7931e';
    out.hasGlasses=a.hasGlasses===true;out.beardStyle=Number.isInteger(a.beardStyle)&&a.beardStyle>=0&&a.beardStyle<=4?a.beardStyle:0;
    return out;
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
  function state(input){const s=input||{};return {x:Math.round(clamp(s.x,38,922)),y:Math.round(clamp(s.y,302,570)),facing:s.facing===-1?-1:1,moving:s.moving===true,avatar:avatar(s.avatar)};}
  function roster(raw,ownUid,now){
    const list=[];
    for(const [uid,sessions] of Object.entries(raw||{})){
      if(uid===ownUid||!sessions||typeof sessions!=='object')continue;
      let latest=null;
      for(const [sessionId,data] of Object.entries(sessions)){
        if(!data||data.schema!==1||!Number.isFinite(data.updatedAt)||now-data.updatedAt>45000||data.updatedAt>now+10000)continue;
        if(!latest||data.updatedAt>latest.updatedAt)latest={uid,sessionId,...state(data),username:cleanText(data.username,24,'MONTAÑISTA'),updatedAt:data.updatedAt};
      }
      if(latest)list.push(latest);
    }
    return list;
  }
  function create(options){
    const {db,uid,username,getState,onRoster=()=>{},onStatus=()=>{},serverTimestamp}=options;
    const now=options.now||Date.now,schedule=options.setInterval||setInterval,cancel=options.clearInterval||clearInterval;
    let stopped=false,connected=false,published=false,epoch=0,session=null,pending=false,lastWrite=0,lastBody='',raw={},offset=0,blocked=false,retryAt=0;
    const members=db.ref(PATH),connection=db.ref('.info/connected'),clock=db.ref('.info/serverTimeOffset');
    const report=()=>onRoster(connected&&published?roster(raw,uid,now()+offset):[]);
    const status=(v)=>onStatus(v);
    function failure(error){if(stopped)return;published=false;onRoster([]);blocked=!!(error&&/permission/i.test(error.code||error.message||''));retryAt=now()+5000;status(blocked?'denied':'error');}
    async function write(force){
      if(stopped||blocked||now()<retryAt||!connected||!session||pending)return;
      const body=state(getState()),signature=JSON.stringify(body),time=now();
      if(!force&&time-lastWrite<250)return;
      if(!force&&signature===lastBody&&time-lastWrite<20000)return;
      pending=true;const ref=session,token=epoch;
      try{
        await ref.set({schema:1,username:cleanText(username,24,'MONTAÑISTA'),...body,updatedAt:serverTimestamp});
        if(stopped||token!==epoch){ref.remove().catch(()=>{});return;}
        lastWrite=now();lastBody=signature;published=true;status('online');report();
      }catch(error){if(token===epoch)failure(error);}
      finally{if(token===epoch)pending=false;}
    }
    async function connect(snapshot){
      if(stopped)return;blocked=false;retryAt=0;
      const token=++epoch;connected=snapshot.val()===true;published=false;pending=false;onRoster([]);
      if(!connected){session=null;status('offline');return;}
      status('connecting');const ref=members.child(uid).push();session=ref;
      try{
        // Registrar la limpieza EN EL SERVIDOR antes de anunciar al jugador.
        await ref.onDisconnect().remove();
        if(stopped||token!==epoch){ref.remove().catch(()=>{});return;}
        lastWrite=0;lastBody='';await write(true);
      }catch(error){if(token===epoch)failure(error);}
    }
    function receive(snapshot){raw=snapshot.val()||{};report();}
    function clockChanged(snapshot){offset=Number(snapshot.val())||0;}
    members.on('value',receive,failure);clock.on('value',clockChanged);connection.on('value',connect,failure);
    const timer=schedule(()=>{report();write(false);},250);
    return {update:()=>write(false),stop(){
      if(stopped)return;stopped=true;epoch++;cancel(timer);
      connection.off('value',connect);clock.off('value',clockChanged);members.off('value',receive);
      const ref=session;session=null;connected=false;published=false;
      if(ref)ref.remove().catch(()=>{}); // onDisconnect sigue como respaldo si falla el cierre.
      onRoster([]);status('offline');
    }};
  }
  let sdkPromise=null;
  function loadSDK(){
    if(window.firebase?.database)return Promise.resolve();
    if(sdkPromise)return sdkPromise;
    sdkPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://www.gstatic.com/firebasejs/11.6.1/firebase-database-compat.js';
      const timer=setTimeout(()=>{script.remove();reject(new Error('Tiempo de conexión agotado'));},12000);
      script.onload=()=>{clearTimeout(timer);window.firebase?.database?resolve():reject(new Error('SDK no disponible'));};
      script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('No se pudo cargar la conexión'));};document.head.appendChild(script);
    }).catch(e=>{sdkPromise=null;throw e;});return sdkPromise;
  }
  return {create,avatar,state,roster,loadSDK,PATH};
});
