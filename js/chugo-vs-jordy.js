/* ============================================================================
   MINI JUEGO CHUGO VS JORDY
   ============================================================================ */
let lastRemoteFighterInfo = null;
let vsWinnerIdx = -1;
let vsFloaters = [];

const FIGHT_GRAVITY = 0.7;
const FIGHT_JUMP_SPEED = -12;
const BEER_DAMAGE = 10;
const BEER_SPEED = 9;
const AXE_DAMAGE = 8;
const KICK_DAMAGE = 6;
const SHIELD_BLOCK_LIMIT = 3;
const SHIELD_RECHARGE_MS = 3000; // 3 segundos reales, incluso en pantallas rápidas.
const SHIELD_RECHARGE_FRAMES = 180; // HUD a 60 FPS (el reloj usa milisegundos).
const WEAK_SHIELD_PUSH_FRAMES = 6;
const WEAK_SHIELD_PUSH_PER_FRAME = 4; // 24 unidades, mucho menos que el cramponazo.
const KICK_PUSH_FRAMES = 14;
const KICK_PUSH_PER_FRAME = 12; // ~168 unidades: al alcance de una Pilsener.


function stageXToCanvasX(stageX) {
  return (stageX / FIGHT_STAGE_W) * GW;
}

function getFightGroundY() {
  return isPortrait ? 535 : 390;
}

function addVsFloater(x, y, text, color) {
  vsFloaters.push({ x, y, text, color, life: 50 });
}

function sendOnline(msg) {
  // La sala tradicional conserva exactamente su envío; el torneo usa otro Peer.
  if (tournament && tournament.status === 'playing' && tournament.mode === 'online') {
    tourSendCombat(msg);
    return;
  }
  if (vsIsOnline && peerConn && peerConn.open) {
    try { peerConn.send(msg); } catch (e) {}
  }
}

function startVersusMiniGame(onlineMode = false, remoteFighterInfo = null) {
  if (!(tournament && tournament.status === 'playing')) {
    if (!onlineMode) apusActiveFightStageId=apusChooseFightStage();
    else if (isOnlineHost) apusActiveFightStageId=apusStageRoomId;
    // Invitado: conservar el escenario recibido en el saludo ya existente.
  }
  vsIsOnline = onlineMode;
  if (remoteFighterInfo) lastRemoteFighterInfo = remoteFighterInfo;

  const myInfo = getMyFighterPayload();
  const groundY = getFightGroundY();

  keys.defend = false;
  const p1StartX = (!onlineMode || isOnlineHost) ? 260 : 700;
  const p2StartX = (!onlineMode || isOnlineHost) ? 700 : 260;

  let p2Char = selectedCharacter === "JORDY" ? "CHUGO" : "JORDY";
  if (!onlineMode) p2Char = selectedCpuOpponent;
  let p2DisplayName = `${p2Char} (CPU)`;
  let p2CustomConfig = null;

  if (onlineMode && lastRemoteFighterInfo) {
    p2Char = lastRemoteFighterInfo.char;
    p2DisplayName = lastRemoteFighterInfo.displayName || "OPONENTE";
    p2CustomConfig = lastRemoteFighterInfo.customConfig || null;
  }

  fighters = [
    {
      char: myInfo.char, displayName: myInfo.displayName, customConfig: myInfo.customConfig,
      isAI: false, x: p1StartX, y: groundY, vx: 0, vy: 0, hp: 350, maxHp: 350, hpGhost: 350,
      facing: p1StartX < p2StartX ? 1 : -1, onGround: true, blocking: false,
      action: null, actionTimer: 0, cooldown: 0, hurtTimer: 0, anim: 0,
      shieldBlocks: 0, shieldCooldown: 0, shieldReadyAt: 0, shieldAnim: 0, guardPose: false,
      knockbackFrames: 0, knockbackDir: 0, knockbackPerFrame: KICK_PUSH_PER_FRAME
    },
    {
      char: p2Char, displayName: p2DisplayName, customConfig: p2CustomConfig,
      isAI: !onlineMode, x: p2StartX, y: groundY, vx: 0, vy: 0, hp: 350, maxHp: 350, hpGhost: 350,
      facing: p2StartX < p1StartX ? 1 : -1, onGround: true, blocking: false,
      action: null, actionTimer: 0, cooldown: 0, hurtTimer: 0, anim: 0,
      shieldBlocks: 0, shieldCooldown: 0, shieldReadyAt: 0, shieldAnim: 0, guardPose: false,
      knockbackFrames: 0, knockbackDir: 0, knockbackPerFrame: KICK_PUSH_PER_FRAME
    }
  ];
  projectiles = [];
  vsFloaters = [];
  vsWinner = null;
  vsWinnerIdx = -1;
  vsEndAnimTimer = 0;
  window.apusStopVersusOutcomeJingle?.();
  updateVersusResultActions();
  gameState = "MINIGAME";
  updateTouchControlsVisibility();
  sound.playBGM("bgm_versus");
}

function updateVersusResultActions() {
  const actions = document.getElementById('vs-end-actions');
  if (!actions) return;
  actions.style.flexDirection = 'column';
  if (tournament) {
    const t = tournament;
    const canShow = (gameState === 'MINIGAME' || gameState === 'TOURNAMENT_WATCH') && !!vsWinner && vsEndAnimTimer <= 0;
    if (!canShow) { actions.style.display = 'none'; return; }
    const winnerId = t.awaitContinueWinner || null;
    if (!winnerId) { actions.style.display = 'none'; return; } // Una CPU avanza automáticamente.
    const winnerName = t.members.find(p => p.id === winnerId)?.name || vsWinner;
    const localIsWinner = winnerId === t.me;
    let key, content;
    if (t.awaitContinueTriggered) {
      key = 'tour-preparing:' + t.current;
      content = '<div class="controls-hint" style="text-align:center;color:#cbd5e1;margin:2px 0">⏳ Preparando el siguiente combate...</div>';
    } else if (localIsWinner) {
      key = 'tour-win:' + t.current;
      content = '<div class="controls-hint" style="text-align:center;color:#facc15;margin:0 0 4px">🏆 ¡Ganaste! Pulsa para jugar la siguiente partida.</div>' +
        '<button type="button" id="tour-continue-action" class="menu-btn" style="margin:2px 0;background:#10ac84;touch-action:manipulation" onclick="tourWinnerContinue()">▶️ CONTINUAR TORNEO</button>';
    } else {
      key = 'tour-wait:' + t.current + ':' + winnerId;
      content = `<div class="controls-hint" style="text-align:center;color:#cbd5e1;margin:2px 0">⏳ Esperando que ${tourEscape(winnerName)} pulse continuar...</div>`;
    }
    // Evitar recrear el botón en cada fotograma (anulaba el click entre pointerdown y pointerup).
    if (actions.dataset.apusResultKey !== key) {
      actions.innerHTML = content;
      actions.dataset.apusResultKey = key;
    }
    actions.style.display = 'flex';
    return;
  }
  // El 1 vs. 1 normal conserva sus dos acciones sin recrearlas cada fotograma.
  const key = 'normal-versus';
  if (actions.dataset.apusResultKey !== key) {
    actions.innerHTML = '<button class="menu-btn" style="margin:2px 0;background:#2e86de;" onclick="requestRematch()">🔁 REVANCHA</button>' +
      '<button class="menu-btn" style="margin:2px 0;background:#ee5253;" onclick="returnToVersusCharacterSelect()">👤 ELEGIR PERSONAJE / VOLVER</button>';
    actions.dataset.apusResultKey = key;
  }
  actions.style.display = (gameState === 'MINIGAME' && !!vsWinner && vsEndAnimTimer <= 0) ? 'flex' : 'none';
}
function returnToVersusCharacterSelect() {
  if(gameState!=='MINIGAME')return;
  document.getElementById('vs-end-actions').style.display='none';
  cleanupPeerConnection(); // Solo conexiones de Chugo vs. Jordy.
  vsIsOnline=false;
  vsWinner=null;
  gameState='MENU';
  updateTouchControlsVisibility();
  openCharSelect('minigame');
}
function requestRematch() {
  if(gameState!=='MINIGAME'||!vsWinner||vsEndAnimTimer>0)return;
  document.getElementById('vs-end-actions').style.display='none';
  sound.playSFX("sfx_checkpoint");
  sendOnline({ type: "REMATCH" });
  startVersusMiniGame(vsIsOnline, lastRemoteFighterInfo);
}

function triggerFighterJump() {
  if (gameState !== "MINIGAME" || fighters.length < 2) return;
  if (vsWinner) return;
  const f = fighters[0];
  if (f && f.onGround && !f.blocking && !f.guardPose) {
    f.vy = FIGHT_JUMP_SPEED;
    f.onGround = false;
    sound.playSFX("sfx_jump");
  }
}

function canFighterAct(f) {
  return gameState === "MINIGAME" && fighters.length === 2 && f && f.cooldown <= 0 && !f.blocking && !f.guardPose && !vsWinner;
}

function tourMeleePacket(f,dmg){
  // Solo añade posiciones/identificador en torneos entre dos humanos.
  if(!tournament || tournament.mode!=='online' || tournament.cpuSimulation || !vsIsOnline)
    return {type:'MELEE_ATTACK',dmg};
  const target=fighters[1];
  return {type:'MELEE_ATTACK',dmg,attackId:++tourAttackSequence,
    attackX:f.x,attackY:f.y,
    // Decisión de alcance en el instante del atacante; evita fallos por retardo de STATE.
    confirmedHit:!!target && Math.abs(f.x-target.x)<92 && Math.abs(f.y-target.y)<65};
}
function triggerFighterAxe() {
  const f = fighters[0];
  if (!canFighterAct(f)) return;
  f.action = "AXE";
  f.actionTimer = 16;
  f.cooldown = 22;
  sound.playSFX("sfx_axe");
  sendOnline(tourMeleePacket(f,AXE_DAMAGE));
  checkMeleeHit(f, fighters[1], AXE_DAMAGE);
}

function triggerKick() {
  const f = fighters[0];
  if (!canFighterAct(f)) return;
  f.action = "KICK";
  f.actionTimer = 18;
  f.cooldown = 26;
  sound.playSFX("sfx_kick");
  sendOnline(tourMeleePacket(f,KICK_DAMAGE));
  checkMeleeHit(f, fighters[1], KICK_DAMAGE);
}

function spawnBeer(ownerIdx) {
  const f = fighters[ownerIdx];
  if (!f) return;
  projectiles.push({
    owner: ownerIdx,
    type: fighterProjectileType(f),
    x: f.x + f.facing * 36,
    y: f.y - 28,
    vx: f.facing * BEER_SPEED,
    vy: fighterProjectileType(f) === 'BULLET' ? -0.6 : -3.2,
    rot: 0,
    life: 150
  });
}

function triggerBeerThrow() {
  const f = fighters[0];
  if (!canFighterAct(f)) return;
  f.action = "THROW";
  f.actionTimer = 14;
  f.cooldown = 38;
  sound.playSFX("sfx_beer");
  spawnBeer(0);
  sendOnline({ type: "BEER" });
}

function declareVersusWinner(idx) {
  if (vsWinner) return;
  const w = fighters[idx];
  if (!w) return;
  vsWinnerIdx = idx;
  vsWinner = w.displayName || w.char;
  vsEndAnimTimer = 180;
  projectiles = [];
  // La música Boss Rush debe pausarse ANTES de reproducir el resultado.
  window.apusRouteMusic?.();
  if (tournament && tournament.status === 'playing') {
    // En torneo el ganador oficial llega en tourShowResult; evita tocarlo dos veces.
    tourNotifyWin(idx);
  } else if(typeof window.apusPlayVersusOutcomeJingle==='function') {
    window.apusPlayVersusOutcomeJingle(idx===0?'victory':'defeat');
  } else {
    sound.playSFX("sfx_checkpoint");
  }
}

