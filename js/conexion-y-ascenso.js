/* ============================================================================
   ONLINE P2P
   ============================================================================ */
// V25: Enlace P2P reversible. Si el canal invitado -> anfitrión se queda
// esperando ICE, el anfitrión inicia otro canal hacia el invitado, sin cambiar
// quién es anfitrión ni ninguna regla del combate. No es un servidor TURN.
let vsLinkCandidates = [];
let vsReverseTimer = null;
let vsRemotePeerId = null;
let vsPeerGeneration = 0;
let vsMatchStarted = false;
let versusRoomRetries = 0;

function cleanupPeerConnection() {
  versusPausedWhileSharing = false;
  vsPeerGeneration++;
  clearVersusConnectWatchdog();
  if (vsReverseTimer) { clearTimeout(vsReverseTimer); vsReverseTimer = null; }
  if (helloRetryInterval) { clearInterval(helloRetryInterval); helloRetryInterval = null; }
  const closing = [...vsLinkCandidates];
  if (peerConn && !closing.includes(peerConn)) closing.push(peerConn);
  vsLinkCandidates = [];
  peerConn = null;
  for (const conn of closing) {
    try { conn.close(); } catch (e) {}
  }
  if (peerInstance) {
    try { peerInstance.destroy(); } catch (e) {}
    peerInstance = null;
  }
  vsRemotePeerId = null;
  vsMatchStarted = false;
  vsIsOnline = false;
  isOnlineHost = false;
}

function generateShortCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getMyFighterPayload() {
  if (selectedCharacter === "CUSTOM") {
    const cfg = customCharSlots[activeCustomSlot];
    return {
      char: "CUSTOM",
      displayName: (cfg.name || (currentUser ? currentUser.username : "PERS. " + (activeCustomSlot + 1))).toUpperCase(),
      customConfig: cfg
    };
  }
  return {
    char: selectedCharacter,
    displayName: currentUser ? `${selectedCharacter} (${currentUser.username})` : selectedCharacter,
    customConfig: null
  };
}

const PEER_ICE_CONFIG = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" }
    ]
  }
};

let helloRetryInterval = null;
let versusConnectWatchdog = null;
function clearVersusConnectWatchdog() {
  if (versusConnectWatchdog) clearTimeout(versusConnectWatchdog);
  versusConnectWatchdog = null;
}
function getVersusStatusElement() {
  return document.getElementById(isOnlineHost ? "host-status-text" : "join-status-text");
}
function setVersusStatus(text) {
  const el = getVersusStatusElement();
  if (el) el.textContent = text;
}
function setVersusConnectWatchdog(statusElement, roomCode) {
  clearVersusConnectWatchdog();
  const generation = vsPeerGeneration;
  versusConnectWatchdog = setTimeout(() => {
    if (generation !== vsPeerGeneration || vsMatchStarted) return;
    if (document.hidden) { clearVersusConnectWatchdog(); return; }
    if (statusElement) statusElement.textContent =
      "❌ La sala " + roomCode + " fue localizada, pero los dispositivos no lograron abrir el canal de juego. " +
      "Prueben intercambiar anfitrión o cambiar de Wi-Fi a datos móviles. " +
      "Si el problema continúa, la red necesita un servidor TURN.";
    cleanupPeerConnection();
  }, 35000);
}

// El evento PeerJS 'connection' confirma que se recibió la oferta por el
// servidor de señalización, no que WebRTC haya abierto el canal de datos.
function addVersusCandidate(conn) {
  if (!conn || vsLinkCandidates.includes(conn)) return;
  const generation = vsPeerGeneration;
  vsLinkCandidates.push(conn);

  const tryUseChannel = () => {
    if (generation !== vsPeerGeneration) { try { conn.close(); } catch (e) {} return; }
    if (vsMatchStarted || (peerConn && peerConn !== conn && peerConn.open)) {
      try { conn.close(); } catch (e) {}
      return;
    }
    if (!conn.open) return;
    peerConn = conn;
    vsIsOnline = true;
    if (vsReverseTimer) { clearTimeout(vsReverseTimer); vsReverseTimer = null; }
    clearVersusConnectWatchdog();
    setVersusStatus("✅ Canal de juego abierto. Sincronizando luchadores...");
    setupOnlineHandlers(conn, generation);
    // El handshake se hace solo cuando PeerJS ha confirmado conn.open.
  };

  conn.on("open", tryUseChannel);
  if (conn.open) tryUseChannel();
  conn.on("error", (err) => {
    if (generation !== vsPeerGeneration) return;
    console.warn("APUS P2P: error en candidato", err);
    if (!vsMatchStarted && !peerConn?.open) {
      setVersusStatus("⚠️ Un intento falló. Buscando otra ruta de conexión...");
    }
  });
  conn.on("close", () => {
    if (generation !== vsPeerGeneration) return;
    vsLinkCandidates = vsLinkCandidates.filter(x => x !== conn);
    if (peerConn === conn) {
      peerConn = null;
      if (gameState === "MINIGAME" && vsIsOnline) {
        alert("El otro jugador se desconectó.");
        returnToMainMenu();
      } else if (!vsMatchStarted) {
        setVersusStatus("⏳ Canal cerrado. Esperando el enlace alternativo...");
      }
    }
  });
}

