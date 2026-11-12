# Apus Iliniza Sur — Audio por segmentos v31.5.0

**Partimos de la v31.4.1 con videos horizontal/vertical y actualizador OTA ya corregido.**

## Importante

Este ZIP **sustituye al parche anterior v31.5.0**, que no incluía Mountain Pass. Usa solo este parche completo si todavía no has publicado 31.5.0. Si ya instalaste 31.5.0 por OTA, no vuelvas a publicar la misma versión: habría que incrementar a 31.5.1.

## Cambios

- Corrige el destello del menú entre el video y el splash original. La animación "TOCAR DOS VECES PARA ENTRAR" permanece hasta el doble toque (sin temporizador que la salte).
- En la introducción, la pista extraída del video original está activada por defecto. El botón pasa a **SILENCIAR**; en navegadores que bloquean autoplay con sonido puede pedir **ACTIVAR AUDIO** tras un toque.
- Música del menú: `The Great Ascent`.
- Ascenso, niveles 1–5 y cumbre: `Cold Iron Ascent`.
- Combates y torneos Chugo vs Jordy: `Boss Rush`.
- Friki Apus: `Waltz of the Andean Ridge`.
- Bingo Camping: `Lucky Number Bounce`.
- Apus 4x4: **Mountain Pass Derby**; se reproduce en bucle únicamente durante ese minijuego. Los efectos del tractor y del terreno permanecen separados del volumen musical.
- El MIDI de fondo anterior no se reproduce; los efectos de salto, piolet, golpes, cerveza, bingo, etc. siguen funcionando.
- Nuevo panel de audio: efectos sí/no, música sí/no, silenciar todo, volumen independiente para ambos. Preferencias guardadas localmente.

## APK Android existente, sin recompilar

1. Descomprime `Parche_Musica_Apus_v31_5_0_COMPLETO.zip`.
2. En Terminal, entra a la carpeta extraída y ejecuta:
   `bash INSTALAR_AUDIO_APUS_EN_MAC.sh`
3. El script conserva respaldos, modifica el proyecto Android en Descargas y produce un paquete OTA con firma.
4. En GitHub Desktop copia del proyecto Android `publicar-en-github/actualizaciones/android/apus-31-5-0.zip` y `latest.json` a la carpeta homónima del repositorio.
5. `Commit to main` y `Push origin`; abre la APK, instala la actualización y prueba con sonido en el Samsung.

La descarga incluye seis canciones largas y puede ser de decenas de MB: mejor utilizar Wi-Fi. El sistema OTA no debe modificar Firebase, cuentas, ranking ni partidas.

## Publicar también la versión web en GitHub Pages

Para actualizar la web, puedes descomprimir `Apus_Iliniza_Sur_v31_5_0_Web_Modular.zip` y copiar su contenido completo en tu repositorio, o, **si tu web ya está en v31.4.1**, ejecutar desde esta carpeta de parche:

`bash ACTUALIZAR_AUDIO_WEB_GITHUB_EN_MAC.sh "/ruta/al/repositorio/apus-iliniza-sur"`

El segundo método cambia solo archivos necesarios y crea respaldo. Verifica cambios en GitHub Desktop antes de subir.

## Seguridad y compatibilidad

- Se reutiliza el sistema OTA instalado. No requiere clave `.jks` nueva ni APK de reemplazo.
- Los seis MP3 se guardan como recursos independientes `assets/musica/`, sin reducir su calidad.
- Los cambios se centran en presentación, audio y sistema de navegación de intro; mantiene el código de Firebase y salas PeerJS.
- Verificado: sintaxis JS y estructura de archivos. **Falta probar la instalación OTA real y reproducción en tu Samsung.**
