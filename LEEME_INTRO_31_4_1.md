# Apus Iliniza Sur 31.4.1 — doble vídeo + música compartida

Este parche parte de la versión **31.4.0** de la intro. No cambia partidas,
Firebase, rankings, controles ni la pantalla original de doble toque.

## Qué cambia

- En **vertical** se usa `assets/intro/reto-iliniza-sur-vertical.mp4` (720 × 1280, vídeo enviado por el creador).
- En **horizontal** se usa `assets/intro/reto-iliniza-sur.mp4` (1280 × 720, vídeo horizontal anterior).
- La **única música** es `assets/intro/musica-intro.m4a`, extraída del vídeo horizontal original. Ambos MP4 van sin pista de audio para impedir música duplicada. Pulsa **ACTIVAR AUDIO** cuando lo solicite el dispositivo.
- Si giras el móvil a mitad de la intro, cambia de vídeo conservando el segundo aproximado de reproducción y la misma pista de música.
- El logo APUS GUARDIANS sobre fondo negro se muestra **ligeramente más pequeño**; su animación mantiene la duración anterior.
- Al terminar sigue apareciendo el splash original **«TOCAR DOS VECES PARA ENTRAR»**.
- La intro empieza **después de verificar las actualizaciones OTA**, igual que la versión 31.4.0.

## Publicar en Android por OTA (sin generar otra APK)

1. Descomprime este ZIP.
2. En Terminal escribe `cd ` y arrastra la carpeta descomprimida. Presiona Enter.
3. Ejecuta:

   ```bash
   bash INSTALAR_INTRO_DOS_VIDEOS_EN_MAC.sh
   ```

4. El comando modifica solo la intro dentro de `~/Downloads/Apus_Iliniza_Sur_v31_Android_Capacitor/www/`, crea un respaldo local, y ejecuta tu **script de publicación firmado existente**.
5. Tras ver los mensajes OK, abre en Finder:

   `~/Downloads/Apus_Iliniza_Sur_v31_Android_Capacitor/publicar-en-github/actualizaciones/android/`

6. Copia **solo** `apus-31-4-1.zip` y `latest.json` a `actualizaciones/android/` de tu repositorio clonado. Sustituye el `latest.json` anterior.
7. En GitHub Desktop, Summary: `Apus Iliniza Sur v31.4.1 - Doble video y musica unica`; pulsa **Commit to main** y **Push origin**.
8. Espera a que se publique GitHub Pages. Abre la APK en tu Samsung, instala la actualización, y prueba vertical y horizontal. No necesitas otra APK.

**Nota:** Si la carpeta del proyecto Android tiene otro nombre o ruta, puedes pasarla como argumento al script:
`bash INSTALAR_INTRO_DOS_VIDEOS_EN_MAC.sh "/ruta/a/tu/proyecto"`.

## Publicar también en GitHub Pages (versión web)

Si quieres que la web tenga esta intro en ambos formatos, ejecuta desde la carpeta de este parche:

```bash
bash ACTUALIZAR_WEB_GITHUB_EN_MAC.sh "/ruta/a/tu/repositorio/clonado/apus-iliniza-sur"
```

Si tu repositorio está en `~/Documents/GitHub/apus-iliniza-sur`, puedes omitir el argumento.
En GitHub Desktop revisa la lista de archivos, confirma y haz Push. No subas el ZIP completo como un solo archivo.

**Importante:** primero publicar el contenido web (si también lo quieres allí) no activa una OTA por sí solo; la OTA son **dos archivos distintos** en `actualizaciones/android/`.

## Cambiar solo el vídeo vertical más adelante

Sustituye el archivo:

`www/assets/intro/reto-iliniza-sur-vertical.mp4`

por uno nuevo con **exactamente el mismo nombre** (recomendado MP4 H.264, proporción 9:16). El actualizador seguirá eligiéndolo automáticamente al girar el teléfono. **No hace falta cambiar el audio**: la música común continuará en `musica-intro.m4a`. Publica una versión OTA nueva con número superior; evita modificar una versión firmada ya publicada.

El archivo `.jks` y las claves privadas OTA siguen siendo **exclusivos de tu Mac**. No están incluidos en este ZIP y nunca deben subirse a GitHub.

## Verificaciones realizadas

- Ambas pistas de vídeo conservan la duración de ~10 segundos.
- Los dos MP4 no incluyen audio; la música común se guarda como M4A independiente.
- Comprobación de sintaxis de JavaScript y service worker; pruebas automatizadas de orientación, continuidad de tiempo y finalización del splash.
- No fue posible ejecutar una prueba integral en Samsung desde este entorno: debes verificar la reproducción real en tu dispositivo.
