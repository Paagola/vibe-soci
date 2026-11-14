# Créditos del diorama

## Código de terceros

| Qué | Dónde está aquí | De dónde sale | Autor | Licencia | Cambios |
| --- | --- | --- | --- | --- | --- |
| Kit Diorama v5.7.0: `stroked-toon.js`, `orbit.js` | `kit/` | https://github.com/sloemo01/diorama, `templates/`, commit `c790df5` (bajado el 14/11/2026) | Nehal Kanak / Sloemo01 | MIT (`kit/LICENSE`) | Ninguno; solo la cabecera con el aviso |
| Kit Diorama: `camera.js` | `kit/camera.js` | ídem | ídem | MIT | La configuración de cámara llega por parámetro (antes, una constante del módulo) |
| Kit Diorama: `poses.js` (extracto) | `kit/poses.js` | ídem | ídem | MIT | Solo `STAND`, `mixPose` y `walkPose`; `lerp` en línea |
| Kit Diorama: método y QA | `DESIGN.md`, capturas | `SKILL.md`, `templates/DESIGN.md`, `templates/qa/shoot.mjs` y `frames.mjs` | ídem | MIT | El arnés de QA se usó fuera del repo (no se copia) |
| three.js r170 (`three.module.min.js`) y los addons `OutlineEffect`, `OrbitControls`, `RoundedBoxGeometry`, `BufferGeometryUtils` | `src/web/publico/vendor/three/` | paquete npm `three@0.170.0` | three.js authors | MIT (`vendor/three/LICENSE`) | Ninguno |

## Modelos

Ninguno de internet (modo `authored-only`, decisión del usuario). Todo lo que se ve —la losa, los puestos, las
máquinas, la mascota, el material— está hecho a mano con primitivas de three.js en `decorado.js` y `mascota.js`.

La mascota sigue la de SOCIETY (`src/web/publico/img/mascota-movil.png` y la presentación del prototipo): casco blanco,
cara negra mate con dos ojos blancos verticales, sudadera azul #1033EF con la estrella amarilla, pantalón negro y
zapatillas blancas. El aro sobre la cabeza de la presentación se probó y se quitó: a escala de juguete se leía como el
ala de un sombrero negro.

## Tipografía

Los rótulos pintados (TE TOCA, estudio, la nube) usan Nunito si la página la ha cargado (OFL, ya servida desde
`/fuentes`); si no, la sans del sistema.