// Solo el anfitrión intenta el enlace inverso, dirigido al mismo Peer ID
// del invitado. No intercambiamos quién es anfitrión de la partida.
function scheduleReverseVersusLink(remoteId) {
  if (vsReverseTimer || !isOnlineHost || !remoteId) return;
  const generation = vsPeerGeneration;
  vsReverseTimer = setTimeout(() => {
    vsReverseTimer = null;
    if (generation !== vsPeerGeneration || !peerInstance || vsMatchStarted || peerConn?.open) return;
    setVersusStatus("🔄 Jugador detectado. Probando conexión inversa entre dispositivos...");
    try {
      const alternate = peerInstance.connect(remoteId, { reliable:true, serialization:"json" });
      addVersusCandidate(alternate);
    } catch (err) {
      console.warn("APUS P2P: enlace inverso", err);
    }
  }, 1800);
}

async function copyVersusRoomCode() {
  const code=String(currentRoomCode||'').trim();
  if(!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) {setVersusStatus('Crea una sala primero.');return;}
  try {
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    else {
      const input=document.createElement('textarea');input.value=code;
      input.style.cssText='position:fixed;left:-9999px;top:0';
      document.body.appendChild(input);input.select();
      if(!document.execCommand('copy'))throw new Error('No se pudo copiar');
      input.remove();
    }
    setVersusStatus('📋 Código '+code+' copiado. Envíalo a tu amigo.');
  } catch(e) {
    // La sala sigue disponible, aunque el navegador bloquee el portapapeles.
    setVersusStatus('⚠️ Tu navegador bloqueó Copiar. Código: '+code);
  }
}

function createOnlineRoom(retryCount = 0) {
  if (typeof Peer === "undefined") {
    alert("Cargando servidor Online, intenta en 2 segundos...");
    return;
  }
  cleanupPeerConnection();
  apusStageRoomId=apusChooseFightStage();
  currentRoomCode = generateShortCode();
  const fullPeerId = "APUS-ILINIZA-" + currentRoomCode;
  const generation = vsPeerGeneration;
  isOnlineHost = true;

  const area = document.getElementById("host-room-area");
  if (area) area.style.display = "block";
  const display = document.getElementById("room-code-display");
  if (display) display.textContent = currentRoomCode;
  setVersusStatus("⏳ Creando sala " + currentRoomCode + "...");

  peerInstance = new Peer(fullPeerId, PEER_ICE_CONFIG);
  peerInstance.on("open", () => {
    if (generation !== vsPeerGeneration) return;
    setVersusStatus("✅ Sala lista. Comparte el código con tu amigo...");
  });
  peerInstance.on("connection", (conn) => {
    if (generation !== vsPeerGeneration) { try { conn.close(); } catch (e) {} return; }
    if (vsRemotePeerId && conn.peer !== vsRemotePeerId) {
      try { conn.close(); } catch (e) {}
      return;
    }
    if (vsMatchStarted) { try { conn.close(); } catch (e) {} return; }
    vsRemotePeerId = conn.peer;
    setVersusStatus("🔗 Jugador localizado. Abriendo canal de juego...");
    setVersusConnectWatchdog(getVersusStatusElement(), currentRoomCode);
    addVersusCandidate(conn);
    scheduleReverseVersusLink(conn.peer);
  });
  peerInstance.on("error", (err) => {
    if (generation !== vsPeerGeneration) return;
    if (err && err.type === "unavailable-id" && retryCount < 3) {
      createOnlineRoom(retryCount + 1);
      return;
    }
    setVersusStatus("❌ Error de red de la sala (" + (err ? err.type : "red") + "). Si compartiste el código, vuelve al juego; si no reabre, crea otra sala.");
  });
}

function joinOnlineRoom() {
  if (typeof Peer === "undefined") {
    alert("Cargando servidor Online, intenta en 2 segundos...");
    return;
  }
  const inputEl = document.getElementById("join-code-input");
  const inputCode = (inputEl ? inputEl.value : "").toUpperCase().trim();
  if (!/^[A-HJ-NP-Z2-9]{4}$/.test(inputCode)) {
    const target = document.getElementById("join-status-text");
    if (target) target.textContent = "⚠️ Ingresa las 4 letras o números del código.";
    return;
  }
  cleanupPeerConnection();
  currentRoomCode = inputCode;
  const generation = vsPeerGeneration;
  isOnlineHost = false;
  vsRemotePeerId = "APUS-ILINIZA-" + currentRoomCode;
  setVersusStatus("⏳ Buscando la sala " + currentRoomCode + "...");

  peerInstance = new Peer(PEER_ICE_CONFIG);
  // El invitado TAMBIÉN acepta un enlace inverso iniciado por el anfitrión.
  peerInstance.on("connection", (conn) => {
    if (generation !== vsPeerGeneration || conn.peer !== vsRemotePeerId || vsMatchStarted) {
      try { conn.close(); } catch (e) {}
      return;
    }
    setVersusStatus("🔄 Anfitrión localizado. Abriendo canal alternativo...");
    addVersusCandidate(conn);
  });
  peerInstance.on("open", () => {
    if (generation !== vsPeerGeneration) return;
    const conn = peerInstance.connect(vsRemotePeerId, { reliable:true, serialization:"json" });
    setVersusStatus("⏳ Sala encontrada. Negociando conexión directa...");
    addVersusCandidate(conn);
    setVersusConnectWatchdog(getVersusStatusElement(), currentRoomCode);
  });
  peerInstance.on("error", (err) => {
    if (generation !== vsPeerGeneration) return;
    const type = err ? err.type : "red";
    if (type === "peer-unavailable") setVersusStatus("❌ Código incorrecto o anfitrión sin sala abierta.");
    else setVersusStatus("❌ Error de red (" + type + "). Vuelve al juego y, si continúa, prueba de nuevo.");
  });
}

