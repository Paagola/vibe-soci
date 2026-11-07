# Contexto del proyecto para otra IA

Índice para entender `estudio-contenido` sin leerlo todo. Está actualizado al 2026-11-07. Las rutas son relativas a esta carpeta.

## Qué es, en un párrafo

Es un estudio local para crear posts y carruseles de Instagram para restaurantes a partir de una idea y fotos reales del plato. Forma parte de SOCIETY, un TFG con app Android y Angular. Tiene dos caminos:
1. **Generador antiguo (web).** El director creativo es Gemini y escribe un plan; Higgsfield genera la imagen entera, con el texto dentro. Sigue funcionando y no se toca.
2. **Arquitectura nueva (en pruebas).** La IA solo hace o retoca la fotografía, y un compositor propio (sharp, SVG y fontkit) pone el texto, las capas y la exportación a partir de una **intención de diseño**. Encima hay un sistema de conocimiento creativo adaptado de design-agent de LangChain.

**Reglas fijas:**
- **Fidelidad ESTRICTA del plato:** la IA no cambia ingredientes ni geometría.
- **Ningún dato del restaurante inventado.**
- **Ningún gasto sin autorización.**
- **Trabajo por fases:** cada fase se revisa antes de empezar la siguiente.

## Fases

| Fase | Estado | Documento clave |
|---|---|---|
| MVP (web, Gemini y Higgsfield) | Hecho (03–04/11) | `README.md`, `diseno/ARQUITECTURA.md` |
| Propuesta de la nueva arquitectura | Aprobada (06/11) | `diseno/propuesta-creativa/PROPUESTA.md` |
| F0 · Estabilización | Commit `f9910c2` y `87adaf2` | `diseno/ARQUITECTURA.md` §11 |
| F1 · Compositor por capas (DAK Burger) | Commit `4a57f81`, etiqueta `f1` | `diseno/f1/INFORME-F1.md` |
| F1.5 · Dirección de arte y carrusel de Etxebarri | Hecho, **sin confirmar** en git | `diseno/f1_5/INFORME-F1.5.md` |
| F2 · Director automático con el compositor | No empezada | Plan en `PROPUESTA.md` |

## Orden de lectura recomendado

1. `README.md`: qué hace, cómo se arranca, scripts y estructura.
2. `diseno/ARQUITECTURA.md`: arquitectura del MVP (puertos y adaptadores), modelo de datos, decisiones y pendientes conocidos (§11).
3. `diseno/propuesta-creativa/PROPUESTA.md`: rediseño completo y plan por fases (F0–F7).
4. `diseno/f1/INFORME-F1.md`: el compositor y los tres diseños de DAK. Valoración del usuario: «demasiado robóticos».
5. `diseno/f1_5/INVESTIGACION-DESIGN-AGENT.md`: qué se tomó de design-agent y qué no.
6. `diseno/f1_5/INFORME-F1.5.md`: estado actual, entregables, tests, costes, límites y riesgos.
7. `conocimiento/README.md`: cómo está organizado el criterio creativo.
8. `proyectos/etxebarri-gamba-carrusel/`: la producción de ejemplo, de principio a fin.

## Conocimiento creativo (F1.5)

- `conocimiento/oficios/`: `direccion-de-arte.md`, `fotografia-gastronomica.md`, `composicion-y-tipografia.md`, `texto-publicitario.md`, `revision-visual.md`.
- `conocimiento/principios.md`, `antipatrones.md`, `rubrica.md`.
- `conocimiento/referencias/`: fichas (Think Small, Powers of Ten, bodegones de Penn, tipos de madera, posts del usuario).
- `conocimiento/observaciones/estudio.json`: la valoración del usuario sobre la F1, guardada como criterio del estudio.
- `biblioteca/`: la guía del generador antiguo:
  - `principios.md`;
  - `analisis-posts.md`, el análisis de los 30 posts de referencia del usuario;
  - `ejemplos/`;
  - `referencias/` (miniaturas e `indice.json`).

## Marcas

- `marcas/asador-etxebarri/perfil.json` (perfil v2 con la fuente de cada dato) y `tokens.json`.
- `marcas/dak-burger/tokens.json` y `diseno/f1/marcas/dak-burger.json` (F1).
- `marcas/README.md`.
- Datos introducidos en la web: `datos/locales/<slug>/marca.json` (DAK, Etxebarri, Café Albor, Mesón de Cervantes).
- Ejemplos: `plantillas/marca.ejemplo.json`, `marca-cafe-albor.ejemplo.json`, `brief*.ejemplo.json`.

## Producción de ejemplo: carrusel «Y nada más» (Etxebarri)

