/* APUS GUARDIANS · REFUGIO APUS v32.0.0 (FASE 1)
 * Sala de exploración 2.5D pixel art. SIN lecturas/escrituras sociales en Firebase.
 * Reutiliza solo la sesión, el creador y las tres ranuras YA existentes.
 * Las reuniones, presencia, tablón real y amigos se agregan en fases posteriores.
 */
(function(){
  'use strict';
  const root=document.getElementById('apus-refugio-overlay');
  const canvas=document.getElementById('apus-refugio-canvas');
  if(!root||!canvas)return;
  const ctx=canvas.getContext('2d',{alpha:false});
  const W=960,H=560;
  let active=false,frameId=0,lastTick=0,player={x:490,y:435,tx:490,ty:435},walking=0;
  let cameraX=0,logicalViewW=W,renderScale=1,activeSlot=0,uid='',isEditing=false;
  let toastTimeout=0,rafOn=false,zoneToWalk=null;
  const buttons=Array.from(root.querySelectorAll('[data-ref-zone]'));
  const places={
    anuncios:{title:'🔥 FOGATA Y TABLÓN',message:'Aquí estarán las salidas a la montaña, publicadas por los miembros con sus enlaces de WhatsApp. Publicaciones online: próxima fase.',x:488,y:346,px:488,py:430},
    reunion:{title:'🏕️ CABAÑA DE REUNIONES',message:'Esta cabaña tendrá una sala pública o privada con código de 4 dígitos, hasta 16 participantes y límites semanales. Videollamadas: próxima fase.',x:796,y:198,px:796,py:352},
    carpas:{title:'⛺ ZONA DE CARPAS',message:'Descansa, explora el refugio y encuentra a tus compañeros. Amigos y jugadores conectados llegarán en la próxima fase.',x:184,y:376,px:194,py:449},
    vestuario:{title:'🧥 STAND DE EQUIPAMIENTO',message:'Elige con cuál de tus tres personajes aparecerás en el Refugio, o personaliza su equipo existente.',x:751,y:395,px:752,py:467}
  };
  const safeRect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(arr,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(...arr[0]);for(let i=1;i<arr.length;i++)ctx.lineTo(...arr[i]);ctx.closePath();ctx.fill();};
  const line=(points,col,width=4)=>{ctx.strokeStyle=col;ctx.lineWidth=width;ctx.lineJoin='miter';ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.stroke();};
  const font=(size=10)=>`${size}px "Press Start 2P",monospace`;
  const txt=(t,x,y,color='#fff',sz=10,align='center')=>{ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=font(sz);ctx.lineWidth=3;ctx.strokeStyle='#0a1c30';ctx.strokeText(t,x,y);ctx.fillStyle=color;ctx.fillText(t,x,y)};
  const rand=(n)=>{const x=Math.sin(n*97.123+4.56)*43812.123;return x-Math.floor(x);};
  let backdrop=null;
  function pine(x,y,s=1){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    safeRect(-6,0,12,30,'#5d382b');
    poly([[-28,10],[0,-64],[28,10]],'#0e554f');
    poly([[-23,-20],[0,-86],[23,-20]],'#147264');
    poly([[-16,-45],[0,-100],[16,-45]],'#1d8978');
    poly([[-13,-47],[0,-93],[12,-47]],'#e5f3ef');
    safeRect(-27,9,54,5,'#c8dfe5');ctx.restore();
  }
  function mountain(x,y,s,col,snow=true){
    poly([[x-s,y],[x,y-s*.98],[x+s,y]],col);
    if(snow)poly([[x-s*.30,y-s*.69],[x,y-s*.98],[x+s*.25,y-s*.74],[x+s*.12,y-s*.76],[x,y-s*.63],[x-s*.14,y-s*.79]],'#edf8f4');
  }
  function signboard(x,y,w,h,text){
    safeRect(x-5,y+5,w+10,h+7,'#372a2e');safeRect(x,y,w,h,'#925d35');safeRect(x+5,y+5,w-10,h-10,'#e8c17a');
    safeRect(x+6,y+h,w-12,9,'#69442f');txt(text,x+w/2,y+h/2+1,'#543924',9);
  }
  function lodge(){
    // Refugio de piedra, al fondo izquierdo.
    safeRect(80,199,305,116,'#34495c');safeRect(86,213,292,97,'#9a7765');
    poly([[56,200],[214,94],[408,200]],'#263449');poly([[78,186],[215,111],[387,186]],'#d8e9ec');
    poly([[94,177],[215,121],[367,177]],'#87534b');
    for(let i=0;i<13;i++){safeRect(85+i*22,228+(i%2)*19,20,3,'#bfa497');safeRect(93+i*22,266+(i%3)*10,14,3,'#5e4c4f');}
    safeRect(131,227,57,43,'#1b344c');safeRect(138,234,43,28,'#f6c76c');safeRect(207,229,50,86,'#3b2630');safeRect(213,238,38,69,'#755b47');
    safeRect(287,227,60,47,'#1b344c');safeRect(295,237,45,28,'#eec96e');
    safeRect(203,314,65,10,'#c9ac8e');
    signboard(156,164,125,27,'REFUGIO APUS');
    safeRect(94,302,281,6,'#584742');
  }
  function cabin(){
    safeRect(692,183,212,137,'#734a3a');
    for(let i=0;i<10;i++)safeRect(697,193+i*12,204,3,'#a47650');
    poly([[677,187],[792,111],[925,187]],'#302e43');
    poly([[697,177],[793,126],[908,177]],'#e4f2f2');
    safeRect(771,239,57,80,'#382a34');safeRect(779,250,43,66,'#b57d50');safeRect(813,282,5,5,'#f8d47b');
    safeRect(714,222,39,38,'#182f45');safeRect(721,229,25,23,'#ffd57a');
    safeRect(844,223,39,38,'#182f45');safeRect(852,230,24,24,'#ffd57a');
    signboard(740,186,119,27,'REUNIONES');
    safeRect(757,317,83,7,'#c4b1a0');
  }
  function tent(x,y,color,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    poly([[-72,18],[0,-80],[74,18]],'#102f44');poly([[-59,11],[0,-65],[59,11]],color);
    poly([[-8,10],[0,-51],[33,10]],'#183f56');poly([[-45,11],[0,-64],[-8,10]],'#ffffff33');
    safeRect(-78,18,154,7,'#dfe7de');safeRect(-72,23,8,13,'#8ea1a1');safeRect(67,23,8,13,'#8ea1a1');
    ctx.restore();}
  function stand(){
    // Exhibidor con cascos y chaquetas para elegir avatar.
    safeRect(683,362,178,96,'#744d41');safeRect(687,375,168,78,'#dca877');
    poly([[668,368],[713,324],[839,324],[877,368]],'#375d6c');
    for(let i=0;i<8;i++)safeRect(682+i*24,349,15,21,i%2?'#e0f0ee':'#f0a44c');
    safeRect(708,385,128,7,'#422d2f');
    ['#ee8e3d','#17a4a0','#9d74c9'].forEach((c,i)=>{
      const x=722+i*41;
      safeRect(x,391,21,25,c);safeRect(x-5,392,5,11,c);safeRect(x+21,392,5,11,c);
      safeRect(x+4,380,13,8,i===0?'#ffd15e':'#e0e9f4');
    });
    signboard(713,335,117,22,'VESTUARIO');
    safeRect(685,458,179,7,'#80513d');
  }
  function fire(t){
    // Fogata central y piedras alrededor.
    safeRect(420,360,130,14,'#6b5d55');
    for(let i=0;i<13;i++){const a=i*2*Math.PI/13;safeRect(482+Math.cos(a)*62-8,361+Math.sin(a)*26-6,16,10,i%2?'#647582':'#adb7bd');}
    line([[445,364],[521,337]],'#603a28',13);line([[450,339],[521,369]],'#8b5030',12);
    const wave=Math.sin(t*.009);
    poly([[467,349],[477,318-wave*8],[479,334],[490,304+wave*7],[501,340],[508,325-wave*5],[511,353]],'#fe852a');
    poly([[481,356],[485,331],[492,336],[495,321],[501,357]],'#ffe27c');
    safeRect(471,358,29,6,'#fee0a9');
    for(let i=0;i<6;i++){const v=((t*.038+i*31)%99);safeRect(461+(i*13)%55,328-v,3,3,i%2?'#ffd26a':'#f59139');}
  }
  function buildBackdrop(){
    const old=ctx.canvas, temp=document.createElement('canvas');temp.width=W;temp.height=H;
    const dc=temp.getContext('2d');
    // Conserva dibujo en canvas, sin copiar recursos de juegos ajenos.
    dc.fillStyle='#15253d';dc.fillRect(0,0,W,H);
    const sky=dc.createLinearGradient(0,0,0,340);sky.addColorStop(0,'#182e55');sky.addColorStop(.65,'#427b90');sky.addColorStop(1,'#e5b795');dc.fillStyle=sky;dc.fillRect(0,0,W,312);
    dc.fillStyle='#f5d5a0';dc.fillRect(480,111,49,38);
    const m=(x,y,s,c)=>{dc.fillStyle=c;dc.beginPath();dc.moveTo(x-s,y);dc.lineTo(x,y-s);dc.lineTo(x+s,y);dc.fill();};
    m(93,300,210,'#294a67');m(369,298,260,'#365777');m(745,302,250,'#294961');m(1010,316,230,'#25415b');
    m(370,299,174,'#567182');m(690,298,143,'#436c7d');
    dc.fillStyle='#e9f7f0';dc.beginPath();dc.moveTo(265,193);dc.lineTo(369,38);dc.lineTo(461,187);dc.lineTo(412,172);dc.lineTo(390,178);dc.lineTo(365,139);dc.lineTo(333,185);dc.fill();
    dc.fillStyle='#e1f0ea';dc.beginPath();dc.moveTo(638,199);dc.lineTo(745,80);dc.lineTo(845,202);dc.lineTo(801,190);dc.lineTo(766,150);dc.lineTo(726,185);dc.fill();
    dc.fillStyle='#365f61';dc.fillRect(0,273,960,56);dc.fillStyle='#72928b';dc.fillRect(0,314,960,246);
    dc.fillStyle='#879d93';dc.beginPath();dc.ellipse(470,434,400,148,0,0,Math.PI*2);dc.fill();
    dc.fillStyle='#d3d2b3';dc.beginPath();dc.ellipse(490,435,292,104,0,0,Math.PI*2);dc.fill();
    dc.fillStyle='#b9b7a0';dc.beginPath();dc.moveTo(472,421);dc.lineTo(390,560);dc.lineTo(615,560);dc.lineTo(514,416);dc.fill();
    for(let i=0;i<130;i++){const x=rand(i+21)*960,y=312+rand(i+190)*246;
      dc.fillStyle=i%4?'#cbd3c2':'#557d6e';dc.fillRect(Math.round(x),Math.round(y),2+Math.round(rand(i+600)*4),2);
    }
    // Pixel art procedimental estático, renderizado solo una vez.
    backdrop=temp;
    return backdrop;
  }
  function drawLandscape(time){
    if(!backdrop)buildBackdrop();ctx.drawImage(backdrop,0,0);
    pine(49,331,1.24);pine(922,335,1.13);pine(428,329,.56);pine(584,340,.65);
    lodge();cabin();tent(167,417,'#d87c43',1);tent(317,445,'#5b96a6',.75);
    stand();
    safeRect(552,398,86,6,'#725038');safeRect(567,409,9,21,'#513e38');safeRect(615,409,9,21,'#513e38');
    safeRect(382,411,55,7,'#71503a');safeRect(386,420,8,19,'#523a31');safeRect(424,420,8,19,'#523a31');
    for(let i=0;i<15;i++){const x=65+i*62,y=514+(i%3)*9;safeRect(x,y,13+(i%3)*5,7,i%2?'#a5b7ad':'#7c958d');}
    fire(time);
    // Señales de interacción, en el mismo mundo del personaje.
    txt('TABLÓN',490,391,'#ffdd83',9);
    txt('CARPAS',206,493,'#eef9fb',8);
  }
  function selectedCfg(){
    if(typeof customCharSlots==='undefined'||!Array.isArray(customCharSlots))return null;
    return customCharSlots[activeSlot]||customCharSlots[0]||null;
  }
  function drawHero(time){
    const cfg=selectedCfg();
    if(typeof drawMountaineerSprite==='function'&&cfg){
      drawMountaineerSprite(ctx,'CUSTOM',player.x,player.y-30,{
        scale:.88,facing:player.tx<player.x?-1:1,anim:walking?time*.032:0,customConfig:cfg
      });
    }else{safeRect(player.x-13,player.y-47,25,42,'#f5aa46');safeRect(player.x-10,player.y-58,20,12,'#ffe0b4');}
    txt((cfg?.name||'MONTANISTA').slice(0,17),player.x,player.y+13,'#fff6d8',8);
    if(walking){ctx.strokeStyle='#fdd682';ctx.lineWidth=2;ctx.strokeRect(player.tx-8,player.ty-6,16,12);}
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
    renderScale=canvas.height/H;logicalViewW=canvas.width/renderScale;
  }
  function frame(t){
    if(!active){rafOn=false;return;}
    if(!rafOn)rafOn=true;
    const dt=Math.min(45,Math.max(0,t-(lastTick||t)));lastTick=t;
    const dx=player.tx-player.x,dy=player.ty-player.y,d=Math.hypot(dx,dy);
    if(d>1.5){const step=Math.min(d,dt*.15);player.x+=dx/d*step;player.y+=dy/d*step;walking=1;}
    else{walking=0;if(zoneToWalk){const z=zoneToWalk;zoneToWalk=null;zoneOpen(z);}}
    const cw=Math.min(W,logicalViewW);
    cameraX=Math.max(0,Math.min(W-cw,player.x-cw/2));
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#14263a';ctx.fillRect(0,0,canvas.width,canvas.height);
    const scale=renderScale;const pad=(canvas.width-W*scale)/2;
    ctx.setTransform(scale,0,0,scale,pad-cameraX*scale,0);
    drawLandscape(t);drawHero(t);
    frameId=requestAnimationFrame(frame);
  }
  function canEnter(){
    return typeof currentUser!=='undefined'&&Boolean(currentUser?.uid);
  }
  function checkSession(){
    if(canEnter())return true;
    alert('🔒 REFUGIO APUS: DEBES INICIAR SESIÓN CON TU CUENTA PARA ENTRAR. EL MODO INVITADO NO TIENE ACCESO.');
    if(typeof openAuthModal==='function')openAuthModal();return false;
  }
  function keySlot(){return 'apus_refugio_avatar_v32_'+uid;}
  function rememberSlot(){try{localStorage.setItem(keySlot(),String(activeSlot));}catch(_){}}
  function setupAvatar(){
    uid=currentUser.uid;
    let stored=0;try{stored=Number(localStorage.getItem(keySlot())||0);}catch(_){}
    activeSlot=[0,1,2].includes(stored)?stored:0;
    const who=document.getElementById('apus-refugio-user');if(who)who.textContent='👤 '+String(currentUser.username||'MONTAÑISTA').slice(0,24);
  }
  function open(){
    if(!checkSession())return;
    setupAvatar();
    player={x:490,y:430,tx:490,ty:430};zoneToWalk=null;
    root.querySelector('#apus-refugio-dialog').hidden=true;
    if(typeof showOverlay==='function')showOverlay('apus-refugio-overlay');
    active=true;lastTick=0;
    resize();if(!rafOn){rafOn=true;frameId=requestAnimationFrame(frame);}
    const info=document.getElementById('apus-refugio-status');if(info)info.textContent=navigator.onLine?'FASE 1 · MAPA DE EXPLORACIÓN':'FASE 1 · EXPLORACIÓN SIN CONEXIÓN';
    window.apusRouteMusic?.();
  }
  function close(){
    active=false;cancelAnimationFrame(frameId);rafOn=false;
    clearTimeout(toastTimeout);zoneToWalk=null;
    if(typeof showOverlay==='function')showOverlay('menu-overlay');
    window.apusRouteMusic?.();
  }
  function showToast(msg){const el=document.getElementById('apus-refugio-toast');el.textContent=msg;el.hidden=false;
    clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{el.hidden=true;},3700);}
  function zoneOpen(zone){
    if(!active)return;
    if(zone==='vestuario')return openWardrobe();
    const item=places[zone];if(!item)return;
    const title=document.getElementById('apus-refugio-dialog-title');const description=document.getElementById('apus-refugio-dialog-desc');
    title.textContent=item.title;description.textContent=item.message;
    document.getElementById('apus-refugio-slots').hidden=true;
    document.getElementById('apus-refugio-edit').hidden=true;
    document.getElementById('apus-refugio-dialog').hidden=false;
  }
  function goZone(z){const item=places[z];if(!item)return;
    player.tx=item.px;player.ty=item.py;zoneToWalk=z;
    // Un clic en los botones inferiores abre el lugar directamente en móvil.
    if(window.innerWidth<730){zoneToWalk=null;zoneOpen(z);}
  }
  function openWardrobe(){
    const title=document.getElementById('apus-refugio-dialog-title');const description=document.getElementById('apus-refugio-dialog-desc');
    title.textContent='🧥 ELIGE TU MONTAÑISTA';description.textContent='Selecciona uno de tus TRES personajes de la cuenta. Los cambios aquí no borran sus diseños.';
    document.getElementById('apus-refugio-slots').hidden=false;
    document.getElementById('apus-refugio-edit').hidden=false;
    const list=document.getElementById('apus-refugio-slots');list.replaceChildren();
    for(let i=0;i<3;i++){
      const config=typeof customCharSlots!=='undefined'?customCharSlots[i]:null;
      const btn=document.createElement('button');btn.type='button';btn.className='ref-slot-card';btn.setAttribute('aria-pressed',String(activeSlot===i));
      const portrait=document.createElement('canvas');portrait.width=86;portrait.height=100;
      const pctx=portrait.getContext('2d');pctx.imageSmoothingEnabled=false;
      if(config&&typeof drawMountaineerSprite==='function')drawMountaineerSprite(pctx,'CUSTOM',43,63,{scale:1.1,customConfig:config});
      const number=document.createElement('strong');number.textContent='PERSONAJE '+(i+1);
      const label=document.createElement('span');label.textContent=(config?.name||'MONTANISTA').slice(0,18);
      btn.append(portrait,number,label);
      btn.addEventListener('click',()=>{
        activeSlot=i;rememberSlot();list.querySelectorAll('.ref-slot-card').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));
        showToast('PERSONAJE '+(i+1)+' SELECCIONADO');
      });list.append(btn);
    }
    document.getElementById('apus-refugio-dialog').hidden=false;
  }
  function editOutfit(){
    if(!canEnter())return;
    isEditing=true;
    document.getElementById('apus-refugio-dialog').hidden=true;
    if(typeof openCustomCreator==='function'){
      // El creador de la base se reutiliza, incluyendo su guardado en Firebase.
      if(typeof switchCreatorSlot==='function')switchCreatorSlot(activeSlot);
      openCustomCreator();
      if(typeof switchCreatorSlot==='function')switchCreatorSlot(activeSlot);
      const back=document.getElementById('apus-refugio-creator-back');if(back)back.hidden=false;
    }
  }
  function afterCreator(){
    if(!isEditing)return;isEditing=false;
    const back=document.getElementById('apus-refugio-creator-back');if(back)back.hidden=true;
    setupAvatar(); // Refresca los personajes después de guardar.
    open();
  }
  const originalSave=typeof window.saveAndUseCustomChar==='function'?window.saveAndUseCustomChar:null;
  if(originalSave)window.saveAndUseCustomChar=async function(...args){
    await originalSave.apply(this,args);
    if(isEditing&&document.getElementById('char-overlay')?.classList.contains('active'))afterCreator();
  };
  canvas.addEventListener('pointerdown',event=>{
    if(!active||!document.getElementById('apus-refugio-dialog').hidden)return;
    const rect=canvas.getBoundingClientRect();const x=(event.clientX-rect.left)*(canvas.width/rect.width)/renderScale+cameraX;
    const y=(event.clientY-rect.top)*(canvas.height/rect.height)/renderScale;
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    // Las zonas responden directamente cuando el jugador las toca.
    for(const [id,p] of Object.entries(places)){
      if(Math.hypot(x-p.x,(y-p.y)*1.10)<id.length*2+75){goZone(id);return;}
    }
    player.tx=Math.max(60,Math.min(900,x));player.ty=Math.max(295,Math.min(510,y));zoneToWalk=null;
  });
  document.getElementById('apus-refugio-close-dialog')?.addEventListener('click',()=>{document.getElementById('apus-refugio-dialog').hidden=true;});
  document.getElementById('apus-refugio-edit')?.addEventListener('click',editOutfit);
  document.getElementById('apus-refugio-creator-back')?.addEventListener('click',afterCreator);
  buttons.forEach(b=>b.addEventListener('click',()=>goZone(b.dataset.refZone)));
  window.addEventListener('keydown',event=>{
    if(!active||!document.getElementById('apus-refugio-dialog').hidden)return;
    const directions={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
    const dir=directions[event.code];if(!dir)return;
    event.preventDefault();zoneToWalk=null;
    player.tx=Math.max(60,Math.min(900,player.x+dir[0]*95));player.ty=Math.max(295,Math.min(510,player.y+dir[1]*75));
  });
  root.querySelectorAll('[data-ref-dir]').forEach(b=>{
    let task=0;
    const move=()=>{if(!active)return;const key=b.dataset.refDir;const delta={up:[0,-32],down:[0,32],left:[-32,0],right:[32,0]}[key];
      player.tx=Math.max(60,Math.min(900,player.tx+delta[0]));player.ty=Math.max(295,Math.min(510,player.ty+delta[1]));zoneToWalk=null;};
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);move();task=setInterval(move,150);});
    const stop=()=>{clearInterval(task);task=0;};b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);
  });
  window.addEventListener('resize',()=>{if(active)resize();});
  // Cierra si la cuenta deja de estar autenticada, sin enganchar listeners ajenos.
  document.addEventListener('apus:auth-logout',()=>{if(active)close();});
  window.openRefugioApus=open;
  window.closeRefugioApus=close;
  window.refugioOpenZone=zoneOpen;
  window.apusRefugioFase1={get active(){return active;},get selectedSlot(){return activeSlot;},get userId(){return uid;}};
})();
