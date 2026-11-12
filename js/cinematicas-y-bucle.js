/* ============================================================================
   CINEMÁTICA DE APERTURA (INTRO)
   ============================================================================ */
function renderIntroCinematic() {
  introTimer++;
  drawCotopaxiBackground(false, 0.38);

  const charY = isPortrait ? 510 : 370;

  // Jordy saltando
  const jordyX = isPortrait ? (GW * 0.36) : (GW * 0.42);
  const jumpHeight = Math.abs(Math.sin(introTimer * 0.08)) * 26;
  drawMountaineerSprite(ctx, "JORDY", jordyX, charY - jumpHeight, {
    scale: isPortrait ? 1.55 : 1.5,
    facing: 1,
    anim: introTimer,
    swinging: true,
    celebrating: true
  });

  // Chugo patrullando
  const patrolRange = isPortrait ? 38 : 55;
  const chugoBaseX = isPortrait ? (GW * 0.62) : (GW * 0.58);
  const chugoOffsetX = Math.sin(introTimer * 0.045) * patrolRange;
  const chugoFacing = Math.cos(introTimer * 0.045) >= 0 ? 1 : -1;
  drawMountaineerSprite(ctx, "CHUGO", chugoBaseX + chugoOffsetX, charY + 2, {
    scale: isPortrait ? 1.55 : 1.5,
    facing: chugoFacing,
    anim: introTimer * 1.5
  });

  // Nieve
  ctx.fillStyle = "#ffffff";
  snowParticles.forEach((p) => {
    ctx.fillRect(p.x, p.y, p.r, p.r);
    p.y += p.vy;
    p.x += p.vx;
    if (p.y > GH) p.y = 0;
    if (p.x < 0) p.x = GW;
  });

  // Título
  ctx.save();
  const titleAlpha = Math.min(1, introTimer / 30);
  ctx.globalAlpha = titleAlpha;
  ctx.textAlign = "center";

  const titleCenterY = isPortrait ? 230 : 165;
  drawApusLogo(ctx, GW / 2 - 40, titleCenterY - 105, 80);

  ctx.fillStyle = "#000000";
  ctx.font = isPortrait ? "18px 'Press Start 2P'" : "24px 'Press Start 2P'";
  ctx.fillText("APUS' GUARDIANS", GW / 2 + 3, titleCenterY + 3);
  ctx.fillStyle = "#f7931e";
  ctx.fillText("APUS' GUARDIANS", GW / 2, titleCenterY);

  ctx.fillStyle = "#000000";
  ctx.font = isPortrait ? "11px 'Press Start 2P'" : "13.5px 'Press Start 2P'";
  ctx.fillText("RETO ILINIZA SUR (5248 MSNM)", GW / 2 + 2, titleCenterY + 36);
  ctx.fillStyle = "#63b3ed";
  ctx.fillText("RETO ILINIZA SUR (5248 MSNM)", GW / 2, titleCenterY + 34);

  if (exitCinematicActive) {
    // Mensaje definido arriba en EXIT_FAREWELL_LINES (editable sin tocar el dibujo).
    const lines = EXIT_FAREWELL_LINES;
    const lineHeight = isPortrait ? 28 : 23;
    const firstY = GH - (isPortrait ? 115 : 85) - (lines.length - 1) * lineHeight;
    const boxTop = firstY - 22;
    const boxHeight = lines.length * lineHeight + 14;
    ctx.fillStyle = "rgba(6, 16, 31, 0.82)";
    ctx.fillRect(16, boxTop, GW - 32, boxHeight);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, boxTop, GW - 32, boxHeight);
    lines.forEach((message, index) => {
      const maxWidth = GW - 52;
      let fontSize = index === 0 ? (isPortrait ? 14 : 15) : (isPortrait ? 9 : 12);
      ctx.font = `${fontSize}px 'Press Start 2P', monospace`;
      while (fontSize > 6 && ctx.measureText(message).width > maxWidth) {
        fontSize--;
        ctx.font = `${fontSize}px 'Press Start 2P', monospace`;
      }
      ctx.fillStyle = index === 0 ? "#facc15" : "#ffffff";
      ctx.fillText(message, GW / 2, firstY + index * lineHeight);
    });
  }
  const blink = Math.floor(Date.now() / 450) % 2 === 0;
  ctx.fillStyle = blink ? "#facc15" : "#94a3b8";
  ctx.font = isPortrait ? "9px 'Press Start 2P'" : "10px 'Press Start 2P'";
  const introPrompt = introTapCount === 1 ? "[ TOCA OTRA VEZ PARA ENTRAR ]" :
    (exitCinematicActive ? "[ TOCAR DOS VECES PARA VOLVER ]" : "[ TOCAR DOS VECES PARA ENTRAR ]");
  ctx.fillText(introPrompt, GW / 2, isPortrait ? (GH - 60) : (GH - 40));
  ctx.restore();

  // El menú se abre exclusivamente tras DOBLE TOQUE, no por tiempo.
  // Anteriormente el contador avanzaba oculto durante el video y mostraba
  // brevemente el menú antes de regresar a esta animación.

}

/* ============================================================================
   BUCLE PRINCIPAL (60 FPS)
   ============================================================================ */
