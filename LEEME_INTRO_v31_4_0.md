# APUS ILINIZA SUR — v31.4.0 (introducción animada)

## Qué integra

1. Espera a que termine la comprobación de actualizaciones obligatorias en la APK.
2. Logo original APUS GUARDIANS ADVENTURE sobre fondo negro: entrada suave, ligero pulso y desvanecimiento (2,35 s).
3. Video original suministrado por el creador de 1280×720 y 10 segundos, con su audio si el jugador pulsa el control de sonido. En celular muestra **el cuadro completo sin deformar**, y usa un ambiente difuminado alrededor. En los 2,55 segundos finales amplía gradualmente el encuadre para destacar el título **RETO ILINIZA SUR**.
4. Al acabar, regresa al splash animado **original** con Chugo, Jordy y **TOCAR DOS VECES PARA ENTRAR**, reiniciando su contador para que no se omita.

No modifica el ascenso, minijuegos, partidas, Firebase, rankings o jugabilidad. Se preserva el modo sin conexión porque los archivos multimedia van en el paquete web local.

## A) Instalar y preparar una OTA firmada para Android

**No necesitas crear una APK nueva.** El parche modifica solamente archivos web del proyecto Capacitor, que ya tiene el actualizador OTA en tu Samsung.

1. Descomprime este ZIP.
2. Abre Terminal. Escribe `cd ` y arrastra esta carpeta descomprimida a Terminal. Enter.
3. Ejecuta:

```bash
bash INSTALAR_Y_PREPARAR_OTA_EN_MAC.sh
```

El script usa el proyecto que ya tienes en `~/Downloads/Apus_Iliniza_Sur_v31_Android_Capacitor`. Si lo moviste, indica su ruta:

```bash
bash INSTALAR_Y_PREPARAR_OTA_EN_MAC.sh "/ruta/completa/al/proyecto"
```

Necesitarás la **misma clave OTA privada** guardada en tu Mac para firmar la actualización. El script verifica el ZIP final antes de entregarlo. Espera los mensajes OK.

4. En Finder, ve a la carpeta de tu proyecto: `publicar-en-github/actualizaciones/android/`.
5. **Copia solo** `apus-31-4-0.zip` y `latest.json` a `actualizaciones/android/` de tu repositorio `apus-iliniza-sur` clonado desde GitHub Desktop. No reemplaces el `index.html` web con el de Android.
6. En GitHub Desktop: **Summary** = `Intro animada Apus v31.4.0 · OTA Android`; después **Commit to main** y **Push origin**.
7. En tu Samsung: abre el juego con internet; cuando detecte 31.4.0, toca **Instalar actualización**. Cuando el paquete se active, verás la nueva introducción y luego el splash normal de doble toque. **No desinstales la APK**.

## B) Actualizar también GitHub Pages (opcional, pero recomendado)

Los dos juegos usan los mismos recursos. El nuevo archivo HTML no sustituye ni elimina cuentas o minijuegos. Para añadir la introducción a la web sin tocar las otras carpetas:

1. Desde Terminal, situado en la carpeta del parche, ejecuta:

```bash
bash ACTUALIZAR_GITHUB_WEB_EN_MAC.sh "$HOME/Documents/GitHub/apus-iliniza-sur"
```

Si tu repositorio está en otra carpeta, cambia esa ruta. Puedes encontrarlo desde GitHub Desktop → Repository → Show in Finder. El script requiere la carpeta clonada, no un ZIP ni la carpeta Android.

2. En GitHub Desktop aparecerán `index.html`, `sw.js` y **cinco archivos nuevos** (logo, video, fondo, CSS y JS). Haz **Commit to main** y **Push origin**.
3. La web compartirá la misma introducción. Su `sw.js` cachea el video local y soporta reproducción por rangos para jugar sin internet después de instalar los recursos.

## Sobre la adaptación vertical

La película original es horizontal (16:9). Ninguna técnica puede llenar una pantalla vertical y conservar **todo** el ancho sin franjas o recortes. Esta versión conserva toda la película en primer plano y llena el fondo con un fotograma ambiental difuminado. En los segundos finales amplía hasta 1,23× para hacer legible el título sin estirarlo; los elementos importantes quedan dentro del área visible.

## Pruebas y seguridad

- JavaScript y service worker: sintaxis comprobada.
- La actualización se empaquetó y verificó con **claves de prueba** en este entorno; **tu Mac debe firmar la OTA real con tu clave privada**, que nunca se comparte.
- ZIP OTA de la prueba: 22,9 MB (inferior al límite de carga de 25 MB por archivo en GitHub web).
- Se probó la secuencia de eventos OTA→logo→video→final→splash con un simulador de DOM; la apertura real en el Samsung debe verificarse allí.
- El navegador de pruebas de este entorno bloqueó páginas locales: no afirmamos haber reproducido el video dentro de un Samsung.

Conserva una copia del proyecto y tus claves OTA / APK originales. **No subas `.jks`, `.pem` privadas, `node_modules` ni `android` a un repositorio público.**