/* Aplica daño (o lo bloquea) y muestra el número flotante.
   En online, el daño real a MI personaje lo calculo yo; al oponente solo
   le muestro el efecto (su vida real llega por el mensaje STATE). */
function dealDamage(attacker, defender, dmg, attackPositionX = null) {
  const remoteTarget = vsIsOnline && defender === fighters[1];

  if (defender.blocking) {
    addVsFloater(defender.x, defender.y - 78, "BLOQUEO", "#38bdf8");
    sound.playSFX("sfx_axe");
    // Cada combatiente cuenta sus bloqueos en su propio dispositivo.
    if (!remoteTarget) {
      defender.shieldBlocks = (defender.shieldBlocks || 0) + 1;
      if (defender.shieldBlocks >= SHIELD_BLOCK_LIMIT) {
        defender.shieldBlocks = SHIELD_BLOCK_LIMIT;
        defender.shieldCooldown = SHIELD_RECHARGE_FRAMES;
        defender.shieldReadyAt = performance.now() + SHIELD_RECHARGE_MS;
        defender.blocking = false;
        addVsFloater(defender.x, defender.y - 110, "RECARGA 3s", "#facc15");
      }
    }
    return false;
  }

  if (!remoteTarget) {
    defender.hp = Math.max(0, defender.hp - dmg);
    const hitFromX = Number.isFinite(attackPositionX) ? attackPositionX : attacker.x;
    const hitDirection = defender.x >= hitFromX ? 1 : -1;
    const weakShield = defender.shieldCooldown > 0 &&
      (defender.guardPose || defender.action === "GUARD_WEAK");
    if (dmg === KICK_DAMAGE) {
      // El cramponazo conserva su empuje fuerte, incluso con el casco descargado.
      defender.knockbackFrames = KICK_PUSH_FRAMES;
      defender.knockbackDir = hitDirection;
      defender.knockbackPerFrame = KICK_PUSH_PER_FRAME;
      defender.vx = 0;
    } else if (weakShield) {
      // En recarga, defender NO bloquea daño: solo amortigua el impacto con retroceso leve.
      defender.knockbackFrames = WEAK_SHIELD_PUSH_FRAMES;
      defender.knockbackDir = hitDirection;
      defender.knockbackPerFrame = WEAK_SHIELD_PUSH_PER_FRAME;
      defender.vx = 0;
      addVsFloater(defender.x, defender.y - 112, "SIN ESCUDO", "#facc15");
    } else {
      defender.vx = hitDirection * 7;
    }
  }
  defender.hurtTimer = 18;
  addVsFloater(defender.x, defender.y - 78, "-" + dmg, "#ef4444");
  sound.playSFX("sfx_hit");

  if (!remoteTarget && defender.hp <= 0) {
    declareVersusWinner(fighters.indexOf(attacker));
  }
  return true;
}

function checkMeleeHit(attacker, defender, dmg) {
  if (!attacker || !defender) return;
  if (Math.abs(attacker.x - defender.x) < 92 && Math.abs(attacker.y - defender.y) < 65) {
    dealDamage(attacker, defender, dmg);
  }
}

function updateProjectiles() {
  const groundY = getFightGroundY();
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.x += pr.vx;
    pr.vy += 0.28;
    pr.y += pr.vy;
    pr.rot += pr.vx > 0 ? 0.4 : -0.4;
    pr.life--;

    const attacker = fighters[pr.owner];
    const target = fighters[pr.owner === 0 ? 1 : 0];
    let remove = false;

    if (attacker && target && Math.abs(pr.x - target.x) < 36 && Math.abs(pr.y - (target.y - 8)) < 50) {
      dealDamage(attacker, target, BEER_DAMAGE);
      if (vsWinner) return; // declareVersusWinner ya vació los proyectiles
      remove = true;
    }
    if (pr.y > groundY + 30 || pr.x < -30 || pr.x > FIGHT_STAGE_W + 30 || pr.life <= 0) remove = true;
    if (remove) projectiles.splice(i, 1);
  }
}

function updateVersusMiniGame() {
  const groundY = getFightGroundY();

  // Temporizadores (cooldown, acción, parpadeo de daño, barra "fantasma")
  fighters.forEach((f, i) => {
    if (f.cooldown > 0) f.cooldown--;
    if (f.hurtTimer > 0) f.hurtTimer--;
    // En online solo el propio cliente decide cuándo termina la recarga.
    if (!(vsIsOnline && i === 1) && f.shieldCooldown > 0) {
      // Tiempo real: 3 segundos independientemente de Hz o FPS.
      const remainingMs = Math.max(0, (f.shieldReadyAt || 0) - performance.now());
      f.shieldCooldown = Math.ceil(remainingMs * 60 / 1000);
      if (remainingMs === 0) {
        f.shieldCooldown = 0;
        f.shieldBlocks = 0;
        f.shieldReadyAt = 0;
      }
    }
    const shieldTarget = (f.blocking || f.guardPose || f.action === "GUARD_WEAK") ? 1 : 0;
    f.shieldAnim = Math.max(0, Math.min(1,
      (f.shieldAnim || 0) + (shieldTarget ? 0.14 : -0.16)));
    f.hpGhost = f.hpGhost > f.hp ? Math.max(f.hp, f.hpGhost - 1.4) : f.hp;
    const isRemote = vsIsOnline && i === 1; // su acción llega por STATE
    if (!isRemote && f.actionTimer > 0) {
      f.actionTimer--;
      if (f.actionTimer === 0) f.action = null;
    }
  });

  for (let i = vsFloaters.length - 1; i >= 0; i--) {
    const fl = vsFloaters[i];
    fl.y -= 0.9;
    fl.life--;
    if (fl.life <= 0) vsFloaters.splice(i, 1);
  }

  if (vsWinner) {
    if (tournament?.resultReadyAt) {
      vsEndAnimTimer = Math.ceil(Math.max(0, tournament.resultReadyAt - performance.now()) / (1000 / 60));
    } else if (vsEndAnimTimer > 0) vsEndAnimTimer--;
    updateVersusResultActions();
    fighters.forEach((f) => {
      f.vx = 0;
      f.y = groundY;
      f.blocking = false;
      f.anim++;
    });
    return;
  }

  const p1 = fighters[0];
  const p2 = fighters[1];

  // --- Jugador local ---
  const requestedGuard = keys.defend || joyState.dy > 0.45;
  p1.guardPose = p1.onGround && requestedGuard;
  p1.blocking = p1.guardPose && p1.shieldCooldown <= 0
    && p1.shieldBlocks < SHIELD_BLOCK_LIMIT;
  if ((keys.up || joyState.dy < -0.55) && p1.onGround && !p1.guardPose) {
    triggerFighterJump();
  }

  if (p1.knockbackFrames > 0) {
    p1.vx = 0;
    p1.x = Math.max(65, Math.min(FIGHT_STAGE_W - 65,
      p1.x + p1.knockbackDir * (p1.knockbackPerFrame || KICK_PUSH_PER_FRAME)));
    p1.knockbackFrames--;
    p1.anim++;
  } else {
    p1.vx *= 0.8;
    if (!p1.guardPose) {
      if (keys.left || joyState.dx < -0.25) { p1.vx = -FIGHT_MOVE_SPEED; p1.anim++; }
      if (keys.right || joyState.dx > 0.25) { p1.vx = FIGHT_MOVE_SPEED; p1.anim++; }
    }
    p1.x = Math.max(65, Math.min(FIGHT_STAGE_W - 65, p1.x + p1.vx));
  }
  p1.facing = p2.x >= p1.x ? 1 : -1;

  // Física vertical (salto con gravedad)
  p1.vy += FIGHT_GRAVITY;
  p1.y += p1.vy;
  if (p1.y >= groundY) {
    p1.y = groundY;
    p1.vy = 0;
    p1.onGround = true;
  } else {
    p1.onGround = false;
  }

  // --- Oponente ---
  if (!vsIsOnline) {
    // CPU
    p2.vx *= 0.8;
    p2.blocking = false;
    p2.facing = p1.x >= p2.x ? 1 : -1;
    const dist = Math.abs(p1.x - p2.x);
    if (p2.knockbackFrames > 0) {
      p2.vx = p2.knockbackDir * (p2.knockbackPerFrame || KICK_PUSH_PER_FRAME);
      p2.knockbackFrames--;
      p2.anim++;
    } else if (dist > 82) {
      p2.vx = p2.facing * FIGHT_MOVE_SPEED;
      p2.anim++;
      if (dist > 230 && p2.cooldown <= 0 && Math.random() < 0.012) {
        p2.action = "THROW";
        p2.actionTimer = 14;
        p2.cooldown = 70;
        spawnBeer(1);
        sound.playSFX("sfx_beer");
      }
    } else if (p2.cooldown <= 0) {
      if (Math.random() < 0.35) {
        p2.action = "KICK";
        p2.actionTimer = 18;
        p2.cooldown = 55;
        sound.playSFX("sfx_kick");
        checkMeleeHit(p2, p1, KICK_DAMAGE);
      } else {
        p2.action = "AXE";
        p2.actionTimer = 15;
        p2.cooldown = 48;
        sound.playSFX("sfx_axe");
        checkMeleeHit(p2, p1, AXE_DAMAGE);
      }
    }
    p2.x = Math.max(65, Math.min(FIGHT_STAGE_W - 65, p2.x + p2.vx));
    p2.y = groundY;
  } else {
    // Online: la posición/acción del rival llegan por STATE; solo oriento su sprite
    p2.facing = p1.x >= p2.x ? 1 : -1;
  }

  updateProjectiles();

  // Online: envío mi estado al rival
  sendOnline({
    type: "STATE",
    nx: p1.x / FIGHT_STAGE_W,
    jumpOffset: groundY - p1.y,
    facing: p1.facing,
    blocking: p1.blocking,
    action: p1.guardPose && !p1.blocking ? "GUARD_WEAK" : p1.action,
    anim: p1.anim,
    myHp: p1.hp,
    customConfig: p1.customConfig
  });
}

/* ============================================================================
   FONDOS Y RENDER
   ============================================================================ */

// Fondo pixel-art de alta resolución (recurso integrado para uso offline).
const cotopaxiPixelArtwork = new Image();
cotopaxiPixelArtwork.src = "assets/escenarios/imagen_6ce08e48db7d18.webp";


