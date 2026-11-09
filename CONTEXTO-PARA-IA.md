# Contexto del proyecto para otra IA

Actualizado el 09/11/2026. Las rutas son relativas a esta carpeta. **El estado vivo y comprobado está en [`diseno/f1_6/ESTADO.md`](diseno/f1_6/ESTADO.md): empieza por ahí.** Los informes de fase llevan la marca «Histórico» y ya no mandan.

## Qué es

Es un estudio local (Node 24, TypeScript, zod y sharp, con puertos y adaptadores) para crear posts y carruseles de Instagram para restaurantes. Forma parte de SOCIETY, un TFG con app Android y Angular.

**Objetivo:** el hostelero sube con prisa una foto del plato, el estudio hace una **foto nueva y profesional del mismo plato** y monta con ella un **post de nivel estudio** sobre una **referencia de Canva o Pinterest**. La referencia es obligatoria en las 5 primeras creaciones de cada local.

**Hay dos caminos:**
1. **Generador antiguo (web, MVP).** Gemini dirige e Higgsfield (API) genera la imagen entera, con el texto dentro. Hay que conservarlo.
2. **Vía nueva (F1–F1.6, en pruebas).** La IA hace solo la foto, sin texto, y un compositor propio (sharp, SVG y fontkit) pinta una **intención de diseño** escrita en JSON.
   - Hoy es una cadena de herramientas de línea de comandos que maneja una persona o una IA en conversación.
   - **No hay un flujo único:** la orden de punta a punta está pendiente de decidir la vía de generación (ESTADO.md §8).

## Reglas vigentes (09/11/2026)

- **Fidelidad FLEXIBLE** por defecto:
  - pueden cambiar la cámara, la luz, el fondo, la superficie, el encuadre y la colocación;
  - se conservan los elementos, su número, la anatomía, los ingredientes y la vajilla;
  - se descarta la imagen si añade algo;
  - ESTRICTA solo si el local lo pide.
- **Otra toma, no la foto subida mejorada:** la altura cambia más de 30°, o cambian al menos dos de lado (giro de 45° o más), distancia y altura (15° o más). Está en `src/dominio/fotoNueva.ts` → `esOtraToma`.
- **Referencia obligatoria** en las 5 primeras piezas del local.
  - Cuentan las piezas de la app y las hechas con herramientas (`pieza` en `proyectos/…/plan.json`).
  - De la referencia se toma el oficio, nunca los textos ni las marcas.
- **Datos del restaurante:** no se inventa ninguno. Una frase entra solo si consta en sus datos.
- **Gasto:**
  - Gemini solo en el tier gratuito, sin facturación;
  - Higgsfield por el MCP solo para pruebas autorizadas, con `get_cost` antes de cada petición, un tope por tarea y parada tras 2 fallos seguidos.
  - **Congelado (09/11):** ninguna pieza nueva y ninguna foto nueva sin autorización.
- **Trabajo por fases**, con revisión del usuario antes de seguir. Commits locales al cerrar cada paso, sin push.

## Fases

| Fase | Estado | Documento |
|---|---|---|
| MVP (web) | Hecho, en git | `README.md`, `diseno/ARQUITECTURA.md` |
| Propuesta de arquitectura (F0–F8) | Aprobada el 06/11; histórico | `diseno/propuesta-creativa/PROPUESTA.md` |
| F0 · estabilización | Commits `f9910c2` y `87adaf2` | `ARQUITECTURA.md` §11 |
| F1 · compositor | Etiqueta `f1` | `diseno/f1/INFORME-F1.md` (histórico) |
| F1.5 · dirección de arte | Etiqueta `f1_5` | `diseno/f1_5/INFORME-F1.5.md` (histórico) |
| F1.6 · referencia, foto nueva y 4 posts | Etiqueta `f1_6`, más los commits del 09/11 | `diseno/f1_6/ESTADO.md` (vivo); el resto de `diseno/f1_6/` es histórico |
| Siguiente: la orden única de punta a punta | Espera la decisión de la vía de generación | ESTADO.md §12 |

## Código clave

- **Foto nueva:**
  - `src/dominio/fotoNueva.ts`: plantilla, montaje del prompt y regla «otra toma»;
  - `src/adaptadores/gemini/instruccionesFoto.ts`;
  - `src/herramientas/fotoNueva.ts`.
- **Referencia:**
  - `src/dominio/referencia.ts`;
  - `src/aplicacion/referencias/`;
  - `src/adaptadores/ficheros/PiezasHechasFicheros.ts`;
  - `src/herramientas/referencia.ts`;
  - `test/referencias.test.ts`.
- **Generación:**
  - `src/herramientas/generarActivo.ts`: API de Higgsfield;
  - `src/herramientas/generarGeminiImagen.ts`: API de Gemini, que da 429 sin facturación;
  - `src/herramientas/importarManual.ts`: importa lo generado por el MCP.
- **Diseño:**
  - `src/dominio/diseno/`: esquemas de la intención;
  - `src/adaptadores/compositor/`;
  - `src/herramientas/carrusel.ts`.
- **Comprobación de salida:** solo **diseñada y probada con un prototipo** (`proyectos/prueba-comprobacion-salida/`). No está implementada.
- **Pruebas:** `npm test`; `test/datos-locales.test.ts` valida los datos reales de los locales.

## Modelos

- **Higgsfield, API:** Marketing Studio 2.0, Grok 2.0, Qwen e Ideogram. No tiene Nano Banana.
- **Higgsfield, MCP:**
  - se pide `nano_banana_pro` → el trabajo responde `nano_banana_2`;
  - se pide `nano_banana_2` → el trabajo responde `nano_banana_flash`.

  El movimiento se etiqueta con el nombre pedido y cuesta 2 créditos a 2K en los dos casos (ESTADO.md §8).
- **Gemini, API:** texto y visión, gratis; imagen, solo de pago.

## No mandar

`.env` (claves), `node_modules/`, `datos-simulado/`, `revision-externa*` y los originales en alta resolución.
