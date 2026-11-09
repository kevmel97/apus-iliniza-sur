# Apus Iliniza Sur — versión 31 modular

Esta versión conserva la jugabilidad de **v30.2** y reorganiza el proyecto en archivos. No cambia los IDs de colecciones de Firestore, los nombres de cuenta ni el protocolo de `postMessage` entre minijuegos.

## Publicar en GitHub Pages

1. Descarga el ZIP y **extrae su contenido**.
2. Abre tu repositorio `apus-iliniza-sur` en GitHub.
3. Sube **todos** los archivos y carpetas manteniendo esta estructura, incluidos `index.html`, `css/`, `js/`, `minijuegos/`, `assets/`, `manifest.json` y `sw.js`.
4. Reemplaza el antiguo `index.html`. Si GitHub no permite subir carpetas directamente, arrastra **todos los archivos y carpetas** extraídos juntos al cargador o usa GitHub Desktop / git para enviar el contenido.
5. Espera a que GitHub Pages publique y abre la URL de siempre. Recarga una vez para obtener la v31.
6. Prueba inicio de sesión, ascenso, Chugo vs Jordy (1v1 y torneo), Friki Apus y su puntaje, Bingo, Apus 4x4 y los rankings globales.

**Importante:** No subas solamente `index.html`: a partir de ahora depende de los archivos externos. Tampoco subas el ZIP como sustituto.

## Organización

- `index.html` — Interfaz y menú de entrada.
- `css/estilos.css` — Estilos del menú, pantallas y controles.
- `js/puentes-minijuegos.js` — Apertura/cierre de los iframes, sonido y comunicación con rankings.
- `js/juego-principal.js`, `js/conexion-y-ascenso.js` — Sistemas del ascenso, menú, cuentas, Firebase y conexión.
- `js/chugo-vs-jordy.js` — Motor visual y de lucha del minijuego.
- `js/torneos.js` — Torneos y observación online.
- `js/cinematicas-y-bucle.js`, `js/inicio.js` — Cinemáticas y bucle principal.
- `js/actualizaciones-v30.js` — Compatibilidad de escenarios y rankings de la v30.x.
- `minijuegos/` — HTML independiente para Friki Apus, Apus 4x4, Bingo y las animaciones de cumbre/descenso.
- `assets/escenarios/` — Imágenes y miniaturas extraídas **sin recomprimir ni reducir resolución**.
- `manifest.json`, `sw.js` — Base PWA y caché de contenido local para uso offline.

## Offline y APK

En HTTPS (GitHub Pages), `sw.js` intenta almacenar los archivos locales tras la primera visita. La descarga debe completarse antes de desconectarse. El ranking, la autenticación online, las salas y torneos por internet siguen necesitando conexión; PeerJS y fuentes de terceros no se precargan.

Para una APK con Capacitor se podrá empaquetar este mismo árbol como recursos locales. El Service Worker no sustituye la instalación de la APK ni actualiza automáticamente el código nativo. Un sistema de actualización de contenido deberá implementarse aparte.

## Agregar contenido

Para un nuevo minijuego crea otro `minijuegos/mi-juego.html` y agrega su entrada en el menú y mensajes correspondientes en `js/puentes-minijuegos.js`. Para paisajes nuevos coloca imágenes dentro de `assets/escenarios/` y referencia sus rutas en el JS. No vuelvas a convertir los HTML o imágenes a Base64 para integrarlos en `index.html`.

Si actualizas archivos offline, cambia `APUS_CACHE_VERSION` en `sw.js` a un valor nuevo. No sobrescribas el caché antiguo sin cambiar la versión.

## Historial

Base: archivo `Apus_Iliniza_Sur_v30_2.html`. En la v31 solamente se reorganizaron archivos, se sustituyeron las fuentes `srcdoc` por rutas locales y se añadió el caché offline. La conexión real a Firebase y los modos multijugador deben validarse con cuentas/dispositivos reales.