/* V28.0.4 - NUEVOS FONDOS VISUALES, sin afectar combate, física ni el transporte PeerJS. */
const APUS_STAGE_NAMES = ["Cotopaxi original", "Volcán Chimborazo", "Volcán Cotopaxi (postal)", "Laguna del Quilotoa", "Mitad del Mundo", "Laguna de Cuicocha", "Volcán Cayambe", "Volcán Tungurahua", "Volcán El Altar", "Parque Nacional Cajas", "Volcán Antisana", "Los Ilinizas", "Volcán Sangay", "Lagunas de Ozogoche", "Volcán Carihuairazo", "Volcán Imbabura y Lago San Pablo", "Río Napo y Selva Amazónica", "Valle de Vilcabamba y Mandango", "Lagunas de Mojanda y Fuya-Fuya", "Volcán Reventador", "Próximamente #20", "Próximamente #21", "Próximamente #22", "Próximamente #23", "Próximamente #24", "Próximamente #25"];
const APUS_FIGHT_PHOTOS = {1:"assets/escenarios/imagen_8b71506e61db30.jpg",2:"assets/escenarios/imagen_ee4a3458fd9fde.jpg",3:"assets/escenarios/imagen_9b43dce767f49a.jpg",4:"assets/escenarios/imagen_f2cb0e234c94fe.jpg",5:"assets/escenarios/imagen_3b421faf695056.jpg",6:"assets/escenarios/imagen_e94972170d3aae.jpg",7:"assets/escenarios/imagen_55e2c4e6573f42.jpg",8:"assets/escenarios/imagen_5faaa6d2985806.jpg",9:"assets/escenarios/imagen_861a5541b61ca4.jpg",10:"assets/escenarios/imagen_fd1cff65bb1831.jpg",11:"assets/escenarios/imagen_ced116ff6cb629.jpg",12:"assets/escenarios/imagen_f23c05f8b6b5b7.webp",
  13:"assets/escenarios/imagen_1a6279d63f8638.jpg",
  14:"assets/escenarios/imagen_5ffc3bb9ac1e03.jpg",
  15:"assets/escenarios/imagen_bc2f12ff8b5275.jpg",
  16:"assets/escenarios/imagen_342787263b2de3.jpg",
  17:"assets/escenarios/imagen_bf882a7a523838.jpg",
  18:"assets/escenarios/imagen_93d5368095f252.jpg",
  19:"assets/escenarios/imagen_8574fdcee9bb98.jpg"};
const APUS_STAGE_THUMBNAILS = {
  0:"assets/escenarios/imagen_dc00bec0cffc8d.webp",
  1:"assets/escenarios/imagen_890f8378532962.webp",
  2:"assets/escenarios/imagen_55af60aebc8ae5.webp",
  3:"assets/escenarios/imagen_63b99e01bdc13d.webp",
  4:"assets/escenarios/imagen_a7b2b16f2c4ae4.webp",
  5:"assets/escenarios/imagen_c22a379f0e96c3.webp",
  6:"assets/escenarios/imagen_06cbc52a0cb825.webp",
  7:"assets/escenarios/imagen_5cf37cd5ed2748.webp",
  8:"assets/escenarios/imagen_5d5dde0f24239c.webp",
  9:"assets/escenarios/imagen_303c377b9750ae.webp",
  10:"assets/escenarios/imagen_6c4162643acafe.webp",
  11:"assets/escenarios/imagen_b182669a1add79.webp",
  12:"assets/escenarios/imagen_db531da62e8373.webp",
  13:APUS_FIGHT_PHOTOS[13],
  14:APUS_FIGHT_PHOTOS[14],
  15:APUS_FIGHT_PHOTOS[15],
  16:APUS_FIGHT_PHOTOS[16],
  17:APUS_FIGHT_PHOTOS[17],
  18:APUS_FIGHT_PHOTOS[18],
  19:APUS_FIGHT_PHOTOS[19]
};
window.apusGetStagePhoto = function(id){return APUS_FIGHT_PHOTOS[Number(id)]||null;};
const apusFightImages = new Map();
let apusSelectedStageId=0; // -1: aleatorio, 0: Cotopaxi clásico, 1..19: Friki Apus.
let apusActiveFightStageId=0;
let apusStageRoomId=0;
const apusUnlockedFightStages=new Set();
function apusUnlockFightStage(id) {
  id=Number(id);
  if(!Number.isInteger(id)||id<1||id>19) return false;
  if(apusUnlockedFightStages.has(id)) return true;
  apusUnlockedFightStages.add(id);
  try { localStorage.setItem('apus_fight_stages_v2804',JSON.stringify([...apusUnlockedFightStages].sort((a,b)=>a-b))); }catch(e){}
  apusRenderStagePicker();
  return true;
}
function apusLoadFightStageUnlocks() {
  try {
    const arr=JSON.parse(localStorage.getItem('apus_fight_stages_v2804')||'[]');
    if(Array.isArray(arr)) arr.forEach(id=>{if(Number.isInteger(id)&&id>=1&&id<=19)apusUnlockedFightStages.add(id);});
    const progress=JSON.parse(localStorage.getItem('apus_ecuador_pixel_save_v1')||'{}');
    for(const [k,v] of Object.entries(progress.unlockedPostcards||{})){
      const id=Number(k);if(v&&Number.isInteger(id)&&id>=1&&id<=19)apusUnlockedFightStages.add(id);
    }
  }catch(e){}
}
function apusAvailableFightStages() {
  apusLoadFightStageUnlocks();
  return [0,...[...apusUnlockedFightStages].filter(n=>n>=1&&n<=19).sort((a,b)=>a-b)];
}
function apusChooseFightStage() {
  const a=apusAvailableFightStages();
  return apusSelectedStageId===-1?a[Math.floor(Math.random()*a.length)]:a.includes(apusSelectedStageId)?apusSelectedStageId:0;
}
function apusPickFightStage(id) {
  id=Number(id);if(!Number.isInteger(id))return;
  if(id!==-1 && !apusAvailableFightStages().includes(id))return;
  apusSelectedStageId=id;apusRenderStagePicker();
}
function apusRenderStagePicker() {
  const grid=document.getElementById('apus-stage-grid'),selected=document.getElementById('apus-stage-selected');
  if(!grid)return;
  const available=new Set(apusAvailableFightStages());
  grid.replaceChildren();
  const stages=[-1,...Array.from({length:26},(_,i)=>i)];
  for(const id of stages){
    const btn=document.createElement('button');btn.type='button';
    const ready=id===-1||available.has(id);
    btn.className='apus-stage-cell'+(apusSelectedStageId===id?' active':'');
    btn.disabled=!ready;
    btn.title=ready?'Seleccionar '+(APUS_STAGE_NAMES[id]||'aleatorio'):'Desbloquea la postal con 15/20 en Friki Apus';
    const preview=document.createElement('span');preview.className='apus-stage-preview';
    if(id>=0 && APUS_STAGE_THUMBNAILS[id]){
      const img=document.createElement('img');
      img.src=APUS_STAGE_THUMBNAILS[id];
      img.alt=APUS_STAGE_NAMES[id];
      img.width=160;img.height=90;
      img.loading='lazy';img.decoding='async';
      preview.appendChild(img);
      if(!ready){
        const lock=document.createElement('span');lock.className='apus-stage-lock';
        lock.textContent='🔒';lock.setAttribute('aria-hidden','true');
        preview.appendChild(lock);
      }
    }else{
      preview.textContent=id===-1?'🎲':'🔒';
      preview.setAttribute('aria-hidden','true');
    }
    const name=document.createElement('span');name.className='apus-stage-name';
    name.textContent=id===-1?'RANDOM':id===0?'COTOPAXI CLÁSICO':id+'. '+APUS_STAGE_NAMES[id];
    btn.append(preview,name);
    btn.onclick=()=>apusPickFightStage(id);
    grid.appendChild(btn);
  }
  if(selected)selected.textContent=apusSelectedStageId===-1?'🎲 ESCENARIO ALEATORIO':('🗺️ '+APUS_STAGE_NAMES[apusSelectedStageId].toUpperCase());
}
function apusFightImageFor(id){
  const src=APUS_FIGHT_PHOTOS[id];if(!src)return null;
  if(!apusFightImages.has(id)){
    const image=new Image();image.decoding='async';image.src=src;apusFightImages.set(id,image);
  }
  return apusFightImages.get(id);
}
function drawSelectedVersusBackground(){
  const image=apusFightImageFor(apusActiveFightStageId);
  if(!image||!image.complete||!image.naturalWidth){drawCotopaxiBackground(false,.4);return;}
  const iw=image.naturalWidth, ih=image.naturalHeight;
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  if(isPortrait){
    const groundY=getFightGroundY();
    // En móvil vertical se ve el ancho COMPLETO de la fotografía; sin zoom al centro.
    const destH=Math.round(GW*ih/iw);
    const destY=Math.max(0,Math.round(groundY-destH+16));
    // Cielo extendido con el COLOR MEDIO del cielo real, sin estirar ni repetir
    // nubes, montañas o rocas en la parte superior del formato vertical.
    if(destY>0){
      if(!image.apusSkySample){
        const sm=document.createElement('canvas'); sm.width=8; sm.height=1;
        const sc=sm.getContext('2d');
        sc.drawImage(image,0,0,iw,Math.max(2,Math.round(ih*.025)),0,0,8,1);
        const rgba=sc.getImageData(0,0,8,1).data;
        let r=0,g=0,b=0;
        for(let k=0;k<8;k++){r+=rgba[k*4];g+=rgba[k*4+1];b+=rgba[k*4+2];}
        image.apusSkySample=[Math.round(r/8),Math.round(g/8),Math.round(b/8)];
      }
      const [r,g,b]=image.apusSkySample;
      const sky=ctx.createLinearGradient(0,0,0,destY+4);
      sky.addColorStop(0,`rgb(${Math.max(0,r-12)},${Math.max(0,g-10)},${Math.max(0,b-7)})`);
      sky.addColorStop(1,`rgb(${r},${g},${b})`);
      ctx.fillStyle=sky;ctx.fillRect(0,0,GW,destY+4);
      // Algunas nubes pixeladas suaves, sin la franja espuria de la v29.9.
      ctx.fillStyle='rgba(244,246,252,.06)';
      for(let i=0;i<12;i++){
        const x=(i*83+apusActiveFightStageId*37)%GW;
        const y=22+(i*39)%Math.max(28,destY-32);
        ctx.fillRect(x,y,16+(i%3)*11,3);
      }
    }
    ctx.drawImage(image,0,0,iw,ih,0,destY,GW,destH);
  }else{
    // Paisaje horizontal con proporciones intactas y un recorte mínimo centrado.
    const ratio=Math.max(GW/iw,GH/ih),sw=GW/ratio,sh=GH/ratio;
    const sy=Math.max(0,(ih-sh)*.50);
    ctx.drawImage(image,Math.max(0,(iw-sw)*.5),sy,sw,sh,0,0,GW,GH);
  }
  ctx.restore();
}

function apusStageForTournament(match,t){
  const a=apusAvailableFightStages();
  const idx=t.matches.findIndex(m=>m.id===match.id);
  return a[Math.max(0,idx)%a.length];
}
apusLoadFightStageUnlocks();