function setupOnlineHandlers(conn, generation) {
  if (!conn || generation !== vsPeerGeneration || conn !== peerConn || !conn.open) return;
  let matchStarted = false;
  const sendHelloPacket = () => {
    if (generation === vsPeerGeneration && conn.open && conn === peerConn) {
      try { conn.send({ type:"HELLO_FIGHTER", fighterInfo:{...getMyFighterPayload(), stageId:isOnlineHost?apusStageRoomId:undefined} }); } catch (e) {}
    }
  };
  const startFightOnce = (remotePayload) => {
    if (matchStarted || generation !== vsPeerGeneration || conn !== peerConn) return;
    matchStarted = true;
    vsMatchStarted = true;
    if (helloRetryInterval) { clearInterval(helloRetryInterval); helloRetryInterval = null; }
    clearVersusConnectWatchdog();
    sound.playSFX("sfx_checkpoint");
    showOverlay(null);
    if(!isOnlineHost){
      const receivedStage=Number(remotePayload?.stageId);
      apusActiveFightStageId=Number.isInteger(receivedStage)&&receivedStage>=0&&receivedStage<=12?receivedStage:0;
    }
    startVersusMiniGame(true, remotePayload);
    // Cerrar el canal no elegido SIN cancelar la conexión ganadora.
    for (const extra of [...vsLinkCandidates]) {
      if (extra !== conn) { try { extra.close(); } catch (e) {} }
    }
  };

  conn.on("data", (data) => {
    if (generation !== vsPeerGeneration || conn !== peerConn || !data?.type) return;
    if (data.type === "HELLO_FIGHTER") {
      // ACK distinto de HELLO para evitar el bucle de respuestas infinito.
      try { conn.send({ type:"HELLO_ACK", fighterInfo:{...getMyFighterPayload(), stageId:isOnlineHost?apusStageRoomId:undefined} }); } catch (e) {}
      startFightOnce(data.fighterInfo);
    } else if (data.type === "HELLO_ACK") {
      startFightOnce(data.fighterInfo);
    } else if (data.type === "STATE" && fighters.length === 2) {
      const remote = fighters[1];
      remote.x = data.nx * FIGHT_STAGE_W;
      remote.y = getFightGroundY() - (data.jumpOffset || 0);
      remote.facing = typeof data.facing === "number" ? data.facing : remote.facing;
      remote.blocking = !!data.blocking;
      remote.action = data.action || null;
      remote.anim = data.anim || 0;
      if (data.customConfig) {
        remote.char = "CUSTOM";
        remote.customConfig = data.customConfig;
      }
      if (typeof data.myHp === "number") {
        remote.hp = data.myHp;
        if (remote.hp <= 0 && !vsWinner) declareVersusWinner(0);
      }
    } else if (data.type === "MELEE_ATTACK" && fighters.length === 2 && !vsWinner) {
      checkMeleeHit(fighters[1], fighters[0], data.dmg);
    } else if (data.type === "BEER" && fighters.length === 2 && !vsWinner) {
      spawnBeer(1);
    } else if (data.type === "REMATCH" && gameState === "MINIGAME") {
      startVersusMiniGame(true, lastRemoteFighterInfo);
    }
  });
  // Registrar el manejador antes de enviar HELLO evita perder respuestas rápidas.
  sendHelloPacket();
  if (helloRetryInterval) clearInterval(helloRetryInterval);
  helloRetryInterval = setInterval(() => {
    if (matchStarted || generation !== vsPeerGeneration || !conn.open || conn !== peerConn) {
      clearInterval(helloRetryInterval);
      helloRetryInterval = null;
      return;
    }
    sendHelloPacket();
  }, 450);
}

// V26.2: Al compartir el código se puede suspender la pestaña.
// No se crean nuevos Peer, no se cambian códigos y no hay reintentos en bucle.
// Únicamente reanudar la señalización existente si PeerJS marca disconnected.
let versusPausedWhileSharing = false;
function checkVersusResume() {
  if (document.hidden || !peerInstance || vsMatchStarted || peerConn?.open) return;
  const p = peerInstance;
  if (p.destroyed) {
    setVersusStatus('⚠️ La sala se cerró. Pulsa CREAR SALA otra vez.');
    versusPausedWhileSharing = false;
    return;
  }
  if (p.disconnected) {
    setVersusStatus('📶 Restableciendo conexión con la sala ' + currentRoomCode + '...');
    try { p.reconnect(); } catch (err) {
      console.warn('APUS: reconexión puntual', err);
      setVersusStatus('⚠️ No se pudo reabrir la sala. Crea una sala nueva.');
    }
  } else if (versusPausedWhileSharing && p.open && isOnlineHost && !vsRemotePeerId) {
    setVersusStatus('✅ Sala ' + currentRoomCode + ' lista. Tu amigo ya puede entrar.');
  }
  versusPausedWhileSharing = false;
  // Si se estaba negociando una conexión, conceder tiempo completo en pantalla.
  if ((vsRemotePeerId || !isOnlineHost) && !peerConn?.open)
    setVersusConnectWatchdog(getVersusStatusElement(), currentRoomCode);
}
document.addEventListener('visibilitychange', () => {
  if (!peerInstance || vsMatchStarted || peerConn?.open) return;
  if (document.hidden) {
    versusPausedWhileSharing = true;
    clearVersusConnectWatchdog();
  } else checkVersusResume();
});
window.addEventListener('pageshow', checkVersusResume);

