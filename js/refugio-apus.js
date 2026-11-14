/* REFUGIO APUS 32.0.4 · Mundo social en perspectiva 2.5D, CÁMARA FIJA.
   La cámara nunca sigue al jugador: clic/toque y d-pad/teclado desplazan
   únicamente su avatar. Esta fase NO finge usuarios ni reuniones en línea. */
(function () {
  'use strict';
  const root = document.getElementById('apus-refugio-overlay');
  const canvas = document.getElementById('apus-refugio-canvas');
  if (!root || !canvas) return;
  const ctx = canvas.getContext('2d');
  const map=window.ApusRefugioMap;
  let spriteScale=1.04;
  let waypoints=[];
  const project=p=>{const q=map.project(p,scene?.portrait===true);return {x:q.x*(scene?.w||960)/(scene?.portrait?560:960),y:q.y*(scene?.h||600)/(scene?.portrait?720:600)};};
  const unproject=p=>map.unproject({x:p.x*(scene.portrait?560:960)/scene.w,y:p.y*(scene.portrait?720:600)/scene.h},scene.portrait);
  if (!ctx) { console.error('[REFUGIO] Canvas 2D no está disponible'); return; }
  const $ = (id) => document.getElementById(id);
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const zoneInfo = {
    fogata: {
      title:'🔥 FOGATA · SALIDAS A LA MONTAÑA',
      message:'El tablón permitirá publicar salidas grupales, fecha, montaña y enlace a WhatsApp. Las publicaciones online se activarán en una próxima fase.',
      label:'SALIDAS'
    },
    cabana: {
      title:'🏡 CABAÑA DE REUNIONES',
      message:'Aquí estará la única sala de reuniones de Refugio Apus: pública o privada con código de 4 dígitos, máximo 16 participantes. Las llamadas se activarán en una próxima fase.',
      label:'REUNIONES'
    },
    carpas: {
      title:'⛺ ZONA DE CARPAS',
      message:'Encuentra aquí a otros montañistas conectados. Chugo y Jordy, marcados como NPC, son personajes decorativos.',
      label:'CARPAS'
    },
    vestuario: {
      title:'🧥 STAND DE EQUIPAMIENTO',
      message:'Elige uno de tus tres personajes guardados para caminar por el Refugio Apus. También puedes abrir el creador para cambiar su ropa y equipo.',
      label:'VESTUARIO'
    }
  };
  let scene = null;
  let active = false, editorReturn = false, raf = 0, lastFrame = 0;
  let slot = 0, accountId = '', direction = 1;
  let avatar = {x:0,y:0}, target = null, destinationZone = null;
  let keys = Object.create(null),movePressed = Object.create(null);
  let state = {scale:1,offsetX:0,offsetY:0,width:960,height:600,portrait:false};
  let backgroundCanvas = null;
  let lastDrawError = '';
  let noticeTimer = 0;
  let presence=null,presenceLoading=false,presenceGeneration=0,presenceRetryAt=0;
  let remotePlayers=new Map(),presenceState='offline';
  function presenceLabel(value){
    presenceState=value;
    const label=$('apus-refugio-status');if(!label)return;
    const messages={online:'EN LÍNEA · '+(remotePlayers.size+1)+' MONTAÑISTAS',connecting:'CONECTANDO CON EL REFUGIO…',offline:'SIN CONEXIÓN · EXPLORACIÓN LOCAL',denied:'PRESENCIA NO DISPONIBLE · REVISAR PERMISOS',error:'RECONECTANDO…',setup:'EXPLORACIÓN LOCAL · CONEXIÓN SOCIAL PENDIENTE',signin:'INICIA SESIÓN EN LÍNEA PARA VER A OTROS'};
    const valueText=messages[value]||messages.offline;if(label.textContent!==valueText)label.textContent=valueText;
  }
  function stopPresence(){
    presenceGeneration++;presenceLoading=false;
    if(presence)presence.stop();presence=null;remotePlayers.clear();
    presenceLabel('offline');
  }
  function publicState(){return {x:avatar.x,y:avatar.y,facing:direction,moving:!!(target||moving()),avatar:slotConfig()};}
  function updateVisitors(list){
    const next=new Map();
    for(const visitor of list){const old=remotePlayers.get(visitor.uid);next.set(visitor.uid,{...visitor,drawX:old?.drawX??visitor.x,drawY:old?.drawY??visitor.y,lastFrame:old?.lastFrame});}
    remotePlayers=next;presenceLabel(presenceState);
  }
  async function startPresence(){
    if(presence||presenceLoading||!active||document.hidden||Date.now()<presenceRetryAt)return;
    const config=window.APUS_REFUGIO_ONLINE;
    if(!config?.databaseURL){presenceLabel('setup');return;}
    const user=typeof apusFirebaseAuth!=='undefined'?apusFirebaseAuth?.currentUser:null;
    if(!user||user.uid!==accountId){presenceLabel('signin');return;}
    if(!navigator.onLine){presenceLabel('offline');return;}
    presenceLoading=true;const generation=++presenceGeneration;presenceLabel('connecting');
    try{
      await window.ApusRefugioPresence.loadSDK();
      if(generation!==presenceGeneration||!active||document.hidden)return;
      if(apusFirebaseAuth.currentUser?.uid!==accountId)return;
      const db=firebase.app().database(config.databaseURL);
      presence=window.ApusRefugioPresence.create({db,uid:accountId,username:currentUser.username,getState:publicState,
        serverTimestamp:firebase.database.ServerValue.TIMESTAMP,onRoster:updateVisitors,onStatus:presenceLabel});
    }catch(error){if(generation===presenceGeneration){console.warn('[REFUGIO] Conexión:',error);presenceRetryAt=Date.now()+10000;presenceLabel('error');}}
    finally{if(generation===presenceGeneration)presenceLoading=false;}
  }
  function maintainPresence(){
    if(document.hidden){if(presence||presenceLoading)stopPresence();return;}
    if(presence&&(typeof apusFirebaseAuth==='undefined'||apusFirebaseAuth?.currentUser?.uid!==accountId)){stopPresence();return;}
    startPresence();
  }
  function drawVisitor(visitor,t){
    const dx=visitor.x-visitor.drawX,dy=visitor.y-visitor.drawY;
    const alpha=1-Math.exp(-clamp(t-(visitor.lastFrame||t-16),0,100)/100);
    visitor.lastFrame=t;visitor.drawX+=dx*alpha;visitor.drawY+=dy*alpha;
    const projected=project({x:visitor.drawX,y:visitor.drawY});
    const x=projected.x,y=projected.y,walking=visitor.moving||Math.hypot(dx,dy)>2;
    ellipse(x,y+9,27,8,'#52776f');
    try{if(typeof drawMountaineerSprite==='function')drawMountaineerSprite(ctx,'CUSTOM',x,y-21,{scale:spriteScale,facing:visitor.facing,anim:walking?t*.027:0,customConfig:visitor.avatar});}
    catch(error){console.warn('[REFUGIO] Avatar remoto no disponible',error);}
    const label=String(visitor.username).slice(0,19).toUpperCase();
    r(x-65,y+16,130,19,'#153c4c');text(label,x,y+26,7,'#bfffe1',126);
  }
  function drawPlayers(t){
    const players=[...remotePlayers.values(),{local:true,y:avatar.y}].sort((a,b)=>a.y-b.y);
    for(const player of players){if(player.local)drawAvatar(t);else drawVisitor(player,t);}
  }
  const dPad = root.querySelectorAll('[data-ref-dir]');
  const palette = {ink:'#111d31',white:'#f6f1d9',gold:'#ffd480',shadow:'#23334d',snow:'#e6eef2',stone:'#879ca9'};
  const r = (x,y,w,h,c) => {ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
  function polygon(points,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();}
  function ellipse(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function strokeRect(x,y,w,h,c,size=2){ctx.strokeStyle=c;ctx.lineWidth=size;ctx.strokeRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function text(value,x,y,size=10,color='#fff',maxWidth=0){
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${size}px "Press Start 2P",monospace`;
    ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#111829';ctx.strokeText(value,x,y,maxWidth||undefined);
    ctx.fillStyle=color;ctx.fillText(value,x,y,maxWidth||undefined);ctx.restore();
  }
  function rng(seed){const n=Math.sin(seed*82.631+12.3)*49873.14;return n-Math.floor(n);}
  function chooseLayout(portrait){
    const w=portrait?560:960, h=portrait?720:600;
    const p=portrait;
    return {w,h,portrait:p,
      groundTop:p?294:270,
      spawn:{x:w/2,y:p?645:521},
      zones:{
        cabana:{x:p?435:788,y:p?317:322,focusX:p?437:790,focusY:p?203:207,hit:75},
        fogata:{x:w/2,y:p?504:440,focusX:w/2,focusY:p?437:369,hit:74},
        carpas:{x:p?138:177,y:p?550:493,focusX:p?138:183,focusY:p?452:428,hit:84},
        vestuario:{x:p?440:780,y:p?565:515,focusX:p?440:778,focusY:p?453:435,hit:85}
      },
      lodge:{x:p?146:192,y:p?314:322,s:p?.78:1.0},
      cabin:{x:p?432:790,y:p?319:320,s:p?.76:1.0},
      tents:{x:p?128:164,y:p?523:476,s:p?.82:.93},
      wardrobe:{x:p?442:783,y:p?527:471,s:p?.8:.96},
      fire:{x:w/2,y:p?452:378,s:p?.90:1.0}
    };
  }
  function safeLayout(){
    // Se recalcula SOLO en cambios de orientación o tamaño, nunca durante el movimiento.
    const rect=canvas.getBoundingClientRect();
    const width=rect.width||320,height=rect.height||460;
    const portrait=height/width>1.12;
    const next=chooseLayout(portrait);
    const baseHeight=next.h;
    if(width/height<next.w/next.h)next.h=next.w*height/width;
    else next.w=next.h*width/height;
    next.groundTop*=next.h/baseHeight;
    const world=chooseLayout(false);
    // Las posiciones de red nunca cambian al girar: solo se proyectan al mapa local.
    if(!scene)avatar={...world.spawn};
    scene=next;
    for(const key of ['lodge','cabin','tents','wardrobe','fire'])Object.assign(scene[key],project(world[key]));
    for(const key of Object.keys(scene.zones)){
      const foot=project(map.zones[key]);
      const original=world.zones[key];
      const focus=project({x:original.focusX,y:original.focusY});
      Object.assign(scene.zones[key],foot,{focusX:focus.x,focusY:focus.y});
    }
    remotePlayers.forEach(player=>{player.lastFrame=0;});
    const pxRatio=Math.min(1.5,window.devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(width*pxRatio));
    canvas.height=Math.max(1,Math.round(height*pxRatio));
    const scale=Math.min(canvas.width/next.w,canvas.height/next.h);
    state={scale,offsetX:(canvas.width-next.w*scale)/2,offsetY:(canvas.height-next.h*scale)/2,width:next.w,height:next.h,portrait};
    spriteScale=Math.max(1.04,46/(76*(scale/pxRatio)));
    ctx.imageSmoothingEnabled=false;
    backgroundCanvas=null;
  }
  function tree(x,y,s){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ellipse(0,7,37,9,'#315d56');r(-5,-3,10,29,'#4f3b32');
    polygon([[-38,2],[0,-70],[39,2]],'#164a4b');polygon([[-31,-23],[0,-94],[30,-23]],'#236862');polygon([[-25,-43],[0,-110],[24,-43]],'#36847a');
    polygon([[-15,-65],[0,-109],[13,-74],[4,-78],[-2,-65]],'#e4eef0');r(-35,1,69,7,'#164a4b');ctx.restore();
  }
  function rock(x,y,s){ellipse(x,y+3,18*s,7*s,'#56717b');polygon([[x-14*s,y+3*s],[x-9*s,y-8*s],[x+6*s,y-12*s],[x+15*s,y+3*s]],'#b2c2c7');polygon([[x-9*s,y-7*s],[x+5*s,y-12*s],[x+3*s,y-2*s]],'#dde1dd');}
  function mountain(x,y,w,h,color){polygon([[x-w/2,y],[x,y-h],[x+w/2,y]],color);
    polygon([[x-w*.16,y-h*.65],[x,y-h],[x+w*.17,y-h*.66],[x+w*.09,y-h*.69],[x,y-h*.48],[x-w*.07,y-h*.7]],'#ecf3f1');}
  function snowTile(x,y,s){polygon([[x,y],[x+s*.57,y-4],[x+s,y],[x+s*.55,y+5]],'#c8dfe5');}
  function background(){
    const {w,h,groundTop}=scene;
    const g=ctx.createLinearGradient(0,0,0,groundTop);g.addColorStop(0,'#18335a');g.addColorStop(.55,'#5386aa');g.addColorStop(1,'#a9c4d1');
    r(0,0,w,h,'#6a9d93');ctx.fillStyle=g;ctx.fillRect(0,0,w,groundTop+65);
    ellipse(w*.7,groundTop*.33,36,35,'#eecb9f');
    mountain(w*.12,groundTop+50,w*.76,groundTop*.78,'#3e5777');
    mountain(w*.39,groundTop+45,w*.84,groundTop*1.04,'#476c8a');
    mountain(w*.73,groundTop+56,w*.72,groundTop*.91,'#395e7b');
    mountain(w*1.02,groundTop+50,w*.64,groundTop*.80,'#4e7291');
    polygon([[0,groundTop-5],[w*.19,groundTop-16],[w*.35,groundTop+13],[w*.67,groundTop-14],[w,groundTop-3],[w,h],[0,h]],'#b7d3d4');
    // Plaza elíptica en perspectiva; centro despejado para que camine el avatar.
    ellipse(w/2,groundTop+(h-groundTop)*.56,w*.51,(h-groundTop)*.46,'#4b7778');
    ellipse(w/2,groundTop+(h-groundTop)*.54,w*.49,(h-groundTop)*.43,'#c0d1c7');
    ellipse(w/2,groundTop+(h-groundTop)*.58,w*.45,(h-groundTop)*.36,'#b5c7ba');
    // Lajas y detalles del suelo, repetidos determinísticamente.
    for(let i=0;i<115;i++){
      const x=30+rng(i+21)*(w-60), y=groundTop+45+rng(i+251)*(h-groundTop-65);
      r(x,y,3+rng(i+18)*7,2+rng(i+97)*3,i%5?'#93b0ae':'#e1e8d9');
    }
    for(let i=0;i<32;i++){
      const x=10+rng(i+800)*(w-20), y=groundTop+8+rng(i+990)*(h-groundTop-15);
      if(i%2===0)rock(x,y,.38+rng(i)*.48);
      else snowTile(x,y,6+rng(i)*8);
    }
    // Camino que conduce a la fogata.
    const fx=scene.fire.x,fy=scene.fire.y;
    polygon([[fx-31,fy+33],[fx+38,fy+34],[w*.66,h],[w*.34,h]],'#a6b3a8');
    for(let i=0;i<9;i++){
      let y=fy+49+i*(h-fy-48)/9;
      let spread=28+(y-fy)*.19;
      r(fx-spread,y,spread*.9,4,'#d1d3c4');r(fx+spread*.18,y,spread*.85,4,'#d1d3c4');
    }
    // Abetos laterales, sin tapar entradas ni la figura del jugador.
    const tr=scene.portrait;
    tree(23,groundTop+70,tr?.7:.9);tree(w-24,groundTop+75,tr?.69:.9);
    if(!tr){tree(43,groundTop-22,.65);tree(w-43,groundTop-22,.63);}
  }
  function labelSign(title,x,y,w){
    r(x-w/2-3,y-3,w+6,28,'#392d36');r(x-w/2,y,w,23,'#f7d99d');
    r(x-w/2+5,y+5,w-10,12,'#bd8751');text(title,x,y+11,9,'#fff8dc',w-8);
    r(x-w/2+12,y+23,7,10,'#5c3c31');r(x+w/2-17,y+23,7,10,'#5c3c31');
  }
  function house(centerX,baseY,s,type){
    ctx.save();ctx.translate(centerX,baseY);ctx.scale(s,s);
    const meeting=type==='meeting';
    const width=meeting?206:244, tall=meeting?113:129;
    ellipse(0,5,width*.6,18,'#4f666d');
    r(-width/2,-tall,width,tall,meeting?'#745444':'#8c776c');
    for(let i=0;i<9;i++){r(-width/2+6,-tall+11+i*13,width-12,3,meeting?'#b38655':'#bca194');}
    polygon([[-width/2-20,-tall+9],[0,-tall-92],[width/2+20,-tall+9]],meeting?'#5b4050':'#35465c');
    polygon([[-width/2-6,-tall+5],[0,-tall-77],[width/2+5,-tall+5]],meeting?'#9c5d59':'#6a6e76');
    polygon([[-width/2-12,-tall-8],[0,-tall-96],[width/2+10,-tall-8],[width/2-6,-tall+1],[0,-tall-69],[-width/2+4,-tall+1]],'#e7f2ed');
    r(-width/2+15,-tall+33,47,43,'#17354c');r(-width/2+21,-tall+39,35,31,'#ffd477');
    r(width/2-62,-tall+33,47,43,'#17354c');r(width/2-57,-tall+39,36,30,'#ffd477');
    r(-24,-79,48,79,'#2d3546');r(-19,-74,38,72,meeting?'#ab704d':'#6b523b');
    r(8,-42,5,6,'#ffdc89');
    r(-width/2,-8,width,10,'#5a4643');
    labelSign(meeting?'REUNIONES':'REFUGIO APUS',0,-tall-40,meeting?130:162);
    ctx.restore();
  }
  function tent(x,y,s,color){ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ellipse(0,1,98,20,'#6a8a85');polygon([[-96,0],[0,-126],[98,0]],'#203c50');
    polygon([[-83,-5],[0,-115],[84,-5]],color);
    polygon([[-5,-6],[0,-82],[42,-5]],'#1c354d');
    polygon([[-80,-6],[0,-112],[-8,-6]],'#ffffff35');
    r(-101,0,201,6,'#e2e8e2');r(-94,5,9,12,'#587b7c');r(89,5,9,12,'#587b7c');
    r(-60,-31,23,8,'#e8ca80');r(37,-29,25,8,'#c8dce4');ctx.restore();}
  function clothes(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ellipse(0,0,116,15,'#5d807b');r(-106,-101,212,102,'#7f5944');r(-98,-91,198,90,'#d9b18a');
    polygon([[-124,-107],[-82,-146],[83,-146],[123,-107]],'#3b5a6d');
    for(let i=0;i<8;i++)r(-110+i*29,-115,17,17,i%2?'#e7eedf':'#f3a25f');
    r(-72,-77,145,6,'#5f3c33');
    ['#f08b44','#65a6b5','#9869af'].forEach((c,i)=>{const xx=-61+i*54;
      r(xx,-67,32,41,c);r(xx-7,-61,7,19,c);r(xx+32,-61,7,19,c);
      r(xx+5,-83,21,13,i===0?'#f4ca69':'#e3f4ed');
    });
    labelSign('VESTUARIO',0,-143,146);r(-109,-5,217,9,'#593e36');ctx.restore();}
  function campfire(x,y,s,t){ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    ellipse(0,0,86,35,'#81948e');for(let i=0;i<13;i++){
      const a=i*Math.PI*2/13, px=Math.cos(a)*67, py=Math.sin(a)*30;
      ellipse(px,py,13,7,i%2?'#b7c1c0':'#637986');
    }
    ctx.save();ctx.rotate(.12);r(-48,-6,96,13,'#6d402a');ctx.restore();
    ctx.save();ctx.rotate(-.15);r(-46,-4,93,12,'#9c663a');ctx.restore();
    const wav=Math.sin(t*.012)*4;
    polygon([[-30,-6],[-26,-54+wav],[-11,-39],[0,-87-wav],[14,-35],[28,-60+wav],[33,-7]],'#f88737');
    polygon([[-15,-2],[-11,-36],[-1,-26],[5,-53],[17,-5]],'#ffdb64');
    for(let i=0;i<4;i++){const d=(t*.023+i*29)%95;r(-23+i*14,-48-d,3,3,i%2?'#ffd17a':'#ff9d4f');}
    ctx.restore();}
  function bench(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    r(-64,-15,128,16,'#704938');r(-59,-18,118,5,'#aa7f57');r(-52,1,9,21,'#4b3f35');r(40,1,9,21,'#4b3f35');ctx.restore();}
  function drawBuildings(){
    const g=scene;
    house(g.lodge.x,g.lodge.y,g.lodge.s,'lodge');
    house(g.cabin.x,g.cabin.y,g.cabin.s,'meeting');
    tent(g.tents.x,g.tents.y,g.tents.s,'#e07b4a');
    tent(g.tents.x+g.tents.s*77,g.tents.y+19,g.tents.s*.55,'#5f9d9f');
    clothes(g.wardrobe.x,g.wardrobe.y,g.wardrobe.s);
    bench(g.fire.x-(g.portrait?105:142),g.fire.y+52,.55);
    bench(g.fire.x+(g.portrait?107:144),g.fire.y+51,.55);
    // Pequeños rótulos en el suelo para facilitar acceso táctil.
    for(const key of ['fogata','cabana','carpas','vestuario']){
      const z=g.zones[key];ellipse(z.x,z.y+3,25,8,'#6d9191');
      ellipse(z.x,z.y,21,6,'#f0dbac');
      r(z.x-2,z.y-13,4,10,'#6b513b');
    }
  }
  function prepareStaticLayer(){
    // Dibujar el mapa fijo UNA sola vez en el lienzo visible; copiarlo después
    // a una textura en memoria. Las siguientes imágenes solo animan fuego/avatar.
    ctx.setTransform(1,0,0,1,0,0);r(0,0,canvas.width,canvas.height,'#192b41');
    ctx.setTransform(state.scale,0,0,state.scale,state.offsetX,state.offsetY);
    ctx.save();ctx.beginPath();ctx.rect(0,0,scene.w,scene.h);ctx.clip();
    background();drawBuildings();
    ctx.restore();
    const texture=document.createElement('canvas');texture.width=canvas.width;texture.height=canvas.height;
    const tctx=texture.getContext('2d');
    if(tctx){tctx.drawImage(canvas,0,0);backgroundCanvas=texture;}
  }
  function drawScene(t){
    const {w}=scene;
    campfire(scene.fire.x,scene.fire.y,scene.fire.s,t);
    // El avatar se pinta SOBRE el suelo. Ningún comando desplaza la cámara.
    for(const key of ['cabana','fogata','carpas','vestuario']){
      const z=scene.zones[key];
      if(distance(avatar,map.zones[key])<72){
        ellipse(z.x,z.y,37,9,'#d7bf71');
        text('PULSA / ENTRAR',z.x,z.y-23,8,'#fff1aa',118);
      }
    }
    drawCampNPCs(t);
    drawPlayers(t);
    text('REFUGIO APUS',w/2,24,scene.portrait?14:18,'#ffdb88',w-62);
  }
  function drawCampNPCs(t){
    // Figuras decorativas, NO jugadores conectados. Cada uno usa los sprites
    // originales del minijuego de Chugo vs Jordy.
    if(typeof drawMountaineerSprite!=='function')return;
    const spots=[{...project({x:367,y:448}),n:'CHUGO',f:-1},{...project({x:604,y:448}),n:'JORDY',f:1}];
    for(const p of spots){
      try{drawMountaineerSprite(ctx,p.n,p.x,p.y-20+Math.sin(t*.002+p.x)*.6,{scale:spriteScale,facing:p.f,anim:0});
        r(p.x-34,p.y+13,68,16,'#163449');text(p.n+' NPC',p.x,p.y+21,6,'#fff1d5',65);
      }catch(_){/* Si falta un sprite, el mapa sigue funcionando. */}
    }
  }
  function drawAvatar(t){
    const cfg=slotConfig();
    const point=project(avatar);
    const bob=(target||moving())?Math.sin(t*.019)*1.6:0;
    ellipse(point.x,point.y+9,27,8,'#52776f');
    let painted=false;
    if(typeof drawMountaineerSprite==='function'){
      try{drawMountaineerSprite(ctx,cfg?'CUSTOM':'JORDY',point.x,point.y-21+bob,{scale:spriteScale,facing:direction,anim:(target||moving())?t*.027:0,customConfig:cfg});painted=true;}
      catch(e){if(!lastDrawError){console.warn('[REFUGIO] Sprite: dibujo alternativo',e);lastDrawError=String(e);}}
    }
    if(!painted){
      // Fallback si una versión de WebView no soporta algún sprite.
      r(point.x-11,point.y-50+bob,24,27,'#df8544');r(point.x-8,point.y-65+bob,18,17,'#f0ba84');r(point.x-13,point.y-70+bob,27,11,'#efd36d');
      r(point.x-13,point.y-23+bob,9,29,'#273f59');r(point.x+4,point.y-23+bob,9,29,'#273f59');
    }
    const name=String(cfg?.name||(typeof currentUser!=='undefined'?currentUser?.username:'')||'MONTAÑISTA').slice(0,19).toUpperCase();
    r(point.x-Math.min(128,name.length*5+15)/2,point.y+16,Math.min(128,name.length*5+15),19,'#122c43');
    text(name,point.x,point.y+26,7,'#fff8df',132);
    ellipse(point.x,point.y+3,14,3,'#edb45f');
  }
  function moving(){return Object.keys(movePressed).some(k=>movePressed[k])||Object.keys(keys).some(k=>keys[k]);}
  function slotConfig(){
    try{if(typeof customCharSlots!=='undefined'&&Array.isArray(customCharSlots))return customCharSlots[slot]||null;}
    catch(_){}return null;
  }
  function hasAccount(){
    try{return typeof currentUser!=='undefined'&&!!currentUser&&typeof currentUser.uid==='string'&&currentUser.uid.length>0;}
    catch(_){return false;}
  }
  function gate(){
    if(hasAccount())return true;
    alert('🔒 INICIA SESIÓN CON TU CUENTA PARA ENTRAR AL REFUGIO APUS. LOS INVITADOS NO PUEDEN ENTRAR.');
    try{if(typeof openAuthModal==='function')openAuthModal();}catch(_){}
    return false;
  }
  function slotKey(){return 'apus_refugio_avatar_v32_'+accountId;}
  function remember(){try{localStorage.setItem(slotKey(),String(slot));}catch(_){}}
  function restoreAccount(){
    accountId=currentUser.uid;
    let s=0;try{s=Number(localStorage.getItem(slotKey())||0);}catch(_){}
    slot=[0,1,2].includes(s)?s:0;
    const label=$('apus-refugio-user');if(label)label.textContent='👤 '+String(currentUser.username||'MONTAÑISTA').slice(0,19);
  }
  function open(){
    if(!gate())return;
    try{
      restoreAccount();target=null;destinationZone=null;keys=Object.create(null);movePressed=Object.create(null);
      if(!active)scene=null;
      if(typeof showOverlay==='function')showOverlay('apus-refugio-overlay');
      else root.classList.add('active');
      root.querySelector('#apus-refugio-dialog').hidden=true;
      const error=$('apus-refugio-error');if(error)error.hidden=true;
      active=true;
      safeLayout();avatar={...chooseLayout(false).spawn};direction=1;lastFrame=0;waypoints=[];
      startPresence();
      if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
      if(typeof window.apusRouteMusic==='function')window.apusRouteMusic();
    }catch(e){recover(e);}
  }
  function recover(error){
    stopPresence();
    console.error('[REFUGIO APUS] Error protegido:',error);
    active=false;if(raf)cancelAnimationFrame(raf);raf=0;
    // Nunca dejar al jugador ante una pantalla negra o bloqueada.
    const msg=$('apus-refugio-error');
    if(msg){msg.hidden=false;msg.firstChild.textContent='NO SE PUDO INICIAR EL REFUGIO. PULSA VOLVER AL MENÚ Y REINTENTA.';}
    else{if(typeof showOverlay==='function')showOverlay('menu-overlay');alert('No se pudo abrir Refugio Apus. El resto del juego continúa disponible.');}
  }
  function close(){
    stopPresence();
    active=false;if(raf)cancelAnimationFrame(raf);raf=0;
    target=null;destinationZone=null;keys=Object.create(null);movePressed=Object.create(null);
    editorReturn=false;const back=$('apus-refugio-creator-back');if(back)back.hidden=true;
    if(noticeTimer)clearTimeout(noticeTimer);
    const msg=$('apus-refugio-error');if(msg)msg.hidden=true;
    if(typeof showOverlay==='function')showOverlay('menu-overlay');else root.classList.remove('active');
    if(typeof window.apusRouteMusic==='function')window.apusRouteMusic();
  }
  function notify(message){const el=$('apus-refugio-toast');if(!el)return;
    el.textContent=message;el.hidden=false;clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>{el.hidden=true;},3000);
  }
  function dialogOpen(name){
    if(!active)return;
    if(name==='vestuario'){wardrobeOpen();return;}
    const data=zoneInfo[name];if(!data)return;
    $('apus-refugio-dialog-title').textContent=data.title;
    $('apus-refugio-dialog-desc').textContent=data.message;
    $('apus-refugio-slots').hidden=true;$('apus-refugio-edit').hidden=true;
    $('apus-refugio-dialog').hidden=false;
    target=null;destinationZone=null;
  }
  function wardrobeOpen(){
    $('apus-refugio-dialog-title').textContent='🧥 ELIGE TU MONTAÑISTA';
    $('apus-refugio-dialog-desc').textContent='Puedes elegir uno de tus TRES personajes guardados. No se borran los diseños de los demás.';
    $('apus-refugio-slots').hidden=false;$('apus-refugio-edit').hidden=false;
    const list=$('apus-refugio-slots');list.replaceChildren();
    for(let i=0;i<3;i++){
      const cfg=typeof customCharSlots!=='undefined'&&Array.isArray(customCharSlots)?customCharSlots[i]:null;
      const button=document.createElement('button');button.type='button';button.className='ref-slot-card';button.setAttribute('aria-pressed',String(slot===i));
      const portrait=document.createElement('canvas');portrait.width=80;portrait.height=88;
      const p=portrait.getContext('2d');if(p){p.imageSmoothingEnabled=false;
        if(typeof drawMountaineerSprite==='function'){
          try{drawMountaineerSprite(p,cfg?'CUSTOM':'JORDY',40,50,{scale:.92,customConfig:cfg});}catch(e){}
        }
      }
      const title=document.createElement('strong');title.textContent='PERSONAJE '+(i+1);
      const label=document.createElement('span');label.textContent=String(cfg?.name||'SIN NOMBRE').slice(0,20);
      button.append(portrait,title,label);
      button.addEventListener('click',()=>{slot=i;remember();list.querySelectorAll('button').forEach((item,j)=>item.setAttribute('aria-pressed',String(i===j)));notify('PERSONAJE '+(i+1)+' SELECCIONADO');});
      list.append(button);
    }
    $('apus-refugio-dialog').hidden=false;
  }
  function editOutfit(){
    if(!hasAccount())return;
    stopPresence();
    $('apus-refugio-dialog').hidden=true;editorReturn=true;
    active=false;if(raf)cancelAnimationFrame(raf);raf=0;
    try{
      if(typeof switchCreatorSlot==='function')switchCreatorSlot(slot);
      if(typeof openCustomCreator==='function')openCustomCreator();
      if(typeof switchCreatorSlot==='function')switchCreatorSlot(slot);
      const back=$('apus-refugio-creator-back');if(back)back.hidden=false;
    }catch(e){recover(e);}
  }
  function fromCreator(){
    if(!editorReturn)return;
    if(!hasAccount()||currentUser.uid!==accountId){close();return;}
    if(typeof activeCustomSlot!=='undefined'&&[0,1,2].includes(activeCustomSlot)){slot=activeCustomSlot;remember();}
    keys=Object.create(null);movePressed=Object.create(null);target=null;destinationZone=null;
    editorReturn=false;
    const back=$('apus-refugio-creator-back');if(back)back.hidden=true;
    // Restablecer panel y avatar sin alterar la cuenta ni guardados.
    if(typeof showOverlay==='function')showOverlay('apus-refugio-overlay');
    active=true;safeLayout();startPresence();if(!raf)raf=requestAnimationFrame(frame);
  }
  function startWalk(destination,zone=null){
    waypoints=map.route(avatar,destination);destinationZone=zone;
    target=waypoints.shift()||null;
    if(!target){destinationZone=null;notify('NO HAY PASO POR AQUÍ');}
  }
  function approach(zone){
    if(!active||$('apus-refugio-dialog').hidden===false)return;
    const z=map.zones[zone];if(!z)return;
    if(distance(avatar,z)<22){target=null;waypoints=[];destinationZone=null;dialogOpen(zone);return;}
    startWalk(z,zone);
  }
  function moveTo(x,y){
    if(!scene)return;
    startWalk(map.safe({x,y}));
  }
  function waypointClick(event){
    if(!active||!$('apus-refugio-dialog').hidden)return;
    const rect=canvas.getBoundingClientRect();
    const px=(event.clientX-rect.left)*canvas.width/rect.width;
    const py=(event.clientY-rect.top)*canvas.height/rect.height;
    const x=(px-state.offsetX)/state.scale,y=(py-state.offsetY)/state.scale;
    if(x<0||x>scene.w||y<0||y>scene.h)return;
    // Los edificios son interactivos; el personaje camina HASTA ellos, no teletransporta la cámara.
    for(const key of ['cabana','fogata','carpas','vestuario']){
      const z=scene.zones[key];
      if(Math.hypot(x-z.focusX,(y-z.focusY)*.85)<(key==='fogata'?85:120)){
        approach(key);return;
      }
    }
    const point=unproject({x,y});moveTo(point.x,point.y);
  }
  function movementFromInput(dt){
    let dx=0,dy=0;
    const pressed=k=>Boolean(keys[k]||movePressed[k]);
    if(pressed('left')||pressed('ArrowLeft')||pressed('KeyA'))dx-=1;
    if(pressed('right')||pressed('ArrowRight')||pressed('KeyD'))dx+=1;
    if(pressed('up')||pressed('ArrowUp')||pressed('KeyW'))dy-=1;
    if(pressed('down')||pressed('ArrowDown')||pressed('KeyS'))dy+=1;
    if(dx||dy){
      const m=Math.hypot(dx,dy);dx/=m;dy/=m;target=null;destinationZone=null;waypoints=[];
      avatar=map.slide(avatar,dx*dt*.215,dy*dt*.215);
      if(dx)direction=Math.sign(dx);
      return;
    }
    if(target){const length=distance(avatar,target);if(length<3){avatar={...target};target=waypoints.shift()||null;
      if(!target&&destinationZone){const z=destinationZone;destinationZone=null;dialogOpen(z);}
    }else{
      const step=Math.min(length,dt*.19);const vx=(target.x-avatar.x)/length,vy=(target.y-avatar.y)/length;
      avatar=map.slide(avatar,step*vx,step*vy);
      if(Math.abs(vx)>.04)direction=vx>0?1:-1;
    }}
  }
  function frame(time){
    if(!active){raf=0;return;}
    if(!hasAccount()||currentUser.uid!==accountId){close();return;}
    if(!root.classList.contains('active')){stopPresence();active=false;raf=0;keys=Object.create(null);movePressed=Object.create(null);return;}
    try{
      const dt=lastFrame?clamp(time-lastFrame,0,50):16;lastFrame=time;
      maintainPresence();
      if(!$('apus-refugio-dialog').hidden){} else movementFromInput(dt);
      if(!backgroundCanvas)prepareStaticLayer();
      ctx.setTransform(1,0,0,1,0,0);
      if(backgroundCanvas)ctx.drawImage(backgroundCanvas,0,0);
      else r(0,0,canvas.width,canvas.height,'#192b41');
      ctx.setTransform(state.scale,0,0,state.scale,state.offsetX,state.offsetY);
      ctx.save();ctx.beginPath();ctx.rect(0,0,scene.w,scene.h);ctx.clip();
      drawScene(time);
      ctx.restore();
      raf=requestAnimationFrame(frame);
    }catch(e){recover(e);}
  }
  // Los eventos se registran una sola vez y sólo actúan mientras el refugio está abierto.
  canvas.addEventListener('pointerdown',waypointClick);
  root.querySelectorAll('[data-ref-zone]').forEach(b=>b.addEventListener('click',()=>approach(b.dataset.refZone)));
  $('apus-refugio-close-dialog')?.addEventListener('click',()=>{$('apus-refugio-dialog').hidden=true;});
  $('apus-refugio-edit')?.addEventListener('click',editOutfit);
  $('apus-refugio-creator-back')?.addEventListener('click',fromCreator);
  window.addEventListener('keydown',e=>{
    if(!active||!$('apus-refugio-dialog').hidden)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){
      e.preventDefault();e.stopImmediatePropagation();keys[e.code]=true;
    }
    if(e.code==='KeyE'&&active){
      const nearby=Object.entries(map.zones).find(([,z])=>distance(avatar,z)<40);
      if(nearby)dialogOpen(nearby[0]);
    }
  },true);
  window.addEventListener('keyup',e=>{if(keys[e.code]){keys[e.code]=false;e.preventDefault();}},true);
  window.addEventListener('blur',()=>{keys=Object.create(null);movePressed=Object.create(null);});
  dPad.forEach(btn=>{
    const dir=btn.dataset.refDir;
    btn.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();movePressed[dir]=true;btn.setPointerCapture?.(e.pointerId);});
    const stop=e=>{movePressed[dir]=false;};
    btn.addEventListener('pointerup',stop);btn.addEventListener('pointercancel',stop);
    btn.addEventListener('lostpointercapture',stop);
  });
  window.addEventListener('resize',()=>{if(active){safeLayout();lastFrame=0;}});
  document.addEventListener('apus:auth-logout',()=>{if(active)close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPresence();else if(active)startPresence();});
  window.addEventListener('pagehide',stopPresence);
  window.addEventListener('pageshow',()=>{if(active)startPresence();});
  window.openRefugioApus=open;
  window.closeRefugioApus=close;
  window.apusRefugioFase1={
    get active(){return active;},get selectedSlot(){return slot;},
    get avatarX(){return Math.round(avatar.x);},get avatarY(){return Math.round(avatar.y);},
    get worldWidth(){return scene?.w||0;},get worldHeight(){return scene?.h||0;},
    get isCameraFixed(){return true;},
    testMoveTo:moveTo,openZone:approach
  };
})();
