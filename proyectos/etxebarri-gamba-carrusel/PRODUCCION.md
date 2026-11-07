# Producción · modelos, prompts, gasto y procedencia

Producción del 2026-11-07, hecha con la **API** de Higgsfield (no con el MCP). Tope autorizado: 5 USD, regeneraciones incluidas. **Gastado: 1,977 USD en 6 imágenes.** Ninguna petición falló; las fallidas no se cobran.

## 1. Qué se comprobó antes de elegir modelo

Catálogo de imagen documentado en `docs.higgsfield.ai` el 07/11/2026: SOUL (tres variantes y Soul ID), Marketing Studio Image (2.0 Alpha, 2.5 Flare, 2.5 Sunburst), Ads Studio, Grok Image 2.0, Recraft V4.1 (cuatro variantes), Qwen Image 3 (generación y edición) e Ideogram 4.0. Nano Banana, Gemini Image, Flux Kontext y Seedream **no están en la API**.

El precio se pidió al endpoint gratuito `POST /estimate/<modelo>` con los mismos parámetros que se iban a usar:

| Modelo (endpoint) | Referencias | Resoluciones | Precio por imagen |
|---|---|---|---|
| Qwen Image 3 Edit (`alibaba/qwen-image-3/edit`) | 1–3 | 1K, 2K | 0,075 USD (2K) |
| Grok Image 2.0 (`xai/grok-imagine-image-2.0`) | hasta 10 | 1K, 2K | 0,09 USD (2K, medium) |
| Marketing Studio 2.0 Alpha (`marketing-studio/image`) | hasta 16 | 1K, 2K, 4K | 0,339–0,344 USD (2K) · 0,553–0,561 USD (4K) |
| Marketing Studio 2.5 Flare / Sunburst | hasta 16 | 1K, 2K, 4K | Por tokens: sin importe cerrado (la API solo da la tarifa) |

**Criterios:**
1. Que sea un modelo de **edición** que conserve la geometría de la foto real (fidelidad ESTRICTA).
2. Que admita la misma proporción que la entrada (4:3).
3. Que tenga un precio cerrado para vigilar el tope.
4. Que llegue a 4K para los primeros planos.

Flare y Sunburst quedaron fuera por el criterio 3: la herramienta se niega a enviar una petición sin importe.

**Elegido: Marketing Studio Image 2.0 Alpha**, por la prueba y no por fama:
- fue el único que conservó el producto en las pruebas;
- es el único con 4K y precio cerrado.

## 2. Qué se generó y por qué

La foto real (luz de día y mantel blanco) no casaba con la idea: carbón, hueso y la luz de brasa. El recorte sobre fondo plano quedó descartado porque la máscara pierde las antenas. Así que se pidió **volver a iluminar la foto entera**, sin recomponerla.

| Activo | Modelo y receta | Prompt | Coste | Fidelidad | Uso |
|---|---|---|---|---|---|
| `etx-brasa-qwen-v1` | Qwen Edit 2K · `recetas/brasa-qwen-v1.json` | `prompts/luz-de-brasa-v1.txt` | 0,075 | **ALTERA** (0,447): mueve las gambas y añade sal | Descartado |
| `etx-brasa-grok-v1` | Grok 2K · `recetas/brasa-grok-v1.json` | v1 | 0,090 | **ALTERA** (0,417): purpurina de sal en la cabeza | Descartado |
| `etx-brasa-ms2-v1` | MS 2.0 2K · `recetas/brasa-ms2-v1.json` | v1 | 0,344 | CONSERVA (0,656) | No se usa: la luz es plana |
| `etx-brasa-ms2-v2` | MS 2.0 2K · `recetas/brasa-ms2-v2.json` | `prompts/luz-de-brasa-v2.txt` | 0,346 | CONSERVA (0,512, desplazamiento 0) | **Da la luz** a la foto de campaña |
| `etx-brasa-ms2-v3-4k` | MS 2.0 4K · `recetas/brasa-ms2-v3-4k.json` | `prompts/luz-de-brasa-v3.txt` | 0,561 | CONSERVA (0,674) | **Da el detalle** a la foto de campaña |
| `etx-brasa-ms2-v2-4k` | MS 2.0 4K · `recetas/brasa-ms2-v2-4k.json` | v2 | 0,561 | **ALTERA** (0,087): redibuja la cabeza y las patas | Descartado |
| **Total** | | | **1,977 USD** | | |

La correlación es la coincidencia de bordes con la foto real dentro de la zona del producto (`src/herramientas/fidelidad.ts`). Los recortes ampliados de cada comprobación están en `datos/locales/asador-etxebarri/activos/<id>/fidelidad/`.

**Importante:** el mismo modelo con el mismo prompt (v2) conservó el producto a 2K y lo alteró a 4K. Cada imagen se comprueba; no se da por buena una configuración.

## 3. Activos que entran en el carrusel

| Activo | Tipo | Cómo se hizo | Procedencia |
|---|---|---|---|
| `etx-real-gamba` | REAL | Copia exacta de `plantillas/fotos/gamba-roja-de-palamos.png` (4043 × 2887), con su sha256 | `activo.json` → `procedencia.ruta` y `sha256` |
| `etx-brasa-campana` | GENERADO (derivado) | `combinarLuz.ts`: la luz (frecuencias bajas, σ = 5) de `etx-brasa-ms2-v2` y el detalle de `etx-brasa-ms2-v3-4k`, relleno 0,3, ganancia limitada a 0,15–1,35. Determinista y sin coste | `procedencia.derivacion` · fidelidad CONSERVA (0,641) |
| `etx-real-grano-sal` | REAL (derivado) | `extraerDetalle.ts`: recorte de 114 × 112 px de la foto real en (2170, 1025) y máscara por umbral del canal verde (115–170) | `procedencia.derivacion` |

Las diapositivas 1–3 usan `etx-brasa-campana`, y la 4, `etx-real-grano-sal`. Todas son PUBLICABLE.

## 4. Retoque común (en el compositor, no en la foto)

Las tres fotos llevan el mismo retoque, para que la serie comparta luz:
- brillo 1,1;
- contraste 1,12;
- saturación 1,06;
- **punto negro = carbón #111111**.

La portada tiene además un aclarado suave (degradado radial en «luz suave», color hueso) sobre el cuerpo de las gambas.

## 5. Reproducir

```bash
npx tsx --env-file=.env src/herramientas/generarActivo.ts proyectos/etxebarri-gamba-carrusel/produccion/recetas/<receta>.json --solo-estimar
npx tsx src/herramientas/fidelidad.ts --local asador-etxebarri --real etx-real-gamba --recorte 97,0,3849,2887 --generado <id> --zona cabezas:0.33,0.35,0.3,0.55 …
npx tsx src/herramientas/combinarLuz.ts --local asador-etxebarri --id etx-brasa-campana --luz etx-brasa-ms2-v2 --detalle etx-brasa-ms2-v3-4k --sigma 5 --relleno 0.3 --descripcion "…"
npx tsx src/herramientas/carrusel.ts proyectos/etxebarri-gamba-carrusel
```

- **Gasto:** `datos/gasto/higgsfield.jsonl` (enviado, completado o fallido, con su `request_id`).
- **Coste real:** la respuesta de la API no trae el coste. Para estos modelos de precio cerrado el importe es el de `/estimate` (tipo `estimate`). El saldo se puede cotejar en la consola de Higgsfield; la API no tiene un endpoint de saldo documentado.