/* ============================================================================
   CONTROLES TÁCTILES Y TECLADO
   ============================================================================ */
const keys = {
  left: false, right: false, up: false, down: false,
  jump: false, axe: false, hug: false, kick: false, beer: false, defend: false
};
const joyState = { active: false, dx: 0, dy: 0 };

window.addEventListener("keydown", (e) => {
  if (introActive) {
    if (!e.repeat) introRegisterActivation();
    e.preventDefault();
    return;
  }
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  const code = e.code;
  if (gameState === "MINIGAME" && tournament?.cpuAutoplay) return;
  if (code === "ArrowLeft" || code === "KeyA") keys.left = true;
  if (code === "ArrowRight" || code === "KeyD") keys.right = true;
  if (code === "ArrowUp" || code === "KeyW") {
    keys.up = true;
    if (gameState === "MINIGAME") triggerFighterJump();
    else if (gameState === "STORY" && !e.repeat) triggerJump();
  }
  if (code === "ArrowDown" || code === "KeyS") {
    keys.down = true;
    if (gameState === "MINIGAME") keys.defend = true;
  }
  if (code === "ShiftLeft" || code === "ShiftRight") keys.defend = true;
  if (code === "Space") {
    keys.jump = true;
    if (gameState === "MINIGAME") {
      if (!vsWinner) keys.defend = true;
    } else {
      triggerJump();
    }
  }
  // Ascenso: J saltar, K piolet, L protección. Combate: J defender,
  // K piolet (-8), H cramponazo (-6 + empuje), L Pilsener (-10).
  if (gameState === "STORY") {
    if (code === "KeyJ") {
      keys.jump = true;
      if (!e.repeat) triggerJump();
    }
    if (code === "KeyZ" || code === "KeyK") { keys.axe = true; if (!e.repeat) triggerAxe(); }
    if (code === "KeyX" || code === "KeyL") keys.hug = true;
  } else if (gameState === "MINIGAME") {
    if (code === "KeyJ") keys.defend = true;
    if (code === "KeyZ" || code === "KeyK") {
      keys.axe = true;
      if (!e.repeat) triggerFighterAxe();
    }
    if (code === "KeyH") {
      keys.kick = true;
      if (!e.repeat) triggerKick();
    }
    if (code === "KeyC" || code === "KeyL") {
      keys.beer = true;
      if (!e.repeat) triggerBeerThrow();
    }
  }
});

window.addEventListener("keyup", (e) => {
  const code = e.code;
  if (code === "ArrowLeft" || code === "KeyA") keys.left = false;
  if (code === "ArrowRight" || code === "KeyD") keys.right = false;
  if (code === "ArrowUp" || code === "KeyW") keys.up = false;
  if (code === "ArrowDown" || code === "KeyS") { keys.down = false; keys.defend = false; }
  if (code === "ShiftLeft" || code === "ShiftRight") keys.defend = false;
  if (code === "Space") { keys.jump = false; keys.defend = false; }
  if (gameState === "STORY") {
    if (code === "KeyJ") keys.jump = false;
    if (code === "KeyZ" || code === "KeyK") keys.axe = false;
    if (code === "KeyX" || code === "KeyL") keys.hug = false;
  } else if (gameState === "MINIGAME") {
    if (code === "KeyJ") keys.defend = false;
    if (code === "KeyZ" || code === "KeyK") keys.axe = false;
    if (code === "KeyH") keys.kick = false;
    if (code === "KeyC" || code === "KeyL") keys.beer = false;
  }
});

const joyZone = document.getElementById("joystick-zone");
const joyKnob = document.getElementById("joystick-knob");

function handleJoystickMove(clientX, clientY) {
  if (!joyZone || !joyKnob) return;
  const rect = joyZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = rect.width / 2 - 20;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyState.dx = dx / maxR;
  joyState.dy = dy / maxR;

  if (joyState.dy < -0.55) {
    if (gameState === "STORY" && player.onGround) triggerJump();
    else if (gameState === "MINIGAME" && !vsWinner) triggerFighterJump();
  }
}

function resetJoystick() {
  joyState.active = false;
  joyState.dx = 0;
  joyState.dy = 0;
  if (joyKnob) joyKnob.style.transform = "translate(-50%, -50%)";
}

if (joyZone) {
  joyZone.addEventListener("pointerdown", (e) => {
    joyState.active = true;
    try { joyZone.setPointerCapture(e.pointerId); } catch(err){}
    handleJoystickMove(e.clientX, e.clientY);
  });
  joyZone.addEventListener("pointermove", (e) => {
    if (joyState.active) handleJoystickMove(e.clientX, e.clientY);
  });
  joyZone.addEventListener("pointerup", resetJoystick);
  joyZone.addEventListener("pointercancel", resetJoystick);
}

function bindTouchButton(id, onDown, onUp) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    btn.classList.add("pressed");
    if (onDown) onDown();
  });
  const release = (e) => {
    if (e) e.preventDefault();
    btn.classList.remove("pressed");
    if (onUp) onUp();
  };
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
}