function initPreviews() {
  const logoCanvas = document.getElementById("logoCanvas");
  if (logoCanvas) {
    const logoCtx = logoCanvas.getContext("2d");
    drawApusLogo(logoCtx, 4, 4, 88);
  }
  // Reutilizar exactamente el mismo logo del menú principal en Comunidad.
  const communityLogoCanvas = document.getElementById("communityLogoCanvas");
  if (communityLogoCanvas) {
    drawApusLogo(communityLogoCanvas.getContext("2d"), 4, 4, 88);
  }
  const jCanvas = document.getElementById("preview-jordy");
  if (jCanvas) {
    const jCtx = jCanvas.getContext("2d");
    drawMountaineerSprite(jCtx, "JORDY", 60, 92, { scale: 1.65, facing: 1 });
  }
  const cCanvas = document.getElementById("preview-chugo");
  if (cCanvas) {
    const cCtx = cCanvas.getContext("2d");
    drawMountaineerSprite(cCtx, "CHUGO", 60, 92, { scale: 1.65, facing: 1 });
  }
  renderCustomCardPreview();
}

function gameLoop() {
  try {
  ctx.clearRect(0, 0, GW, GH);

  if (introActive) {
    renderIntroCinematic();
  } else if (gameState === "MENU" || gameState === "PAUSED") {
    drawCotopaxiBackground(false, 0.35);
    const charY = isPortrait ? 460 : 330;
    const jX = isPortrait ? GW * 0.72 : 730;
    const cX = isPortrait ? GW * 0.86 : 815;
    drawMountaineerSprite(ctx, "JORDY", jX, charY, { scale: 1.4, facing: -1, celebrating: true });
    drawMountaineerSprite(ctx, "CHUGO", cX, charY + 5, { scale: 1.4, facing: -1 });
  } else if (gameState === "STORY" || gameState === "CHECKPOINT" || gameState === "SUMMIT") {
    if (gameState === "STORY") updateStoryMode();
    renderStoryMode();
  } else if (gameState === "MINIGAME") {
    const bracketPause = tournament?.mode === 'offline' &&
      document.getElementById('tournament-lobby-overlay')?.classList.contains('active');
    if (!bracketPause) {
      if(tournament?.cpuAutoplay) tourCpuDrive();
      updateVersusMiniGame();
      if(tournament?.cpuSimulation)tourSendCpuFrame();
    }
    renderVersusMiniGame();
  } else if (gameState === "TOURNAMENT_WATCH") {
    tourWatchAnimation();
    renderVersusMiniGame();
  }

  }catch(frameError){
    console.error('APUS: fallo transitorio de dibujo/fotograma',frameError);
  }finally{
    requestAnimationFrame(gameLoop);
  }
}

canvas.addEventListener("pointerdown", (e) => {
  if (introActive) {
    e.preventDefault();
    e.stopPropagation();
    sound.initContext();
    introRegisterActivation();
    return;
  }
  // Las acciones de victoria/derrota se eligen con los dos botones de v26.
});

function drawFallingRockShape(ctx, x, y, r, variant = 0) {
  const sizeClass = r <= 14 ? 0 : (r <= 18 ? 1 : 2);
  const scaleBySize = [0.82, 0.98, 1.08];
  const s = scaleBySize[sizeClass] || 1;
  const shapes = [
    [
      [-0.92, -0.18], [-0.62, -0.8], [0.02, -0.96], [0.62, -0.62],
      [0.98, -0.06], [0.76, 0.56], [0.16, 0.92], [-0.56, 0.78], [-1.0, 0.24]
    ],
    [
      [-0.84, -0.4], [-0.28, -0.92], [0.42, -0.86], [0.92, -0.26],
      [0.84, 0.34], [0.46, 0.88], [-0.14, 0.98], [-0.8, 0.56], [-0.98, 0.02]
    ],
    [
      [-0.98, -0.08], [-0.76, -0.76], [-0.06, -0.9], [0.7, -0.82],
      [0.98, -0.2], [0.88, 0.44], [0.38, 0.92], [-0.34, 0.96], [-0.86, 0.42]
    ]
  ];
  const pts = shapes[Math.abs(variant) % shapes.length];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((x * 0.011 + y * 0.008 + (variant + 1) * 0.6 + r * 0.05) % (Math.PI * 2));
  const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
  bodyGrad.addColorStop(0, '#a8b1bc');
  bodyGrad.addColorStop(0.4, '#6b7280');
  bodyGrad.addColorStop(1, '#374151');
  ctx.beginPath();
  pts.forEach((p, i) => {
    const px = p[0] * r * s;
    const py = p[1] * r * s;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = Math.max(1.8, r * 0.12);
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-0.56 * r * s, -0.42 * r * s);
  ctx.lineTo(0.12 * r * s, -0.64 * r * s);
  ctx.lineTo(0.28 * r * s, -0.2 * r * s);
  ctx.lineTo(-0.18 * r * s, -0.02 * r * s);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0.02 * r * s, 0.08 * r * s);
  ctx.lineTo(0.72 * r * s, -0.06 * r * s);
  ctx.lineTo(0.58 * r * s, 0.52 * r * s);
  ctx.lineTo(0.16 * r * s, 0.76 * r * s);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15,23,42,0.24)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-0.16 * r * s, -0.14 * r * s, Math.max(1.6, r * 0.1), 0, Math.PI * 2);
  ctx.arc(0.26 * r * s, 0.18 * r * s, Math.max(1.4, r * 0.085), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(226,232,240,0.14)';
  ctx.fill();
  ctx.restore();
}

