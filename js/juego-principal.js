/* ============================================================================
   SISTEMA DE AUDIO
   ============================================================================ */
const DRIVE_AUDIO_LINKS = {
  bgm_menu: "", bgm_climb: "", bgm_storm: "", bgm_summit: "", bgm_versus: "",
  sfx_jump: "", sfx_axe: "", sfx_hit: "", sfx_beer: "", sfx_kick: "", sfx_checkpoint: ""
};

class SoundSystem {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.bgmInterval = null;
    this.currentTrack = null;
    this.customAudios = {};
    this.bgmAudioElement = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playTone(freq, duration, type = "square", vol = 0.12, slideFreq = null) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideFreq, now + duration);
      }
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  playSFX(name) {
    if (!this.enabled) return;
    switch (name) {
      case "sfx_jump": this.playTone(220, 0.18, "square", 0.12, 540); break;
      case "sfx_axe":
        this.playTone(580, 0.09, "sawtooth", 0.15, 190);
        setTimeout(() => this.playTone(920, 0.07, "triangle", 0.12, 420), 45);
        break;
      case "sfx_hit": this.playTone(150, 0.28, "sawtooth", 0.2, 55); break;
      case "sfx_beer":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          setTimeout(() => this.playTone(f, 0.12, "triangle", 0.15), idx * 70);
        });
        break;
      case "sfx_kick": this.playTone(300, 0.14, "sawtooth", 0.18, 90); break;
      case "sfx_checkpoint":
        [440, 554.37, 659.25, 880].forEach((f, idx) => {
          setTimeout(() => this.playTone(f, 0.18, "square", 0.15), idx * 110);
        });
        break;
    }
  }

  playBGM(trackName) {
    if (!this.enabled) return;
    if (this.currentTrack === trackName && this.bgmInterval) return;
    this.stopBGM();
    this.currentTrack = trackName;
    const melodies = {
      bgm_menu: {
        tempo: 230,
        notes: [220, 261.63, 329.63, 440, 392, 329.63, 293.66, 246.94],
        bass:  [110, 110, 130.81, 130.81]
      },
      bgm_climb: {
        tempo: 170,
        notes: [329.63, 329.63, 392, 440, 493.88, 440, 392, 329.63],
        bass:  [164.81, 164.81, 196, 220]
      },
      bgm_storm: {
        tempo: 135,
        notes: [220, 233.08, 220, 196, 174.61, 196, 220, 261.63],
        bass:  [110, 116.54, 98, 87.31]
      },
      bgm_summit: {
        tempo: 210,
        notes: [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5],
        bass:  [261.63, 329.63, 392, 261.63]
      },
      bgm_versus: {
        tempo: 125,
        notes: [329.63, 392, 440, 329.63, 493.88, 440, 392, 329.63],
        bass:  [164.81, 164.81, 220, 164.81]
      }
    };
    const track = melodies[trackName] || melodies.bgm_menu;
    let step = 0;
    this.bgmInterval = setInterval(() => {
      if (!this.enabled) return;
      const note = track.notes[step % track.notes.length];
      const bassNote = track.bass[Math.floor(step / 2) % track.bass.length];
      this.playTone(note, (track.tempo / 1000) * 0.85, "square", 0.05);
      if (step % 2 === 0) {
        this.playTone(bassNote, (track.tempo / 1000) * 1.6, "triangle", 0.07);
      }
      step++;
    }, track.tempo);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

const sound = new SoundSystem();

/* ============================================================================
   CATÁLOGOS Y CREACIÓN DE PERSONAJES
   ============================================================================ */
const SKIN_TONES = { BLANCO: "#fde2c4", MESTIZO: "#d99b66", NEGRO: "#6f4124" };

const HAIR_COLORS = [
  { id: "AMARILLO", name: "AMARILLO", hex: "#facc15" },
  { id: "NARANJA",  name: "NARANJA",  hex: "#f97316" },
  { id: "ROJO",     name: "ROJO",     hex: "#dc2626" },
  { id: "AZUL",     name: "AZUL",     hex: "#0284c7" },
  { id: "NEGRO",    name: "NEGRO",    hex: "#18181b" },
  { id: "GRIS",     name: "GRIS",     hex: "#94a3b8" },
  { id: "CAFE",     name: "CAFÉ",     hex: "#5c3419" },
  { id: "BLANCO",   name: "BLANCO",   hex: "#f8fafc" }
];

const HELMET_COLORS = {
  PETZL: [
    { id: "NARANJA", name: "NARANJA", hex: "#f97316" },
    { id: "BLANCO",  name: "BLANCO",  hex: "#f8fafc" },
    { id: "AZUL",    name: "AZUL",    hex: "#0284c7" },
    { id: "GRIS",    name: "GRIS",    hex: "#94a3b8" }
  ],
  BD: [
    { id: "ROJO",  name: "ROJO",  hex: "#dc2626" },
    { id: "VERDE", name: "VERDE", hex: "#16a34a" },
    { id: "NEGRO", name: "NEGRO", hex: "#1e293b" },
    { id: "ROSA",  name: "ROSA",  hex: "#ec4899" },
    { id: "TURQUESA", name: "TURQUESA", hex: "#14b8a6" }
  ]
};

// El color del mango identifica el piolet elegido; se conserva la forma
// y el alcance de combate de la versión estable.
const AXE_BRAND_COLORS = {
  PETZL: "#f97316", BD: "#94a3b8",
  SIMOND: "#2563eb", SINGING_ROCK: "#eab308",
  EDELRID: "#16a34a", GRIVEL: "#dc2626",
  POLICE: "#7c4a22"
};

const GLASSES_COLORS = [
  { id: "NEGRO",   name: "NEGRO",   hex: "#1e293b" },
  { id: "AZUL",    name: "AZUL",    hex: "#38bdf8" },
  { id: "NARANJA", name: "NARANJA", hex: "#f97316" },
  { id: "CAFE",    name: "CAFÉ",    hex: "#854d0e" },
  { id: "TURQUESA", name: "TURQUESA", hex: "#14b8a6" }
];

const GEAR_10_COLORS = [
  "#f97316", "#0284c7", "#dc2626", "#16a34a", "#eab308",
  "#1e293b", "#f8fafc", "#9333ea", "#ec4899", "#78350f", "#14b8a6"
];

function getDefaultCustomSlots() {
  return [
    {
      name: "MONTANISTA 1", gender: "M", skin: "MESTIZO", hairLength: "CORTO", hairColor: "#18181b",
      expression: "FELIZ", helmetBrand: "PETZL", helmetColor: "#f97316", hasGlasses: true, glassesColor: "#38bdf8",
      beardStyle: 1, jacketColor: "#16a34a", pantsColor: "#1e293b", packColor: "#eab308", harnessColor: "#dc2626",
      bootsColor: "#f97316", axeBrand: "PETZL"
    },
    {
      name: "MONTANISTA 2", gender: "F", skin: "BLANCO", hairLength: "LARGO", hairColor: "#5c3419",
      expression: "FELIZ", helmetBrand: "BD", helmetColor: "#ec4899", hasGlasses: true, glassesColor: "#f97316",
      beardStyle: 0, jacketColor: "#9333ea", pantsColor: "#1e293b", packColor: "#0284c7", harnessColor: "#f8fafc",
      bootsColor: "#eab308", axeBrand: "BD"
    },
    {
      name: "MONTANISTA 3", gender: "M", skin: "NEGRO", hairLength: "MEDIO", hairColor: "#18181b",
      expression: "SERIA", helmetBrand: "BD", helmetColor: "#dc2626", hasGlasses: false, glassesColor: "#1e293b",
      beardStyle: 2, jacketColor: "#eab308", pantsColor: "#334155", packColor: "#dc2626", harnessColor: "#0284c7",
      bootsColor: "#78350f", axeBrand: "PETZL"
    }
  ];
}

let customCharSlots = getDefaultCustomSlots();
let activeCustomSlot = 0;

function ensureSlotDefaults(slots) {
  const defaults = getDefaultCustomSlots();
  return slots.map((s, idx) => ({ ...defaults[idx], ...s }));
}

/* ============================================================================
   SISTEMA DE CUENTAS
   ============================================================================ */
// ===================== NUBE APUS: CONFIGURACIÓN =====================
// 1) Crea un proyecto en https://console.firebase.google.com/
// 2) Activa Authentication > Correo/contraseña y Firestore.
// 3) Registra una app WEB y pega los valores de "firebaseConfig" aquí.
// Esta configuración WEB no es una contraseña. NO pegues llaves privadas.
const APUS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAjTrd2k6IUMciCVcpQTXLzzBbwYmWWBa0",
  authDomain: "apus-iliniza-sur.firebaseapp.com",
  projectId: "apus-iliniza-sur",
  storageBucket: "apus-iliniza-sur.firebasestorage.app",
  messagingSenderId: "538357981273",
  appId: "1:538357981273:web:5bda2f464bc5c2d9a71148",
  measurementId: "G-SSJLDDPC7M"
};
const APUS_USER_COLLECTION = "apusUsers";
const APUS_RANKING_COLLECTION = "apusRankings";
const APUS_DEFAULT_PROFILE = () => ({
  username: "MONTAÑISTA", customChars: getDefaultCustomSlots(), saves: [],
  progress: {}, scores: [], preferences: {theme:"dark",difficultyIndex:1,selectedCharacter:"JORDY"}
});
let apusFirebaseAuth = null;
let apusFirebaseDb = null;
let cloudProfile = null;
let cloudAuthUser = null;
let cloudSaveQueue = Promise.resolve();
let cloudReady = false;
let cloudRestoringPreferences = false;
let cloudInitPromise = null;
// Evita dos lecturas/escrituras del perfil durante el primer registro o login.
let cloudAuthOperationInProgress = false;
let currentUser = null;
let authMode = "login";
let currentRankingTab = "local";
let returnToGameOverAfterAuth = false;
let pendingRegistrationName = "";
// Solo guardamos una preferencia booleana. Firebase mantiene el token,
// nunca se guardan las contraseñas en localStorage.
const APUS_REMEMBER_KEY = 'apus_firebase_remember_v27';
function rememberPreference() {
  try { return localStorage.getItem(APUS_REMEMBER_KEY) !== 'no'; } catch(e) { return true; }
}
function setRememberPreference(enabled) {
  try {localStorage.setItem(APUS_REMEMBER_KEY,enabled?'yes':'no');} catch(e) {}
}
async function configureAuthPersistence(enabled) {
  const persistence = enabled
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;
  await apusFirebaseAuth.setPersistence(persistence);
}