bindTouchButton("tbtn-jump", () => { keys.jump = true; triggerJump(); }, () => { keys.jump = false; });
bindTouchButton("tbtn-axe", () => { keys.axe = true; triggerAxe(); }, () => { keys.axe = false; });
bindTouchButton("tbtn-hug", () => { keys.hug = true; }, () => { keys.hug = false; });

bindTouchButton("fbtn-defend", () => {
  if (!vsWinner) {
    keys.defend = true;
    if (fighters[0]) {
      fighters[0].guardPose = fighters[0].onGround;
      fighters[0].blocking = fighters[0].guardPose &&
        fighters[0].shieldCooldown <= 0 && fighters[0].shieldBlocks < 3;
    }
  }
}, () => {
  keys.defend = false;
  if (fighters[0]) {
    fighters[0].blocking = false;
    fighters[0].guardPose = false;
  }
});
bindTouchButton("fbtn-axe", () => { triggerFighterAxe(); }, null);
bindTouchButton("fbtn-kick", () => { triggerKick(); }, null);
bindTouchButton("fbtn-beer", () => { triggerBeerThrow(); }, null);

/* ============================================================================
   MODO ASCENSO
   ============================================================================ */
function startNewStoryGame() {
  stopSummitCelebration();
  const diff = DIFFICULTIES[diffIndex];
  storyData.levelIdx = 0;
  storyData.score = 0;
  storyData.maxHearts = diff.hearts;
  storyData.hearts = diff.hearts;
  initStoryLevel(0, true);
}


/* ==========================================================================
   GRIETAS DEL ASCENSO (SOLO MODO HISTORIA)
   Nivel 1 / Fácil: ninguna. Niveles 2, 3, 4 y 5: 5 / 8 / 12 / 18.
   En el nivel 2 empiezan solamente cuando la pendiente supera los 45°.
   Coordenadas ligadas a la distancia del nivel: un salto real las supera.
   ========================================================================== */
function buildStoryCrevasses(levelIdx) {
  // La dificultad fácil no tiene grietas y el nivel 1 tampoco.
  if (diffIndex === 0 || levelIdx === 0) return [];
  const lvl = LEVELS[levelIdx];
  const counts = [0, 5, 8, 12, 18];
  const count = counts[levelIdx] || 0;
  if (!count) return [];

  // Primer hueco visible muy pronto en niveles 3–5. El nivel 2 sí espera
  // hasta que la inclinación visual supera los 45 grados reales.
  let startDistance = levelIdx === 4 ? 135 : levelIdx === 3 ? 280 : 380;
  if (levelIdx === 1) {
    let low = 0, high = 1;
    for (let i = 0; i < 28; i++) {
      const t = (low + high) / 2;
      const eased = t * t * (3 - 2 * t);
      if (12 + 48 * eased <= 45) low = t; else high = t;
    }
    startDistance = Math.ceil(high * lvl.totalDistance) + 180;
  }
  const lastDistance = lvl.totalDistance - 490;
  const spacing = (lastDistance - startDistance) / Math.max(1, count - 1);
  return Array.from({length: count}, (_, i) => {
    // Pequeña variación estable sin alterar la cantidad ni crear grupos.
    const variation = i === 0 || i === count - 1 ? 0
      : Math.sin((levelIdx + 8) * 19.71 + i * 7.39) * Math.min(65, spacing * 0.08);
    const centre = startDistance + spacing * i + variation;
    // Huecos distinguibles, pero superables con un salto bien calculado.
    const width = 36 + levelIdx * 2 + (i % 3) * 3;
    return {start: centre - width / 2, end: centre + width / 2};
  });
}

function storyCrevasseAt(distance) {
  const gaps = storyData.crevasses || [];
  return gaps.find(g => distance > g.start + 3 && distance < g.end - 3) || null;
}

function getVisibleStoryCrevasses() {
  // El mismo avance de la partida mueve huecos y obstáculos hacia el jugador.
  // Cámara anclada al personaje: su posición horizontal coincide exactamente
  // con la comprobación de caída en storyCrevasseAt().
  const scale = 1;
  return (storyData.crevasses || []).map(g => ({
    start: player.x + (g.start - storyData.distance) * scale,
    end: player.x + (g.end - storyData.distance) * scale
  })).filter(g => g.end > -35 && g.start < GW + 35);
}

// Un cubo mide unos 48 px: solo se permite donde la roca puede sostenerlo.
// Se usan exactamente los mismos huecos que se dibujan bajo el personaje.
function storyIceOverlapsCrevasse(screenX) {
  return getVisibleStoryCrevasses().some(g =>
    screenX + 29 > g.start && screenX - 29 < g.end
  );
}

function traceStoryCrevasse(ctx2d, gap, surfaceY) {
  const start = Math.max(-38, gap.start);
  const end = Math.min(GW + 38, gap.end);
  if (end <= start) return;
  ctx2d.moveTo(start, surfaceY(start) - 8);
  for (let x = start + 8; x < end; x += 8) {
    ctx2d.lineTo(x, surfaceY(x) - 8);
  }
  ctx2d.lineTo(end, surfaceY(end) - 8);
  ctx2d.lineTo(end + 3, GH + 48);
  ctx2d.lineTo(start - 3, GH + 48);
  ctx2d.closePath();
}

