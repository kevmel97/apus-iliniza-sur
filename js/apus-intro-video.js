/* APUS ILINIZA SUR 31.4.1 — Intro responsive 2 vídeos, UNA pista musical.
   Solo se muestra al terminar el control OTA. No modifica el splash de doble toque. */
(function () {
  'use strict';
  var opening = document.getElementById('apus-opening');
  if (!opening) return;
  var video = document.getElementById('apus-opening-movie');
  var soundtrack = document.getElementById('apus-opening-music');
  var controls = document.getElementById('apus-opening-controls');
  var helpText = document.getElementById('apus-opening-help-text');
  var replayBtn = document.getElementById('apus-opening-replay');
  var continueBtn = document.getElementById('apus-opening-continue');
  var soundBtn = document.getElementById('apus-opening-sound');
  var skipBtn = document.getElementById('apus-opening-skip');
  if (!video || !soundtrack) return;

  var HORIZONTAL = 'assets/intro/reto-iliniza-sur.mp4';
  var VERTICAL = 'assets/intro/reto-iliniza-sur-vertical.mp4';
  var active = false, finished = false, videoStarted = false;
  var soundEnabled = true, selectedSource = '';
  var logoTimer = 0, endTimer = 0, stallTimer = 0;
  var orientation = window.matchMedia('(orientation: portrait)');

  // Los DOS vídeos carecen de audio. Esta es la ÚNICA pista musical.
  video.muted = true;
  soundtrack.loop = false;
  soundtrack.preload = 'auto';
  soundtrack.volume = 0.9;
  if(soundBtn) soundBtn.textContent='🔊 SILENCIAR';

  function isNative() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform &&
                window.Capacitor.isNativePlatform());
    } catch (_) { return false; }
  }

  function resetOriginalSplash() {
    try {
      if (typeof introActive !== 'undefined') introActive = true;
      if (typeof introTimer !== 'undefined') introTimer = 0;
      if (typeof introTapCount !== 'undefined') introTapCount = 0;
      if (typeof introLastTapAt !== 'undefined') introLastTapAt = 0;
      if (typeof exitCinematicActive !== 'undefined') exitCinematicActive = false;
      if (typeof gameState !== 'undefined') gameState = 'INTRO';
      if (typeof showOverlay === 'function') showOverlay(null);
    } catch (error) {
      console.warn('[APUS INTRO] Splash original', error);
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(logoTimer); clearTimeout(endTimer); clearTimeout(stallTimer);
    opening.classList.add('is-closing');
    try { video.pause(); soundtrack.pause(); } catch (_) {}
    setTimeout(function () {
      resetOriginalSplash();
      opening.hidden = true;
      opening.remove();
      window.apusOpeningFinished = true;
      document.dispatchEvent(new Event('apus:opening-finished'));
    }, 480);
  }

  function showVideoHelp(message) {
    if (!active || finished) return;
    helpText.textContent = message;
    opening.classList.add('needs-tap');
    controls.setAttribute('aria-hidden', 'false');
  }

  function soundtrackSync(force) {
    if (!soundEnabled || finished) return;
    try {
      if (force || Math.abs(soundtrack.currentTime - video.currentTime) > .45) {
        soundtrack.currentTime = video.currentTime;
      }
    } catch (_) {}
  }

  // APUS_AUDIO_ESCENAS_V3153: música encendida de forma predeterminada también en web.
  // Si el navegador prohíbe autoplay con audio, pedir una pulsación ANTES de mostrar
  // el vídeo silencioso. El botón SILENCIAR siempre significa silenciar.
  function trySoundtrack() {
    if (!soundEnabled || finished) return;
    soundtrackSync(false);
    try {
      var promise = soundtrack.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function () {
          if(!soundEnabled||finished||!active||!opening.classList.contains('is-video'))return;
          try{video.pause();soundtrack.pause();video.currentTime=0; }catch(_){}
          if(replayBtn) replayBtn.textContent='▶ REPRODUCIR CON AUDIO';
          showVideoHelp('Tu navegador requiere tocar Reproducir para escuchar la música.');
        });
      }
    } catch (_) {
      if(soundEnabled && !finished){
        try{video.pause();}catch(e){}
        showVideoHelp('Toca Reproducir con audio para comenzar.');
      }
    }
  }

  function tryPlay() {
    if (finished || !active) return;
    clearTimeout(stallTimer);
    opening.classList.remove('needs-tap');
    controls.setAttribute('aria-hidden', 'true');
    try {
      var promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function () {
          showVideoHelp('Toca Reproducir para ver la introducción.');
        });
      }
    } catch (_) {
      showVideoHelp('Toca Reproducir para ver la introducción.');
    }
    stallTimer = setTimeout(function () {
      if (!videoStarted && !finished) {
        showVideoHelp('Toca Reproducir para continuar la introducción.');
      }
    }, 6500);
  }

  // Cambiar el vídeo con la orientación, sin reiniciar la música ni el tiempo.
  function selectMovie(preservePosition) {
    if (finished) return;
    var next = orientation.matches ? VERTICAL : HORIZONTAL;
    if (next === selectedSource) return;
    var previousTime = preservePosition && Number.isFinite(video.currentTime)
      ? video.currentTime : 0;
    selectedSource = next;
    videoStarted = false;
    var shouldContinue = active && opening.classList.contains('is-video');
    clearTimeout(stallTimer);
    try { video.pause(); } catch (_) {}
    video.src = next;
    video.load();
    video.addEventListener('loadedmetadata', function onMetadata() {
      if (finished || selectedSource !== next) return;
      if (previousTime > 0) {
        try {
          video.currentTime = Math.min(previousTime, Math.max(0, video.duration - .05));
        } catch (_) {}
      }
      if (shouldContinue) tryPlay();
    }, {once: true});
    video.addEventListener('error', function onError() {
      if (finished || selectedSource !== next) return;
      showVideoHelp('No se pudo cargar este video. Puedes continuar al inicio normal.');
    }, {once: true});
  }

  function showVideo() {
    if (finished) return;
    opening.classList.remove('is-logo');
    opening.classList.add('is-video');
    video.muted = true;
    selectMovie(false);
    // Si ya estaba precargado, el evento loadedmetadata anterior también puede
    // dispararse; llamar a play() dos veces no crea una segunda reproducción.
    if (video.readyState >= 1) tryPlay();
  }

  function start() {
    if (active || finished) return;
    active = true;
    opening.hidden = false;
    opening.classList.add('is-logo');
    opening.setAttribute('aria-hidden', 'false');
    // Esta secuencia solo comienza después de que la OTA deje pasar al juego.
    logoTimer = setTimeout(showVideo, 2350);
  }

  function blockGameKeys(event) {
    if (active && !finished && !opening.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  document.addEventListener('keydown', blockGameKeys, true);
  opening.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
  opening.addEventListener('click', function (event) { event.stopPropagation(); });

  video.addEventListener('playing', function () {
    videoStarted = true;
    clearTimeout(stallTimer);
    opening.classList.remove('needs-tap');
    controls.setAttribute('aria-hidden', 'true');
    trySoundtrack();
  });
  video.addEventListener('timeupdate', function () {
    if (!Number.isFinite(video.duration)) return;
    soundtrackSync(false);
    if (video.duration - video.currentTime <= 2.55) opening.classList.add('is-finale');
    else opening.classList.remove('is-finale');
  });
  video.addEventListener('pause', function () {
    // Durante un cambio de orientación la música sigue, para evitar cortes.
    if (!finished && !opening.classList.contains('is-video')) soundtrack.pause();
  });
  video.addEventListener('ended', function () {
    try { soundtrack.pause(); } catch (_) {}
    endTimer = setTimeout(finish, 800);
  });
  video.addEventListener('error', function () {
    showVideoHelp('No se pudo cargar la introducción. Puedes continuar al inicio normal.');
  });
  replayBtn.addEventListener('click', function () {
    videoStarted = false;
    // Reintentar la música DENTRO del gesto del usuario permite desbloquear audio web.
    if(soundEnabled)trySoundtrack();
    tryPlay();
  });
  continueBtn.addEventListener('click', finish);
  if (skipBtn) skipBtn.addEventListener('click', function (event) {
    event.preventDefault();event.stopPropagation();
    finish(); // La misma transición al splash de doble toque, sin saltar al menú.
  });
  soundBtn.addEventListener('click', function () {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊 SILENCIAR' : '🔇 ACTIVAR AUDIO';
    if (soundEnabled) {
      soundtrackSync(true);
      trySoundtrack();
    } else {
      try { soundtrack.pause(); } catch (_) {}
    }
    if (video.paused && opening.classList.contains('is-video')) tryPlay();
  });

  function onOrientationChanged() {
    if (active && !finished && opening.classList.contains('is-video')) {
      selectMovie(true);
    }
  }
  if (orientation.addEventListener) orientation.addEventListener('change', onOrientationChanged);
  else if (orientation.addListener) orientation.addListener(onOrientationChanged);

  document.addEventListener('apus:ota-ready', start);
  function whenReady() {
    if (isNative()) {
      if (window.apusOTAAllowedToPlay) start();
    } else start();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', whenReady, {once: true});
  } else whenReady();
})();
