/* ==========================================================================
   TORNEO COMPETITIVO V27.5 — sala PeerJS separada del 1 contra 1 original.
   El anfitrión coordina el cuadro; los dos luchadores usan el motor VS
   existente y transmiten su estado para los espectadores.
   ========================================================================== */
let tournament = null;
let tourRoundTimer = null;
let tourFrameTicker = 0;

const TOUR_ROUND_LABELS = { q: 'CUARTOS DE FINAL', s: 'SEMIFINAL', third: 'TERCER LUGAR', final: 'FINAL' };
const TOUR_ROOM_PREFIX = 'APUS-TORNEO-';
const TOUR_STATE_INTERVAL = 50; // 20 actualizaciones/s para el torneo online.
const TOUR_CPU_FRAME_INTERVAL = 70; // espectadores CPU interpolan fotogramas de red.
const TOUR_WATCH_SMOOTH_MS = 65; // suavizado visual a FPS de pantalla.
let tourAttackSequence = 0;
let tourLastReceivedAttackId = 0;

function tourStatus(message) {
  const el = document.getElementById('tournament-status');
  if (el) el.textContent = message;
  const lobby = document.getElementById('tournament-lobby-hint');
  if (lobby) lobby.textContent = message;
}
function tourSetSize(n) {
  const el = document.getElementById('tournament-size');
  if (el) el.value = String(n);
  // Únicamente actualiza el aspecto de los botones del selector.
  for (const count of [4, 8]) {
    const button = document.getElementById('tour-size-' + count);
    if (button) button.setAttribute('aria-pressed', String(Number(n) === count));
  }
}
function tourGetSize() {
  return Number(document.getElementById('tournament-size').value) === 8 ? 8 : 4;
}
function tourOpenSetup() {
  if (tournament) tourLeave();
  showOverlay('tournament-setup-overlay');
  tourStatus('Elige 4 u 8 participantes. En online puedes comenzar solo y completar con CPU.');
}
function tourOwnInfo() {
  const info = getMyFighterPayload();
  return {
    char: info.char,
    displayName: String(info.displayName || 'MONTAÑISTA').slice(0, 32),
    customConfig: info.customConfig || null
  };
}
function tourPlayer(id, fighterInfo, cpu = false) {
  return {
    id, cpu, connected: true,
    name: String(fighterInfo.displayName || 'JUGADOR').slice(0,32),
    fighterInfo
  };
}
function tourResetState(mode, size) {
  tourLeave(true);
  tourNamedCpuRosterTurn++;
  tournament = {
    mode, size, host: true, me: mode === 'offline' ? 'LOCAL' : 'HOST',
    code: '', status: 'lobby', peer: null, hostConn: null, peers: new Map(),
    members: [tourPlayer(mode === 'offline' ? 'LOCAL' : 'HOST', tourOwnInfo())],
    matches: [], current: null, third: null, winner: null, runnerUp: null,
    cpuAutoplay: false, cpuBout: false, cpuSimulation: false,
    simFirstId: null, simSecondId: null, lastCpuFrameAt: 0,
    awaitContinueWinner: null, awaitContinueTriggered: false,
    resultReadyAt: 0, lastStateAt: 0, roundVersion: 0,
    returnGameState: null, returnMatchId: null,
    tourId: Math.random().toString(36).slice(2,11)
  };
  document.getElementById('tournament-host-start').style.display = 'block';
  tourRenderLobby();
}
function tourOffline() {
  const size = tourGetSize();
  tourResetState('offline',size);
  for (let i=1;i<size;i++) {
    tournament.members.push(tourPlayer('CPU-'+i, tourMakeCpuInfo(i), true));
  }
  tourStartBracket();
}
// En línea los puestos CPU se agregan únicamente al pulsar COMENZAR.
// En espera se permiten 1..8 personas reales (anfitrión incluido).
function tourFillMissingCpu(t) {
  let next = 1;
  while (t.members.length < t.size) {
    const id = 'CPU-' + next;
    if (!t.members.some(p => p.id === id)) {
      t.members.push(tourPlayer(id, tourMakeCpuInfo(next), true));
    }
    next++;
  }
}
function tourNewCode() { return generateShortCode(); }
function tourCreateOnline() {
  if (typeof Peer === 'undefined') { tourStatus('⚠️ Todavía se está cargando la conexión online.');return; }
  tourResetState('online',tourGetSize());
  const t=tournament, token=t.tourId;
  t.code=tourNewCode();
  tourStatus('⏳ Abriendo sala de torneo...');
  showOverlay('tournament-lobby-overlay');
  const peer = new Peer(TOUR_ROOM_PREFIX+t.code,PEER_ICE_CONFIG);
  t.peer=peer;
  peer.on('open', () => {
    if(tournament!==t) return;
    tourStatus('✅ Sala '+t.code+' lista. Invita amigos o comienza ahora: las plazas libres serán CPU.');
    tourRenderLobby();
  });
  peer.on('connection',(conn)=>{
    if(tournament!==t || t.status!=='lobby' || t.members.length>=t.size){try{conn.close();}catch(e){};return;}
    tourAttachGuest(conn,t);
  });
  peer.on('error',(err)=>{
    if(tournament!==t) return;
    if (err?.type==='unavailable-id') {
      tourStatus('⚠️ El código está ocupado. Vuelve a crear la sala.');
    } else tourStatus('⚠️ Conexión del torneo: '+(err?.type||'error de red'));
  });
}
function tourAttachGuest(conn,t){
  const id=conn.peer;
  const onOpen=()=>{
    if(tournament!==t)return;
    t.peers.set(id,conn);
  };
  conn.on('open',onOpen);
  if(conn.open)onOpen();
  conn.on('data', (data)=>{
    if(tournament!==t || !data?.type)return;
    if(data.type==='TOUR_HELLO' && t.status==='lobby'){
      if(t.members.find(p=>p.id===id))return;
      if(t.members.length>=t.size){try{conn.send({type:'TOUR_ERROR',msg:'Sala completa'});}catch(e){};conn.close();return;}
      const info=tourSanitizeInfo(data.fighterInfo);
      t.members.push(tourPlayer(id,info));
      t.peers.set(id,conn);
      tourPublish();
    } else if(data.type==='TOUR_FIGHTER_PACKET'){
      tourRouteFighter(id,data.packet);
    } else if(data.type==='TOUR_CPU_FRAME'){
      tourRouteCpuFrame(id,data);
    } else if(data.type==='TOUR_RESULT'){
      tourReceiveResult(id,data.winner);
    } else if(data.type==='TOUR_CONTINUE'){
      const m=t.matches.find(x=>x.id===t.current && x.status==='done');
      if (tournament===t && t.host && !t.awaitContinueTriggered && m && data.match===m.id &&
          data.winner===m.winner && data.winner===t.awaitContinueWinner && id===m.winner &&
          performance.now()>=(t.resultReadyAt||0)) {
        t.awaitContinueTriggered=true;
        tourAdvanceAfterContinue();
      }
    } else if(data.type==='TOUR_LEAVE'){
      tourHandleDisconnect(id);
    }
  });
  conn.on('close',()=>{if(tournament===t)tourHandleDisconnect(id);});
  conn.on('error',(e)=>console.warn('Torneo P2P conexión participante',e));
}
function tourSanitizeInfo(info){
  const safe=info && typeof info==='object'?info:{};
  return {
    char:['JORDY','CHUGO','CUSTOM'].includes(safe.char)?safe.char:'JORDY',
    displayName:String(safe.displayName||'INVITADO').slice(0,32),
    customConfig:safe.customConfig && typeof safe.customConfig==='object'?safe.customConfig:null
  };
}
function tourJoinOnline(){
  if(typeof Peer==='undefined'){tourStatus('⏳ Cargando conexión online...');return;}
  const code=(document.getElementById('tournament-join-code').value||'').trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{4}$/.test(code)){tourStatus('⚠️ Escribe el código de 4 caracteres.');return;}
  tourResetState('online',4);
  const t=tournament;
  t.host=false;t.me='';t.code=code;t.members=[];
  document.getElementById('tournament-host-start').style.display='none';
  showOverlay('tournament-lobby-overlay');
  tourStatus('⏳ Buscando torneo '+code+'...');
  const peer=new Peer(PEER_ICE_CONFIG);t.peer=peer;
  peer.on('open',id=>{
    if(tournament!==t)return;
    t.me=id;
    const conn=peer.connect(TOUR_ROOM_PREFIX+code,{reliable:true,serialization:'json'});
    t.hostConn=conn;
    conn.on('open',()=>{
      if(tournament!==t)return;
      tourStatus('✅ Conectado. Esperando al anfitrión...');
      conn.send({type:'TOUR_HELLO',fighterInfo:tourOwnInfo()});
    });
    conn.on('data',(packet)=>{if(tournament===t)tourReceiveHost(packet);});
    conn.on('close',()=>{if(tournament===t)tourHostDisconnected();});
    conn.on('error',(err)=>{if(tournament===t)tourStatus('⚠️ Error de canal del torneo: '+(err?.type||'red'));});
  });
  peer.on('error',err=>{if(tournament===t)tourStatus('⚠️ No se pudo conectar al torneo ('+(err?.type||'red')+').');});
}
async function tourCopyCode(){
  const code=tournament?.code;
  if(!code){tourStatus('Primero crea una sala online.');return;}
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(code);
    else {const el=document.createElement('textarea');el.value=code;document.body.appendChild(el);el.select();document.execCommand('copy');el.remove();}
    tourStatus('📋 Código '+code+' copiado.');
  }catch(e){tourStatus('Código de torneo: '+code);}
}
function tourPublic(){
  const t=tournament;
  if(!t)return null;
  return {mode:t.mode,size:t.size,code:t.code,status:t.status, members:t.members.map(p=>({...p})),
    matches:t.matches.map(m=>({...m})),current:t.current,winner:t.winner,runnerUp:t.runnerUp,third:t.third,
    awaitContinueWinner:t.awaitContinueWinner, awaitContinueTriggered:t.awaitContinueTriggered, version:t.roundVersion};
}
function tourSend(id,packet){
  const t=tournament;if(!t || t.mode!=='online')return;
  if(id===t.me){tourReceiveHost(packet);return;}
  const c=t.peers.get(id);
  if(c?.open){try{c.send(packet);}catch(e){}}
}
function tourBroadcast(packet){
  const t=tournament;if(!t)return;
  if(t.mode==='online') for(const p of t.members)if(p.id!==t.me)tourSend(p.id,packet);
}
// Un espectador prefiere el fotograma más reciente a una cola de fotogramas viejos.
// No descartamos resultados, controles, ataques ni estados hacia luchadores.
function tourSendWatch(id,packet){
  const t=tournament;if(!t)return;
  if(id!==t.me){
    const conn=t.peers?.get(id);
    const backlog=conn?.dataChannel?.bufferedAmount||0;
    if(backlog>48*1024)return; // red lenta: omitir este frame y mandar el siguiente.
  }
  tourSend(id,packet);
}
function tourPublish(){
  const t=tournament;if(!t)return;
  t.roundVersion++;
  tourBroadcast({type:'TOUR_SYNC',state:tourPublic()});
  tourRenderLobby();
  tourUpdateHud();
}
function tourReceiveHost(packet){
  const t=tournament;if(!t||!packet?.type)return;
  if(packet.type==='TOUR_SYNC'){
    if(t.host)return;
    const d=packet.state;if(!d)return;
    t.size=d.size;t.status=d.status;t.members=d.members;t.matches=d.matches;
    t.current=d.current;t.winner=d.winner;t.runnerUp=d.runnerUp;t.third=d.third;
    t.awaitContinueWinner=d.awaitContinueWinner||null;
    t.awaitContinueTriggered=!!d.awaitContinueTriggered;
    updateVersusResultActions();
    tourRenderLobby();tourUpdateHud();
  }else if(packet.type==='TOUR_BOUT'){
    tourEnterBout(packet.match,packet.players);
  }else if(packet.type==='TOUR_COMBAT'){
    tourConsumeCombat(packet.sender,packet.packet);
  }else if(packet.type==='TOUR_CPU_FRAME'){
    tourConsumeCpuFrame(packet);
  }else if(packet.type==='TOUR_FINISH'){
    tourShowResult(packet.match,packet.winner,packet.reason,packet.awaitContinueWinner);
  }else if(packet.type==='TOUR_END'){
    tourEndScreen(packet.summary);
  }else if(packet.type==='TOUR_ERROR'){
    tourStatus('❌ '+packet.msg);
  }
}
function tourHandleDisconnect(id){
  const t=tournament;if(!t||!t.host)return;
  t.peers.delete(id);
  const p=t.members.find(x=>x.id===id);if(!p || !p.connected)return;
  if(t.status==='lobby'){
    // El puesto se libera para que otro amigo pueda entrar antes de empezar.
    t.members=t.members.filter(x=>x.id!==id);
    tourPublish();
    return;
  }
  p.connected=false;
  const completed=t.matches.find(x=>x.id===t.current && x.status==='done');
  if(completed && t.awaitContinueWinner===id) {
    t.awaitContinueWinner=null;
    t.awaitContinueTriggered=true;
    if(tourRoundTimer)clearTimeout(tourRoundTimer);
    tourRoundTimer=setTimeout(()=>{if(tournament===t)tourAdvanceAfterContinue();},
      Math.max(0,(t.resultReadyAt||0)-performance.now()));
  }
  const m=t.matches.find(x=>x.id===t.current && x.status==='live');
  if(m && (m.a===id || m.b===id)){
    const rival=m.a===id?m.b:m.a;
    if(rival)tourResolveWin(rival,'Desconexión: victoria automática');
  }
  tourPublish();
}
function tourHostDisconnected(){
  const t=tournament;if(!t || t.host)return;
  const m=t.matches.find(x=>x.id===t.current);
  const opponent=m && [m.a,m.b].find(id=>id!==t.me);
  const hostWasOpponent=opponent==='HOST';
  if(m && hostWasOpponent && gameState==='MINIGAME'){
    vsWinner=fighters[0]?.displayName||'JUGADOR';vsWinnerIdx=0;vsEndAnimTimer=0;
  }
  gameState='MENU';updateTouchControlsVisibility();
  showOverlay('tournament-lobby-overlay');
  tourStatus(hostWasOpponent?'🏆 El anfitrión se desconectó: ganas este combate. El torneo se ha cancelado.':'⚠️ El anfitrión se desconectó. El torneo se ha cancelado.');
}
function tourBracketDefinition(size){
  const t=tournament, initial=size===8?'q':'s', rounds=[];
  for(let i=0;i<size/2;i++){
    rounds.push({id:initial+i, round:initial, a:t.members[2*i].id, b:t.members[2*i+1].id,winner:null,loser:null,status:'pending'});
  }
  if(size===8){
    for(let i=0;i<2;i++)rounds.push({id:'s'+i,round:'s',a:null,b:null,winner:null,loser:null,status:'pending'});
  }
  rounds.push({id:'third',round:'third',a:null,b:null,winner:null,loser:null,status:'pending'});
  rounds.push({id:'final',round:'final',a:null,b:null,winner:null,loser:null,status:'pending'});
  return rounds;
}
function tourStartBracket(){
  const t=tournament;if(!t||!t.host||t.status!=='lobby')return;
  if(t.members.filter(p=>p.connected&&!p.cpu).length<1){
    tourStatus('⚠️ Se necesita al menos un montañista para iniciar.');return;
  }
  // No convertir en CPU a invitados desconectados durante la espera;
  // sus plazas ya se liberan en tourHandleDisconnect.
  if(t.members.some(p=>!p.connected)){
    tourStatus('⚠️ Revisa a los participantes desconectados antes de empezar.');return;
  }
  if(t.mode==='online')tourFillMissingCpu(t);
  t.matches=tourBracketDefinition(t.size);t.status='playing';t.current=null;
  t.roundVersion++;tourPublish();tourNextMatch();
}
function tourNextMatch(){
  const t=tournament;if(!t||!t.host||t.status!=='playing')return;
  const match=t.matches.find(m=>m.status==='pending'&&m.a&&m.b);
  if(!match){
    const incomplete=t.matches.some(m=>m.status!=='done');
    if(!incomplete){
      t.status='complete';t.current=null;t.winner=t.matches.find(m=>m.id==='final')?.winner;
      t.runnerUp=t.matches.find(m=>m.id==='final')?.loser;
      t.third=t.matches.find(m=>m.id==='third')?.winner;
      tourPublish();
      const summary=tourPublic();tourBroadcast({type:'TOUR_END',summary});tourEndScreen(summary);
    }
    return;
  }
  t.current=match.id;
  match.stageId=apusStageForTournament(match,t);
  const a=t.members.find(p=>p.id===match.a),b=t.members.find(p=>p.id===match.b);
  if(!a?.connected||!b?.connected){
    tourResolveWin(a?.connected?match.a:match.b,'Desconexión: pase automático');return;
  }
  match.status='live';t.roundVersion++;tourPublish();
  const players=[a,b];
  tourBroadcast({type:'TOUR_BOUT',match:{...match},players});
  tourEnterBout(match,players);
}
function tourEnterBout(match,players){
  const t=tournament;if(!t||t.status!=='playing')return;
  const stage=Number(match.stageId);
  apusActiveFightStageId=Number.isInteger(stage)&&stage>=0&&stage<=12?stage:0;
  t.current=match.id;
  const [a,b]=players;
  const me=t.me;
  t.cpuAutoplay=false;
  t.cpuBout=false;
  t.cpuSimulation=false;
  t.awaitContinueTriggered=false;
  t.awaitContinueWinner=null;
  t.resultReadyAt=0;
  t.simFirstId=null;
  t.simSecondId=null;
  t.lastCpuFrameAt=0;
  t.lastWatchFrameAt=performance.now();
  t.lastWatchTickAt=performance.now();
  tourAttackSequence=0;
  tourLastReceivedAttackId=0;
  keys.left=false;keys.right=false;keys.up=false;keys.defend=false;
  vsWinner=null;
  vsWinnerIdx=-1;
  vsEndAnimTimer=0;
  const i=me===a.id?0:(me===b.id?1:-1);
  tourUpdateHud();
  document.getElementById('vs-end-actions').style.display='none';
  showOverlay(null);

  // CPU en modo online: el participante humano simula su propio combate;
  // si son dos CPU, lo simula únicamente el anfitrión. Las pantallas restantes
  // son espectadores y reciben ambos luchadores desde el simulador.
  const involvesCpu = !!(a.cpu || b.cpu);
  const human = !a.cpu ? a : (!b.cpu ? b : null);
  const simulatedHere = t.mode==='offline' || (involvesCpu &&
    (human ? human.id===me : t.host));
  if (simulatedHere) {
    const humanInThisMatch=!!(human && human.id===me);
    t.cpuAutoplay=!humanInThisMatch;
    t.cpuBout=involvesCpu;
    t.cpuSimulation=t.mode==='online' && involvesCpu;
    // El motor offline controla a fighters[0] (humano o CPU anfitriona),
    // y fighters[1] siempre es el segundo CPU de ese combate.
    const own=humanInThisMatch?human:a;
    const other=humanInThisMatch?(own.id===a.id?b:a):b;
    t.simFirstId=own.id;
    t.simSecondId=other.id;
    selectedCpuOpponent=other.fighterInfo.char==='CHUGO'?'CHUGO':'JORDY';
    startVersusMiniGame(false);
    fighters[0].char=own.fighterInfo.char;
    fighters[0].customConfig=own.fighterInfo.customConfig;
    fighters[0].displayName=own.name;
    fighters[1].char=other.fighterInfo.char;
    fighters[1].customConfig=other.fighterInfo.customConfig;
    fighters[1].displayName=other.name;
    if(t.cpuAutoplay){
      // Combates CPU vs CPU más breves, igual que los torneos offline previos.
      for(const f of fighters){f.hp=140;f.maxHp=140;f.hpGhost=140;}
    }
    t.returnGameState='MINIGAME';t.returnMatchId=match.id;
    updateTouchControlsVisibility();
    tourUpdateHud();
  } else if (!involvesCpu && t.mode==='online' && i>=0) {
    // Confrontación entre dos personas: ruta ONLINE EXISTENTE sin cambios.
    isOnlineHost=i===0;
    startVersusMiniGame(true,players[1-i].fighterInfo);
    fighters[0].displayName=players[i].name;
    fighters[1].displayName=players[1-i].name;
    t.returnGameState='MINIGAME';t.returnMatchId=match.id;
    tourUpdateHud();
  } else {
    fighters=players.map((p,idx)=>tourMakeSpectatorFighter(p,idx));
    projectiles=[];vsFloaters=[];
    gameState='TOURNAMENT_WATCH';
    updateTouchControlsVisibility();
    sound.playBGM('bgm_versus');
    t.returnGameState='TOURNAMENT_WATCH';t.returnMatchId=match.id;
    tourUpdateHud();
  }
}
function tourMakeSpectatorFighter(p,idx){
  const x=idx===0?260:700;
  return {char:p.fighterInfo.char,displayName:p.name,customConfig:p.fighterInfo.customConfig,
    x,y:getFightGroundY(),netTargetX:x,netTargetY:getFightGroundY(),vx:0,vy:0,hp:350,maxHp:350,hpGhost:350,facing:idx===0?1:-1,
    onGround:true,blocking:false,guardPose:false,action:null,actionTimer:0,cooldown:0,hurtTimer:0,
    anim:0,shieldBlocks:0,shieldCooldown:0,shieldReadyAt:0,shieldAnim:0,
    knockbackFrames:0,knockbackDir:0,knockbackPerFrame:12};
}
// Los combates mixtos no usan MELEE_ATTACK/STATE del 1 vs 1:
// el cliente simulador entrega un fotograma completo para espectadores.
function tourSendCpuFrame() {
  const t=tournament;
  if(!t||t.mode!=='online'||!t.cpuSimulation||t.status!=='playing'||
     gameState!=='MINIGAME'||fighters.length!==2)return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');
  if(!m)return;
  const now=performance.now();
  if(now-t.lastCpuFrameAt<TOUR_CPU_FRAME_INTERVAL)return;
  t.lastCpuFrameAt=now;
  const frame={
    actors:fighters.map((f,i)=>({id:i===0?t.simFirstId:t.simSecondId,
      x:f.x,y:f.y,facing:f.facing,hp:f.hp,maxHp:f.maxHp,
      blocking:!!f.blocking,guardPose:!!f.guardPose,
      shieldAnim:f.shieldAnim||0,shieldCooldown:f.shieldCooldown||0,
      action:f.action||null,anim:f.anim||0,hurtTimer:f.hurtTimer||0})),
    projectiles:projectiles.map(p=>({ownerId:p.owner===0?t.simFirstId:t.simSecondId,
      type:p.type||'BEER',x:p.x,y:p.y,vx:p.vx,vy:p.vy,rot:p.rot,life:p.life}))
  };
  if(t.host)tourRouteCpuFrame(t.me,{match:m.id,frame});
  else if(t.hostConn?.open)try{t.hostConn.send({type:'TOUR_CPU_FRAME',match:m.id,frame});}catch(e){}
}
function tourRouteCpuFrame(sender,packet) {
  const t=tournament;
  if(!t||!t.host||t.mode!=='online'||t.status!=='playing')return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');
  if(!m||packet?.match!==m.id)return;
  const a=t.members.find(p=>p.id===m.a), b=t.members.find(p=>p.id===m.b);
  if(!a||!b||!(a.cpu||b.cpu))return;
  const expectedOwner=!a.cpu?a.id:(!b.cpu?b.id:t.me);
  if(sender!==expectedOwner)return;
  const out={type:'TOUR_CPU_FRAME',match:m.id,frame:packet.frame};
  if(t.me!==sender)tourConsumeCpuFrame(out);
  for(const p of t.members){
    if(!p.cpu&&p.connected&&p.id!==t.me&&p.id!==sender)tourSendWatch(p.id,out);
  }
}
function tourConsumeCpuFrame(packet) {
  const t=tournament;
  if(!t||t.status!=='playing'||gameState!=='TOURNAMENT_WATCH')return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');
  if(!m||packet?.match!==m.id||fighters.length!==2)return;
  const frame=packet.frame;
  if(!Array.isArray(frame?.actors)||frame.actors.length!==2)return;
  t.lastWatchFrameAt=performance.now();
  for(const actor of frame.actors){
    const i=actor.id===m.a?0:(actor.id===m.b?1:-1);
    if(i<0||!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||
       !Number.isFinite(actor.hp))continue;
    const f=fighters[i];
    f.netTargetX=Math.max(65,Math.min(FIGHT_STAGE_W-65,actor.x));
    f.netTargetY=actor.y;
    f.facing=actor.facing===-1?-1:1;
    f.hp=Math.max(0,Math.min(350,actor.hp));
    if(Number.isFinite(actor.maxHp))f.maxHp=actor.maxHp;
    f.blocking=!!actor.blocking;
    f.guardPose=!!actor.guardPose;
    f.shieldAnim=actor.shieldAnim||0;
    f.shieldCooldown=actor.shieldCooldown||0;
    f.action=actor.action||null;
    f.anim=actor.anim||0;
    f.hurtTimer=actor.hurtTimer||0;
  }
  // Proyectiles sobre el terreno sincronizados con el simulador.
  if(Array.isArray(frame.projectiles)){
    projectiles=frame.projectiles.slice(0,16).filter(p=>
      Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.vx)
    ).map(p=>({...p,owner:p.ownerId===m.a?0:1,life:p.life||60}));
  }
}
function tourRouteFighter(sender,packet){
  const t=tournament;if(!t||!t.host||t.status!=='playing'||!packet?.type)return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');
  if(!m || (sender!==m.a&&sender!==m.b))return;
  const to=sender===m.a?m.b:m.a;
  const out={type:'TOUR_COMBAT',sender,packet};
  tourSend(to,out);
  // Espectadores reciben posiciones y proyectiles; no alteran las vidas.
  if(['STATE','BEER'].includes(packet.type)){
    for(const p of t.members){
      if(p.id!==sender && p.id!==to && p.connected)tourSendWatch(p.id,out);
    }
  }
}
function tourSendCombat(packet){
  const t=tournament;if(!t||t.mode!=='online'||!packet||t.cpuSimulation)return;
  if(packet.type==='STATE'){
    const now=performance.now();
    if(now-t.lastStateAt<TOUR_STATE_INTERVAL)return;
    t.lastStateAt=now;
    // La personalización ya se entregó en TOUR_BOUT: no repetirla cada 50 ms.
    // Este ajuste solo aplica a la sala del torneo, no al 1vs1 tradicional.
    packet={type:'STATE',nx:packet.nx,jumpOffset:packet.jumpOffset,
      facing:packet.facing,blocking:packet.blocking,action:packet.action,
      anim:packet.anim,myHp:packet.myHp};
  }
  if(t.host)tourRouteFighter(t.me,packet);
  else if(t.hostConn?.open)try{t.hostConn.send({type:'TOUR_FIGHTER_PACKET',packet});}catch(e){}
}
function tourConsumeCombat(sender,p){
  const t=tournament;if(!t||t.status!=='playing'||!p?.type)return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');
  if(!m)return;
  if(gameState==='MINIGAME'){
    if(sender===t.me || (sender!==m.a&&sender!==m.b) || fighters.length!==2)return;
    const remote=fighters[1];
    if(p.type==='STATE'){
      remote.x=p.nx*FIGHT_STAGE_W;
      remote.y=getFightGroundY()-(p.jumpOffset||0);
      remote.facing=typeof p.facing==='number'?p.facing:remote.facing;
      remote.blocking=!!p.blocking;
      remote.action=p.action||null;
      remote.anim=p.anim||0;
      if(p.customConfig){remote.char='CUSTOM';remote.customConfig=p.customConfig;}
      if(typeof p.myHp==='number'){
        remote.hp=p.myHp;
        if(remote.hp<=0&&!vsWinner)declareVersusWinner(0);
      }
    }else if(p.type==='MELEE_ATTACK'&&!vsWinner){
      const dmg=[AXE_DAMAGE,KICK_DAMAGE].includes(p.dmg)?p.dmg:AXE_DAMAGE;
      // Paquetes antiguos siguen siendo compatibles dentro del torneo.
      if(Number.isInteger(p.attackId) && p.attackId>0){
        if(p.attackId<=tourLastReceivedAttackId)return;
        tourLastReceivedAttackId=p.attackId;
        if(p.confirmedHit===true && Number.isFinite(p.attackX) &&
           Number.isFinite(p.attackY) && p.attackX>=0 && p.attackX<=FIGHT_STAGE_W &&
           Math.abs(p.attackY-getFightGroundY())<140){
          // La defensa y el daño se resuelven en el dispositivo de la víctima.
          dealDamage(fighters[1],fighters[0],dmg,p.attackX);
        }
      }else checkMeleeHit(fighters[1],fighters[0],dmg);
    }else if(p.type==='BEER'&&!vsWinner){spawnBeer(1);}
  }else if(gameState==='TOURNAMENT_WATCH'&&fighters.length===2){
    const index=sender===m.a?0:(sender===m.b?1:-1);
    if(index<0)return;
    if(p.type==='STATE'){
      const f=fighters[index];
      if(!Number.isFinite(p.nx))return;
      t.lastWatchFrameAt=performance.now();
      f.netTargetX=Math.max(65,Math.min(FIGHT_STAGE_W-65,p.nx*FIGHT_STAGE_W));
      f.netTargetY=getFightGroundY()-(Number(p.jumpOffset)||0);
      f.facing=typeof p.facing==='number'?p.facing:f.facing;
      f.blocking=!!p.blocking;
      f.guardPose=f.blocking || p.action==='GUARD_WEAK';
      f.shieldAnim=f.guardPose?1:0;
      f.action=p.action||null;
      f.anim=p.anim||0;
      if(typeof p.myHp==='number')f.hp=p.myHp;
    }else if(p.type==='BEER'){spawnBeer(index);}
  }
}
function tourReceiveResult(sender,winner){
  const t=tournament;if(!t||!t.host||t.status!=='playing')return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');
  if(!m || ![m.a,m.b].includes(sender)||![m.a,m.b].includes(winner))return;
  const ma=t.members.find(p=>p.id===m.a),mb=t.members.find(p=>p.id===m.b);
  if((ma?.cpu||mb?.cpu)&&(!ma?.cpu?m.a:(!mb?.cpu?m.b:t.me))!==sender)return;
  tourResolveWin(winner,'KO');
}
function tourNotifyWin(index){
  const t=tournament;if(!t||t.status!=='playing')return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');if(!m)return;
  let winner;
  if(t.mode==='offline'||t.cpuSimulation){
    winner=index===0?t.simFirstId:t.simSecondId;
    if(t.host)tourResolveWin(winner,'KO');
    else if(t.hostConn?.open)try{t.hostConn.send({type:'TOUR_RESULT',winner});}catch(e){}
  }else{
    winner=index===0?t.me:(m.a===t.me?m.b:m.a);
    if(t.host)tourReceiveResult(t.me,winner);
    else if(t.hostConn?.open)try{t.hostConn.send({type:'TOUR_RESULT',winner});}catch(e){}
  }
}
function tourWinnerNeedsConfirmation(t, winnerId) {
  const p = t?.members?.find(x => x.id === winnerId);
  return !!(p && !p.cpu);
}
function tourAdvanceAfterContinue(){
  const t=tournament;if(!t||!t.host||t.status!=='playing')return;
  t.awaitContinueWinner = null;
  t.awaitContinueTriggered = false;
  if(tourRoundTimer)clearTimeout(tourRoundTimer);
  tourRoundTimer = null;
  tourNextMatch();
}
function tourWinnerContinue(){
  const t=tournament;
  if(!t||t.status!=='playing'||!t.awaitContinueWinner||t.awaitContinueTriggered)return;
  const match=t.matches.find(m=>m.id===t.current && m.status==='done');
  if(!match||match.winner!==t.me||t.me!==t.awaitContinueWinner)return;
  if(performance.now() < (t.resultReadyAt||0))return; // Nunca antes de 3 segundos.
  if(t.host){
    t.awaitContinueTriggered=true;
    tourAdvanceAfterContinue();
  }else if(t.hostConn?.open){
    t.awaitContinueTriggered=true;
    updateVersusResultActions();
    try { t.hostConn.send({type:'TOUR_CONTINUE',match:match.id,winner:t.me}); }
    catch(e){t.awaitContinueTriggered=false;updateVersusResultActions();}
  }else {
    tourStatus('⚠️ Sin conexión al anfitrión; no se pudo continuar.');
  }
}
function tourResolveWin(winner,reason){
  const t=tournament;if(!t||!t.host||t.status!=='playing')return;
  const m=t.matches.find(m=>m.id===t.current&&m.status==='live');
  if(!m||![m.a,m.b].includes(winner))return;
  const loser=winner===m.a?m.b:m.a;
  m.winner=winner;m.loser=loser;m.status='done';
  if(t.size===8 && m.round==='q'){
    const k=Number(m.id.slice(1));
    const semi=t.matches.find(x=>x.id==='s'+Math.floor(k/2));
    if(k%2===0)semi.a=winner;else semi.b=winner;
  }
  if(m.round==='s'){
    const k=Number(m.id.slice(1));
    const fin=t.matches.find(x=>x.id==='final'), third=t.matches.find(x=>x.id==='third');
    if(k===0){fin.a=winner;third.a=loser;}else{fin.b=winner;third.b=loser;}
  }
  t.current=m.id;t.roundVersion++;
  t.awaitContinueWinner = tourWinnerNeedsConfirmation(t, winner) ? winner : null;
  t.awaitContinueTriggered = false;
  t.resultReadyAt=performance.now()+3000;
  tourBroadcast({type:'TOUR_FINISH',match:m.id,winner,reason,
    awaitContinueWinner:t.awaitContinueWinner});
  tourShowResult(m.id,winner,reason);
  tourPublish();
  if(tourRoundTimer)clearTimeout(tourRoundTimer);
  if(!t.awaitContinueWinner){
    tourRoundTimer=setTimeout(()=>{tourRoundTimer=null;if(tournament===t)tourAdvanceAfterContinue();},3100);
  }
}
function tourShowResult(matchId,winner,reason,waitForWinner){
  const t=tournament;if(!t)return;
  if(matchId!==t.current)return;
  const p=t.members.find(x=>x.id===winner);
  // En invitados, el ganador autorizado llega en TOUR_FINISH y también en TOUR_SYNC.
  if(!t.host) t.awaitContinueWinner = waitForWinner !== undefined ? waitForWinner :
    (tourWinnerNeedsConfirmation(t,winner) ? winner : null);
  t.awaitContinueTriggered=false;
  if(!t.host || !t.resultReadyAt) t.resultReadyAt=performance.now()+3000;
  vsWinner=p?.name||'GANADOR';
  const m=t.matches.find(x=>x.id===matchId);
  if(m){
    const first=(t.cpuSimulation||t.mode==='offline')&&t.simFirstId?t.simFirstId:m.a;
    vsWinnerIdx=winner===first?0:1;
  }
  vsEndAnimTimer=180;
  document.getElementById('vs-end-actions').style.display='none';
  tourUpdateHud('🏆 '+vsWinner+' · '+reason);
  updateVersusResultActions();
}
function tourEndScreen(summary){
  const t=tournament;if(!t)return;
  t.status='complete';
  if(summary){t.members=summary.members;t.matches=summary.matches;t.winner=summary.winner;t.runnerUp=summary.runnerUp;t.third=summary.third;}
  gameState='MENU';updateTouchControlsVisibility();
  showOverlay('tournament-end-overlay');
  const winnerName=id=>t.members.find(x=>x.id===id)?.name||'—';
  document.getElementById('tournament-podium').innerHTML=
    `<div class="tour-medal">🥇 CAMPEÓN: ${tourEscape(winnerName(t.winner))}</div>`+
    `<div class="tour-medal">🥈 SEGUNDO: ${tourEscape(winnerName(t.runnerUp))}</div>`+
    `<div class="tour-medal">🥉 TERCERO: ${tourEscape(winnerName(t.third))}</div>`;
  tourRenderLobby();
}
function tourEscape(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function tourRenderLobby(){
  const t=tournament;if(!t)return;
  const list=document.getElementById('tournament-players-list');
  if(list){list.innerHTML=t.members.map((p,i)=>`<div class="tour-player">${i+1}. ${tourEscape(p.name)} ${p.cpu?'🤖':''} ${p.connected?'✅':'⚠️ DESCONECTADO'}</div>`).join('');}
  const code=document.getElementById('tournament-code-display');
  if(code)code.textContent=t.mode==='online'?t.code:'SIN INTERNET';
  const count=document.getElementById('tournament-count');
  if(count){
    const humanCount=t.members.filter(p=>p.connected&&!p.cpu).length;
    const cpuCount=t.members.filter(p=>p.cpu).length;
    count.textContent=t.status==='lobby'&&t.mode==='online'
      ?`${humanCount} humano(s) · ${t.size-humanCount} plaza(s) CPU al empezar`
      :`${humanCount} humano(s) + ${cpuCount} CPU / ${t.size}`;
  }
  const returnBtn=document.getElementById('tournament-return-to-fight');
  if(returnBtn){
    returnBtn.style.display=t.status==='lobby'?'none':'block';
    returnBtn.textContent=t.status==='complete'?'↩️ VOLVER AL PODIO':
      (t.returnGameState==='TOURNAMENT_WATCH'?'👁️ VOLVER A VER EL COMBATE':'↩️ VOLVER AL COMBATE');
  }
  const hostStart=document.getElementById('tournament-host-start');
  if(hostStart){hostStart.style.display=t.host&&t.status==='lobby'?'block':'none';
    hostStart.disabled=!t.host||t.members.filter(p=>p.connected&&!p.cpu).length<1||t.members.some(p=>!p.connected);
  }
  const bracket=document.getElementById('tournament-bracket');
  if(bracket){
    if(!t.matches.length){bracket.innerHTML='<p class="controls-hint">El cuadro se genera al comenzar. Las plazas sin personas se completan con CPU.</p>';}
    else bracket.innerHTML=t.matches.map(m=>{
      const name=id=>t.members.find(p=>p.id===id)?.name||(id?'JUGADOR':'POR DEFINIR');
      return `<div class="tour-match ${m.status==='live'?'tour-current':''}"><strong>${TOUR_ROUND_LABELS[m.round]||m.round}${m.status==='live'?' 🔴 EN VIVO':''}</strong><div>${tourEscape(name(m.a))} <b>VS</b> ${tourEscape(name(m.b))}</div>${m.winner?`<small>🏆 ${tourEscape(name(m.winner))}</small>`:''}</div>`;
    }).join('');
  }
}
function tourUpdateHud(custom){
  const t=tournament, hud=document.getElementById('tournament-hud');
  if(!hud)return;
  const fightVisible=t && t.status==='playing' && !vsWinner &&
    (gameState==='MINIGAME'||gameState==='TOURNAMENT_WATCH');
  // Nunca superponer el botón a un menú abierto.
  const menuOpen=!!document.querySelector('.overlay.active');
  hud.style.display=fightVisible && !menuOpen?'flex':'none';
}
function tourShowBracket(){
  const t=tournament;if(!t)return;
  if(t.status==='playing' && (gameState==='MINIGAME'||gameState==='TOURNAMENT_WATCH')){
    t.returnGameState=gameState;
    t.returnMatchId=t.current;
  }
  tourRenderLobby();
  showOverlay('tournament-lobby-overlay');
  tourUpdateHud();
}
function tourResumeSpectate(){
  const t=tournament;if(!t)return;
  if(t.status==='complete'){
    tourEndScreen(tourPublic());
    tourUpdateHud();
    return;
  }
  if(t.status!=='playing'){
    tourRenderLobby();showOverlay('tournament-lobby-overlay');tourUpdateHud();
    return;
  }
  // Regresar sin recrear los luchadores ni reiniciar la vida o los combates.
  const match=t.matches.find(m=>m.id===t.current);
  if(match?.status==='live' && !['MINIGAME','TOURNAMENT_WATCH'].includes(gameState)){
    if(t.returnMatchId===t.current && fighters.length===2 &&
       ['MINIGAME','TOURNAMENT_WATCH'].includes(t.returnGameState)){
      gameState=t.returnGameState;
    }else if(fighters.length!==2){
      const a=t.members.find(p=>p.id===match.a);
      const b=t.members.find(p=>p.id===match.b);
      if(a&&b)tourEnterBout(match,[a,b]);
    }
  }
  showOverlay(null);
  updateTouchControlsVisibility();
  tourUpdateHud();
}
function tourCpuDrive(){
  const t=tournament;
  if(!t?.cpuAutoplay || gameState!=='MINIGAME'||fighters.length!==2||vsWinner)return;
  const me=fighters[0],other=fighters[1];
  keys.left=false;keys.right=false;keys.defend=false;keys.up=false;
  const dist=Math.abs(me.x-other.x);
  if(dist>78){keys.left=other.x<me.x;keys.right=other.x>me.x;}
  else if(me.cooldown<=0){
    if(Math.random()<0.36)triggerKick();else triggerFighterAxe();
  }
  if(dist>220 && me.cooldown<=0 && Math.random()<0.02)triggerBeerThrow();
}
function tourWatchAnimation(){
  if(gameState!=='TOURNAMENT_WATCH')return;
  const t=tournament;
  const now=performance.now();
  const elapsed=Math.max(8,Math.min(55,now-(t?.lastWatchTickAt||now-16)));
  if(t)t.lastWatchTickAt=now;
  const alpha=1-Math.exp(-elapsed/TOUR_WATCH_SMOOTH_MS);
  if(vsWinner) {
    vsEndAnimTimer = tournament?.resultReadyAt ?
      Math.ceil(Math.max(0,tournament.resultReadyAt-performance.now())/(1000/60)) :
      Math.max(0,vsEndAnimTimer-1);
    updateVersusResultActions();
  }
  const gy=getFightGroundY();
  for(const f of fighters){
    if(!f)continue;
    if(Number.isFinite(f.netTargetX)) {
      const dx=f.netTargetX-f.x;
      // Primera actualización puede llegar lejos de la posición inicial del avatar.
      // Después se suavizan desplazamientos sin deformar el empuje del cramponazo.
      if(!f.watchInitialized){f.x=f.netTargetX;f.watchInitialized=true;}
      else f.x+=Math.abs(dx)>500?dx:dx*alpha;
    }
    if(Number.isFinite(f.netTargetY))f.y+=(f.netTargetY-f.y)*alpha;
    f.hpGhost=f.hpGhost>f.hp?Math.max(f.hp,f.hpGhost-1.5):f.hp;
  }
  for(let i=projectiles.length-1;i>=0;i--){
    const pr=projectiles[i];pr.x+=pr.vx;pr.vy+=0.28;pr.y+=pr.vy;pr.rot+=0.3;pr.life--;
    if(pr.y>gy+30||pr.x<0||pr.x>FIGHT_STAGE_W||pr.life<=0)projectiles.splice(i,1);
  }
}
function tourLeave(silent=false){
  if(tourRoundTimer){clearTimeout(tourRoundTimer);tourRoundTimer=null;}
  const t=tournament;
  if(t){
    if(t.mode==='online'&&!t.host&&t.hostConn?.open){try{t.hostConn.send({type:'TOUR_LEAVE'});}catch(e){}}
    try{t.hostConn?.close();}catch(e){}
    if(t.peers)for(const c of t.peers.values())try{c.close();}catch(e){}
    try{t.peer?.destroy();}catch(e){}
  }
  tournament=null;
  keys.left=false;keys.right=false;keys.defend=false;keys.up=false;
  vsIsOnline=false;vsWinner=null;vsEndAnimTimer=0;
  const hud=document.getElementById('tournament-hud');if(hud)hud.style.display='none';
  const end=document.getElementById('vs-end-actions');if(end)end.style.display='none';
  if(!silent){
    gameState='MENU';updateTouchControlsVisibility();showOverlay('versus-selection-overlay');sound.playBGM('bgm_menu');
  }
}
document.addEventListener('visibilitychange',()=>{
  const t=tournament;if(!t || document.hidden||t.mode!=='online')return;
  if(t.peer?.disconnected&&!t.peer.destroyed)try{t.peer.reconnect();}catch(e){}
});