function defeatStoryByCrevasse() {
  if (gameState !== "STORY") return;
  storyData.fallingInCrevasse = false;
  storyData.hearts = 0;
  storyData.score += storyData.levelScore;
  storyData.levelScore = 0;
  gameState = "SUMMIT";
  player.celebrating = false;
  sound.stopBGM();
  sound.playSFX("sfx_hit");
  document.getElementById("end-title").textContent = "❄️ ¡LA MONTAÑA TE VENCIÓ!";
  document.getElementById("end-subtitle").textContent = "CAÍSTE EN UNA GRIETA DEL ILINIZA SUR";
  // Las grietas comparten exactamente las frases aleatorias de derrota.
  document.getElementById("end-defeat-message").textContent =
    STORY_DEFEAT_MESSAGES[Math.floor(Math.random() * STORY_DEFEAT_MESSAGES.length)];
  document.getElementById("end-score-text").textContent = `PUNTAJE TOTAL: ${storyData.score}`;
  updateTouchControlsVisibility();
  prepareGameOverModal();
  showOverlay("gameover-overlay");
}

function initStoryLevel(lvlIdx, resetHearts = false) {
  defeatScoreSavedAutomatically = false;
  storyData.levelIdx = lvlIdx;
  storyData.levelStartScore = storyData.score;
  storyData.levelScore = 0;
  storyData.distance = 0;
  storyData.elapsedSec = 0;
  storyData.beersSpawnedThisLevel = 0;
  storyData.nextIceDist = 550;
  storyData.checkpointTimer = 0;
  storyData.summitSunriseProgress = 0;
  storyData.crevasses = buildStoryCrevasses(lvlIdx);
  storyData.fallingInCrevasse = false;
  // Cada nivel empieza con vida completa, incluso si se continúa desde
  // un punto de control o una partida guardada.
  storyData.maxHearts = DIFFICULTIES[diffIndex].hearts;
  storyData.hearts = storyData.maxHearts;
  updateDiffLabel();

  const lvl = LEVELS[lvlIdx];
  const inFlat = storyData.distance < lvl.flatTutorialDist;
  player.x = isPortrait ? 110 : 180;
  player.y = getGroundY(inFlat);
  player.vx = 0; player.vy = 0;
  player.onGround = true; player.crouching = false;
  player.huggingWall = false; player.swingTimer = 0;
  player.invulnTimer = 0; player.celebrating = false;

  obstacles = [];
  floatingTexts = [];
  snowBreakParticles = [];
  initSnowParticles();

  gameState = "STORY";
  updateTouchControlsVisibility();
  sound.playBGM(lvl.storm ? "bgm_storm" : "bgm_climb");
}

function initSnowParticles() {
  snowParticles = [];
  for (let i = 0; i < 75; i++) {
    snowParticles.push({
      x: Math.random() * GW, y: Math.random() * GH,
      r: Math.random() * 3 + 1,
      vx: -Math.random() * 2 - 0.5, vy: Math.random() * 2.5 + 1.5
    });
  }
}

function addFloatingScore(x, y, text = "+10", color = "#facc15") {
  floatingTexts.push({ x, y, text, color, life: 55 });
}

function spawnSnowBreakEffect(x, y, r = 20) {
  const shardCount = 9 + ((Math.random() * 4) | 0);
  for (let i = 0; i < shardCount; i++) {
    const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.35;
    const speed = 1.4 + Math.random() * 2.8;
    snowBreakParticles.push({
      kind: i % 3 === 0 ? "puff" : "shard",
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.9,
      size: (i % 3 === 0 ? r * 0.32 : r * (0.18 + Math.random() * 0.12)),
      life: 18 + ((Math.random() * 10) | 0),
      maxLife: 26,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.28
    });
  }
}

function maybeSpawnPilsener(x, y) {
  const diff = DIFFICULTIES[diffIndex];
  if (storyData.beersSpawnedThisLevel >= diff.beerQuota) return;

  const lvl = LEVELS[storyData.levelIdx];
  const progress = storyData.distance / lvl.totalDistance;
  // Mantener la probabilidad duplicada (90/50/36/24%) y UNA sola botella por bloque.
  // Reservar parte del cupo para tramos posteriores: el límite se abre gradualmente
  // en diez secciones del recorrido, para evitar gastar todas las cervezas al inicio.
  const chance = diff.id === "FACIL" ? 0.90 : diff.id === "NORMAL" ? 0.50 : diff.id === "DIFICIL" ? 0.36 : 0.24;
  const section = Math.min(9, Math.max(0, Math.floor(progress * 10)));
  const availableByThisSection = Math.floor(((section + 1) * diff.beerQuota) / 10);
  if (storyData.beersSpawnedThisLevel >= availableByThisSection) return;
  const forceSpawn = (progress > 0.72 && storyData.beersSpawnedThisLevel === 0);

  if (Math.random() < chance || forceSpawn) {
    storyData.beersSpawnedThisLevel++;
    obstacles.push({
      type: "PILSENER",
      x: x,
      y: y - 10,
      vx: 0,
      vy: 0,
      r: 20,
      dead: false
    });
  }
}

function triggerJump() {
  if (gameState === "STORY" && player.onGround && !player.huggingWall) {
    player.vy = -12.5;
    player.onGround = false;
    sound.playSFX("sfx_jump");
  } else if (gameState === "MINIGAME") {
    triggerFighterJump();
  }
}