function isCloudConfigured() {
  return !!(APUS_FIREBASE_CONFIG.apiKey &&
    !APUS_FIREBASE_CONFIG.apiKey.includes('PEGA_AQUI') &&
    APUS_FIREBASE_CONFIG.projectId &&
    APUS_FIREBASE_CONFIG.projectId !== 'TU_PROJECT_ID' &&
    APUS_FIREBASE_CONFIG.appId &&
    !APUS_FIREBASE_CONFIG.appId.includes('PEGA_AQUI'));
}
function cloudAvailable() {
  return cloudReady && !!apusFirebaseAuth && !!apusFirebaseDb;
}
function requireCloudConfigured() {
  if (cloudAvailable()) return true;
  const status = document.getElementById('auth-msg-box');
  if (status) {
    status.style.color = '#facc15';
    status.textContent = isCloudConfigured()
      ? '⚠️ NO SE PUDO CONECTAR A FIREBASE. REVISA INTERNET Y LA CONFIGURACIÓN.'
      : '⚠️ NUBE SIN ACTIVAR: CONFIGURA TU PROYECTO FIREBASE EN EL HTML.';
  }
  return false;
}
function makeSafeProfile(data, username) {
  const fallback = APUS_DEFAULT_PROFILE();
  const input = data && typeof data === 'object' ? data : {};
  const validSlots = Array.isArray(input.customChars) && input.customChars.length === 3;
  return {
    username: String(username || input.username || fallback.username).trim().slice(0,24).toUpperCase(),
    customChars: validSlots ? ensureSlotDefaults(input.customChars) : fallback.customChars,
    saves: Array.isArray(input.saves) ? input.saves.slice(0,3) : [],
    progress: input.progress && typeof input.progress === 'object' && !Array.isArray(input.progress) ? input.progress : {},
    scores: Array.isArray(input.scores) ? input.scores.slice(-30) : [],
    preferences: input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
      ? input.preferences : fallback.preferences
  };
}
function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }
function cloudSavePreferences(patch) {
  if(!currentUser?.uid || !cloudProfile || cloudRestoringPreferences)return;
  cloudProfile.preferences={...cloudProfile.preferences,...patch};
  cloudCommitProfile().catch(flagCloudWriteFailure);
}
function simpleHash(str) {
  // Solo para comprobar credenciales LEGADAS localmente durante la importación.
  // Las cuentas nuevas usan Firebase Authentication (nunca este hash).
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}
function getLocalCloudStore() {
  // SOLO importación de cuentas anteriores; no se usa para autenticar.
  try {
    const raw = localStorage.getItem('apus_iliniza_cloud_clean');
    const old = JSON.parse(raw || '{}');
    if (old && typeof old === 'object') return old;
  } catch(e) {}
  return {users:{}};
}
async function hydrateCloudUser(user) {
  if (!user || !apusFirebaseDb) return;
  cloudAuthUser = user;
  const docRef = apusFirebaseDb.collection(APUS_USER_COLLECTION).doc(user.uid);
  const docSnap = await docRef.get();
  if (cloudAuthUser?.uid !== user.uid) return;
  const fromAuth = pendingRegistrationName || (user.displayName || user.email?.split('@')[0] || 'MONTAÑISTA');
  const existing = docSnap.exists ? docSnap.data() : null;
  cloudProfile = makeSafeProfile(existing, existing?.username || fromAuth);
  currentUser = { uid:user.uid, username:cloudProfile.username, email:user.email || '' };
  if (!docSnap.exists) await docRef.set({...deepCopy(cloudProfile), updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  loadCustomCharsFromStorage();
  cloudRestoringPreferences = true;
  try {
    const prefs = cloudProfile.preferences || {};
    if(prefs.theme === 'light' || prefs.theme === 'dark') applyTheme(prefs.theme);
    if(Number.isInteger(prefs.difficultyIndex) && prefs.difficultyIndex >= 0 && prefs.difficultyIndex < DIFFICULTIES.length) {
      diffIndex=prefs.difficultyIndex;updateDiffLabel();
    }
    if(['JORDY','CHUGO','CUSTOM'].includes(prefs.selectedCharacter)) selectedCharacter=prefs.selectedCharacter;
  } finally {cloudRestoringPreferences=false;}
  updateUserStatusUI();
  renderCustomCardPreview();
  sendApusBingoAccount();
}
function loadFirebaseSDK() {
  if(window.firebase?.auth && window.firebase?.firestore) return Promise.resolve();
  const urls=[
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore-compat.js'
  ];
  return urls.reduce((chain,url)=>chain.then(()=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=url;script.async=false;
    script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar SDK Firebase'));
    document.head.appendChild(script);
  })),Promise.resolve());
}
async function initializeCloudAccounts() {
  if(!isCloudConfigured()) {
    console.info('APUS: faltan los datos de Firebase; los invitados pueden seguir jugando offline.');
    updateUserStatusUI();return;
  }
  if(cloudReady)return;
  if(cloudInitPromise)return cloudInitPromise;
  cloudInitPromise=(async()=>{
    await loadFirebaseSDK();
    if(!window.firebase?.initializeApp || !window.firebase?.auth || !window.firebase?.firestore)
      throw new Error('No se cargaron las bibliotecas de Firebase');
    if(!firebase.apps?.length)firebase.initializeApp(APUS_FIREBASE_CONFIG);
    apusFirebaseAuth=firebase.auth();apusFirebaseDb=firebase.firestore();
    // Respeta la preferencia elegida en el último acceso.
    try { await configureAuthPersistence(rememberPreference()); }
    catch(e) { console.warn('APUS: no se pudo restaurar persistencia de sesión',e); }
    cloudReady=true;
    apusFirebaseAuth.onAuthStateChanged(async user=>{
      // Durante un registro/login manual, handleAuthSubmit hidrata el perfil.
      // Así evitamos carreras entre el observador y el formulario.
      if (cloudAuthOperationInProgress) return;
      if(user) {
        try{await hydrateCloudUser(user);}
        catch(err){console.error('Error leyendo datos de Firebase:',err);
          cloudProfile=null;currentUser=null;updateUserStatusUI();}
      } else {
        cloudAuthUser=null;cloudProfile=null;currentUser=null;
        loadCustomCharsFromStorage();updateUserStatusUI();
        renderCustomCardPreview();sendApusBingoAccount();
      }
    });
  })().catch(err=>{
    console.warn('APUS: el servidor de cuentas no está disponible:',err);
    cloudReady=false;updateUserStatusUI();
  }).finally(()=>{cloudInitPromise=null;});
  return cloudInitPromise;
}
function cloudCommitProfile() {
  if (!cloudAvailable() || !cloudAuthUser || !cloudProfile || !currentUser) {
    return Promise.reject(new Error('Sin sesión cloud activa'));
  }
  const uid = cloudAuthUser.uid;
  const snapshot = deepCopy(makeSafeProfile(cloudProfile,currentUser.username));
  const task = cloudSaveQueue.catch(()=>{}).then(async () => {
    if (cloudAuthUser?.uid !== uid) throw new Error('La sesión cambió durante el guardado');
    await apusFirebaseDb.collection(APUS_USER_COLLECTION).doc(uid)
      .set({...snapshot, updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  });
  cloudSaveQueue = task;
  return task;
}
function flagCloudWriteFailure(error) {
  console.error('Error al guardar datos en la nube',error);
  alert('⚠️ No se pudieron guardar tus cambios en la nube. Revisa tu conexión e inténtalo de nuevo antes de cerrar el juego.');
}
function loadCustomCharsFromStorage() {
  if (currentUser?.uid) {
    customCharSlots = cloudProfile?.customChars ? ensureSlotDefaults(deepCopy(cloudProfile.customChars)) : getDefaultCustomSlots();
    return;
  }
  try {
    const parsed=JSON.parse(localStorage.getItem('apus_custom_chars_guest') || 'null');
    customCharSlots = Array.isArray(parsed) && parsed.length===3 ? ensureSlotDefaults(parsed) : getDefaultCustomSlots();
  } catch(e){customCharSlots=getDefaultCustomSlots();}
}
async function saveCustomCharsToAccount() {
  if (currentUser?.uid) {
    cloudProfile.customChars=deepCopy(customCharSlots);
    await cloudCommitProfile();
  } else {
    localStorage.setItem('apus_custom_chars_guest',JSON.stringify(customCharSlots));
  }
}
async function forceCloudSyncNow() {
  const msg = document.getElementById('auth-msg-box');
  if (!currentUser?.uid || !cloudAvailable()) { requireCloudConfigured(); return; }
  try {
    msg.textContent='⏳ RECARGANDO DATOS DEL SERVIDOR...'; msg.style.color='#38bdf8';
    await cloudSaveQueue;
    await hydrateCloudUser(apusFirebaseAuth.currentUser);
    msg.textContent='✅ DATOS DE TU CUENTA DESCARGADOS DESDE LA NUBE'; msg.style.color='#22c55e';
  } catch(e) {
    msg.textContent='⚠️ NO SE PUDO DESCARGAR DESDE LA NUBE'; msg.style.color='#ef4444';
  }
}
function loadSavedSession() {
  // Las cuentas nuevas NO confían en una sesión de localStorage: Firebase valida el token.
  loadCustomCharsFromStorage(); updateUserStatusUI(); initializeCloudAccounts();
}
function updateUserStatusUI() {
  try {sendFrikiAccount();}catch(e){}
  const label=document.getElementById('menu-user-label');
  const logoutBtn=document.getElementById('auth-logout-btn');
  if (label) label.textContent=currentUser?.uid
    ? `✅ CUENTA NUBE: ${currentUser.username}`
    : (isCloudConfigured() ? '👤 SESIÓN: INVITADO' : '👤 INVITADO · NUBE SIN CONFIGURAR');
  if (logoutBtn) logoutBtn.style.display=currentUser?.uid ? 'block' : 'none';
}
function openAuthModal() {
  returnToGameOverAfterAuth=false;
  switchAuthTab('login');
  document.getElementById('auth-email').value=currentUser?.email || '';
  document.getElementById('auth-password').value='';
  document.getElementById('auth-remember').checked=rememberPreference();
  document.getElementById('auth-msg-box').textContent = currentUser?.uid
    ? `✅ SESIÓN ACTIVA: ${currentUser.username}`
    : (isCloudConfigured() ? 'INGRESA CON EL CORREO DE TU CUENTA FIREBASE.' : '⚠️ HAY QUE CONFIGURAR FIREBASE PARA ACTIVAR CUENTAS ONLINE.');
  showOverlay('auth-overlay');
}
function openAuthModalFromGameOver() {
  openAuthModal();returnToGameOverAfterAuth=true;
}
function switchAuthTab(mode) {
  authMode=mode;
  const reset=document.getElementById('cloud-password-reset');
  if(reset)reset.style.display=mode==='register'?'none':'inline-block';
  const remember=document.getElementById('auth-remember-area');
  if(remember)remember.style.display=mode==='login'?'flex':'none';
  document.getElementById('tab-login-btn').classList.toggle('active',mode==='login');
  document.getElementById('tab-register-btn').classList.toggle('active',mode==='register');
  document.getElementById('auth-username').style.display=mode==='register'?'block':'none';
  document.getElementById('auth-submit-btn').textContent=mode==='login'?'✅ INICIAR SESIÓN':'📝 CREAR CUENTA ONLINE';
  document.getElementById('auth-msg-box').textContent=mode==='login'
    ? 'INICIA SESIÓN CON TU CORREO Y CONTRASEÑA.'
    : 'ESCRIBE TU APODO, CORREO Y UNA CONTRASEÑA NUEVA (MÍNIMO 6 CARACTERES).';
}
async function handleAuthSubmit() {
  const msg=document.getElementById('auth-msg-box');
  if (!cloudAvailable() && isCloudConfigured()) await initializeCloudAccounts();
  if (!requireCloudConfigured()) return;
  const email=document.getElementById('auth-email').value.trim().toLowerCase();
  const pass=document.getElementById('auth-password').value;
  const username=document.getElementById('auth-username').value.toUpperCase().trim().replace(/\s+/g,' ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || pass.length<6) {
    msg.textContent='⚠️ USA UN CORREO VÁLIDO Y CONTRASEÑA DE 6+ CARACTERES.';msg.style.color='#ef4444'; return;
  }
  if (authMode==='register' && username.length<3) {
    msg.textContent='⚠️ ESCRIBE UN APODO DE AL MENOS 3 LETRAS.';msg.style.color='#ef4444';return;
  }
  msg.textContent='⏳ VERIFICANDO CUENTA SEGURA...';msg.style.color='#38bdf8';
  pendingRegistrationName=authMode==='register'?username:'';
  cloudAuthOperationInProgress = true;
  try {
    // Registro: sesión permanente; inicio de sesión: opción del jugador.
    const remember = authMode==='register' || document.getElementById('auth-remember').checked;
    await configureAuthPersistence(remember);
    setRememberPreference(remember);
    const result=authMode==='register'       ? await apusFirebaseAuth.createUserWithEmailAndPassword(email,pass)
      : await apusFirebaseAuth.signInWithEmailAndPassword(email,pass);
    if(authMode==='register') {
      await result.user.updateProfile({displayName:username});
      cloudProfile=makeSafeProfile(null,username);
      await apusFirebaseDb.collection(APUS_USER_COLLECTION).doc(result.user.uid).set({...deepCopy(cloudProfile),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    }
    await hydrateCloudUser(result.user);
    pendingRegistrationName='';
    msg.textContent=`✅ SESIÓN EN LA NUBE: ${currentUser.username}`;msg.style.color='#22c55e';
    document.getElementById('auth-password').value='';
    sound.playSFX('sfx_checkpoint');
    setTimeout(()=>showOverlay(returnToGameOverAfterAuth?'gameover-overlay':'menu-overlay'),400);
    if (returnToGameOverAfterAuth) prepareGameOverModal();
  } catch(error) {
    pendingRegistrationName='';
    console.warn('Firebase login failed',error);
    msg.textContent=({
      'auth/email-already-in-use':'❌ YA EXISTE UNA CUENTA CON ESE CORREO.',
      'auth/invalid-credential':'❌ CORREO O CONTRASEÑA INCORRECTOS.',
      'auth/weak-password':'❌ NECESITAS UNA CONTRASEÑA MÁS SEGURA.',
      'auth/network-request-failed':'❌ SIN INTERNET. LA CUENTA ONLINE NO ESTÁ DISPONIBLE.',
      'permission-denied':'❌ REVISA LAS REGLAS DE SEGURIDAD DE FIRESTORE.'
    }[error.code] || '❌ NO SE PUDO INICIAR SESIÓN. REVISA FIREBASE Y LAS REGLAS.');
    msg.style.color='#ef4444';
  } finally {
    cloudAuthOperationInProgress = false;
  }
}
async function recoverCloudPassword() {
  const msg=document.getElementById('auth-msg-box');
  if(!cloudAvailable() && isCloudConfigured()) await initializeCloudAccounts();
  if(!requireCloudConfigured())return;
  const email=document.getElementById('auth-email').value.trim().toLowerCase();
  if(!email.includes('@')) {msg.textContent='⚠️ ESCRIBE TU CORREO ARRIBA.';return;}
  try {
    await apusFirebaseAuth.sendPasswordResetEmail(email);
    msg.style.color='#22c55e';msg.textContent='✅ SI EL CORREO ESTÁ REGISTRADO, RECIBIRÁS INSTRUCCIONES.';
  } catch(error) {msg.style.color='#ef4444';msg.textContent='⚠️ NO SE PUDO ENVIAR EL CORREO. REVISA FIREBASE.';}
}
async function logoutAccount() {
  if (cloudAvailable()) {
    try {await cloudSaveQueue.catch(()=>{});await apusFirebaseAuth.signOut();}
    catch(e){alert('No se pudo cerrar la sesión.');return;}
  }
  cloudAuthUser=null;cloudProfile=null;currentUser=null;
  loadCustomCharsFromStorage();updateUserStatusUI();renderCustomCardPreview();sendApusBingoAccount();
  document.getElementById('auth-msg-box').textContent='✅ SESIÓN CERRADA.';
}
async function importLegacyAccountData() {
  const msg=document.getElementById('auth-msg-box');
  if (!currentUser?.uid) {msg.textContent='INICIA SESIÓN EN LA NUBE PRIMERO.';return;}
  const username=(document.getElementById('legacy-import-username').value||'').toUpperCase().trim().replace(/\s+/g,' ');
  const password=(document.getElementById('legacy-import-password').value||'').toUpperCase().trim();
  const legacyStore=getLocalCloudStore();
  const old=legacyStore.users && legacyStore.users[username];
  if (!old || !old.passHash || old.passHash!==simpleHash(username+':'+password)) {
    msg.textContent='❌ NO SE ENCONTRÓ ESA CUENTA ANTERIOR EN ESTE NAVEGADOR O LA CONTRASEÑA NO COINCIDE.';
    msg.style.color='#ef4444';return;
  }
  if (!confirm(`¿Importar partidas, personajes y niveles de la cuenta anterior ${username} a ${currentUser.username}? Tus datos anteriores NO se borrarán.`)) return;
  const parseOld=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}};
  const oldChars=parseOld(`apus_custom_chars_${username}`);
  const oldSaves=parseOld(`apus_iliniza_saves_${username}`);
  const oldProgress=parseOld(`apus_iliniza_story_progress_${username}`);
  const merged=makeSafeProfile(cloudProfile,currentUser.username);
  if (Array.isArray(oldChars) && oldChars.length===3) merged.customChars=ensureSlotDefaults(oldChars);
  else if(Array.isArray(old.customChars) && old.customChars.length===3) merged.customChars=ensureSlotDefaults(old.customChars);
  const importedSaves=Array.isArray(oldSaves)?oldSaves:(Array.isArray(old.saves)?old.saves:[]);
  merged.saves=[...importedSaves,...merged.saves].slice(0,8);
  if(oldProgress && typeof oldProgress==='object') {
    merged.progress={...oldProgress,...merged.progress,
      unlocked:Math.max(Number(oldProgress.unlocked)||1,Number(merged.progress.unlocked)||1),
      finished:!!(oldProgress.finished||merged.progress.finished)};
  }
  // No se importan puntuaciones viejas al ranking público: eran editables localmente.
  cloudProfile=merged;
  try {
    await cloudCommitProfile();loadCustomCharsFromStorage();renderCustomCardPreview();
    document.getElementById('legacy-import-password').value='';
    msg.style.color='#22c55e';
    msg.textContent='✅ DATOS ANTERIORES IMPORTADOS A TU CUENTA ONLINE. SE CONSERVA LA COPIA LOCAL.';
  } catch(e) {flagCloudWriteFailure(e);}
}

/* ============================================================================
   NIVELES Y JUEGO
   ============================================================================ */
const DIFFICULTIES = [
  { id: "FACIL", name: "FÁCIL", hearts: 10, beerQuota: 14 },
  { id: "NORMAL", name: "NORMAL", hearts: 5, beerQuota: 8 },
  { id: "DIFICIL", name: "DIFÍCIL", hearts: 3, beerQuota: 6 },
  { id: "IVAN_VALLEJO", name: "IVÁN VALLEJO", hearts: 1, beerQuota: 2 }
];

const LEVELS = [
  { level: 1, durationFastSec: 120, totalDistance: 21600, flatTutorialDist: 3200, startAlt: 4650, endAlt: 4800, checkpointText: "KM 1 - ASCENSO ILINIZA SUR 4800 MSNM", night: false, storm: false, frozenPlayer: false, snowRate: 0.015, rockRate: 0.010, iceBlockGap: 430 },
  { level: 2, durationFastSec: 120, totalDistance: 21600, flatTutorialDist: 0, startAlt: 4800, endAlt: 4900, checkpointText: "KM 2 - 4900 MSNM", night: false, storm: false, frozenPlayer: false, snowRate: 0.024, rockRate: 0.018, iceBlockGap: 320 },
  { level: 3, durationFastSec: 120, totalDistance: 21600, flatTutorialDist: 0, startAlt: 4900, endAlt: 5000, checkpointText: "KM 3 - 5000 MSNM", night: false, storm: false, frozenPlayer: false, snowRate: 0.032, rockRate: 0.026, iceBlockGap: 250 },
  { level: 4, durationFastSec: 120, totalDistance: 21600, flatTutorialDist: 0, startAlt: 5000, endAlt: 5100, checkpointText: "DESCANSO - 5100 MSNM", night: true, storm: true, frozenPlayer: false, snowRate: 0.038, rockRate: 0.030, iceBlockGap: 220 },
  { level: 5, durationFastSec: 180, totalDistance: 32400, flatTutorialDist: 0, startAlt: 5100, endAlt: 5248, checkpointText: "FELICIDADES LLEGASTE A 5248 MSNM", night: true, storm: true, frozenPlayer: true, snowRate: 0.046, rockRate: 0.038, iceBlockGap: 200 }
];

let diffIndex = 1;
let selectedCharacter = "JORDY";
let selectedCpuOpponent = "JORDY";
let pendingMode = "story";
let gameState = "INTRO";
let forceTouchUI = true;

let storyData = {
  levelIdx: 0, score: 0, levelScore: 0, maxHearts: 5, hearts: 5,
  distance: 0, elapsedSec: 0, beersSpawnedThisLevel: 0, nextIceDist: 600,
  checkpointTimer: 0, summitSunriseProgress: 0
};

let player = {
  x: 140, y: 380, vx: 0, vy: 0, width: 48, height: 68,
  onGround: true, crouching: false, huggingWall: false,
  swingTimer: 0, invulnTimer: 0, facing: 1, animFrame: 0, celebrating: false
};

let obstacles = [];
let floatingTexts = [];
let snowParticles = [];
let snowBreakParticles = [];

let fighters = [];
let projectiles = [];
let vsWinner = null;
let vsEndAnimTimer = 0;
let vsIsOnline = false;
let peerInstance = null;
let peerConn = null;
let isOnlineHost = false;
let currentRoomCode = "";

/* ============================================================================
   SPRITES Y DIBUJOS
   ============================================================================ */
function drawApusLogo(targetCtx, x, y, size) {
  if (!targetCtx) return;
  targetCtx.save();
  targetCtx.translate(x, y);
  const r = size / 2;
  targetCtx.beginPath();
  targetCtx.arc(r, r, r - 4, 0, Math.PI * 2);
  targetCtx.fillStyle = "#1459a6";
  targetCtx.fill();
  targetCtx.lineWidth = 4;
  targetCtx.strokeStyle = "#ffffff";
  targetCtx.stroke();

  targetCtx.fillStyle = "#ffffff";
  targetCtx.beginPath();
  targetCtx.moveTo(6, r + 8);
  targetCtx.lineTo(r - 12, r - 12);
  targetCtx.lineTo(r, r - 2);
  targetCtx.lineTo(r + 14, r - 14);
  targetCtx.lineTo(size - 6, r + 8);
  targetCtx.lineTo(r + 10, r - 4);
  targetCtx.lineTo(r, r + 6);
  targetCtx.lineTo(r - 12, r - 2);
  targetCtx.closePath();
  targetCtx.fill();

  targetCtx.fillStyle = "#f7931e";
  targetCtx.fillRect(r - 18, size - 18, 36, 10);
  targetCtx.fillRect(r - 10, r + 6, 7, 16);
  targetCtx.fillRect(r + 1, r - 1, 7, 13);
  targetCtx.fillRect(r - 8, r - 18, 14, 22);
  targetCtx.fillRect(r - 15, r - 16, 8, 18);
  targetCtx.fillRect(r - 5, r - 26, 11, 9);
  targetCtx.strokeStyle = "#f7931e";
  targetCtx.lineWidth = 3;
  targetCtx.beginPath();
  targetCtx.moveTo(r + 14, r - 16);
  targetCtx.lineTo(r + 6, size - 14);
  targetCtx.stroke();
  targetCtx.restore();
}

function drawMountaineerSprite(targetCtx, charName, x, y, opts = {}) {
  if (!targetCtx) return;
  const {
    scale = 1,
    facing = 1,
    anim = 0,
    swinging = false,
    crouching = false,
    hugging = false,
    throwing = false,
    kicking = false,
    frozen = false,
    celebrating = false,
    crying = false,
    hurt = false,
    customConfig = null,
    helmetShield = false
  } = opts;

  targetCtx.save();
  targetCtx.translate(x, y);
  if (hurt && Math.floor(Date.now() / 60) % 2 === 0) {
    targetCtx.globalAlpha = 0.45;
  }
  targetCtx.scale(facing * scale, scale);

  const isCustom = charName === "CUSTOM" && customConfig;
  const isJordy = charName === "JORDY";

  const gender       = isCustom ? customConfig.gender : "M";
  const skinColor    = isCustom ? (SKIN_TONES[customConfig.skin] || "#d99b66") : "#f1c27d";
  const hairLength   = isCustom ? (customConfig.hairLength || (gender === "F" ? "LARGO" : "CORTO")) : "CORTO";
  const hairColor    = isCustom ? (customConfig.hairColor || "#18181b") : "#18181b";
  const expression   = isCustom ? (customConfig.expression || "FELIZ") : "FELIZ";
  const helmetBrand  = isCustom ? customConfig.helmetBrand : "PETZL";
  const helmetColor  = isCustom ? customConfig.helmetColor : (isJordy ? "#f1f5f9" : "#f97316");
  const hasGlasses   = isCustom ? customConfig.hasGlasses : isJordy;
  const glassesColor = isCustom ? customConfig.glassesColor : "#38bdf8";
  const beardStyle   = isCustom ? customConfig.beardStyle : (isJordy ? 0 : 1);
  const jacketColor  = isCustom ? customConfig.jacketColor : (isJordy ? "#f97316" : "#0ea5e9");
  const packColor    = isCustom ? customConfig.packColor   : (isJordy ? "#eab308" : "#1d4ed8");
  const pantsColor   = isCustom ? customConfig.pantsColor  : (isJordy ? "#334155" : "#ea580c");
  const harnessColor = isCustom ? customConfig.harnessColor : "#1e293b";
  const bootColor    = isCustom ? customConfig.bootsColor  : (isJordy ? "#facc15" : "#1e3a8a");
  const axeBrand     = isCustom ? customConfig.axeBrand    : "PETZL";
  const specialCombat = isCustom ? (customConfig.specialCombat || null) : null;
  const isPolice = specialCombat === 'POLICE';

  const isDownCrouch = crouching || hugging || crying;
  const yOffset = crying ? 15 : (isDownCrouch ? 10 : 0);

  // Cuando celebra, camina en su misma zona sin desplazarse
  const walkCycle = celebrating ? (Date.now() * 0.018) : (anim * 0.35);
  const stepBounce = crying ? 0 : Math.sin(walkCycle) * 3.5;

  // Sombra en el suelo
  targetCtx.fillStyle = "rgba(0,0,0,0.35)";
  targetCtx.fillRect(-18, 30, 36, 6);

  // Mochila de expedición
  if (!isPolice) {
    targetCtx.fillStyle = packColor;
    targetCtx.fillRect(-21, -16 + yOffset, 12, 26);
    targetCtx.strokeStyle = "#0f172a";
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(-21, -16 + yOffset, 12, 26);
  }

  // Piernas y Pantalón (caminando en el sitio si celebra)
  const leg1Y = stepBounce;
  const leg2Y = -stepBounce;
  targetCtx.fillStyle = pantsColor;
  if (kicking) {
    targetCtx.fillRect(-8, 8 + yOffset, 9, 16);
    targetCtx.fillRect(2, 2 + yOffset, 22, 9);
    targetCtx.fillStyle = bootColor;
    targetCtx.fillRect(-8, 22 + yOffset, 11, 7);
    targetCtx.fillRect(22, 0 + yOffset, 8, 10);
  } else {
    targetCtx.fillRect(-10, 8 + yOffset + leg1Y * 0.5, 9, 16 - yOffset * 0.4);
    targetCtx.fillRect(2, 8 + yOffset + leg2Y * 0.5, 9, 16 - yOffset * 0.4);
    // Botas de alta montaña
    targetCtx.fillStyle = bootColor;
    targetCtx.fillRect(-11, 22 + leg1Y * 0.5, 12, 7);
    targetCtx.fillRect(2, 22 + leg2Y * 0.5, 12, 7);
  }

  // Torso / Chaqueta
  targetCtx.fillStyle = jacketColor;
  if (gender === "F") {
    targetCtx.fillRect(-10, -16 + yOffset, 20, 26);
  } else {
    targetCtx.fillRect(-11, -16 + yOffset, 22, 26);
  }

  // Arnés de escalada
  if (!isPolice) {
    targetCtx.fillStyle = harnessColor;
    targetCtx.fillRect(-11, 4 + yOffset, 22, 4);
    targetCtx.fillRect(-11, -6 + yOffset, 22, 3);
    targetCtx.fillRect(-9, 8 + yOffset, 7, 3);
    targetCtx.fillRect(3, 8 + yOffset, 7, 3);
    targetCtx.fillStyle = "#cbd5e1";
    targetCtx.fillRect(-6, 5 + yOffset, 4, 6);
  } else {
    // Uniforme policial más visible
    targetCtx.fillStyle = '#8fb68b';
    targetCtx.fillRect(-10, -2 + yOffset, 20, 2);
    targetCtx.fillRect(-10, 5 + yOffset, 20, 2);
    targetCtx.fillStyle = '#e5e7eb';
    targetCtx.fillRect(-8, -1 + yOffset, 4, 3);
    targetCtx.fillRect(4, -1 + yOffset, 4, 3);
    targetCtx.fillStyle = '#1a3321';
    targetCtx.fillRect(-11, 7 + yOffset, 22, 3); // cinturón
    targetCtx.fillStyle = '#d1d5db';
    targetCtx.fillRect(-2, 7 + yOffset, 4, 3); // hebilla
    targetCtx.fillStyle = '#facc15';
    targetCtx.fillRect(5, -10 + yOffset, 3, 3); // insignia
    targetCtx.fillStyle = '#16301e';
    targetCtx.fillRect(-8, -10 + yOffset, 4, 6); // bolsillo izq
    targetCtx.fillRect(4, -10 + yOffset, 4, 6);  // bolsillo der
  }

  // Detalles de pixel art: costuras, cremallera y bolsillo de la chaqueta.
  // Son únicamente gráficos; no afectan al tamaño ni a la física del personaje.
  if (!isPolice) {
    targetCtx.fillStyle = "rgba(255,255,255,0.24)";
    targetCtx.fillRect(-8, -13 + yOffset, 3, 2);
    targetCtx.fillRect(-8, -10 + yOffset, 2, 7);
    targetCtx.fillStyle = "rgba(15,23,42,0.28)";
    targetCtx.fillRect(4, -10 + yOffset, 5, 6);
    targetCtx.strokeStyle = "rgba(255,255,255,0.42)";
    targetCtx.lineWidth = 1;
    targetCtx.strokeRect(4.5, -10 + yOffset, 4, 5);
    targetCtx.fillStyle = "#facc15";
    targetCtx.fillRect(1, -1 + yOffset, 2, 2);
  } else {
    targetCtx.fillStyle = 'rgba(255,255,255,0.14)';
    targetCtx.fillRect(-8, -13 + yOffset, 6, 2);
    targetCtx.fillRect(-1, -13 + yOffset, 2, 16); // cremallera
  }

  // Cabello trasero/lateral (según CORTO, MEDIO o LARGO y color elegido)
  targetCtx.fillStyle = hairColor;
  if (hairLength === "LARGO") {
    // Cabello largo cayendo por la espalda y hombros
    targetCtx.fillRect(-16, -34 + yOffset, 7, 22);
    targetCtx.fillRect(-18, -20 + yOffset, 6, 12);
    targetCtx.fillRect(8, -32 + yOffset, 4, 14);
  } else if (hairLength === "MEDIO") {
    // Cabello medio a la altura de la nuca/cuello
    targetCtx.fillRect(-14, -34 + yOffset, 6, 13);
    targetCtx.fillRect(8, -33 + yOffset, 3, 9);
  }

  // Cabeza y Color de Piel
  targetCtx.fillStyle = skinColor;
  targetCtx.fillRect(-10, -36 + yOffset, 20, 19);
  // Al defender sin casco, el peinado CALVO muestra la cabeza redondeada
  // del mismo tono de piel, sin huecos donde normalmente va el cabello.
  if (hairLength === "CALVO" && helmetShield) {
    targetCtx.fillRect(-8, -40 + yOffset, 16, 5);
    targetCtx.fillRect(-10, -38 + yOffset, 20, 3);
    targetCtx.fillStyle = "rgba(255,255,255,0.13)";
    targetCtx.fillRect(-6, -39 + yOffset, 5, 2);
  }

  // CALVO: no dibujar patillas ni mechones. En los otros tres peinados
  // se conservan sus detalles originales debajo del casco.
  if (hairLength !== "CALVO") {
    targetCtx.fillStyle = hairColor;
    targetCtx.fillRect(-11, -34 + yOffset, 3, 7);
    if (hairLength !== "CORTO") {
      targetCtx.fillRect(-11, -30 + yOffset, 3, 7);
    }
  }

  // Ojos y Cejas según el Tipo de Mirada (FELIZ, ENOJADA, SERIA, NORMAL) o si está llorando
  if (crying) {
    // Ojos cerrados tristes llorando
    targetCtx.fillStyle = "#0f172a";
    targetCtx.fillRect(-6, -28 + yOffset, 5, 2);
    targetCtx.fillRect(2, -28 + yOffset, 5, 2);
  } else if (!hasGlasses) {
    targetCtx.fillStyle = "#0f172a";
    targetCtx.fillRect(-5, -29 + yOffset, 3, 3);
    targetCtx.fillRect(3, -29 + yOffset, 3, 3);

    // Cejas expresivas
    targetCtx.fillStyle = hairColor;
    if (expression === "ENOJADA") {
      // Cejas inclinadas hacia el centro (mirada furiosa)
      targetCtx.fillRect(-6, -32 + yOffset, 3, 1);
      targetCtx.fillRect(-4, -31 + yOffset, 2, 1);
      targetCtx.fillRect(3, -31 + yOffset, 2, 1);
      targetCtx.fillRect(4, -32 + yOffset, 3, 1);
    } else if (expression === "SERIA") {
      // Cejas rectas bajas y firmes
      targetCtx.fillRect(-6, -31 + yOffset, 5, 1.5);
      targetCtx.fillRect(2, -31 + yOffset, 5, 1.5);
    } else if (expression === "FELIZ") {
      // Cejas arqueadas altas
      targetCtx.fillRect(-6, -32.5 + yOffset, 4, 1);
      targetCtx.fillRect(2, -32.5 + yOffset, 4, 1);
    } else {
      // Mirada Normal
      targetCtx.fillRect(-5, -32 + yOffset, 4, 1);
      targetCtx.fillRect(2, -32 + yOffset, 4, 1);
    }
  }

  // Opciones de Barba (0: Sin barba, 1: Completa, 2: Candado, 3: Bigote)
  targetCtx.fillStyle = hairColor === "#f8fafc" || hairColor === "#94a3b8" ? hairColor : "#27272a";
  if (beardStyle === 1) {
    targetCtx.fillRect(-10, -24 + yOffset, 20, 8);
  } else if (beardStyle === 2) {
    targetCtx.fillRect(-5, -24 + yOffset, 11, 8);
  } else if (beardStyle === 3) {
    targetCtx.fillRect(-6, -24 + yOffset, 13, 3);
  }

  // Boca según expresión o llanto
  if (crying) {
    targetCtx.fillStyle = "#0f172a";
    targetCtx.fillRect(-4, -21 + yOffset, 8, 2);
    targetCtx.fillRect(-5, -20 + yOffset, 2, 2);
    targetCtx.fillRect(3, -20 + yOffset, 2, 2);
  } else if (expression === "FELIZ") {
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fillRect(-4, -22 + yOffset, 9, 3);
  } else if (expression === "ENOJADA") {
    targetCtx.fillStyle = "#0f172a";
    targetCtx.fillRect(-4, -21 + yOffset, 8, 2);
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fillRect(-3, -22 + yOffset, 6, 1);
  } else if (expression === "SERIA") {
    targetCtx.fillStyle = "#0f172a";
    targetCtx.fillRect(-4, -21 + yOffset, 8, 1.5);
  } else {
    // Normal
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fillRect(-3, -22 + yOffset, 7, 2);
  }

  // Gafas estilo Jordy (si están activadas y no está llorando sin gafas)
  if (hasGlasses) {
    targetCtx.fillStyle = "#0f172a";
    targetCtx.fillRect(-9, -31 + yOffset, 19, 7);
    targetCtx.fillStyle = glassesColor;
    targetCtx.fillRect(-7, -30 + yOffset, 6, 4);
    targetCtx.fillRect(2, -30 + yOffset, 6, 4);
    // Si tiene mirada enojada con gafas, mostrar ceño fruncido sobre las gafas
    if (expression === "ENOJADA" && !crying) {
      targetCtx.fillStyle = hairColor;
      targetCtx.fillRect(-6, -32.5 + yOffset, 4, 1.5);
      targetCtx.fillRect(3, -32.5 + yOffset, 4, 1.5);
    }
  }

  // Animación de lágrimas cayendo cuando el perdedor se agacha derrotado
  if (crying) {
    const tearFall1 = (Date.now() * 0.04) % 16;
    const tearFall2 = ((Date.now() * 0.04) + 8) % 16;
    targetCtx.fillStyle = "#38bdf8";
    targetCtx.fillRect(-6, -26 + yOffset + tearFall1, 3, 5);
    targetCtx.fillRect(4, -26 + yOffset + tearFall2, 3, 5);
    targetCtx.fillStyle = "#e0f2fe";
    targetCtx.fillRect(-5, -26 + yOffset + tearFall1, 1.5, 2);
    targetCtx.fillRect(5, -26 + yOffset + tearFall2, 1.5, 2);
  }

  // Bajo el casco se ve el peinado elegido; con CALVO queda la piel visible.
  // El cabello se dibuja solo al sostener el casco en la mano.
  if (helmetShield && hairLength !== "CALVO") {
    targetCtx.fillStyle = hairColor;
    if (hairLength === "LARGO") {
      targetCtx.fillRect(-12, -43 + yOffset, 24, 8);
      targetCtx.fillRect(-14, -38 + yOffset, 5, 19);
      targetCtx.fillRect(9, -38 + yOffset, 5, 19);
      targetCtx.fillRect(-9, -35 + yOffset, 6, 4); // flequillo
    } else if (hairLength === "MEDIO") {
      targetCtx.fillRect(-12, -42 + yOffset, 24, 8);
      targetCtx.fillRect(-13, -37 + yOffset, 5, 11);
      targetCtx.fillRect(9, -37 + yOffset, 4, 11);
      targetCtx.fillRect(-6, -35 + yOffset, 6, 3); // flequillo
    } else {
      // Jordy y Chugo usan pelo corto; también vale para personalización CORTO.
      targetCtx.fillRect(-11, -41 + yOffset, 22, 7);
      targetCtx.fillRect(-9, -43 + yOffset, 14, 3);
      targetCtx.fillRect(-12, -36 + yOffset, 4, 5);
      targetCtx.fillRect(9, -36 + yOffset, 3, 5);
      targetCtx.fillRect(-6, -34 + yOffset, 6, 2);
    }
    targetCtx.fillStyle = "rgba(255,255,255,0.13)";
    targetCtx.fillRect(-7, -41 + yOffset, 6, 2);
  }

  // Casco Técnico: en defensa del minijuego se retira de la cabeza
  // para sostenerlo como escudo delante del cuerpo.
  if (!helmetShield) {
    if (isPolice) {
      targetCtx.fillStyle = '#101827';
      targetCtx.fillRect(-14, -41 + yOffset, 28, 4); // visera
      targetCtx.fillStyle = '#214d2f';
      targetCtx.fillRect(-11, -46 + yOffset, 22, 7); // gorra
      targetCtx.fillRect(-8, -49 + yOffset, 16, 4);  // parte alta
      targetCtx.fillStyle = '#183420';
      targetCtx.fillRect(-10, -39 + yOffset, 20, 2); // banda
      targetCtx.fillStyle = '#facc15';
      targetCtx.fillRect(-2, -44 + yOffset, 4, 4);   // placa
      targetCtx.fillRect(-5, -43 + yOffset, 1, 1);
      targetCtx.fillRect(4, -43 + yOffset, 1, 1);
      targetCtx.fillStyle = 'rgba(255,255,255,0.25)';
      targetCtx.fillRect(-6, -47 + yOffset, 7, 2);
    } else {
      targetCtx.fillStyle = helmetColor;
      targetCtx.fillRect(-12, -43 + yOffset, 24, 11);
      targetCtx.strokeStyle = "#0f172a";
      targetCtx.lineWidth = 1.5;
      targetCtx.strokeRect(-12, -43 + yOffset, 24, 11);

      if (helmetBrand === "PETZL") {
        targetCtx.fillStyle = "#0f172a";
        targetCtx.fillRect(-8, -40 + yOffset, 3, 3);
        targetCtx.fillRect(-2, -41 + yOffset, 3, 3);
        targetCtx.fillStyle = "#f97316";
        targetCtx.fillRect(6, -40 + yOffset, 4, 3);
      } else {
        targetCtx.fillStyle = "#0f172a";
        targetCtx.fillRect(-12, -43 + yOffset, 24, 3);
        targetCtx.fillStyle = "#e2e8f0";
        targetCtx.fillRect(4, -39 + yOffset, 4, 4);
      }

      // Brillo del casco y visera, manteniendo el estilo pixel art.
      targetCtx.fillStyle = "rgba(255,255,255,0.45)";
      targetCtx.fillRect(-8, -42 + yOffset, 9, 2);
      targetCtx.fillStyle = "rgba(15,23,42,0.24)";
      targetCtx.fillRect(-11, -34 + yOffset, 22, 2);
    }
  }

  // Brazo y Piolet (Al ganar levanta el piolet hacia arriba varias veces en bucle)
  targetCtx.save();
  if (celebrating) {
    const pumpLift = Math.abs(Math.sin(Date.now() * 0.015)) * 9;
    targetCtx.translate(4, -12 + yOffset - pumpLift);
    targetCtx.rotate(-Math.PI * 0.68 + Math.sin(Date.now() * 0.015) * 0.28);
  } else if (crying) {
    targetCtx.translate(2, -4 + yOffset);
    targetCtx.rotate(0.65);
  } else {
    targetCtx.translate(4, -8 + yOffset);
    if (swinging) {
      targetCtx.rotate(Math.sin(Date.now() * 0.03) * 1.1 + 0.5);
    } else if (hugging) {
      targetCtx.rotate(-0.45);
    } else {
      targetCtx.rotate(Math.sin(anim * 0.3) * 0.25);
    }
  }

  targetCtx.fillStyle = jacketColor;
  targetCtx.fillRect(-3, -3, 15, 7);
  targetCtx.fillStyle = skinColor;
  targetCtx.fillRect(10, -3, 5, 7);

  if (isPolice) {
    if (throwing) {
      // Escopeta de madera y metal
      targetCtx.fillStyle = '#7c4a22';
      targetCtx.fillRect(7, -7, 10, 4);   // culata
      targetCtx.fillRect(16, -6, 8, 3);   // unión
      targetCtx.fillStyle = '#94a3b8';
      targetCtx.fillRect(23, -8, 16, 5);  // cañón
      targetCtx.fillRect(21, -10, 4, 9);  // cuerpo
      targetCtx.fillStyle = '#111827';
      targetCtx.fillRect(36, -7, 3, 3);   // boca del cañón
      targetCtx.fillStyle = '#d1d5db';
      targetCtx.fillRect(20, -5, 2, 3);   // gatillo/agarre
    } else if (swinging || celebrating) {
      // Tolete más claro
      targetCtx.fillStyle = '#6b3f1f';
      targetCtx.fillRect(11, -17, 5, 25);
      targetCtx.fillStyle = '#2f1c10';
      targetCtx.fillRect(9, -19, 9, 4);
      targetCtx.fillRect(10, 4, 7, 2);
    } else {
      targetCtx.fillStyle = '#6b3f1f';
      targetCtx.fillRect(11, -16, 5, 24);
      targetCtx.fillStyle = '#2f1c10';
      targetCtx.fillRect(9, -18, 9, 4);
    }
  } else {
    targetCtx.fillStyle = AXE_BRAND_COLORS[axeBrand] || AXE_BRAND_COLORS.PETZL;
    targetCtx.fillRect(12, -20, 4, 28);
    targetCtx.fillStyle = "#1e293b";
    targetCtx.fillRect(12, 4, 4, 4);
    targetCtx.fillStyle = axeBrand === "BD" ? "#e2e8f0" : "#cbd5e1";
    targetCtx.fillRect(6, -23, 18, 4);
    targetCtx.fillRect(21, -20, 4, 5);
  }
  targetCtx.restore();

  if (frozen) {
    targetCtx.fillStyle = "rgba(125, 211, 252, 0.38)";
    targetCtx.fillRect(-20, -44 + yOffset, 40, 74);
    targetCtx.strokeStyle = "#e0f2fe";
    targetCtx.lineWidth = 1.5;
    targetCtx.strokeRect(-14, -43 + yOffset, 28, 70);
  }

  if (hugging) {
    targetCtx.fillStyle = "rgba(56, 189, 248, 0.28)";
    targetCtx.beginPath();
    targetCtx.arc(0, -8 + yOffset, 38, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.strokeStyle = "#38bdf8";
    targetCtx.lineWidth = 3.5;
    targetCtx.stroke();
  }

  targetCtx.restore();
}

/* ============================================================================
   CREADOR DE PERSONAJE
   ============================================================================ */
const TOUR_NAMED_CPU_PROFILES = [
  {
    fighterInfo: {
      char: "CUSTOM",
      displayName: "Vivi",
      customConfig: {
        gender: "F", skin: "BLANCO", hairLength: "LARGO", hairColor: "#6b4423", expression: "ENOJADA",
        helmetBrand: "PETZL", helmetColor: "#f8fafc", hasGlasses: false, beardStyle: 0,
        jacketColor: "#7e22ce", pantsColor: "#f472b6", packColor: "#2563eb",
        harnessColor: "#f97316", bootsColor: "#3b82f6", axeBrand: "SIMOND",
        quoteText: "ay! mis rodillas!!!"
      }
    }
  },
  {
    fighterInfo: {
      char: "CUSTOM",
      displayName: "Chiquis",
      customConfig: {
        gender: "F", skin: "BLANCO", hairLength: "LARGO", hairColor: "#111111", expression: "ENOJADA",
        helmetBrand: "PETZL", helmetColor: "#f97316", hasGlasses: false, beardStyle: 0,
        jacketColor: "#ffffff", pantsColor: "#f472b6", packColor: "#9333ea",
        harnessColor: "#ec4899", bootsColor: "#f97316", axeBrand: "PETZL",
        quoteText: "no sentí nada…"
      }
    }
  },
  {
    fighterInfo: {
      char: "CUSTOM",
      displayName: "Papucho",
      customConfig: {
        gender: "M", skin: "BLANCO", hairLength: "CALVO", hairColor: "#18181b", expression: "SERIA",
        helmetBrand: "POLICE", helmetColor: "#1f4d2e", hasGlasses: false, beardStyle: 0,
        jacketColor: "#214d2f", pantsColor: "#1c3f28", packColor: "#214d2f",
        harnessColor: "#214d2f", bootsColor: "#111827", axeBrand: "POLICE",
        specialCombat: "POLICE", quoteText: "Chugo!!! Dónde estas? Voy por ti!!!"
      }
    }
  },
  {
    fighterInfo: {
      char: "CUSTOM",
      displayName: "Miguel",
      customConfig: {
        gender: "M", skin: "BLANCO", hairLength: "CORTO", hairColor: "#111111", expression: "SERIA",
        helmetBrand: "BD", helmetColor: "#16a34a", hasGlasses: false, beardStyle: 0,
        jacketColor: "#2563eb", pantsColor: "#111827", packColor: "#eab308",
        harnessColor: "#111827", bootsColor: "#3b82f6", axeBrand: "PETZL",
        quoteText: "el matrimonio me cambió…"
      }
    }
  },
  {
    fighterInfo: {
      char: "CUSTOM",
      displayName: "Sambita",
      customConfig: {
        gender: "F", skin: "MESTIZO", hairLength: "LARGO", hairColor: "#111111", expression: "ENOJADA",
        helmetBrand: "BD", helmetColor: "#f472b6", hasGlasses: false, beardStyle: 0,
        jacketColor: "#7e22ce", pantsColor: "#111827", packColor: "#2563eb",
        harnessColor: "#eab308", bootsColor: "#ec4899", axeBrand: "PETZL",
        quoteText: "me dio ganas de vomitar!"
      }
    }
  },
  { fighterInfo: { char: "CHUGO", displayName: "Chugo CPU", customConfig: { quoteText: "no será de tomar un traguito?" } } },
  { fighterInfo: { char: "JORDY", displayName: "Jordy CPU", customConfig: { quoteText: "mira mamá sin manos!!" } } },
  {
    fighterInfo: {
      char: "CUSTOM", displayName: "Daniel",
      customConfig: {
        gender: "M", skin: "MESTIZO", hairLength: "CORTO", hairColor: "#18181b", expression: "NORMAL",
        helmetBrand: "PETZL", helmetColor: "#f8fafc", hasGlasses: true, glassesColor: "#1e293b", beardStyle: 0,
        jacketColor: "#f8fafc", pantsColor: "#111827", packColor: "#2563eb",
        harnessColor: "#111827", bootsColor: "#f97316", axeBrand: "PETZL",
        quoteText: "soy el mejor chuguito!"
      }
    }
  }
];
let tourNamedCpuRosterTurn = 0;
function tourMakeCpuInfo(slotIndex) {
  // En torneos de 4 y 8 Daniel aparece como CPU, sin quitar a Chugo ni Jordy del cuadro de 8.
  // Como hay 7 plazas CPU junto a un jugador y 8 perfiles, se alterna uno de los demás rivales.
  const rosterOptions = [
    [0,1,7,2,3,5,6], [0,1,7,2,4,5,6], [0,1,7,3,4,5,6],
    [0,2,7,3,4,5,6], [1,2,7,3,4,5,6]
  ];
  const cpuOrder = rosterOptions[tourNamedCpuRosterTurn % rosterOptions.length];
  const index = cpuOrder[(Math.max(1,slotIndex) - 1) % cpuOrder.length];
  const profile = TOUR_NAMED_CPU_PROFILES[index];
  return {
    char: profile.fighterInfo.char,
    displayName: profile.fighterInfo.displayName,
    customConfig: profile.fighterInfo.customConfig ? JSON.parse(JSON.stringify(profile.fighterInfo.customConfig)) : null
  };
}
function isPoliceSpecialConfig(cfg) {
  return !!(cfg && cfg.specialCombat === 'POLICE');
}
function fighterQuoteText(fighter) {
  if (fighter?.customConfig?.quoteText) return fighter.customConfig.quoteText;
  if (fighter?.char === 'JORDY') return 'mira mamá sin manos!!';
  if (fighter?.char === 'CHUGO') return 'no será de tomar un traguito?';
  return '';
}
function fighterProjectileType(fighter) {
  return isPoliceSpecialConfig(fighter?.customConfig) ? 'BULLET' : 'BEER';
}
function selectCustomSlot(slotIdx) {
  activeCustomSlot = slotIdx;
  [0, 1, 2].forEach((i) => {
    const b = document.getElementById(`slot-btn-${i}`);
    if (b) b.classList.toggle("active", i === slotIdx);
  });
  selectChar("CUSTOM");
  renderCustomCardPreview();
}

function renderCustomCardPreview() {
  const cardCanvas = document.getElementById("preview-custom-card");
  if (!cardCanvas) return;
  const cCtx = cardCanvas.getContext("2d");
  cCtx.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
  const cfg = customCharSlots[activeCustomSlot];
  drawMountaineerSprite(cCtx, "CUSTOM", 60, 92, {
    scale: 1.65, facing: 1, customConfig: cfg
  });
  const titleEl = document.getElementById("custom-card-title");
  if (titleEl) {
    titleEl.textContent = (cfg.name || `MONTANISTA ${activeCustomSlot + 1}`).toUpperCase();
  }
}

function openCustomCreator() {
  selectChar("CUSTOM");
  switchCreatorSlot(activeCustomSlot);
  showOverlay("custom-creator-overlay");
}

function switchCreatorSlot(slotIdx) {
  activeCustomSlot = slotIdx;
  [0, 1, 2].forEach((i) => {
    const tabEl = document.getElementById(`creator-slot-${i}`);
    if (tabEl) tabEl.classList.toggle("active", i === slotIdx);
    const sb = document.getElementById(`slot-btn-${i}`);
    if (sb) sb.classList.toggle("active", i === slotIdx);
  });
  refreshCreatorUI();
}

function updateCreatorConfig(prop, val) {
  const cfg = customCharSlots[activeCustomSlot];
  cfg[prop] = prop === "name" ? String(val).toUpperCase() : val;
  if (prop === "helmetBrand") {
    cfg.helmetColor = HELMET_COLORS[val][0].hex;
  }
  sound.playSFX("sfx_jump");
  refreshCreatorUI();
}

function buildColorSwatches(containerId, propName, currentColor) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  GEAR_10_COLORS.forEach((hex) => {
    const sw = document.createElement("div");
    sw.className = "color-swatch" + (currentColor === hex ? " active" : "");
    sw.style.backgroundColor = hex;
    if (hex === "#14b8a6") { sw.title = "TURQUESA"; sw.setAttribute("aria-label", "TURQUESA"); }
    sw.onclick = () => updateCreatorConfig(propName, hex);
    container.appendChild(sw);
  });
}

function refreshCreatorUI() {
  const cfg = customCharSlots[activeCustomSlot];
  const nameEl = document.getElementById("custom-char-name");
  if (nameEl) nameEl.value = (cfg.name || `MONTANISTA ${activeCustomSlot + 1}`).toUpperCase();

  const gM = document.getElementById("gender-M");
  const gF = document.getElementById("gender-F");
  if (gM) gM.classList.toggle("active", cfg.gender === "M");
  if (gF) gF.classList.toggle("active", cfg.gender === "F");

  ["BLANCO", "MESTIZO", "NEGRO"].forEach((s) => {
    const el = document.getElementById(`skin-${s}`);
    if (el) el.classList.toggle("active", cfg.skin === s);
  });

  ["CALVO", "CORTO", "MEDIO", "LARGO"].forEach((hl) => {
    const el = document.getElementById(`hlen-${hl}`);
    if (el) el.classList.toggle("active", (cfg.hairLength || "CORTO") === hl);
  });

  const hairColorContainer = document.getElementById("hair-color-options");
  if (hairColorContainer) {
    hairColorContainer.innerHTML = "";
    HAIR_COLORS.forEach((hc) => {
      const btn = document.createElement("button");
      btn.className = "chip-btn" + (cfg.hairColor === hc.hex ? " active" : "");
      btn.innerHTML = `<span style="display:inline-block;width:9px;height:9px;background:${hc.hex};border:1px solid #000;margin-right:4px;"></span>${hc.name}`;
      btn.onclick = () => updateCreatorConfig("hairColor", hc.hex);
      hairColorContainer.appendChild(btn);
    });
  }

  ["FELIZ", "ENOJADA", "SERIA", "NORMAL"].forEach((ex) => {
    const el = document.getElementById(`expr-${ex}`);
    if (el) el.classList.toggle("active", (cfg.expression || "FELIZ") === ex);
  });

  const hPetzl = document.getElementById("hbrand-PETZL");
  const hBD = document.getElementById("hbrand-BD");
  if (hPetzl) hPetzl.classList.toggle("active", cfg.helmetBrand === "PETZL");
  if (hBD) hBD.classList.toggle("active", cfg.helmetBrand === "BD");

  const hColorContainer = document.getElementById("helmet-color-options");
  if (hColorContainer) {
    hColorContainer.innerHTML = "";
    (HELMET_COLORS[cfg.helmetBrand] || HELMET_COLORS.PETZL).forEach((hc) => {
      const btn = document.createElement("button");
      btn.className = "chip-btn" + (cfg.helmetColor === hc.hex ? " active" : "");
      btn.innerHTML = `<span style="display:inline-block;width:9px;height:9px;background:${hc.hex};border:1px solid #000;margin-right:4px;"></span>${hc.name}`;
      btn.onclick = () => updateCreatorConfig("helmetColor", hc.hex);
      hColorContainer.appendChild(btn);
    });
  }

  const gOn = document.getElementById("glasses-ON");
  const gOff = document.getElementById("glasses-OFF");
  if (gOn) gOn.classList.toggle("active", !!cfg.hasGlasses);
  if (gOff) gOff.classList.toggle("active", !cfg.hasGlasses);

  const gColorContainer = document.getElementById("glasses-color-options");
  if (gColorContainer) {
    gColorContainer.innerHTML = "";
    if (cfg.hasGlasses) {
      GLASSES_COLORS.forEach((gc) => {
        const btn = document.createElement("button");
        btn.className = "chip-btn" + (cfg.glassesColor === gc.hex ? " active" : "");
        btn.innerHTML = `<span style="display:inline-block;width:9px;height:9px;background:${gc.hex};border:1px solid #fff;margin-right:4px;"></span>${gc.name}`;
        btn.onclick = () => updateCreatorConfig("glassesColor", gc.hex);
        gColorContainer.appendChild(btn);
      });
    }
  }

  [0, 1, 2, 3].forEach((b) => {
    const el = document.getElementById(`beard-${b}`);
    if (el) el.classList.toggle("active", cfg.beardStyle === b);
  });

  buildColorSwatches("jacket-color-swatches", "jacketColor", cfg.jacketColor);
  buildColorSwatches("pants-color-swatches", "pantsColor", cfg.pantsColor);
  buildColorSwatches("pack-color-swatches", "packColor", cfg.packColor);
  buildColorSwatches("harness-color-swatches", "harnessColor", cfg.harnessColor);
  buildColorSwatches("boots-color-swatches", "bootsColor", cfg.bootsColor);

  ["PETZL", "BD", "SIMOND", "SINGING_ROCK", "EDELRID", "GRIVEL"].forEach((brand) => {
    const el = document.getElementById(`axe-${brand}`);
    if (el) el.classList.toggle("active", (cfg.axeBrand || "PETZL") === brand);
  });

  const pCanvas = document.getElementById("creatorPreviewCanvas");
  if (pCanvas) {
    const pCtx = pCanvas.getContext("2d");
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    drawMountaineerSprite(pCtx, "CUSTOM", 65, 102, {
      scale: 1.85, facing: 1, customConfig: cfg
    });
  }
  renderCustomCardPreview();
}

async function saveAndUseCustomChar() {
  const nameVal = (document.getElementById("custom-char-name").value || "").toUpperCase().trim();
  customCharSlots[activeCustomSlot].name = nameVal || `MONTANISTA ${activeCustomSlot + 1}`;
  try {await saveCustomCharsToAccount();}
  catch(error){flagCloudWriteFailure(error);return;}
  renderCustomCardPreview();
  selectChar("CUSTOM");
  sound.playSFX("sfx_checkpoint");
  showOverlay("char-overlay");
}

/* ============================================================================
   MENÚS Y OVERLAYS
   ============================================================================ */
function stopSummitCelebration() {
  const wasActive = summitCelebrationActive;
  summitCelebrationActive = false;
  summitPromptDismissed = false;
  summitPromptReadyAt = 0;
  document.body.classList.remove("summit-background-active");
  const backdrop = document.getElementById("summit-animation-backdrop");
  const frame = document.getElementById("summit-animation-frame");
  if (backdrop) backdrop.classList.remove("active");
  if (frame && wasActive) frame.src = "about:blank";
}

function showSummitCelebrationPrompt() {
  if (summitCelebrationActive || gameState !== "SUMMIT" || !player.celebrating) return;
  showOverlay(null);
  try { sound.stopBGM(); } catch (e) {}
  summitCelebrationActive = true;
  summitPromptDismissed = false;
  summitPromptReadyAt = performance.now() + 10000;
  document.body.classList.add("summit-background-active");
  const backdrop = document.getElementById("summit-animation-backdrop");
  const frame = document.getElementById("summit-animation-frame");
  if (backdrop) backdrop.classList.add("active");
  if (frame) frame.src = SUMMIT_ANIMATION_DATA_URI;
}

function finishSummitCinematic() {
  if (!summitCelebrationActive || summitPromptDismissed || gameState !== "SUMMIT" || !player.celebrating) return;
  if (performance.now() < summitPromptReadyAt) return;
  summitPromptDismissed = true;
  document.getElementById("end-title").textContent = "🏔️ ¡CUMBRE ILINIZA SUR!";
  document.getElementById("end-subtitle").textContent = "FELICIDADES LLEGASTE A 5248 MSNM";
  document.getElementById("end-score-text").textContent = `PUNTAJE FINAL: ${storyData.score}`;
  prepareGameOverModal();
  showOverlay("gameover-overlay");
}

window.addEventListener("message", (event) => {
  const frame = document.getElementById("summit-animation-frame");
  if (event.data === "apus-summit-finish-v21" && frame && event.source === frame.contentWindow) {
    finishSummitCinematic();
  }
});

function showOverlay(id) {
  if (id) {const btn=document.getElementById('vs-end-actions');if(btn)btn.style.display='none';}
  if (id === "menu-overlay" && summitCelebrationActive) {
    stopSummitCelebration();
    if (gameState === "SUMMIT") gameState = "MENU";
  }
  document.querySelectorAll(".overlay").forEach(el => el.classList.remove("active"));
  if (id) {
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
  }
}

function updateDiffLabel() {
  const d = DIFFICULTIES[diffIndex];
  const el = document.getElementById("diff-label");
  if (el) el.textContent = `DIFICULTAD: ${d.name} (${d.hearts} ❤️)`;
}

function changeDifficulty(dir) {
  diffIndex = (diffIndex + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
  updateDiffLabel();
  cloudSavePreferences({difficultyIndex:diffIndex});
  sound.playSFX("sfx_jump");
}

function openCharSelect(mode) {
  pendingMode = mode;
  const sub = document.getElementById("mode-subtitle");
  if (sub) sub.textContent = mode === "story" ? "MODO ASCENSO AL ILINIZA SUR (5 NIVELES)"
    : mode === "tournament" ? "TORNEO COMPETITIVO CHUGO VS JORDY" : "MINI JUEGO CHUGO VS JORDY";

  const customCard = document.getElementById("card-custom");
  if (customCard) {
    if (mode === "minigame" || mode === "tournament") {
      customCard.style.display = "flex";
      renderCustomCardPreview();
    } else {
      customCard.style.display = "none";
      if (selectedCharacter === "CUSTOM") selectChar("JORDY");
    }
  }
  showOverlay("char-overlay");
  sound.playBGM("bgm_menu");
}

function backFromCharacterSelection() {
  showOverlay(pendingMode === 'minigame' || pendingMode === 'tournament'
    ? 'versus-selection-overlay' : 'menu-overlay');
}

function selectChar(name) {
  selectedCharacter = name;
  const cJordy = document.getElementById("card-jordy");
  const cChugo = document.getElementById("card-chugo");
  const cCustom = document.getElementById("card-custom");
  if (cJordy) cJordy.classList.toggle("selected", name === "JORDY");
  if (cChugo) cChugo.classList.toggle("selected", name === "CHUGO");
  if (cCustom) cCustom.classList.toggle("selected", name === "CUSTOM");
  cloudSavePreferences({selectedCharacter:name});
  sound.playSFX("sfx_jump");
}

function confirmCharSelect() {
  if (pendingMode === "story") {
    if (selectedCharacter === "CUSTOM") selectedCharacter = "JORDY";
    showOverlay(null);
    startNewStoryGame();
  } else {
    if (pendingMode === "tournament") { tourOpenSetup(); return; }
    const charDisplayName = selectedCharacter === "CUSTOM"
      ? `${customCharSlots[activeCustomSlot].name} (PERS. #${activeCustomSlot + 1})`
      : selectedCharacter;
    const label = document.getElementById("vs-chosen-char-label");
    if (label) label.textContent = `PELEADOR ELEGIDO: ${charDisplayName}`;
    const hostArea = document.getElementById("host-room-area");
    if (hostArea) hostArea.style.display = "none";
    const jStatus = document.getElementById("join-status-text");
    if (jStatus) jStatus.textContent = "";
    showOverlay("minigame-mode-overlay");
    apusRenderStagePicker();
  }
}

function openCpuOpponentSelect() {
  // Este selector solo afecta al modo VS CPU offline.
  showOverlay("cpu-opponent-overlay");
}

function startVersusCPU(opponent = "JORDY") {
  selectedCpuOpponent = opponent === "CHUGO" ? "CHUGO" : "JORDY";
  cleanupPeerConnection();
  vsIsOnline = false;
  showOverlay(null);
  startVersusMiniGame(false);
}

function cancelOnlineAndBack() {
  cleanupPeerConnection();
  showOverlay("char-overlay");
}

function getSavesKey() {
  return "apus_iliniza_saves"; // Solo partidas de INVITADO; cuentas en Firestore.
}

function getSavesList() {
  if(currentUser?.uid) return Array.isArray(cloudProfile?.saves) ? deepCopy(cloudProfile.saves.slice(0,3)) : [];
  try {const saves=JSON.parse(localStorage.getItem(getSavesKey()) || '[]');return Array.isArray(saves)?saves.slice(0,3):[];}
  catch(e){return [];}
}
async function writeSavesList(saves) {
  const list=deepCopy(saves.slice(0,3));
  if(currentUser?.uid){cloudProfile.saves=list;await cloudCommitProfile();}
  else localStorage.setItem(getSavesKey(),JSON.stringify(list));
}

async function saveCurrentProgress() {
  if (gameState !== "STORY" && gameState !== "PAUSED") {
    alert("Solo puedes guardar mientras estás en una partida de ascenso.");
    return;
  }
  const saves = getSavesList();
  const newSave = {
    date: new Date().toLocaleString(),
    char: selectedCharacter,
    diffIdx: diffIndex,
    levelIdx: storyData.levelIdx,
    score: storyData.score + storyData.levelScore,
    hearts: storyData.hearts,
    maxHearts: storyData.maxHearts
  };
  saves.unshift(newSave);
  const trimmed = saves.slice(0, 3);
  try {
    await writeSavesList(trimmed);
    sound.playSFX("sfx_checkpoint");
    alert("¡Partida guardada exitosamente!" + (currentUser?.uid ? " (NUBE)" : " (INVITADO, SOLO EN ESTE DISPOSITIVO)"));
  } catch(error) {flagCloudWriteFailure(error);}
}

// V24: desbloqueo persistente por usuario (o por dispositivo si es invitado).
function getStoryProgressKey() {
  return "apus_iliniza_story_progress_guest"; // Solo INVITADO.
}

function readStoryProgress() {
  if (currentUser?.uid) return cloudProfile?.progress ? deepCopy(cloudProfile.progress) : {};
  try { const data=JSON.parse(localStorage.getItem(getStoryProgressKey())||'{}');return data&&typeof data==='object'?data:{}; }
  catch(e){return {};}
}

function getUnlockedStoryLevel() {
  const progress = readStoryProgress();
  // También reconoce partidas antiguas que ya estaban guardadas en v23.
  const savedHighest = getSavesList().reduce((max, save) =>
    Math.max(max, (Number(save.levelIdx) || 0) + 1), 1);
  return Math.min(LEVELS.length, Math.max(1, Number(progress.unlocked) || 1, savedHighest));
}

function recordStoryLevelCompletion(completedLevelIdx) {
  const progress = readStoryProgress();
  progress.unlocked = Math.max(getUnlockedStoryLevel(), Math.min(LEVELS.length, completedLevelIdx + 2));
  progress.slots = progress.slots && typeof progress.slots === "object" ? progress.slots : {};
  // Los niveles desbloqueados son comunes; las puntuaciones guardadas de cada
  // dificultad permanecen separadas para no transferir puntos entre modos.
  progress.slotsByDifficulty = progress.slotsByDifficulty && typeof progress.slotsByDifficulty === "object"
    ? progress.slotsByDifficulty : {};
  if (completedLevelIdx < LEVELS.length - 1) {
    const nextSlot = {
      levelIdx: completedLevelIdx + 1,
      score: storyData.score,
      char: selectedCharacter,
      diffIdx: diffIndex,
      hearts: DIFFICULTIES[diffIndex].hearts,
      maxHearts: DIFFICULTIES[diffIndex].hearts
    };
    progress.slots[completedLevelIdx + 1] = nextSlot; // Compatibilidad con v24/v25.
    const modeSlots = progress.slotsByDifficulty[diffIndex] || {};
    modeSlots[completedLevelIdx + 1] = nextSlot;
    progress.slotsByDifficulty[diffIndex] = modeSlots;
  } else {
    progress.finished = true;
  }
  if (currentUser?.uid) {
    cloudProfile.progress=deepCopy(progress);
    cloudCommitProfile().catch(flagCloudWriteFailure);
  } else {
    try {localStorage.setItem(getStoryProgressKey(),JSON.stringify(progress));} catch(e) {}
  }
}


/* ============================================================================
   V26.3 — NIVEL 6 EXTRA: DESCENSO (SOLO DESPUÉS DE COMPLETAR EL NIVEL 5)
   No afecta el orden de los cinco niveles de historia, sus guardados ni el P2P.
   ============================================================================ */
let descentExtraActive = false;
let descentExitTimer = null;
function hasUnlockedDescentExtra() {
  // «finished» ya se guarda al terminar el nivel 5 en el perfil de Firebase
  // o en el progreso local de INVITADO. No se desbloquea solo por llegar al nivel 5.
  return readStoryProgress().finished === true;
}
function startDescentExtra() {
  if (!hasUnlockedDescentExtra()) return; // Bloqueado para quienes no culminaron la cumbre.
  stopSummitCelebration();
  if (descentExtraActive) closeDescentExtra();
  const shell = document.getElementById('apus-descent-shell');
  const frame = document.getElementById('apus-descent-frame');
  const exitBtn = document.getElementById('apus-descent-exit');
  if (!shell || !frame || !exitBtn) return;
  descentExtraActive = true;
  gameState = 'DESCENT';
  updateTouchControlsVisibility();
  showOverlay(null);
  try { sound.stopBGM(); } catch (e) {}
  document.body.classList.add('apus-descent-playing');
  exitBtn.style.display = 'none';
  shell.style.display = 'block';
  // V31: animación local separada, incluida en la caché offline.
  // APUS_AUDIO_ESCENAS_V3153: pasar al descenso solo la preferencia de efectos.
  frame.addEventListener('load', function descentAudioReady(){
    const p=window.apusAudioSettings||{};
    try{frame.contentWindow?.postMessage({apusDescent:'SOUND',enabled:p.fxEnabled!==false,fxVolume:p.fxVolume??1},'*');}catch(_){}
  },{once:true});
  frame.src = "minijuegos/animacion-descenso.html";
  // Animación de una sola pasada (~11 segundos). Al finalizar, se habilita salir.
  descentExitTimer = setTimeout(() => {
    if (descentExtraActive) exitBtn.style.display = 'block';
  }, 11000);
}
function closeDescentExtra() {
  if (!descentExtraActive) return;
  descentExtraActive = false;
  clearTimeout(descentExitTimer);
  descentExitTimer = null;
  document.body.classList.remove('apus-descent-playing');
  const frame = document.getElementById('apus-descent-frame');
  if (frame) { frame.removeAttribute('srcdoc'); frame.src = 'about:blank'; }
  const shell = document.getElementById('apus-descent-shell');
  if (shell) shell.style.display = 'none';
  const exitBtn = document.getElementById('apus-descent-exit');
  if (exitBtn) exitBtn.style.display = 'none';
}
function exitDescentToMenu() {
  if (!descentExtraActive) return;
  closeDescentExtra();
  returnToMainMenu();
}

function continueGame() {
  const unlocked = getUnlockedStoryLevel();
  // Se respeta la dificultad seleccionada en el menú principal.
  const currentMode = DIFFICULTIES[diffIndex];
  const difficultyLabel = document.getElementById("continue-difficulty-label");
  if (difficultyLabel) difficultyLabel.textContent = `JUGAR EN ${currentMode.name} · ${currentMode.hearts} ❤️`;
  const container = document.getElementById("continue-levels-list");
  if (!container) return;
  container.replaceChildren();
  for (let i = 0; i < LEVELS.length; i++) {
    const available = i < unlocked;
    const button = document.createElement("button");
    button.className = "menu-btn";
    button.textContent = available
      ? `🏔️ NIVEL ${i + 1} · ${LEVELS[i].startAlt}–${LEVELS[i].endAlt} m · JUGAR`
      : `🔒 NIVEL ${i + 1} · BLOQUEADO`;
    button.disabled = !available;
    if (!available) {
      button.style.opacity = "0.48";
      button.style.cursor = "not-allowed";
    } else {
      button.addEventListener("click", () => startUnlockedStoryLevel(i));
    }
    container.appendChild(button);
  }
  // Epílogo oculto hasta que nivel 5 se haya FINALIZADO de verdad.
  if (hasUnlockedDescentExtra()) {
    const descentBtn = document.createElement('button');
    descentBtn.className = 'menu-btn';
    descentBtn.style.cssText = 'background:#0e7490;border-color:#67e8f9;';
    descentBtn.textContent = '🎁 Descenso (extra)';
    descentBtn.addEventListener('click', startDescentExtra);
    container.appendChild(descentBtn);
  }
  showOverlay("continue-levels-overlay");
}

function startUnlockedStoryLevel(levelIdx) {
  if (!Number.isInteger(levelIdx) || levelIdx < 0 || levelIdx >= getUnlockedStoryLevel()) return;
  if (levelIdx === 0) {
    openCharSelect("story");
    return;
  }
  const selectedDifficulty = diffIndex;
  const progress = readStoryProgress();
  const modeSlots = progress.slotsByDifficulty && progress.slotsByDifficulty[selectedDifficulty];
  const slotForMode = modeSlots && modeSlots[levelIdx];
  const legacySlot = progress.slots && progress.slots[levelIdx];
  const oldSave = getSavesList().find(save =>
    Number(save.levelIdx) === levelIdx && Number(save.diffIdx) === selectedDifficulty);
  const sameModeSlot = slotForMode || (
    legacySlot && Number(legacySlot.diffIdx) === selectedDifficulty ? legacySlot : null
  );
  if (sameModeSlot || oldSave) {
    // El desbloqueo es común, pero jamás cambia la dificultad del menú.
    loadSaveObject(sameModeSlot || oldSave, true);
  } else {
    // Al elegir una dificultad nueva, el nivel está desbloqueado, pero se
    // inicia con 0 puntos de esa dificultad (sin importar otros guardados).
    storyData.score = 0;
    storyData.maxHearts = DIFFICULTIES[selectedDifficulty].hearts;
    storyData.hearts = storyData.maxHearts;
    showOverlay(null);
    initStoryLevel(levelIdx, true);
  }
}

function continueAfterCheckpoint() {
  if (gameState !== "CHECKPOINT" || storyData.levelIdx >= LEVELS.length - 1) return;
  const nextLevelIdx = storyData.levelIdx + 1;
  showOverlay(null);
  initStoryLevel(nextLevelIdx, false);
}

async function saveCheckpointProgress() {
  if (gameState !== "CHECKPOINT" || storyData.levelIdx >= LEVELS.length - 1) return;
  const saves = getSavesList();
  saves.unshift({
    date: new Date().toLocaleString(), char: selectedCharacter,
    diffIdx: diffIndex, levelIdx: storyData.levelIdx + 1,
    score: storyData.score,
    hearts: DIFFICULTIES[diffIndex].hearts,
    maxHearts: DIFFICULTIES[diffIndex].hearts
  });
  try {
    await writeSavesList(saves);
    sound.playSFX("sfx_checkpoint");
    showOverlay("checkpoint-saved-overlay");
  } catch (e) {
    flagCloudWriteFailure(e);
  }
}

async function saveFinishedGameProgress() {
  if (gameState !== "SUMMIT" || !player.celebrating || storyData.levelIdx !== 4) return;
  const saves = getSavesList();
  saves.unshift({
    date: new Date().toLocaleString(), char: selectedCharacter,
    diffIdx: diffIndex, levelIdx: 4,
    score: storyData.levelStartScore, hearts: storyData.maxHearts,
    maxHearts: storyData.maxHearts
  });
  try {
    await writeSavesList(saves);
    sound.playSFX("sfx_checkpoint");
    alert("¡Partida guardada! Puedes repetir el nivel 5 desde Continuar partida.");
  } catch (e) {
    flagCloudWriteFailure(e);
  }
}

function replayLevelFive() {
  if (gameState !== "SUMMIT" || !player.celebrating || storyData.levelIdx !== 4) return;
  stopSummitCelebration();
  storyData.score = Number(storyData.levelStartScore) || 0;
  storyData.hearts = storyData.maxHearts;
  showOverlay(null);
  initStoryLevel(4, true);
}

function loadSaveObject(save, keepSelectedDifficulty = false) {
  selectedCharacter = save.char || selectedCharacter;
  // La lista «Continuar partida» utiliza la dificultad elegida en el menú;
  // «Cargar partida» sí puede restaurar la dificultad del guardado original.
  if (!keepSelectedDifficulty) diffIndex = save.diffIdx ?? 1;
  updateDiffLabel();
  storyData.levelIdx = save.levelIdx || 0;
  storyData.score = save.score || 0;
  // La vida máxima depende siempre de la dificultad elegida, no de una
  // captura antigua con corazones de otro nivel o dificultad.
  storyData.maxHearts = DIFFICULTIES[diffIndex].hearts;
  storyData.hearts = storyData.maxHearts;
  showOverlay(null);
  initStoryLevel(storyData.levelIdx, false);
}

function openSavedGames() {
  const container = document.getElementById("saves-list");
  const saves = getSavesList();
  const info=document.createElement('p');
  info.style.cssText='font-size:9px;line-height:1.6;margin:8px 0;color:#facc15';
  info.textContent='MÁXIMO 3 PARTIDAS GUARDADAS. AL GUARDAR UNA CUARTA SE REEMPLAZA LA MÁS ANTIGUA.';
  if (saves.length === 0) {
    container.innerHTML = "<p style='margin:15px 0; font-size:11px;'>No tienes partidas guardadas aún.</p>";
  } else {
    let html = "<table><thead><tr><th>FECHA</th><th>PERS.</th><th>NV</th><th>PTS</th><th>ACCIÓN</th></tr></thead><tbody>";
    saves.forEach((s, idx) => {
      html += `<tr>
        <td>${s.date}</td>
        <td>${s.char}</td>
        <td>NV ${s.levelIdx + 1}</td>
        <td>${s.score}</td>
        <td><button class="diff-btn" onclick="loadSaveByIndex(${idx})">CARGAR</button></td>
      </tr>`;
    });
    html += "</tbody></table>";
    container.innerHTML = html;
  }
  container.prepend(info);
  showOverlay("saves-overlay");
}

function loadSaveByIndex(idx) {
  const saves = getSavesList();
  if (saves[idx]) loadSaveObject(saves[idx]);
}

function openRanking() {
  rankingReturnToGameOver = false;
  showOverlay("ranking-overlay");
  showApusRankingTab('iliniza');
}

function openFinishRanking() {
  if (!summitCelebrationActive || !player.celebrating) return;
  openRanking();
  rankingReturnToGameOver = true;
}

function returnFromRanking() {
  if (rankingReturnToGameOver && (summitCelebrationActive || gameState === "SUMMIT")) {
    rankingReturnToGameOver = false;
    showOverlay("gameover-overlay");
  } else {
    rankingReturnToGameOver = false;
    showOverlay("menu-overlay");
  }
}

// La clasificación es única y pública: una entrada por UID y su mejor puntaje.
// No usa localStorage, datos de ejemplo ni una tabla separada por dispositivo.
let apusRankingView='iliniza';
function showApusRankingTab(which){
  apusRankingView = which==='friki' ? 'friki' : which==='4x4' ? '4x4' : 'iliniza';
  const friki=apusRankingView==='friki', fourx4=apusRankingView==='4x4';
  const title=document.getElementById('ranking-title');
  const head=document.getElementById('ranking-head-row');
  if(title)title.textContent=fourx4?'🚜 RANKING GLOBAL APUS 4x4':friki?'📚 RANKING GLOBAL FRIKI APUS':'🏆 RANKING GLOBAL ILINIZA SUR';
  if(head)head.innerHTML=fourx4?'<th>#</th><th>JUGADOR</th><th>MEJOR TIEMPO</th><th>A BORDO</th>':friki?'<th>#</th><th>JUGADOR</th><th>PTS TOTALES</th>':'<th>#</th><th>JUGADOR</th><th>PERS.</th><th>DIF.</th><th>PTS</th>';
  const personal=document.getElementById('friki-ranking-my-score');
  if(personal)personal.style.display=friki?'block':'none';
  const my4=document.getElementById('ranking-4x4-my-time');
  if(my4)my4.style.display=fourx4?'block':'none';
  const routes=document.getElementById('ranking-4x4-routes');
  if(routes)routes.style.display=fourx4?'flex':'none';
  for(const [id,active] of [['tab-ranking-iliniza',!friki&&!fourx4],['tab-ranking-friki',friki],['tab-ranking-4x4',fourx4]]){
    const b=document.getElementById(id);if(b)b.style.opacity=active?'1':'.65';
  }
  if(fourx4){updateApus4x4RouteButtons();return loadApus4x4Ranking();}
  if(friki)return loadFrikiRanking();
  return switchRankingTab();
}

const APUS_4X4_GLOBAL_COLLECTIONS={short:'apus4x4ShortRankings',long:'apus4x4LongRankings'};
let apus4x4RankingRoute='short';
let apus4x4RankingRequest=0;
function apus4x4FormatTime(ms){
  ms=Math.max(0,Math.round(Number(ms)||0));
  const totalSeconds=Math.floor(ms/1000);
  const minutes=Math.floor(totalSeconds/60);
  return `${String(minutes).padStart(2,'0')}:${String(totalSeconds%60).padStart(2,'0')}.${String(Math.floor((ms%1000)/10)).padStart(2,'0')}`;
}
function updateApus4x4RouteButtons(){
  const short=document.getElementById('ranking-4x4-short'),long=document.getElementById('ranking-4x4-long');
  if(short)short.style.opacity=apus4x4RankingRoute==='short'?'1':'.60';
  if(long)long.style.opacity=apus4x4RankingRoute==='long'?'1':'.60';
}
function selectApus4x4RankingRoute(route){
  apus4x4RankingRoute=route==='long'?'long':'short';
  updateApus4x4RouteButtons();
  if(apusRankingView==='4x4')return loadApus4x4Ranking();
}
async function loadApus4x4Ranking(){
  const request=++apus4x4RankingRequest;
  const route=apus4x4RankingRoute;
  const collection=APUS_4X4_GLOBAL_COLLECTIONS[route];
  const status=document.getElementById('ranking-status-msg');
  const tbody=document.getElementById('ranking-tbody');
  const personal=document.getElementById('ranking-4x4-my-time');
  if(status)status.textContent='🌍 CONSULTANDO MEJORES TIEMPOS GLOBALES...';
  if(tbody)tbody.replaceChildren();
  if(personal)personal.textContent=currentUser?.uid?'⏱ Consultando tu récord...':'Inicia sesión para registrar tus tiempos en el ranking global.';
  if(!cloudAvailable()){
    if(status)status.textContent='⚠️ Se necesita conexión a Firebase para consultar el ranking global de Apus 4x4.';
    return;
  }
  try{
    const snapshot=await apusFirebaseDb.collection(collection).orderBy('timeMs','asc').limit(100).get();
    if(apusRankingView!=='4x4'||route!==apus4x4RankingRoute||request!==apus4x4RankingRequest)return;
    const rows=snapshot.docs.map(d=>d.data()).filter(d=>Number.isFinite(Number(d.timeMs))&&Number(d.timeMs)>0);
    if(tbody)tbody.innerHTML=rows.map((entry,i)=>{
      const me=currentUser?.uid&&entry.uid===currentUser.uid;
      const aboard=Number(entry.aboard);
      return `<tr style="${me?'background:rgba(247,147,30,.25);':''}"><td>${i+1}</td><td>${escapeRankingHTML(entry.name||'MONTAÑISTA')}${me?' ⭐':''}</td><td style="color:#facc15;white-space:nowrap">${apus4x4FormatTime(entry.timeMs)}</td><td>${Number.isInteger(aboard)?Math.max(0,Math.min(6,aboard))+'/6':'—'}</td></tr>`;
    }).join('');
    if(status)status.textContent=rows.length
      ?`🌍 ${rows.length} JUGADOR${rows.length===1?'':'ES'} · ${route==='short'?'RUTA CORTA 3.000 m':'EXPEDICIÓN COMPLETA 7.500 m'} · GANA EL MENOR TIEMPO.`
      :'🌍 TODAVÍA NO HAY TIEMPOS PARA ESTA RUTA. ¡SÉ EL PRIMERO!';
    if(personal&&currentUser?.uid){
      let mine=rows.find(d=>d.uid===currentUser.uid);
      if(!mine){
        const ownSnap=await apusFirebaseDb.collection(collection).doc(currentUser.uid).get();
        if(apusRankingView!=='4x4'||route!==apus4x4RankingRoute||request!==apus4x4RankingRequest)return;
        mine=ownSnap.exists?ownSnap.data():null;
      }
      personal.textContent=mine?'🏅 Tu mejor tiempo: '+apus4x4FormatTime(mine.timeMs):'Todavía no has completado esta ruta con tu cuenta.';
    }
  }catch(err){
    console.warn('Apus 4x4: consulta de ranking global:',err);
    if(apusRankingView==='4x4'&&route===apus4x4RankingRoute&&request===apus4x4RankingRequest&&status)
      status.textContent='⚠️ No se pudo leer el ranking 4x4. Revisa la conexión y los permisos de Firestore.';
    if(personal&&request===apus4x4RankingRequest)personal.textContent='No fue posible consultar tu récord.';
  }
}
function apus4x4ReplyFinish(ok,message,bestTimeMs){
  const frame=document.getElementById('apus-4x4-frame');
  if(frame&&frame.contentWindow)frame.contentWindow.postMessage({apus4x4:'SCORE_RESULT',ok:!!ok,message,bestTimeMs},'*');
}
async function saveApus4x4GlobalFinish(data){
  const routeMeters=Number(data.routeMeters), timeMs=Math.round(Number(data.timeMs));
  const aboard=Number(data.aboard),score=Number(data.score);
  const route=routeMeters===3000?'short':routeMeters===7500?'long':null;
  if(!route||!Number.isFinite(timeMs)||timeMs<1000||timeMs>3600000||
     !Number.isInteger(aboard)||aboard<0||aboard>6||!Number.isFinite(score)||score<0){
    apus4x4ReplyFinish(false,'Tiempo de partida inválido.');return;
  }
  if(!currentUser?.uid){
    apus4x4ReplyFinish(false,'Inicia sesión con tu cuenta antes de jugar para registrar un récord global.');return;
  }
  if(!cloudAvailable()){
    apus4x4ReplyFinish(false,'Sin conexión a Firebase: este tiempo no se registró en el ranking global.');return;
  }
  const uid=currentUser.uid, name=currentUser.username;
  const record={uid,name:String(name||'MONTAÑISTA').slice(0,24),route,
    timeMs,aboard,score:Math.max(0,Math.floor(score)),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  try{
    const docRef=apusFirebaseDb.collection(APUS_4X4_GLOBAL_COLLECTIONS[route]).doc(uid);
    const result=await apusFirebaseDb.runTransaction(async tx=>{
      const snapshot=await tx.get(docRef),old=snapshot.exists?snapshot.data():null;
      const oldMs=Number(old?.timeMs);
      if(old&&Number.isFinite(oldMs)&&oldMs<=timeMs)return {improved:false,best:oldMs};
      tx.set(docRef,record);
      return {improved:true,best:timeMs};
    });
    apus4x4ReplyFinish(true,result.improved?'✅ ¡Nuevo récord global! '+apus4x4FormatTime(result.best):
      '✅ Partida completada. Tu mejor tiempo global sigue siendo '+apus4x4FormatTime(result.best),result.best);
    if(apusRankingView==='4x4'&&apus4x4RankingRoute===route)loadApus4x4Ranking();
  }catch(error){
    console.warn('Apus 4x4: no pudo publicar el récord global:',error);
    apus4x4ReplyFinish(false,'No se pudo publicar el tiempo. Revisa Internet y las reglas de Firestore.');
  }
}
async function loadFrikiRanking(){
  const status=document.getElementById('ranking-status-msg'),tbody=document.getElementById('ranking-tbody');
  if(status)status.textContent='🌐 CONSULTANDO RANKING FRIKI APUS...';
  if(tbody)tbody.replaceChildren();
  if(!cloudAvailable()){
    if(status)status.textContent='⚠️ Se necesita internet y Firebase para consultar el ranking.';
    const personal=document.getElementById('friki-ranking-my-score');
    if(personal)personal.textContent='Sin conexión: no se puede confirmar el total de puntos en la nube.';
    return;
  }
  try{
    // Upload sessions that failed previously before reading the official ranking.
    if(currentUser?.uid)await syncPendingFrikiScores(false);
    const snapshot=await apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).orderBy('score','desc').limit(100).get();
    if(apusRankingView!=='friki')return;
    const rows=snapshot.docs.map(doc=>doc.data());
    if(tbody)tbody.innerHTML=rows.map((p,i)=>{
      const me=currentUser?.uid&&p.uid===currentUser.uid;
      return `<tr style="${me?'background:rgba(247,147,30,.25)':''}"><td>${i+1}</td><td>${escapeRankingHTML(p.name)}${me?' ⭐':''}</td><td style="color:#facc15">${Math.max(0,Number(p.score)||0)}</td></tr>`;
    }).join('');
    if(status)status.textContent=rows.length?`🌍 ${rows.length} JUGADOR${rows.length===1?'':'ES'} · PUNTOS ACUMULADOS EN FRIKI APUS.`:'🌍 AÚN NO HAY PUNTAJES EN FRIKI APUS.';
    const my=document.getElementById('friki-ranking-my-score');
    if(my){
      if(!currentUser?.uid) my.textContent='Inicia sesión para consultar tu total de puntos.';
      else {
        const uid=currentUser.uid;
        const own=rows.find(p=>p.uid===uid);
        let score=own?Number(own.score)||0:0;
        if(!own){
          const ownSnap=await apusFirebaseDb.collection(APUS_FRIKI_RANKING_COLLECTION).doc(uid).get();
          if(ownSnap.exists)score=Number(ownSnap.data()?.score)||0;
        }
        const pending=frikiReadPending(uid).length;
        my.textContent=`⭐ Tu puntuación confirmada: ${Math.max(0,score).toLocaleString('es-EC')} puntos`+
          (pending?` · ⚠️ ${pending} partida(s) pendiente(s) de subir`:'');
      }
    }
  }catch(err){
    console.warn('Friki Apus ranking:',err);
    if(status)status.textContent='⚠️ No se pudo consultar. Comprueba internet y permisos de Firestore.';
  }
}
function refreshActiveApusRanking(){
  try{sound.playSFX('sfx_jump')}catch(e){}
  return apusRankingView==='4x4'?loadApus4x4Ranking():apusRankingView==='friki'?loadFrikiRanking():switchRankingTab();
}
async function switchRankingTab() {
  currentRankingTab = "world";
  const status = document.getElementById('ranking-status-msg');
  const tbody = document.getElementById('ranking-tbody');
  if (status) status.textContent = '🌎 CONSULTANDO EL RANKING GLOBAL...';
  if (!cloudAvailable()) {
    if (status) status.textContent = '⚠️ PARA VER EL RANKING GLOBAL SE NECESITA INTERNET Y FIREBASE.';
    renderRankingRows(tbody, []);
    return;
  }
  try {
    const snapshot = await apusFirebaseDb.collection(APUS_RANKING_COLLECTION)
      .orderBy('score', 'desc').get();
    const list = snapshot.docs.map(doc => doc.data());
    renderRankingRows(tbody, list);
    if (status) status.textContent = list.length
      ? `🌎 ${list.length} JUGADOR${list.length === 1 ? '' : 'ES'} · MEJOR PUNTAJE DE CADA CUENTA.`
      : '🌎 TODAVÍA NO HAY PUNTAJES. ¡SÉ EL PRIMERO!';
  } catch (error) {
    console.warn('No se pudo consultar el ranking global:', error);
    if (status) status.textContent = '⚠️ NO SE PUDO CONSULTAR EL RANKING. REVISA TU CONEXIÓN.';
    renderRankingRows(tbody, []);
  }
}
function escapeRankingHTML(value) {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderRankingRows(tbody,list) {
  if(!tbody)return;
  tbody.innerHTML=list.map((r,i)=>{
    const isMe=currentUser?.uid && r.uid===currentUser.uid;
    return `<tr style="${isMe?'background:rgba(247,147,30,.25);':''}">
      <td>${i+1}</td><td>${escapeRankingHTML(r.name)} ${isMe?'⭐':''}</td>
      <td>${escapeRankingHTML(r.char)}</td><td>${escapeRankingHTML(r.diff)}</td>
      <td style="color:#facc15;">${Number(r.score)||0}</td></tr>`;
  }).join('');
}
async function refreshWorldRanking() {
  sound.playSFX('sfx_jump');await switchRankingTab();
}
async function publishSignedInScore(entry) {
  if(!currentUser?.uid || !cloudAvailable()) throw new Error('Sin cuenta online');
  const uid=currentUser.uid;
  const clean={uid,name:currentUser.username,
    char:String(entry.char).slice(0,20),diff:String(entry.diff).slice(0,40),
    score:Math.max(0,Math.floor(Number(entry.score)||0))};
  cloudProfile.scores=Array.isArray(cloudProfile.scores)?cloudProfile.scores:[];
  cloudProfile.scores.push({...clean,at:new Date().toISOString()});
  cloudProfile.scores=cloudProfile.scores.slice(-30);
  await cloudCommitProfile();
  const ref=apusFirebaseDb.collection(APUS_RANKING_COLLECTION).doc(uid);
  const old=await ref.get();
  if(!old.exists || (Number(old.data().score)||0) < clean.score) {
    await ref.set({...clean,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  }
}
let defeatScoreSavedAutomatically=false;
function saveSignedInDefeatScoreOnce() {
  if(defeatScoreSavedAutomatically||!currentUser?.uid)return;
  defeatScoreSavedAutomatically=true;
  const entry={name:currentUser.username,char:selectedCharacter,
    diff:DIFFICULTIES[diffIndex].name,score:storyData.score};
  publishSignedInScore(entry).catch(flagCloudWriteFailure);
}
function retryDefeatedStoryLevel() {
  if(gameState!=='SUMMIT'||player.celebrating)return;
  stopSummitCelebration();storyData.score=Math.max(0,Number(storyData.levelStartScore)||0);
  storyData.hearts=DIFFICULTIES[diffIndex].hearts;
  showOverlay(null);initStoryLevel(storyData.levelIdx,true);
}
function openDefeatRanking() {
  if(gameState!=='SUMMIT'||player.celebrating)return;
  openRanking();rankingReturnToGameOver=true;
}
function prepareGameOverModal() {
  const defeated=!player.celebrating;
  const loggedIn=!!currentUser?.uid;
  const defeatMessage=document.getElementById('end-defeat-message');
  if(defeatMessage)defeatMessage.style.display=defeated?'block':'none';
  const finishActions=document.getElementById('summit-finish-actions');
  if(finishActions)finishActions.style.display=!defeated&&storyData.levelIdx===LEVELS.length-1?'block':'none';
  const defeatActions=document.getElementById('end-defeat-actions');
  if(defeatActions)defeatActions.style.display=defeated?'block':'none';
  const saveBtn=document.getElementById('end-submit-score-btn');
  const signInBtn=document.getElementById('end-signin-btn');
  const mainMenuBtn=document.getElementById('end-mainmenu-btn');
  const nameInput=document.getElementById('player-name-input');
  const statusEl=document.getElementById('end-account-status');
  if(saveBtn)saveBtn.style.display=defeated?'none':'block';
  if(signInBtn)signInBtn.style.display=!loggedIn?'block':'none';
  if(mainMenuBtn)mainMenuBtn.style.display=defeated?'none':'block';
  if(nameInput){nameInput.value=loggedIn?currentUser.username:'';
    nameInput.readOnly=loggedIn;nameInput.style.display=defeated||loggedIn?'none':'block';}
  if(statusEl){statusEl.style.color=loggedIn?'#22c55e':'#facc15';
    statusEl.textContent=loggedIn
     ? `✅ ${currentUser.username} · ${defeated?'GUARDANDO PUNTAJE EN LA NUBE':'CUENTA ONLINE'}`
     : '⚠️ INICIA SESIÓN PARA GUARDAR Y CONSULTAR TU RANKING.';}
  if(defeated&&loggedIn)saveSignedInDefeatScoreOnce();
}
async function submitScore() {
  const input=document.getElementById('player-name-input');
  const name=(currentUser?.uid?currentUser.username:(input.value||'MONTANISTA')).toUpperCase().trim();
  const entry={name,char:selectedCharacter,diff:DIFFICULTIES[diffIndex].name,score:storyData.score};
  if(!currentUser?.uid){
    openAuthModalFromGameOver();
    return;
  }
  try {
    await publishSignedInScore(entry);
    openRanking();
  } catch(e){ flagCloudWriteFailure(e); return; }
  if(summitCelebrationActive&&player.celebrating)rankingReturnToGameOver=true;
}

/* ============================================================================
   MENSAJE DE DESPEDIDA EDITABLE — BOTÓN «SALIR DEL JUEGO»
   Cambia o agrega frases entre comillas dentro de EXIT_FAREWELL_LINES.
   Cada elemento del arreglo aparece como una línea distinta en la animación.
   Ejemplo: "¡NOS VEMOS EN LA PRÓXIMA AVENTURA!",
   ============================================================================ */
const EXIT_FAREWELL_LINES = [
  "¡GRACIAS POR JUGAR!",
  "APUS' GUARDIANS - RETO ILINIZA SUR"
];

function exitGame() {
  // Reutiliza los mismos dibujos/animación de la introducción; no intenta
  // cerrar la pestaña (los navegadores no lo permiten de forma general).
  sound.stopBGM();
  introTimer = 0;
  introTapCount = 0;
  introLastTapAt = 0;
  exitCinematicActive = true;
  introActive = true;
  gameState = "INTRO";
  showOverlay(null);
  updateTouchControlsVisibility();
  initSnowParticles();
}

function toggleSound() {
  sound.enabled = !sound.enabled;
  const btn = document.getElementById("btn-sound");
  const setBtn = document.getElementById("settings-sound-btn");
  if (!sound.enabled) {
    sound.stopBGM();
    if (btn) btn.textContent = "🔇 OFF";
    if (setBtn) setBtn.textContent = "🔇 SONIDO: DESACTIVADO";
  } else {
    sound.initContext();
    if (btn) btn.textContent = "🔊 ON";
    if (setBtn) setBtn.textContent = "🔊 SONIDO: ACTIVADO";
    if (gameState === "MENU" || gameState === "INTRO") sound.playBGM("bgm_menu");
    else if (gameState === "MINIGAME") sound.playBGM("bgm_versus");
    else if (gameState === "STORY") {
      const lvl = LEVELS[storyData.levelIdx];
      sound.playBGM(lvl.storm ? "bgm_storm" : "bgm_climb");
    }
  }
  sendApusBingoSound();
  sendFrikiSound();
  sendApus4x4Sound();
}

function toggleTouchUI() {
  forceTouchUI = !forceTouchUI;
  const btn = document.getElementById("settings-touch-btn");
  if (btn) btn.textContent = `📱 CONTROLES TÁCTILES: ${forceTouchUI ? "ACTIVADOS" : "OCULTOS"}`;
  updateTouchControlsVisibility();
}

function updateTouchControlsVisibility() {
  const tc = document.getElementById("touch-controls");
  const activePlay = (gameState === "STORY" || (gameState === "MINIGAME" && !tournament?.cpuAutoplay));
  if (tc) {
    tc.classList.toggle("story-ascent-ui", gameState === "STORY");
    if (activePlay && forceTouchUI) {
      tc.classList.add("active");
      const sb = document.getElementById("story-buttons");
      const fb = document.getElementById("fight-buttons");
      if (sb) sb.style.display = gameState === "STORY" ? "grid" : "none";
      if (fb) fb.style.display = gameState === "MINIGAME" ? "grid" : "none";
    } else {
      tc.classList.remove("active");
    }
  }
}

document.getElementById("btn-sound").addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSound();
});

/* V30.2: Configuración funciona como una pantalla de retroceso.
   Se guarda el modo y la pantalla reales ANTES de pausar. Nunca se deduce
   el tipo de partida a partir de pendingMode, personajes ni corazones. */
let apusSettingsReturnContext = null;

function openApusSettings() {
  if (document.getElementById("settings-overlay")?.classList.contains("active")) return;
  const priorOverlay = document.querySelector(".overlay.active");
  const originalState = gameState;
  apusSettingsReturnContext = {
    gameState: originalState,
    overlayId: priorOverlay && priorOverlay.id !== "settings-overlay" ? priorOverlay.id : null
  };
  sound.initContext();
  const storySaveBtn = document.getElementById("settings-story-save-btn");
  if (storySaveBtn) storySaveBtn.style.display = originalState === "STORY" ? "" : "none";
  // Las partidas del ascenso y del combate quedan pausadas, no reiniciadas.
  // En online la pausa afecta solo a este dispositivo, nunca reinicia la sala.
  if (originalState === "STORY" || originalState === "MINIGAME" ||
      originalState === "TOURNAMENT_WATCH") {
    gameState = "PAUSED";
  }
  showOverlay("settings-overlay");
  if (tournament) tourUpdateHud();
  updateTouchControlsVisibility();
}

document.getElementById("btn-settings").addEventListener("click", (e) => {
  e.stopPropagation();
  openApusSettings();
});

function resumeFromSettings() {
  const previous = apusSettingsReturnContext;
  apusSettingsReturnContext = null;
  if (!previous) {
    // Configuración abierta sin una partida previa: volver al menú, no empezar.
    gameState = "MENU";
    showOverlay("menu-overlay");
  } else {
    // Recuperar exactamente el modo donde se pulsó CONFIG.
    gameState = previous.gameState;
    const destination = previous.overlayId &&
      document.getElementById(previous.overlayId) ? previous.overlayId : null;
    if (destination) showOverlay(destination);
    else if (gameState === "MENU") showOverlay("menu-overlay");
    else showOverlay(null);
  }
  updateTouchControlsVisibility();
  if (tournament) tourUpdateHud();
  if (gameState === "MINIGAME") updateVersusResultActions();
  // Si se activó el audio durante la pausa, recuperar la música del modo actual.
  if (sound.enabled && !sound.bgmInterval) {
    if (gameState === "MINIGAME" || gameState === "TOURNAMENT_WATCH") sound.playBGM("bgm_versus");
    else if (gameState === "STORY") {
      const level = LEVELS[storyData.levelIdx];
      sound.playBGM(level?.storm ? "bgm_storm" : "bgm_climb");
    } else if (gameState === "MENU") sound.playBGM("bgm_menu");
  }
}

function returnToMainMenu() {
  apusSettingsReturnContext = null;
  if (tournament) tourLeave(true);
  if (descentExtraActive) closeDescentExtra();
  cleanupPeerConnection();
  gameState = "MENU";
  updateTouchControlsVisibility();
  showOverlay("menu-overlay");
  sound.playBGM("bgm_menu");
}

