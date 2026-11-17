(function(root){'use strict';
 const PATH='apusVoice/v1/calls';
 function friends(links,blocks,id){return !!id&&links?.[id]?.status==='accepted'&&!blocks?.[id];}
 function validOffer(v,from,to,now){return !!v&&v.from===from&&v.to===to&&typeof v.id==='string'&&v.id.length<=80&&Number.isFinite(v.createdAt)&&v.createdAt<=now+10000&&now-v.createdAt<60000&&v.offer?.type==='offer'&&typeof v.offer.sdp==='string'&&v.offer.sdp.length<=24000;}
 function create({db,uid,onFriends=()=>{},onIncoming=()=>{},onNetwork=()=>{},onError=()=>{}}){
  let links={},blocks={},stopped=false;const watchers=[];
  function watch(ref,fn){const h=s=>{if(!stopped)fn(s.val());};ref.on('value',h,onError);watchers.push([ref,h]);}
  watch(db.ref('apusSocial/v1/links/'+uid),v=>{links=v||{};onFriends(links,blocks);});
  watch(db.ref('apusSocial/v1/blocks/'+uid),v=>{blocks=v||{};onFriends(links,blocks);});
  watch(db.ref('.info/connected'),v=>onNetwork(v===true));
  watch(db.ref(PATH+'/'+uid),v=>onIncoming(v||{}));
  return {canCall:id=>friends(links,blocks,id),ref:(to,from,id)=>db.ref(PATH+'/'+to+'/'+from+'/'+id),stop(){stopped=true;for(const[r,h]of watchers)r.off('value',h);}};
 }
 const api={PATH,friends,validOffer,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.ApusVoicePolicy=api;
})(typeof window!=='undefined'?window:globalThis);