En `proyectos/etxebarri-gamba-carrusel/`:
- `BRIEF.md`: objetivo y registro de afirmaciones (qué se puede decir y su fuente).
- `CONCEPTO.md`: idea, ideas descartadas, dirección de arte, narrativa y referencias.
- `PRODUCCION.md`: modelos de Higgsfield comparados, criterio de elección, prompts, recetas, coste (1,977 USD) y procedencia.
- `REVISION.md`: revisión con rúbrica por diapositiva y del conjunto, iteraciones y comparación con DAK.
- `PIE.txt`, `plan.json`, `intenciones/1-gamba.json` … `4-nada-mas.json`, `produccion/prompts/`, `produccion/recetas/`.

## Imágenes

**En git:**
- `proyectos/etxebarri-gamba-carrusel/img/`:
  - `carrusel.jpg`: las 4 diapositivas finales en fila;
  - `carrusel-movil.jpg`: las mismas a tamaño de móvil;
  - `comparativa-dak-etxebarri.jpg`: posts antiguos de DAK, F1 y F1.5.
- `diseno/f1/img/`: `hoja-disenos.jpg`, `comparativa-antes-despues.jpg`, `capas-a-tres.jpg`.
- `diseno/propuesta-creativa/img/`: láminas de la propuesta.
- **Referencias y fotos:** `biblioteca/referencias/post-*.jpg` (posts de referencia del usuario) y `plantillas/fotos/` (fotos reales de ejemplo, entre ellas `gamba-roja-de-palamos.png`, de 4043 × 2887).

**Fuera de git** (`datos/`; copiarlas aparte si la otra IA no tiene acceso al disco):
- **Carrusel final:** `datos/disenos/etxebarri-gamba-carrusel/final/` (01–04 en PNG a 1080 × 1440, JPG 3:4 y 4:5, y `pie.txt`).
- **Versiones del carrusel:** `datos/disenos/etxebarri-gamba-carrusel/<diapositiva>/vNNN/`. Cada una trae `diseno.png`, `diseno.svg` (editable), `diseno-trazos.svg`, `capas/`, `intencion.json`, `resuelto.json` y `exportadas/`. Las hojas de revisión están en `revision/{v1,v2,final}/`.
- **Diseños de la F1 (DAK):** `datos/disenos/f1/{a-tres,b-alzado,c-ventana}/...`.
- **Activos de Etxebarri:** `datos/locales/asador-etxebarri/activos/`. Cada activo trae su `activo.json` (procedencia y fidelidad), y los generados además `respuesta-api.json` y `fidelidad/hoja-*.jpg`:
  - `etx-real-gamba` (foto real);
  - `etx-brasa-campana` (foto de campaña);
  - `etx-real-grano-sal`;
  - las 6 generaciones de prueba.
- **Activos de DAK:** `datos/locales/dak-burger/activos/` (`dak-real-manhattan`, `dak-grok-torre`).
- **Posts del MVP:** `datos/piezas/2026-11-03-*/generadas/*.png`. Son 9 imágenes de pago, de 7 piezas: DAK, gamba, tostada y salmón.
- **Registro de gasto:** `datos/gasto/higgsfield.jsonl`.

## Código

- **Dominio** (`src/dominio/`): `modelos.ts` (pieza, marca, valoración), `reglas.ts`, `activos.ts`, `aprendizaje.ts`, `conocimiento.ts`, `marca/perfil.ts`, y en `diseno/` `intencion.ts`, `resuelto.ts`, `reticula.ts` y `operaciones.ts`.
- **Puertos** (`src/puertos/`): interfaces. **Adaptadores** (`src/adaptadores/`): `gemini`, `higgsfield`, `compositor` (resolutor, motor de texto, `CompositorSharp`), `ficheros`, `imagen`, `simulado`.
- **Casos de uso:** `src/aplicacion/` (uno por archivo; el compositor está en `diseno/componerDiseno.ts`).
- **Web:** `src/web/`.
- **Herramientas** (`src/herramientas/`): `prepararActivo.ts`, `f1.ts`, `generarActivo.ts`, `fidelidad.ts`, `combinarLuz.ts`, `extraerDetalle.ts`, `carrusel.ts`.
- **Tests:** `test/` (86 en total; `compositor.test.ts`, `compositor-f15.test.ts` y `conocimiento.test.ts` cubren lo nuevo).
- **Fuentes OFL:** `recursos/tipografias/catalogo.json`.

## No mandar

- `.env`: tiene las claves de Gemini y Higgsfield.
- `node_modules/`.
- `datos-simulado/`.