function drawCotopaxiBackground(isNight = false, sunriseProgress = 0) {
  if (cotopaxiPixelArtwork.complete && cotopaxiPixelArtwork.naturalWidth > 0) {
    if (isPortrait) {
      // Recorte vertical centrado en el Cotopaxi para que no se deforme el arte.
      const sourceW = Math.min(
        cotopaxiPixelArtwork.naturalWidth,
        cotopaxiPixelArtwork.naturalHeight * (GW / GH)
      );
      const mountainCenterX = cotopaxiPixelArtwork.naturalWidth * 0.34;
      const sourceX = Math.max(
        0,
        Math.min(cotopaxiPixelArtwork.naturalWidth - sourceW, mountainCenterX - sourceW / 2)
      );
      ctx.drawImage(
        cotopaxiPixelArtwork,
        sourceX, 0, sourceW, cotopaxiPixelArtwork.naturalHeight,
        0, 0, GW, GH
      );
    } else {
      ctx.drawImage(cotopaxiPixelArtwork, 0, 0, GW, GH);
    }

    // Mantiene el ambiente nocturno de los niveles que lo usan.
    if (isNight && sunriseProgress < 0.45) {
      const nightAlpha = 0.38 * (1 - Math.max(0, sunriseProgress) / 0.45);
      if (nightAlpha > 0.005) {
        ctx.fillStyle = `rgba(5, 8, 18, ${nightAlpha})`;
        ctx.fillRect(0, 0, GW, GH);
      }
    }

    // La cumbre se ilumina progresivamente al terminar la partida.
    if (sunriseProgress > 0) {
      const progress = Math.min(1, sunriseProgress);
      const warm = ctx.createLinearGradient(0, GH * 0.28, 0, GH);
      warm.addColorStop(0, `rgba(255, 184, 96, ${0.035 + progress * 0.045})`);
      warm.addColorStop(1, `rgba(255, 206, 120, ${progress * 0.12})`);
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, GW, GH);

      // En vertical el recorte no incluye el sol del panorama horizontal,
      // así que se dibuja una puesta/amanecer suave solo durante la victoria.
      if (isPortrait) {
        const sunX = GW * 0.78;
        const sunY = 455 - progress * 150;
        const glow = ctx.createRadialGradient(sunX, sunY, 3, sunX, sunY, 92);
        glow.addColorStop(0, `rgba(255, 232, 150, ${0.16 + progress * 0.22})`);
        glow.addColorStop(1, "rgba(255, 182, 80, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, GW, GH);
        ctx.fillStyle = `rgba(255, 239, 160, ${0.28 + progress * 0.55})`;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 18 + progress * 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  // Fondo original de respaldo mientras se carga la imagen o si no se decodifica.
  const horizonY = isPortrait ? 520 : 410;
  const grad = ctx.createLinearGradient(0, 0, 0, horizonY + 80);
  if (isNight && sunriseProgress === 0) {
    grad.addColorStop(0, "#050811");
    grad.addColorStop(0.6, "#111a2e");
    grad.addColorStop(1, "#1e293b");
  } else if (sunriseProgress > 0) {
    grad.addColorStop(0, "#1e1b4b");
    grad.addColorStop(0.45, "#9d174d");
    grad.addColorStop(0.75, "#f97316");
    grad.addColorStop(1, "#fde047");
  } else {
    grad.addColorStop(0, "#1d3557");
    grad.addColorStop(0.5, "#457b9d");
    grad.addColorStop(0.82, "#f4a261");
    grad.addColorStop(1, "#e9c46a");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GW, GH);

  ctx.fillStyle = isNight && sunriseProgress < 0.3 ? "rgba(51, 65, 85, 0.35)" : "rgba(255, 255, 255, 0.22)";
  const cloudY = isPortrait ? 135 : 95;
  ctx.fillRect(45, cloudY, 130, 14);
  ctx.fillRect(70, cloudY - 8, 80, 8);
  ctx.fillRect(GW - 210, cloudY + 25, 150, 14);
  ctx.fillRect(GW - 180, cloudY + 15, 95, 10);

  const peakX = isPortrait ? GW * 0.5 : GW * 0.45;
  const peakY = isPortrait ? 175 : 145;
  const baseWidth = isPortrait ? 520 : 580;
  if (sunriseProgress > 0) {
    const sunX = isPortrait ? GW * 0.76 : 760;
    const sunY = (horizonY - 70) - sunriseProgress * 150;
    ctx.fillStyle = "rgba(253, 224, 71, 0.35)";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(peakX - baseWidth / 2, horizonY);
  ctx.lineTo(peakX - 42, peakY);
  ctx.lineTo(peakX + 42, peakY);
  ctx.lineTo(peakX + baseWidth / 2, horizonY);
  ctx.closePath();
  ctx.fillStyle = isNight && sunriseProgress < 0.3 ? "#1e293b" : "#5c3a3a";
  ctx.fill();

  const snowBaseY = peakY + 95;
  ctx.beginPath();
  ctx.moveTo(peakX - 115, snowBaseY);
  ctx.lineTo(peakX - 42, peakY);
  ctx.lineTo(peakX + 42, peakY);
  ctx.lineTo(peakX + 115, snowBaseY);
  ctx.lineTo(peakX + 70, snowBaseY - 18);
  ctx.lineTo(peakX + 32, snowBaseY + 8);
  ctx.lineTo(peakX, snowBaseY - 22);
  ctx.lineTo(peakX - 38, snowBaseY + 8);
  ctx.lineTo(peakX - 75, snowBaseY - 15);
  ctx.closePath();
  ctx.fillStyle = isNight && sunriseProgress < 0.3 ? "#94a3b8" : "#f8fafc";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = isNight && sunriseProgress < 0.3 ? "rgba(30,41,59,0.75)" : "rgba(226,232,240,0.7)";
  ctx.fillRect(0, horizonY - 45, GW, 55);
}

function drawBottlePilsener(x, y, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "rgba(250, 204, 21, 0.35)";
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#78350f";
  ctx.fillRect(-7, -6, 14, 22);
  ctx.fillRect(-4, -16, 8, 10);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(-4, -18, 8, 3);
  ctx.fillRect(-7, 0, 14, 9);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-7, 2, 14, 5);
  ctx.restore();
}

function drawHeartsHUD(x, y, hearts, maxHearts) {
  const spacing = isPortrait ? 23 : 28;
  for (let i = 0; i < maxHearts; i++) {
    const hx = x + i * spacing;
    const fillAmount = Math.max(0, Math.min(1, hearts - i));
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(hx - 2, y - 2, 20, 18);
    if (fillAmount >= 1) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(hx, y, 16, 14);
    } else if (fillAmount >= 0.5) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(hx, y, 8, 14);
      ctx.fillStyle = "#475569";
      ctx.fillRect(hx + 8, y, 8, 14);
    } else {
      ctx.fillStyle = "#475569";
      ctx.fillRect(hx, y, 16, 14);
    }
  }
}

function storyTerrainHash(value, seed = 0) {
  const raw = Math.sin(value * 127.1 + seed * 311.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function storyTerrainNoise(worldX, seed = 0) {
  const cell = Math.floor(worldX / 28);
  const t0 = (worldX / 28) - cell;
  const t = t0 * t0 * (3 - 2 * t0);
  const a = storyTerrainHash(cell, seed);
  const b = storyTerrainHash(cell + 1, seed);
  return a + (b - a) * t;
}

function storyTerrainAscentLift(lvl, inFlatSection) {
  if (inFlatSection) return 0;
  const progress = Math.min(1, storyData.distance / lvl.totalDistance);
  const overallProgress = (storyData.levelIdx + progress) / LEVELS.length;
  return overallProgress * (isPortrait ? 34 : 62);
}

function getStoryTerrainSlopeAngle(lvl, inFlatSection) {
  // La inclinación visual se reinicia en cada nivel y crece progresivamente
  // desde 12° hasta aproximadamente 60° al completar ese nivel.
  if (inFlatSection) return 0;
  const progress = Math.max(0, Math.min(1, storyData.distance / lvl.totalDistance));
  const easedProgress = progress * progress * (3 - 2 * progress);
  const degrees = 12 + 48 * easedProgress;
  return degrees * Math.PI / 180;
}

function getStoryTerrainSurfaceY(x, floorTop, lvl, inFlatSection) {
  // La superficie queda a la altura de las botas del sprite, no a mitad del cuerpo.
  const baseY = floorTop + 14;
  const travel = storyData.distance * 0.72;
  const worldX = x + travel;
  const noise = storyTerrainNoise(worldX, lvl.level + 13);

  // El tutorial inicial conserva el suelo casi plano.
  if (inFlatSection) {
    return baseY
      + Math.sin(worldX * 0.027 + lvl.level * 0.83) * 1.1
      + (noise - 0.5) * 1.4;
  }

  // La cámara toma al montañista como ancla: así el camino asciende bajo sus
  // botas sin desaparecer de pantalla cuando la pendiente se aproxima a 60°.
  const anchorX = (typeof player !== 'undefined' && Number.isFinite(player.x))
    ? player.x
    : (isPortrait ? 170 : 300);
  const slope = Math.tan(getStoryTerrainSlopeAngle(lvl, inFlatSection));
  const rise = storyTerrainAscentLift(lvl, inFlatSection);
  const roughness = (noise - 0.5) * 8
    + Math.sin(worldX * 0.031 + lvl.level * 1.37) * 2.8
    + Math.sin(worldX * 0.009 + lvl.level * 1.91) * 2.1;
  return baseY - rise + (anchorX - x) * slope + roughness;
}
function getStoryTerrainVisualOffset(x, floorTop, lvl, inFlatSection) {
  if (inFlatSection) return 0;
  return getStoryTerrainSurfaceY(x, floorTop, lvl, inFlatSection) - (floorTop + 14);
}

function drawStoryMountainTerrain(floorTop, lvl, inFlatSection) {
  // Solo dibujo: la geometría física, colisiones y posiciones reales del juego no cambian.
  const travel = storyData.distance * 0.72;
  const surfaceY = (x) => getStoryTerrainSurfaceY(x, floorTop, lvl, inFlatSection);
  const palette = lvl.storm
    ? { base: '#101927', mid: '#222f43', light: '#46576c', shade: '#080e18', ridge: '#90a6bd', snow: '#dbeafe', ice: '#7dd3fc' }
    : { base: '#202a3a', mid: '#34465a', light: '#62758a', shade: '#141d2b', ridge: '#9aafc2', snow: '#f8fafc', ice: '#93c5fd' };

  // Grietas translúcidas: se conserva aprox. el 90 % del paisaje del Cotopaxi
  // que ya se dibujó detrás. Un degradado blanco -> gris aporta profundidad
  // sin tapar el fondo ni rellenar el hueco con una pared oscura.
  const visibleGaps = getVisibleStoryCrevasses();
  for (const gap of visibleGaps) {
    ctx.beginPath();
    traceStoryCrevasse(ctx, gap, surfaceY);
    const frost = ctx.createLinearGradient(0, surfaceY(gap.start) - 8, 0, GH);
    frost.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    frost.addColorStop(0.38, 'rgba(224, 232, 241, 0.10)');
    frost.addColorStop(1, 'rgba(116, 130, 149, 0.10)');
    ctx.fillStyle = frost;
    ctx.fill();
  }

  // Recorte negativo: los huecos cortan TODAS las rocas y parches de nieve.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-45, -45, GW + 90, GH + 95);
  for (const gap of visibleGaps) traceStoryCrevasse(ctx, gap, surfaceY);
  ctx.clip('evenodd');

  // Perfil de suelo irregular, con una pendiente ascendente y contorno rocoso.
  const points = [];
  for (let x = -20; x <= GW + 24; x += 12) {
    const y = surfaceY(x);
    points.push([x, Math.round(y / 2) * 2]);
  }

  ctx.save();
  ctx.lineJoin = 'bevel';
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.lineTo(GW + 24, GH + 24);
  ctx.lineTo(-20, GH + 24);
  ctx.closePath();
  const rockGradient = ctx.createLinearGradient(0, floorTop - 20, 0, GH);
  rockGradient.addColorStop(0, palette.mid);
  rockGradient.addColorStop(0.36, palette.base);
  rockGradient.addColorStop(1, palette.shade);
  ctx.fillStyle = rockGradient;
  ctx.fill();

  // Rocas de tamaños, alturas y formas variadas. Los detalles se generan por
  // coordenada de mundo, así que el patrón avanza de forma continua sin mosaicos repetidos.
  const cellSize = 57;
  const firstCell = Math.floor((travel - 115) / cellSize);
  const lastCell = Math.ceil((travel + GW + 115) / cellSize);
  for (let cell = firstCell; cell <= lastCell; cell++) {
    const seed = cell + lvl.level * 37;
    const worldLeft = cell * cellSize;
    const x = worldLeft - travel;
    const width = 39 + storyTerrainHash(seed, 4) * 34;
    const height = 52 + storyTerrainHash(seed, 8) * 112;
    const variation = storyTerrainHash(seed, 12);
    const topA = surfaceY(x + 4) + 8 + variation * 5;
    const topB = surfaceY(x + width * 0.27) + 7 + storyTerrainHash(seed, 18) * 10;
    const topC = surfaceY(x + width * 0.58) + 5 + storyTerrainHash(seed, 24) * 12;
    const topD = surfaceY(x + width - 2) + 8 + storyTerrainHash(seed, 28) * 7;

    // Bloque base irregular, con silueta distinta en cada tramo.
    ctx.beginPath();
    ctx.moveTo(x, topA);
    ctx.lineTo(x + width * 0.14, topA - 1 + variation * 6);
    ctx.lineTo(x + width * 0.28, topB);
    ctx.lineTo(x + width * 0.45, topB + 7 + storyTerrainHash(seed, 31) * 8);
    ctx.lineTo(x + width * 0.61, topC);
    ctx.lineTo(x + width * 0.78, topC + 4 + storyTerrainHash(seed, 34) * 9);
    ctx.lineTo(x + width, topD);
    ctx.lineTo(x + width - 3, topD + height * 0.55);
    ctx.lineTo(x + width * 0.73, topD + height * 0.82);
    ctx.lineTo(x + width * 0.42, topA + height);
    ctx.lineTo(x + width * 0.13, topA + height * 0.78);
    ctx.closePath();
    ctx.fillStyle = storyTerrainHash(seed, 40) > 0.52 ? palette.mid : palette.base;
    ctx.fill();
    ctx.strokeStyle = palette.shade;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Facetas quebradas, no uniformes, para dar volumen a cada roca.
    ctx.beginPath();
    ctx.moveTo(x + width * 0.07, topA + 17);
    ctx.lineTo(x + width * (0.23 + variation * 0.12), topB + 16);
    ctx.lineTo(x + width * (0.35 + variation * 0.10), topA + height * 0.52);
    ctx.lineTo(x + width * 0.18, topA + height * 0.67);
    ctx.closePath();
    ctx.fillStyle = palette.light;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + width * 0.52, topC + 15);
    ctx.lineTo(x + width * 0.91, topD + 21);
    ctx.lineTo(x + width * 0.79, topD + height * (0.58 + variation * 0.12));
    ctx.lineTo(x + width * 0.58, topA + height * 0.7);
    ctx.closePath();
    ctx.fillStyle = palette.shade;
    ctx.fill();

    // Fracturas finas y vetas minerales de longitud distinta.
    if (storyTerrainHash(seed, 46) > 0.18) {
      const crackX = x + width * (0.25 + storyTerrainHash(seed, 47) * 0.48);
      const crackY = surfaceY(crackX) + 28 + storyTerrainHash(seed, 48) * 18;
      ctx.strokeStyle = palette.shade;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(crackX, crackY);
      ctx.lineTo(crackX - 3 + storyTerrainHash(seed, 49) * 7, crackY + 10 + storyTerrainHash(seed, 50) * 11);
      ctx.lineTo(crackX - 7 + storyTerrainHash(seed, 51) * 11, crackY + 18 + storyTerrainHash(seed, 52) * 12);
      ctx.stroke();
    }
    if (storyTerrainHash(seed, 56) > 0.42) {
      ctx.fillStyle = palette.ridge;
      ctx.fillRect(x + width * 0.12, topA + 45 + storyTerrainHash(seed, 58) * 20, 7 + storyTerrainHash(seed, 59) * 13, 2);
      ctx.fillStyle = palette.ice;
      ctx.fillRect(x + width * 0.66, topC + 52 + storyTerrainHash(seed, 60) * 20, 4 + storyTerrainHash(seed, 61) * 8, 2);
    }

    // Parches de nieve de anchura y forma variables; algunos tramos quedan solo en roca.
    if (storyTerrainHash(seed, 66) > (inFlatSection ? 0.38 : 0.22)) {
      const patchX = x + 2 + storyTerrainHash(seed, 67) * Math.max(5, width * 0.18);
      const patchW = 12 + storyTerrainHash(seed, 68) * Math.max(12, width * 0.72);
      const patchY = surfaceY(patchX);
      const patchMid = surfaceY(patchX + patchW * 0.48);
      const patchEnd = surfaceY(patchX + patchW);
      ctx.beginPath();
      ctx.moveTo(patchX, patchY + 1);
      ctx.lineTo(patchX + patchW * 0.16, patchY - 2);
      ctx.lineTo(patchX + patchW * 0.31, patchY + 1 + storyTerrainHash(seed, 69) * 4);
      ctx.lineTo(patchX + patchW * 0.48, patchMid - 2);
      ctx.lineTo(patchX + patchW * 0.7, patchMid + 2);
      ctx.lineTo(patchX + patchW, patchEnd + 1);
      ctx.lineTo(patchX + patchW * 0.82, patchEnd + 5);
      ctx.lineTo(patchX + patchW * 0.55, patchMid + 7);
      ctx.lineTo(patchX + patchW * 0.25, patchY + 7);
      ctx.closePath();
      ctx.fillStyle = palette.snow;
      ctx.fill();
      ctx.fillStyle = palette.ice;
      ctx.fillRect(patchX + patchW * 0.21, patchY + 5, Math.max(4, patchW * 0.33), 3);
      if (storyTerrainHash(seed, 70) > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(patchX + patchW * 0.48, patchMid + 1, Math.max(4, patchW * 0.2), 2);
      }
    }
  }

  // Nieve y hielo en fragmentos irregulares, nunca como una línea continua.
  // Los parches siguen la pendiente y cambian de forma a lo largo del recorrido.
  const edgeStep = 19;
  for (let edgeX = -20; edgeX < GW + 12; edgeX += edgeStep) {
    const worldCell = Math.floor((edgeX + travel) / edgeStep);
    const seed = worldCell + lvl.level * 103;
    if (storyTerrainHash(seed, 901) < (inFlatSection ? 0.46 : 0.24)) continue;

    const patchX = edgeX + storyTerrainHash(seed, 902) * 5;
    const patchW = 7 + storyTerrainHash(seed, 903) * (inFlatSection ? 10 : 19);
    const yA = surfaceY(patchX);
    const yM = surfaceY(patchX + patchW * 0.48);
    const yB = surfaceY(patchX + patchW);
    ctx.beginPath();
    ctx.moveTo(patchX, yA + 1);
    ctx.lineTo(patchX + patchW * 0.18, yA - 2);
    ctx.lineTo(patchX + patchW * 0.39, yA + 0.5);
    ctx.lineTo(patchX + patchW * 0.53, yM - 1.5);
    ctx.lineTo(patchX + patchW * 0.76, yM + 1.5);
    ctx.lineTo(patchX + patchW, yB + 1);
    ctx.lineTo(patchX + patchW * 0.77, yB + 4);
    ctx.lineTo(patchX + patchW * 0.43, yM + 4);
    ctx.lineTo(patchX + patchW * 0.2, yA + 5);
    ctx.closePath();
    ctx.fillStyle = storyTerrainHash(seed, 904) > 0.52 ? palette.snow : palette.ridge;
    ctx.fill();

    if (storyTerrainHash(seed, 905) > 0.44) {
      ctx.fillStyle = palette.ice;
      ctx.beginPath();
      ctx.moveTo(patchX + patchW * 0.32, yA + 5);
      ctx.lineTo(patchX + patchW * 0.56, yM + 5);
      ctx.lineTo(patchX + patchW * 0.7, yM + 7);
      ctx.lineTo(patchX + patchW * 0.44, yM + 7);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Pequeños bloques de roca suelta y hielo en el primer plano, también variados.
  for (let cell = firstCell; cell <= lastCell; cell++) {
    const seed = cell + lvl.level * 91;
    if (storyTerrainHash(seed, 80) < 0.28) continue;
    const x = cell * cellSize - travel + 5 + storyTerrainHash(seed, 81) * 18;
    const y = surfaceY(x) + 24 + storyTerrainHash(seed, 82) * 34;
    const size = 5 + storyTerrainHash(seed, 83) * 12;
    ctx.fillStyle = storyTerrainHash(seed, 84) > 0.5 ? palette.light : palette.shade;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.25);
    ctx.lineTo(x + size * 0.55, y);
    ctx.lineTo(x + size, y + size * 0.42);
    ctx.lineTo(x + size * 0.72, y + size * 0.9);
    ctx.lineTo(x + size * 0.16, y + size);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore(); // Fin del recorte que vacía las grietas.

  // Bordes irregulares de roca expuesta y pequeñas cornisas heladas.
  for (const gap of visibleGaps) {
    for (const x of [gap.start, gap.end]) {
      const y = surfaceY(x);
      if (x < -25 || x > GW + 25) continue;
      // Bordes blanquecinos, degradados a gris como una fractura helada.
      const edgeFrost = ctx.createLinearGradient(0, y - 5, 0, y + 53);
      edgeFrost.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      edgeFrost.addColorStop(1, 'rgba(138, 151, 166, 0.52)');
      ctx.strokeStyle = edgeFrost;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x + (x === gap.start ? -4 : 4), y + 24);
      ctx.lineTo(x + (x === gap.start ? -2 : 2), y + 51);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220, 230, 243, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + (x === gap.start ? -11 : 2), y - 1);
      ctx.lineTo(x + (x === gap.start ? -2 : 11), y - 3);
      ctx.stroke();
      ctx.fillStyle = palette.snow;
      ctx.fillRect(x - 5, y - 5, 9, 3);
    }
  }
  ctx.restore();
}
function drawStoryClimbingWall(floorTop, lvl) {
  // Pared de roca del modo historia. Su textura se desplaza hacia arriba según
  // avanza la distancia, en un bucle continuo; no interviene en físicas ni colisiones.
  const wallBaseX = isPortrait ? 275 : 520;
  const wallTopX = isPortrait ? 390 : 680;
  const wallBottomY = floorTop + 20;
  const palette = lvl.storm
    ? { base: '#101927', mid: '#202e42', light: '#42546b', bright: '#65778c', shade: '#080e18', snow: '#c9d9e8', ice: '#78b9d8', snowShade: '#7794ad' }
    : { base: '#182536', mid: '#293b50', light: '#435a70', bright: '#6d8296', shade: '#0b1422', snow: '#f1f7fc', ice: '#8ecbeb', snowShade: '#a7bfd2' };

  const cellW = isPortrait ? 43 : 58;
  const cellH = isPortrait ? 49 : 57;
  const worldScrollY = storyData.distance * (isPortrait ? 0.76 : 0.84);
  const scrollY = worldScrollY % cellH;
  const firstWorldRow = Math.floor(worldScrollY / cellH);
  const scrollX = (storyData.distance * 0.11) % cellW;

  ctx.save();
  // Recorte con la misma silueta inclinada de la pared para que no invada el cielo.
  ctx.beginPath();
  ctx.moveTo(wallBaseX - 2, wallBottomY);
  ctx.lineTo(wallTopX, 85);
  ctx.lineTo(GW + 8, 85);
  ctx.lineTo(GW + 8, wallBottomY + 8);
  ctx.closePath();
  ctx.clip();

  const wallGradient = ctx.createLinearGradient(wallTopX, 85, GW, wallBottomY);
  wallGradient.addColorStop(0, palette.light);
  wallGradient.addColorStop(0.35, palette.mid);
  wallGradient.addColorStop(1, palette.base);
  ctx.fillStyle = wallGradient;
  ctx.fillRect(wallBaseX - 5, 78, GW - wallBaseX + 15, wallBottomY - 70);

  const rowCount = Math.ceil((wallBottomY - 78) / cellH) + 3;
  const colStart = -2;
  const colEnd = Math.ceil((GW - wallBaseX) / cellW) + 3;
  for (let row = -1; row < rowCount; row++) {
    const worldRow = firstWorldRow + row;
    const rowY = 82 + row * cellH - scrollY;
    for (let col = colStart; col < colEnd; col++) {
      const seed = worldRow * 173 + col * 47 + lvl.level * 131;
      const x = wallBaseX - 28 + col * cellW - scrollX;
      const y = rowY + (storyTerrainHash(seed, 1) - 0.5) * 9;
      const w = cellW * (0.88 + storyTerrainHash(seed, 2) * 0.26);
      const h = cellH * (0.84 + storyTerrainHash(seed, 3) * 0.25);
      const rockColorPick = storyTerrainHash(seed, 4);
      ctx.beginPath();
      ctx.moveTo(x - 3, y + h * 0.13);
      ctx.lineTo(x + w * 0.12, y + h * 0.02);
      ctx.lineTo(x + w * 0.34, y + h * 0.12);
      ctx.lineTo(x + w * 0.57, y - 2 + storyTerrainHash(seed, 5) * 8);
      ctx.lineTo(x + w * 0.82, y + h * 0.15);
      ctx.lineTo(x + w + 3, y + h * 0.36);
      ctx.lineTo(x + w * 0.91, y + h * 0.69);
      ctx.lineTo(x + w * 0.66, y + h + 3);
      ctx.lineTo(x + w * 0.4, y + h * 0.88);
      ctx.lineTo(x + w * 0.18, y + h * 0.98);
      ctx.lineTo(x - 2, y + h * 0.67);
      ctx.closePath();
      ctx.fillStyle = rockColorPick > 0.66 ? palette.mid : (rockColorPick > 0.31 ? palette.base : palette.light);
      ctx.fill();
      ctx.strokeStyle = palette.shade;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Faceta iluminada y sombra profunda, con diagonales distintas por roca.
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, y + h * 0.18);
      ctx.lineTo(x + w * (0.36 + storyTerrainHash(seed, 6) * 0.12), y + h * 0.2);
      ctx.lineTo(x + w * 0.31, y + h * 0.59);
      ctx.lineTo(x + w * 0.12, y + h * 0.7);
      ctx.closePath();
      ctx.fillStyle = palette.bright;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + w * 0.55, y + h * 0.32);
      ctx.lineTo(x + w * 0.94, y + h * 0.4);
      ctx.lineTo(x + w * 0.72, y + h * 0.88);
      ctx.lineTo(x + w * 0.5, y + h * 0.73);
      ctx.closePath();
      ctx.fillStyle = palette.shade;
      ctx.fill();

      // Grietas cortas y vetas: se generan por coordenada para no parpadear.
      if (storyTerrainHash(seed, 7) > 0.36) {
        const cx = x + w * (0.25 + storyTerrainHash(seed, 8) * 0.45);
        const cy = y + h * (0.32 + storyTerrainHash(seed, 9) * 0.26);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 3 + storyTerrainHash(seed, 10) * 8, cy + 7 + storyTerrainHash(seed, 11) * 7);
        ctx.lineTo(cx - 8 + storyTerrainHash(seed, 12) * 12, cy + 14 + storyTerrainHash(seed, 13) * 8);
        ctx.strokeStyle = palette.shade;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Nieve acumulada en cornisas irregulares (no una cuadrícula de hielo repetida).
      if (storyTerrainHash(seed, 14) > (lvl.storm ? 0.68 : 0.5)) {
        const sx = x + 2 + storyTerrainHash(seed, 15) * (w * 0.42);
        const sy = y + 3 + storyTerrainHash(seed, 16) * (h * 0.48);
        const sw = 12 + storyTerrainHash(seed, 17) * (w * 0.72);
        const sh = 4 + storyTerrainHash(seed, 18) * 7;
        ctx.beginPath();
        ctx.moveTo(sx, sy + 2);
        ctx.lineTo(sx + sw * 0.17, sy - 2);
        ctx.lineTo(sx + sw * 0.38, sy + 1);
        ctx.lineTo(sx + sw * 0.58, sy - 1 + storyTerrainHash(seed, 19) * 3);
        ctx.lineTo(sx + sw, sy + 2);
        ctx.lineTo(sx + sw * 0.84, sy + sh);
        ctx.lineTo(sx + sw * 0.48, sy + sh - 1);
        ctx.lineTo(sx + sw * 0.22, sy + sh + 2);
        ctx.closePath();
        ctx.fillStyle = palette.snowShade;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx + 1, sy);
        ctx.lineTo(sx + sw * 0.17, sy - 2);
        ctx.lineTo(sx + sw * 0.38, sy + 0.5);
        ctx.lineTo(sx + sw * 0.58, sy - 1);
        ctx.lineTo(sx + sw - 1, sy + 1);
        ctx.lineTo(sx + sw * 0.7, sy + 3);
        ctx.lineTo(sx + sw * 0.3, sy + 2);
        ctx.closePath();
        ctx.fillStyle = palette.snow;
        ctx.fill();
        ctx.fillStyle = palette.ice;
        if (storyTerrainHash(seed, 20) > 0.48) {
          ctx.fillRect(sx + sw * 0.58, sy + sh, 3, 5 + storyTerrainHash(seed, 21) * 8);
        }
      }

      // Pequeñas vetas de hielo y carámbanos, colocados con menos frecuencia.
      if (storyTerrainHash(seed, 22) > 0.76) {
        const ix = x + w * (0.18 + storyTerrainHash(seed, 23) * 0.7);
        const iy = y + h * (0.2 + storyTerrainHash(seed, 24) * 0.5);
        ctx.fillStyle = palette.ice;
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(ix + 4, iy + 1);
        ctx.lineTo(ix + 3, iy + 9 + storyTerrainHash(seed, 25) * 10);
        ctx.lineTo(ix + 1, iy + 5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Una pocas repisas nevadas largas rompen el patrón de bloques y refuerzan la pared.
  const ledgeCount = Math.ceil((wallBottomY - 80) / 96) + 2;
  for (let i = -1; i < ledgeCount; i++) {
    const worldRow = firstWorldRow + i;
    const y = 88 + i * 96 - (worldScrollY % 96);
    const seed = worldRow + lvl.level * 59;
    if (storyTerrainHash(seed, 31) < 0.52) continue;
    const x = wallBaseX + 30 + storyTerrainHash(seed, 32) * Math.max(10, GW - wallBaseX - 90);
    const w = 22 + storyTerrainHash(seed, 33) * 66;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + w * 0.18, y);
    ctx.lineTo(x + w * 0.56, y + 2);
    ctx.lineTo(x + w, y + 5);
    ctx.lineTo(x + w * 0.82, y + 10);
    ctx.lineTo(x + w * 0.42, y + 8);
    ctx.closePath();
    ctx.fillStyle = palette.snow;
    ctx.fill();
    ctx.fillStyle = palette.ice;
    ctx.fillRect(x + w * 0.28, y + 8, Math.max(5, w * 0.26), 3);
  }

  ctx.restore();
}

function renderStoryMode() {
  const lvl = LEVELS[storyData.levelIdx];
  const progress = Math.min(1, storyData.distance / lvl.totalDistance);
  const currentAlt = Math.floor(lvl.startAlt + (lvl.endAlt - lvl.startAlt) * progress);
  const inFlatSection = storyData.distance < lvl.flatTutorialDist;
  const groundY = getGroundY(inFlatSection);

  if (gameState === "SUMMIT" && player.celebrating && storyData.summitSunriseProgress < 1) {
    storyData.summitSunriseProgress = Math.min(1, storyData.summitSunriseProgress + 0.005);
  }

  drawCotopaxiBackground(lvl.night, storyData.summitSunriseProgress);

  const scrollX = (storyData.distance * 0.8) % 120;
  const floorTop = groundY + 25;

  // El perfil rocoso de abajo cubre el terreno hasta el borde visible; no se
  // dibuja una franja horizontal que contradiga la inclinación de la cornisa.

  // La pared lateral se elimina: durante la escalada solo se ve el terreno
  // ascendente, con su perfil de roca, nieve y hielo. El tutorial sigue igual.
  if (inFlatSection) {
    const boxW = isPortrait ? 490 : 390;
    const boxX = isPortrait ? (GW - boxW) / 2 : 25;
    const boxY = groundY - 125;
    ctx.fillStyle = "rgba(30, 41, 59, 0.92)";
    ctx.fillRect(boxX, boxY, boxW, 50);
    ctx.strokeStyle = "#f7931e";
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, 50);
    ctx.fillStyle = "#fff";
    ctx.font = "10px 'Press Start 2P'";
    ctx.fillText("TRAMO PLANO: SALTA Y USA EL PIOLET", boxX + 16, boxY + 21);
    ctx.fillText("LUEGO INICIA LA ESCALADA AL ILINIZA", boxX + 16, boxY + 39);
  }

  drawStoryMountainTerrain(floorTop, lvl, inFlatSection);

  // Desplazamiento exclusivamente visual de cámara: acompaña al montañista
  // sobre la pendiente sin modificar su posición lógica ni las colisiones.
  const cameraYOffset = getStoryTerrainVisualOffset(player.x, floorTop, lvl, inFlatSection);

  obstacles.forEach((ob) => {
    const isGroundObstacle = ob.type === "ICEBLOCK" || ob.type === "PILSENER";
    const drawY = isGroundObstacle
      ? getStoryTerrainSurfaceY(ob.x, floorTop, lvl, inFlatSection) - 16
      : ob.y + cameraYOffset;
    if (ob.type === "ICEBLOCK") {
      // El cubo se apoya en la superficie y rota con la pendiente; solo cambia
      // su dibujo, no su posición física ni las colisiones.
      const iceSurfaceY = drawY + 16;
      const iceAngle = getStoryTerrainSlopeAngle(lvl, inFlatSection);
      ctx.save();
      ctx.translate(ob.x, iceSurfaceY);
      ctx.rotate(-iceAngle);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-24, -52, 48, 52);
      ctx.fillStyle = "#e0f2fe";
      ctx.fillRect(-20, -48, 40, 14);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 3;
      ctx.strokeRect(-24, -52, 48, 52);
      ctx.restore();
    } else if (ob.type === "SNOWBALL") {
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(ob.x, drawY, ob.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (ob.type === "ROCK") {
      drawFallingRockShape(ctx, ob.x, drawY, ob.r, ob.variant || 0);
    } else if (ob.type === "PILSENER") {
      drawBottlePilsener(ob.x, drawY, 0);
    }
  });

  // Al avanzar por la pendiente el personaje se eleva visualmente y se inclina
  // hacia delante cuando escala. La animación se limita al modo historia.
  const climbingInput = !inFlatSection && (
    player.huggingWall || keys.up || keys.right || joyState.dy < -0.25 || joyState.dx > 0.25
  );
  const visualPlayerY = player.y + cameraYOffset;
  ctx.save();
  ctx.translate(player.x, visualPlayerY);
  if (climbingInput) ctx.rotate(0.105 + Math.sin(player.animFrame * 0.22) * 0.018);
  drawMountaineerSprite(ctx, selectedCharacter, 0, 0, {
    scale: isPortrait ? 1.45 : 1.35,
    facing: player.facing,
    anim: player.animFrame,
    swinging: player.swingTimer > 0,
    crouching: player.crouching,
    hugging: player.huggingWall,
    frozen: lvl.frozenPlayer,
    celebrating: player.celebrating,
    hurt: player.invulnTimer > 0
  });
  ctx.restore();

  snowBreakParticles.forEach((p) => {
    const alpha = Math.max(0, p.life / p.maxLife);
    const py = p.y + cameraYOffset;
    if (p.kind === "puff") {
      ctx.fillStyle = `rgba(255,255,255,${0.78 * alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(p.x, py);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(240,249,255,${0.95 * alpha})`;
      ctx.strokeStyle = `rgba(148,163,184,${0.85 * alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.9, -p.size * 0.35);
      ctx.lineTo(p.size * 0.95, -p.size * 0.08);
      ctx.lineTo(p.size * 0.36, p.size * 0.76);
      ctx.lineTo(-p.size * 0.7, p.size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });

  ctx.fillStyle = "#ffffff";
  snowParticles.forEach((p) => {
    ctx.fillRect(p.x, p.y, p.r, p.r);
  });

  if (lvl.night && storyData.summitSunriseProgress < 0.5) {
    const darkness = ctx.createRadialGradient(
      player.x, player.y + cameraYOffset - 20, 75,
      player.x, player.y + cameraYOffset - 20, 320
    );
    darkness.addColorStop(0, "rgba(5, 8, 18, 0.1)");
    darkness.addColorStop(1, "rgba(5, 8, 18, 0.86)");
    ctx.fillStyle = darkness;
    ctx.fillRect(0, 0, GW, GH);
  }

  floatingTexts.forEach((ft) => {
    ctx.fillStyle = ft.color;
    ctx.font = "13px 'Press Start 2P'";
    ctx.fillText(ft.text, ft.x - 20, ft.y + cameraYOffset);
  });

  const hudW = isPortrait ? 305 : 470;
  ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
  ctx.fillRect(12, 10, hudW, 82);
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 10, hudW, 82);

  drawHeartsHUD(20, 20, storyData.hearts, storyData.maxHearts);

  ctx.fillStyle = "#f8fafc";
  ctx.font = isPortrait ? "9px 'Press Start 2P'" : "11px 'Press Start 2P'";
  ctx.fillText(
    `NV ${lvl.level}/5 | ${currentAlt}m | PTS:${storyData.score + storyData.levelScore}`,
    20, 56
  );

  const barW = hudW - 18;
  ctx.fillStyle = "#334155";
  ctx.fillRect(20, 68, barW, 12);
  ctx.fillStyle = "#f7931e";
  ctx.fillRect(20, 68, barW * progress, 12);

  // V24: el aviso de nivel completado se muestra como una ventana HTML
  // con dos opciones; el fondo queda congelado y no cambia la física.

  if (gameState === "SUMMIT" && player.celebrating) {
    const smW = isPortrait ? 500 : 680;
    const smX = (GW - smW) / 2;
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(smX, 115, smW, 120);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 4;
    ctx.strokeRect(smX, 115, smW, 120);

    ctx.textAlign = "center";
    ctx.fillStyle = "#facc15";
    ctx.font = isPortrait ? "11px 'Press Start 2P'" : "15px 'Press Start 2P'";
    ctx.fillText("🏔️ ¡FELICIDADES LLEGASTE A 5248 MSNM!", GW / 2, 160);
    ctx.fillStyle = "#ffffff";
    ctx.font = isPortrait ? "10px 'Press Start 2P'" : "12px 'Press Start 2P'";
    ctx.fillText(`FIN DE JUEGO - PUNTAJE: ${storyData.score}`, GW / 2, 198);
    ctx.textAlign = "left";

    if (storyData.summitSunriseProgress >= 1 && !summitCelebrationActive &&
        !document.getElementById("gameover-overlay").classList.contains("active") &&
        !document.getElementById("menu-overlay").classList.contains("active")) {
      showSummitCelebrationPrompt();
    }
  }
}

function trimName(n, max) {
  n = String(n || "");
  return n.length > max ? n.slice(0, max - 1) + "…" : n;
}

function fitFont(text, maxW, startSize) {
  let size = startSize;
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  while (ctx.measureText(text).width > maxW && size > 7) {
    size--;
    ctx.font = `${size}px 'Press Start 2P', monospace`;
  }
}

function drawVsShield(f) {
  const t = Math.max(0, Math.min(1, f.shieldAnim || 0));
  if (t <= 0) return;
  const baseX = stageXToCanvasX(f.x);
  const face = f.facing || 1;
  // La mano recorre de la cabeza al pecho, sin alejar el casco del personaje.
  const cx = baseX + face * (3 + 27 * t);
  const cy = f.y - 64 + 43 * t;
  const helmetColor = f.char === 'CUSTOM' && f.customConfig
    ? (f.customConfig.helmetColor || '#f8fafc')
    : (f.char === 'JORDY' ? '#f8fafc' : '#f97316');
  const jacketColor = f.char === 'CUSTOM' && f.customConfig
    ? (f.customConfig.jacketColor || '#f97316')
    : (f.char === 'JORDY' ? '#f97316' : '#0ea5e9');
  const handColor = f.char === 'CUSTOM' && f.customConfig
    ? (SKIN_TONES[f.customConfig.skin] || '#d99b66') : '#f1c27d';
  const weakGuard = !f.blocking && (f.shieldCooldown > 0 || f.action === 'GUARD_WEAK');

  ctx.save();
  ctx.lineCap = 'square';
  // Brazo hacia el casco, a una distancia natural desde el hombro.
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(baseX + face * 12, f.y - 12);
  ctx.lineTo(cx - face * 7, cy + 5);
  ctx.stroke();
  ctx.strokeStyle = jacketColor;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = handColor;
  ctx.fillRect(cx - 4, cy + 3, 8, 7);

  ctx.translate(cx, cy);
  ctx.scale(face, 1);
  const isPolice = isPoliceSpecialConfig(f.customConfig);
  if (isPolice) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-13, -18, 22, 32);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-11, -16, 18, 28);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-4, -10, 3, 16);
    ctx.fillRect(-7, -4, 9, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-9, -14, 5, 20);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-10, -13, 16, 3);
    ctx.fillRect(-10, 7, 16, 3);
  } else {
    // Casco pixel-art curvado en la mano, con el mismo color de cada personaje.
    ctx.fillStyle = '#101827';
    ctx.fillRect(-14, -5, 28, 14);
    ctx.fillRect(-11, -10, 22, 6);
    ctx.fillRect(-7, -13, 14, 4);
    ctx.fillStyle = helmetColor;
    ctx.fillRect(-12, -4, 24, 12);
    ctx.fillRect(-9, -9, 18, 6);
    ctx.fillRect(-6, -12, 12, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillRect(-8, -9, 8, 2);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-15, 7, 30, 4); // visera
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6, -5, 3, 3); // ventilaciones
    ctx.fillRect(4, -5, 3, 3);
  }

  // Escudo luminoso clásico DELANTE del casco (no sustituye el casco).
  // En recarga sigue visible, pero atenuado y NO bloquea daño.
  const strength = weakGuard ? 0.32 : 1;
  ctx.fillStyle = `rgba(56,189,248,${0.18 * strength * t})`;
  ctx.beginPath();
  ctx.ellipse(isPolice ? 14 : 20, -1, isPolice ? 16 : 13, isPolice ? 26 : 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(125,211,252,${0.88 * strength * t})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(isPolice ? 13 : 19, -1, isPolice ? 11 : 9, isPolice ? 21 : 19, 0, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.strokeStyle = `rgba(224,242,254,${0.6 * strength * t})`;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

function drawBeerBottle(pr) {
  ctx.save();
  ctx.translate(stageXToCanvasX(pr.x), pr.y);
  ctx.rotate(pr.rot);
  ctx.scale(1.3, 1.3);
  if (pr.type === 'BULLET') {
    ctx.fillStyle = '#7c4a22';
    ctx.fillRect(-8, -3, 10, 6);
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(1, -2, 8, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(8, -1, 3, 2);
  } else {
    ctx.fillStyle = "#b45309";
    ctx.fillRect(-5, -4, 14, 9);
    ctx.fillStyle = "#92400e";
    ctx.fillRect(9, -2, 8, 5);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(17, -3, 3, 7);
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(-2, -4, 5, 9);
  }
  ctx.restore();
}

function drawSpeechBubble(x, y, text) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const cand = line ? line + ' ' + w : w;
    if (cand.length > 18 && line) { lines.push(line); line = w; }
    else line = cand;
  }
  if (line) lines.push(line);
  ctx.font = "9px 'Press Start 2P', monospace";
  const lineH = 12;
  const width = Math.min(170, Math.max(84, ...lines.map(l => ctx.measureText(l).width + 16)));
  const height = lines.length * lineH + 12;
  const boxX = Math.max(7, Math.min(GW - width - 7, x - width / 2));
  const boxY = Math.max(145, y - height - 18);
  ctx.fillStyle = '#fff8dc';
  ctx.fillRect(boxX, boxY, width, height);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, width, height);
  ctx.beginPath();
  const tailX = Math.max(boxX + 14, Math.min(boxX + width - 14, x));
  ctx.moveTo(tailX - 8, boxY + height);
  ctx.lineTo(tailX + 4, boxY + height);
  ctx.lineTo(tailX - 1, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111827';
  lines.forEach((ln, idx) => ctx.fillText(ln, boxX + width / 2, boxY + 8 + lineH / 2 + idx * lineH, width - 12));
  ctx.restore();
}

function drawVsFloaters() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "14px 'Press Start 2P', monospace";
  vsFloaters.forEach((fl) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, fl.life / 20));
    const x = stageXToCanvasX(fl.x);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(fl.text, x, fl.y);
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.text, x, fl.y);
  });
  ctx.restore();
}

function drawVsHud() {
  // Bajo los botones CONFIG/SONIDO del DOM (que están arriba a la derecha)
  const cssScale = (window.innerHeight / GH) || 1;
  const topY = Math.min(130, 58 / cssScale) + 12;
  const margin = 14;
  const gap = 44;
  const barW = Math.floor((GW - margin * 2 - gap) / 2);
  const barH = 20;
  const barY = topY + 8;

  ctx.save();
  fighters.forEach((f, i) => {
    const x = i === 0 ? margin : GW - margin - barW;
    const pct = Math.max(0, Math.min(1, f.hp / f.maxHp));
    const ghostPct = Math.max(pct, Math.min(1, f.hpGhost / f.maxHp));
    const name = trimName(f.displayName || f.char, 16);

    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.textAlign = i === 0 ? "left" : "right";
    const nx = i === 0 ? x : x + barW;
    ctx.fillStyle = "#000000";
    ctx.fillText(name, nx + 1, topY + 1);
    ctx.fillStyle = i === 0 ? "#f7931e" : "#63b3ed";
    ctx.fillText(name, nx, topY);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x - 3, barY - 3, barW + 6, barH + 6);
    ctx.fillStyle = "#334155";
    ctx.fillRect(x, barY, barW, barH);

    const gw = barW * ghostPct;
    const w = barW * pct;
    ctx.fillStyle = "#fde68a"; // daño reciente
    ctx.fillRect(i === 0 ? x : x + barW - gw, barY, gw, barH);
    ctx.fillStyle = pct > 0.5 ? "#22c55e" : (pct > 0.25 ? "#eab308" : "#ef4444");
    ctx.fillRect(i === 0 ? x : x + barW - w, barY, w, barH);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(i === 0 ? x : x + barW - w, barY, w, 6);

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, barY, barW, barH);

    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    const label = `${Math.ceil(f.hp)}/${f.maxHp}`;
    ctx.fillStyle = "#000000";
    ctx.fillText(label, x + barW / 2 + 1, barY + 15);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + barW / 2, barY + 14);
  });

  const myShield = fighters[0];
  const shieldLabel = myShield.shieldCooldown > 0
    ? `CASCO: RECARGA ${Math.ceil(myShield.shieldCooldown / 60)}s`
    : `CASCO: ${Math.max(0, SHIELD_BLOCK_LIMIT - myShield.shieldBlocks)}/3 BLOQUEOS`;
  ctx.textAlign = "left";
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillStyle = myShield.shieldCooldown > 0 ? '#facc15' : '#bae6fd';
  ctx.fillText(shieldLabel, margin, barY + barH + 18);

  ctx.textAlign = "center";
  ctx.font = "12px 'Press Start 2P', monospace";
  ctx.fillStyle = "#000000";
  ctx.fillText("VS", GW / 2 + 1, barY + 17);
  ctx.fillStyle = "#facc15";
  ctx.fillText("VS", GW / 2, barY + 16);
  ctx.restore();
}


function apusFightFloorStyle(stageId){
  const id=Number(stageId)||0;
  if(id===21||id===4)return 'urban';
  if([16,17,20].includes(id))return 'jungle';
  if([7,12,19,22,24].includes(id))return 'volcanic';
  if([3,8,10,11,14,18,23].includes(id))return 'rock';
  if([5,9,13,15].includes(id))return 'lagoon';
  return 'pajonal';
}
function drawApusFightGround(){
  const y=getFightGroundY(), width=GW, height=GH, stageId=Number(apusActiveFightStageId)||0;
  const kind=apusFightFloorStyle(stageId);
  const themes={
    urban:   ['#575465','#34333e','#72717d','#98969b','#556a4f'],
    jungle:  ['#417044','#1f3528','#526b3c','#627f58','#77a75f'],
    volcanic:['#575055','#232229','#6d6367','#8e8581','#a8472c'],
    rock:    ['#797269','#393735','#968779','#b7a695','#7b8650'],
    lagoon:  ['#6b784e','#344636','#8a8e6c','#9fa78d','#79a75e'],
    pajonal: ['#87824a','#49482c','#a69a5a','#c7b071','#93aa56']
  };
  const [edge,deep,stone,light,plant]=themes[kind]||themes.pajonal;
  const top=Math.round(y+4), h=height-top;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  // Capa geológica completa: tierra, piedra y profundidad.
  const soil=ctx.createLinearGradient(0,top,0,height);
  soil.addColorStop(0,edge);soil.addColorStop(.16,stone);soil.addColorStop(.19,deep);
  soil.addColorStop(.63,deep);soil.addColorStop(1,'#1a1a1a');
  ctx.fillStyle=soil;ctx.fillRect(0,top,width,h);

  function px(x,py,w,ph,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(py),Math.ceil(w),Math.ceil(ph));}
  // Borde superior vivo, irregular; sirve de línea exacta del suelo de los jugadores.
  for(let x=0;x<width;x+=5){
    const k=Math.sin((x+stageId*31)*.07)*2+Math.sin((x+stageId*17)*.22)*2;
    const crest=Math.max(1,Math.round(3+k));
    px(x,y-crest,5,crest+8,kind==='volcanic'?stone:edge);
    if(x%15===0) px(x,y+9,4,2,light);
  }
  // Estratos, fisuras y pequeñas motas repartidas a lo ancho y abajo.
  for(let i=0;i<Math.max(70,Math.floor(width/3));i++){
    const x=(i*91+stageId*53)%width;
    const py=top+12+((i*61+stageId*43)%(Math.max(22,h-18)));
    const wide=(i%5===0?11:i%3===0?6:3);
    const palette=[stone,light,edge,'#262626'];
    px(x,py,wide,i%4===0?3:2,palette[i%palette.length]);
    if(i%7===0)px(x+wide,py+3,Math.max(3,wide-2),2,'rgba(14,18,20,.4)');
  }
  function rock(x,py,size=20){
    const s=size;
    px(x+4,py+4,s,3,'rgba(0,0,0,.32)');
    ctx.beginPath(); ctx.moveTo(Math.round(x),Math.round(py+7));
    ctx.lineTo(Math.round(x+4),Math.round(py-1));
    ctx.lineTo(Math.round(x+s*.62),Math.round(py-5));
    ctx.lineTo(Math.round(x+s),Math.round(py+4));
    ctx.lineTo(Math.round(x+s-4),Math.round(py+10));ctx.closePath();
    ctx.fillStyle=stone;ctx.fill();
    px(x+s*.24,py-2,s*.29,2,light);px(x+s*.62,py+3,s*.18,3,deep);
  }
  function grass(x,py,size=15){
    px(x,py-size*.75,2,size*.75,kind==='jungle'?'#326d3b':'#627743');
    px(x-4,py-size*.42,3,7,plant);px(x-8,py-size*.75,4,4,plant);
    px(x+2,py-size*.62,4,8,plant);px(x+7,py-size*.92,4,5,light);
    px(x-1,py-size*.78,3,3,light);
  }
  function fern(x,py,size=18){
    px(x,py-size*.76,2,size*.76,'#34572e');
    for(let j=0;j<3;j++){
      const yy=py-size*.64+j*size*.18;
      px(x-(6+j),yy,8+j,3,plant);px(x+2,yy-3,6+j,3,light);
    }
  }
  function bloom(x,py){
    px(x,py-12,2,12,plant);px(x-4,py-15,4,4,'#facc15');
    px(x+2,py-16,4,4,'#f59e0b');px(x,py-18,3,3,'#fff4ae');
  }
  function brick(x,py,w=42){
    px(x,py,w-3,22,'#88858a');px(x+3,py+2,w-9,15,'#5b5b5f');
    px(x+3,py+10,w-9,2,'#3b3942');px(x+Math.round(w/2),py+2,2,10,'#393943');
    px(x+Math.round(w/3),py+14,2,7,'#393943');
  }
  // Detalles cerca de los pies de los jugadores, sin ocupar su silueta.
  for(let i=0;i<Math.max(9,Math.round(width/53));i++){
    const x=11+i*(width-22)/(Math.max(9,Math.round(width/53))-1);
    const yy=y+4+(i%3)*5;
    if(kind==='urban'){
      brick(x-5,yy+6,Math.round(width/Math.max(9,Math.round(width/53))));
      if(i%4===0) grass(x+12,yy+10,13);
    }else if(kind==='volcanic'){
      rock(x,yy+5,24+i%3*7);
      if(i%4===1){px(x+5,yy+8,6,2,'#b94f2a');px(x+8,yy+9,4,1,'#e78a4c');}
    }else if(kind==='rock'){
      rock(x,yy+5,20+i%4*6);
      if(i%3===1)grass(x+8,yy+12,10);
    }else if(kind==='jungle'){
      fern(x,yy+14,24+i%3*4);
      if(i%3===1) rock(x+10,yy+7,13);
    }else if(kind==='lagoon'){
      if(i%2===0) grass(x,yy+15,23);else rock(x,yy+7,19);
      px(x+4,yy+29,18,2,'rgba(121,173,171,.50)');
    }else{
      grass(x,yy+14,22+i%3*6);
      if(i%4===2)bloom(x+12,yy+15);
      if(i%3===1)rock(x+19,yy+9,12);
    }
  }
  // Tres planos de detalle hacia el frente, para evitar el rectángulo liso del fondo.
  for(let layer=0;layer<3;layer++){
    const py=y+Math.max(36,Math.floor((height-y)*(layer+1)/4));
    for(let i=0;i<Math.max(6,Math.floor(width/75));i++){
      const x=((i*81+layer*47+stageId*37)%width);
      if(kind==='urban')brick(x,py,42);
      else if(kind==='jungle')fern(x,py,22);
      else if(kind==='volcanic'||kind==='rock')rock(x,py,24+layer*5);
      else if(i%3===0)rock(x,py,22);else grass(x,py,25);
    }
  }
  ctx.restore();
}

function renderVersusMiniGame() {
  drawSelectedVersusBackground();
  // Terreno vivo dibujado ANTES de los personajes en 1v1 y en torneos.
  drawApusFightGround();

  fighters.forEach((f, i) => {
    const isWinner = !!vsWinner && i === vsWinnerIdx;
    const isLoser = !!vsWinner && i !== vsWinnerIdx;
    drawMountaineerSprite(ctx, f.char, stageXToCanvasX(f.x), f.y, {
      scale: 1.5,
      facing: f.facing,
      anim: f.anim,
      swinging: f.action === "AXE",
      kicking: f.action === "KICK",
      throwing: f.action === "THROW",
      crouching: f.blocking,
      celebrating: isWinner,
      crying: isLoser,
      hurt: f.hurtTimer > 0 && !vsWinner,
      customConfig: f.customConfig,
      helmetShield: !vsWinner && (f.shieldAnim || 0) > 0.03
    });
    if ((f.shieldAnim || 0) > 0 && !vsWinner) drawVsShield(f);
    if (vsWinner && tournament) {
      const quote = fighterQuoteText(f);
      if (quote) {
        // Globo junto al luchador, escalonado para evitar que ambas frases se tapen.
        const px = stageXToCanvasX(f.x) + (i === 0 ? -20 : 20);
        drawSpeechBubble(px, f.y - (i === 0 ? 78 : 115), quote);
      }
    }
  });

  projectiles.forEach(drawBeerBottle);
  drawVsFloaters();
  drawVsHud();
  if(tournament?.mode==='online' && gameState==='TOURNAMENT_WATCH' && !vsWinner &&
     performance.now()-(tournament.lastWatchFrameAt||performance.now())>1800){
    ctx.save();
    ctx.textAlign='center';
    ctx.font="9px 'Press Start 2P', monospace";
    ctx.fillStyle='#facc15';
    ctx.fillText('SIN SEÑAL DEL COMBATE · RECONECTANDO...',GW/2,isPortrait?275:245);
    ctx.restore();
  }

  if (vsWinner && vsEndAnimTimer > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `${isPortrait ? 24 : 32}px 'Press Start 2P', monospace`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000000";
    const koY = tournament ? (isPortrait ? 185 : 165) : GH / 2 - 30;
    ctx.strokeText("K.O.!", GW / 2, koY);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("K.O.!", GW / 2, koY);
    ctx.restore();
  }

  if (vsWinner && vsEndAnimTimer <= 0) {
    const boxW = Math.min(460, GW - 30);
    const boxX = (GW - boxW) / 2;
    const boxY = tournament ? (isPortrait ? 165 : 135) : GH / 2 - 60;
    const boxH = tournament ? 75 : 120;
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = "#f7931e";
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.textAlign = "center";
    ctx.fillStyle = "#facc15";
    fitFont(`🏆 ¡GANA ${trimName(vsWinner, 18)}!`, boxW - 30, isPortrait ? 12 : 16);
    ctx.fillText(`🏆 ¡GANA ${trimName(vsWinner, 18)}!`, GW / 2, boxY + (tournament ? 32 : 50));
    ctx.fillStyle = "#fff";
    const sub = tournament ?
      (tournament.awaitContinueWinner ? "EL GANADOR DEBE PULSAR CONTINUAR" : "PREPARANDO SIGUIENTE COMBATE...") :
      "ELIGE REVANCHA O VOLVER A PERSONAJE";
    fitFont(sub, boxW - 30, 10);
    ctx.fillText(sub, GW / 2, boxY + (tournament ? 61 : 90));
    ctx.textAlign = "left";
  }
}