function triggerAxe() {
  if (gameState === "STORY") {
    player.swingTimer = 16;
    sound.playSFX("sfx_axe");

    obstacles.forEach((ob) => {
      if (ob.dead) return;
      const dist = Math.hypot((ob.x) - (player.x + player.facing * 32), (ob.y) - (player.y - 10));
      if (dist < 78) {
        if (ob.type === "SNOWBALL" || ob.type === "ICEBLOCK") {
          ob.dead = true;
          storyData.levelScore += 10;
          addFloatingScore(ob.x, ob.y - 20, "+10", "#facc15");
          sound.playSFX("sfx_axe");

          if (ob.type === "SNOWBALL") {
            spawnSnowBreakEffect(ob.x, ob.y, ob.r || 20);
          }
          if (ob.type === "ICEBLOCK") {
            maybeSpawnPilsener(ob.x, ob.y);
          }
        }
      }
    });
  } else if (gameState === "MINIGAME") {
    triggerFighterAxe();
  }
}

// Frases de derrota: solo se muestran en el modo historia, nunca al llegar a la cumbre.
const STORY_DEFEAT_MESSAGES = [
  "El soroche te mató",
  "Infarto por mucha cerveza",
  "El guía te mintió, no faltaba solo 5 minutos",
  "¿y te moriste? si... te moriste...",
  "el Chuchaqui te ganó"
];

function damagePlayer(amount = 0.5) {
  if (player.invulnTimer > 0) return;
  storyData.hearts = Math.max(0, storyData.hearts - amount);
  player.invulnTimer = 50;
  sound.playSFX("sfx_hit");
  addFloatingScore(player.x, player.y - 50, "-0.5 ❤️", "#ef4444");

  if (storyData.hearts <= 0) {
    gameState = "SUMMIT";
    sound.stopBGM();
    document.getElementById("end-title").textContent = "❄️ ¡LA MONTAÑA TE VENCIÓ!";
    document.getElementById("end-subtitle").textContent = "TE QUEDASTE SIN CORAZONES EN EL ILINIZA SUR";
    document.getElementById("end-defeat-message").textContent =
      STORY_DEFEAT_MESSAGES[Math.floor(Math.random() * STORY_DEFEAT_MESSAGES.length)];
    document.getElementById("end-score-text").textContent =
      `PUNTAJE TOTAL: ${storyData.score + storyData.levelScore}`;
    storyData.score += storyData.levelScore;
    updateTouchControlsVisibility();
    prepareGameOverModal();
    showOverlay("gameover-overlay");
  }
}

