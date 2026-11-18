/* APUS 32.0.20: controles de audio/configuración dentro de cada interfaz;
   restauración voluntaria del puntaje histórico local, sin mezclar cuentas. */
(function(){
  'use strict';
  const bar=document.getElementById('top-bar');
  const game=document.getElementById('game-container');
  const menuOverlay=document.getElementById('menu-overlay');
  const menuBox=menuOverlay?.querySelector('.retro-box');
  const refuge=document.getElementById('apus-refugio-overlay');
  if(bar&&game&&menuOverlay&&menuBox&&refuge){
    const originalNext=menuOverlay;
    function dockBar(){
      const target=refuge.classList.contains('active')?refuge:
        menuOverlay.classList.contains('active')?menuBox:game;
      if(bar.parentNode!==target){
        if(target===game)game.insertBefore(bar,originalNext);
        else target.insertBefore(bar,target.firstChild);
      }
      bar.classList.toggle('apus-controls-in-menu',target===menuBox);
      bar.classList.toggle('apus-controls-in-refuge',target===refuge);
    }
    const watcher=new MutationObserver(dockBar);
    watcher.observe(menuOverlay,{attributes:true,attributeFilter:['class']});
    watcher.observe(refuge,{attributes:true,attributeFilter:['class']});
    dockBar();
  }

  // El total oficial sigue siendo apusFrikiRankings/{uid}. No migrar datos
  // locales sin una decisión de la cuenta que está iniciada en el dispositivo.
  const own=document.getElementById('friki-ranking-my-score');
  const restore=document.getElementById('friki-legacy-restore');
  if(!own||!restore)return;
  let busy=false;
  function account(){try{return typeof currentUser==='object'?currentUser:null;}catch(_){return null;}}
  function legacy(){try{return typeof frikiLegacyLocalScore==='function'?frikiLegacyLocalScore():0;}catch(_){return 0;}}
  function displayedCloudScore(){
    const match=own.textContent.match(/confirmada:\s*([\d.,]+)/i);
    if(!match)return null;
    const n=Number(match[1].replace(/\D/g,''));
    return Number.isSafeInteger(n)&&n>=0?n:null;
  }
  function showRestore(){
    const user=account();
    const score=displayedCloudScore();
    const historic=legacy();
    const eligible=!busy&&!!user?.uid&&own.style.display!=='none'&&score!==null&&historic>score;
    restore.hidden=!eligible;
    if(eligible){
      restore.textContent='📜 RECUPERAR HISTÓRICO DE ESTE DISPOSITIVO ('+historic.toLocaleString('es-EC')+' PTS)';
      restore.title='Solo si este histórico corresponde a la cuenta iniciada.';
    }
  }
  const observer=new MutationObserver(showRestore);
  observer.observe(own,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style']});
  document.addEventListener('apus:auth-logout',()=>{restore.hidden=true;});
  showRestore();

  restore.addEventListener('click',async()=>{
    const user=account();
    const uid=user?.uid,name=String(user?.username||'MONTAÑISTA').slice(0,24);
    const historic=legacy(),shown=displayedCloudScore();
    if(busy||!uid||shown===null||historic<=shown)return;
    const yes=window.confirm(
      'RECUPERACIÓN HISTÓRICA DE FRIKI APUS\n\n'+
      'Cuenta actual: '+name+'\n'+
      'Histórico de ESTE dispositivo: '+historic.toLocaleString('es-EC')+' puntos.\n\n'+
      'El historial antiguo no guarda el UID: puede pertenecer a otra cuenta que utilizó este dispositivo.\n'+
      'Confirma SOLO si estos puntos fueron obtenidos por '+name+'.\n\n'+
      'Se conservará el MAYOR TOTAL, sin sumar ambos puntajes. ¿Continuar?'
    );
    if(!yes)return;
    busy=true;restore.disabled=true;restore.hidden=true;
    try{
      if(typeof cloudAvailable!=='function'||!cloudAvailable())throw Error('Necesitas conexión a Firebase.');
      if(typeof frikiRefreshAccountScore!=='function'||typeof frikiReadPending!=='function')throw Error('No se encuentra el módulo de puntuaciones.');
      const official=await frikiRefreshAccountScore(); // incluye sincronización previa
      if(account()?.uid!==uid)throw Error('Cambió la cuenta. No se restauró nada.');
      if(frikiReadPending(uid).length)throw Error('Aún hay partidas pendientes. Sincronízalas antes de restaurar.');
      const ref=apusFirebaseDb.collection('apusFrikiRankings').doc(uid);
      const confirmed=await apusFirebaseDb.runTransaction(async(tx)=>{
        const snap=await tx.get(ref);
        const doc=snap.exists?snap.data():{};
        const before=Number(doc.score)||0;
        const after=Math.max(before,Number(official)||0,historic);
        if(after>before){
          tx.set(ref,{uid,name,score:after,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
        }
        return after;
      });
      if(account()?.uid!==uid)return;
      if(typeof frikiStoreVerified==='function')frikiStoreVerified(uid,confirmed);
      if(typeof frikiPushAccountScore==='function')frikiPushAccountScore(uid,confirmed,'historico-confirmado');
      await frikiRefreshAccountScore();
      if(typeof loadFrikiRanking==='function')await loadFrikiRanking();
      window.alert('Puntaje único actualizado: '+confirmed.toLocaleString('es-EC')+' puntos. Ya se refleja en el ranking global y en Friki Apus.');
    }catch(err){
      console.warn('[APUS FRIKI] Histórico sin restaurar:',err);
      window.alert('No se modificó el puntaje: '+String(err?.message||err));
    }finally{busy=false;restore.disabled=false;showRestore();}
  });
})();