function updateStoryMode() {
  const lvl = LEVELS[storyData.levelIdx];
  storyData.elapsedSec += 1 / 60;

  const inFlatSection = storyData.distance < lvl.flatTutorialDist;
  const groundY = getGroundY(inFlatSection);

  // Si el montañista cayó, no puede avanzar ni recuperar apoyo en la grieta.
  // La caída se ve brevemente antes de mostrar el fin de partida.
  if (storyData.fallingInCrevasse) {
    player.onGround = false;
    player.vy = Math.max(2, player.vy + 0.62);
    player.y += player.vy;
    if (player.y > groundY + 115) defeatStoryByCrevasse();
    return;
  }

  let moveX = 0;
  let moveY = 0;
  if (keys.right || joyState.dx > 0.25) moveX = 1;
  else if (keys.left || joyState.dx < -0.25) moveX = -1;

  if (keys.up || joyState.dy < -0.25) moveY = 1;
  else if (keys.down || joyState.dy > 0.35) moveY = -1;

  player.crouching = (moveY === -1 && player.onGround);
  player.huggingWall = (!inFlatSection && keys.hug);

  if (player.swingTimer > 0) player.swingTimer--;
  if (player.invulnTimer > 0) player.invulnTimer--;

  let advanceSpeed = 0;
  if (!player.huggingWall && !player.crouching) {
    if (moveX > 0 || (!inFlatSection && moveY > 0)) {
      advanceSpeed = 3.0;
      player.facing = 1;
      player.animFrame++;
    } else if (moveX < 0) {
      advanceSpeed = -1.8;
      player.facing = -1;
      player.animFrame++;
    }
  }

  // Mantener libres las grietas tanto para el salto como para el dibujo.
  obstacles.forEach(ob => {
    if (!ob.dead && ob.type === "ICEBLOCK" && storyIceOverlapsCrevasse(ob.x)) ob.dead = true;
  });
  const blockingIce = obstacles.find(
    (ob) => !ob.dead && ob.type === "ICEBLOCK" && Math.abs(ob.x - player.x) < 42
  );
  if (blockingIce && advanceSpeed > 0 && player.onGround) {
    advanceSpeed = 0;
  }

  const minPlayerX = isPortrait ? 65 : 90;
  const maxPlayerX = isPortrait ? 225 : 420;

  if (advanceSpeed !== 0) {
    storyData.distance = Math.max(0, storyData.distance + advanceSpeed);
    player.x = Math.max(minPlayerX, Math.min(maxPlayerX, player.x + advanceSpeed * 0.35));
  }

  player.y += player.vy;
  const gapBelowPlayer = storyCrevasseAt(storyData.distance);
  if (player.y < groundY) {
    player.vy += 0.62;
    player.onGround = false;
  } else if (gapBelowPlayer) {
    // Sin terreno debajo: el salto es obligatorio para alcanzar el otro borde.
    player.onGround = false;
    storyData.fallingInCrevasse = true;
    player.vy = Math.max(2, player.vy + 0.62);
    return;
  } else {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  }

  if (storyData.distance >= storyData.nextIceDist && storyData.distance < lvl.totalDistance - 600) {
    storyData.nextIceDist = storyData.distance + lvl.iceBlockGap + Math.random() * 140;
    // Si la grieta ocupa el espacio de aparición, dejarlo libre.
    if (!storyIceOverlapsCrevasse(GW + 30)) {
      obstacles.push({
        type: "ICEBLOCK",
        x: GW + 30,
        y: groundY - 12,
        r: 28,
        dead: false
      });
    }
  }

  if (!inFlatSection) {
    if (Math.random() < lvl.snowRate) {
      obstacles.push({
        type: "SNOWBALL",
        x: (isPortrait ? 100 : 220) + Math.random() * (GW - 120),
        y: isPortrait ? 75 : -30,
        vx: -1.8 - Math.random() * 1.6,
        vy: 2.8 + Math.random() * 2.2,
        r: 20,
        dead: false
      });
    }
    if (Math.random() < lvl.rockRate) {
      const rockSizes = [13, 17, 21];
      const rockRadius = rockSizes[(Math.random() * rockSizes.length) | 0];
      const rockVariant = (Math.random() * 3) | 0;
      obstacles.push({
        type: "ROCK",
        x: (isPortrait ? 70 : 150) + Math.random() * (GW - 110),
        y: isPortrait ? 75 : -35,
        vx: -1.3 - Math.random() * 1.4,
        vy: 4.0 + Math.random() * 2.8,
        r: rockRadius,
        variant: rockVariant,
        dead: false
      });
    }
  }

  obstacles.forEach((ob) => {
    if (ob.dead) return;

    if (ob.type === "ICEBLOCK" || ob.type === "PILSENER") {
      ob.x -= advanceSpeed * 1.15;
      ob.y = groundY - 12;
      if (ob.type === "ICEBLOCK" && storyIceOverlapsCrevasse(ob.x)) {
        ob.dead = true;
        return;
      }
    } else {
      ob.x += ob.vx - advanceSpeed * 0.4;
      ob.y += ob.vy;
    }

    const distToPlayer = Math.hypot(ob.x - player.x, ob.y - (player.y - 18));

    if (ob.type === "PILSENER" && distToPlayer < 42) {
      ob.dead = true;
      storyData.hearts = Math.min(storyData.maxHearts, storyData.hearts + 0.5);
      sound.playSFX("sfx_beer");
      addFloatingScore(ob.x, ob.y - 20, "+0.5 ❤️ PILSENER", "#22c55e");
    } else if (ob.type === "SNOWBALL" && distToPlayer < 34) {
      if (player.swingTimer > 0) {
        ob.dead = true;
        storyData.levelScore += 10;
        addFloatingScore(ob.x, ob.y, "+10", "#facc15");
        spawnSnowBreakEffect(ob.x, ob.y, ob.r || 20);
      } else {
        ob.dead = true;
        spawnSnowBreakEffect(ob.x, ob.y, ob.r || 20);
        damagePlayer(0.5);
      }
    } else if (ob.type === "ROCK" && distToPlayer < 34) {
      if (!player.huggingWall) {
        ob.dead = true;
        damagePlayer(0.5);
      }
    }

    if (ob.x < -80 || ob.y > groundY + 45) ob.dead = true;
  });

  obstacles = obstacles.filter((o) => !o.dead);

  floatingTexts.forEach((ft) => {
    ft.y -= 1.2;
    ft.life--;
  });
  floatingTexts = floatingTexts.filter((ft) => ft.life > 0);

  const windMultiplier = lvl.storm ? 3.4 : 1.0;
  snowParticles.forEach((p) => {
    p.x += p.vx * windMultiplier;
    p.y += p.vy * (lvl.storm ? 2.2 : 1.0);
    if (p.x < 0) p.x = GW;
    if (p.y > GH) { p.y = 0; p.x = Math.random() * GW; }
  });

  snowBreakParticles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.98;
    p.vy += 0.08;
    p.rot += p.spin;
    p.size *= 0.985;
    p.life--;
  });
  snowBreakParticles = snowBreakParticles.filter((p) => p.life > 0 && p.size > 0.7);

  if (gameState === "STORY" && storyData.distance >= lvl.totalDistance) {
    storyData.score += storyData.levelScore;
    storyData.levelScore = 0;
    sound.playSFX("sfx_checkpoint");

    // Publicar el mejor progreso en la clasificación de todos los jugadores.
    if (currentUser?.uid) {
      publishSignedInScore({name:currentUser.username, char:selectedCharacter,
        diff:DIFFICULTIES[diffIndex].name, score:storyData.score}).catch(flagCloudWriteFailure);
    }
    recordStoryLevelCompletion(storyData.levelIdx);
    if (storyData.levelIdx < LEVELS.length - 1) {
      gameState = "CHECKPOINT";
      updateTouchControlsVisibility();
      const nextLevel = LEVELS[storyData.levelIdx + 1];
      document.getElementById("checkpoint-choice-text").textContent =
        `¡NIVEL ${nextLevel.level} DESBLOQUEADO! · ${nextLevel.startAlt}–${nextLevel.endAlt} m`;
      document.getElementById("checkpoint-continue-btn").textContent =
        `▶️ CONTINUAR AL NIVEL ${nextLevel.level}`;
      showOverlay("checkpoint-choice-overlay");
    } else {
      gameState = "SUMMIT";
      player.celebrating = true;
      sound.playBGM("bgm_summit");
      updateTouchControlsVisibility();
      showSummitCelebrationPrompt();
    }
  }
}

