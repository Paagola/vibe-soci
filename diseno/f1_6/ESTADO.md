# Estado del proyecto `estudio-contenido` (documento vivo)

**Última actualización: 09/11/2026, por la noche.** Este es el único documento que dice el estado vigente. Los informes de fase (`FASE-0`, `FASE-1`, `BENCHMARK`, `METODO-SOCIETY`, `POSTS-F1-6`, F1, F1.5 y la propuesta) son históricos: si algo de ellos choca con este, vale este.

**Cómo leer las marcas de cada dato:**
- **[comprobado]**: ejecutado o medido el 09/11.
- **[hecho, sin recomprobar]**: hecho antes, consta en un informe o en la procedencia de un activo.
- **[supuesto]**: deducción, sin prueba directa.

---

## 0. Qué cambió el 09/11 (tus decisiones 1–11)

| # | Qué | Resultado | Commit |
|---|---|---|---|
| 1 | Commit de F1.6 | Hecho, con la etiqueta `f1_6`. `.gitignore` deja fuera `.env`, `datos/`, `revision-externa*` y las copias `.zip` de la biblioteca [comprobado con `git check-ignore`] | `40a0953` |
| 2 | Copia de `datos/` | `/Users/padre/Documents/victor/pantallas/copias-estudio-contenido/datos-2026-11-09.tar.gz`, 826 MB y 1164 archivos [comprobado]. No incluye nada de después de las 17:44 (el prototipo del punto 9 no escribe en `datos/`) | — |
| 3 | Fallos de §0 | Los dos `marca.json`, con nombres de color acortados (copia previa en `datos/copias/`); prueba nueva que valida **todos** los `datos/locales/*/marca.json`; `referencia comprobar` ya solo lee y la hoja pasa a `referencia propuestas`, con una prueba que falla con la orden antigua. **La web con datos reales lista los 7 locales** (HTTP 200) [comprobado] | `93a6cdf` |
| 4 | DAK y Mesón | Regla nueva «otra toma» (§4.1). Fotos nuevas con 4 créditos en total y un intento cada una. Posts recompuestos en v007 (§7) | `d0657ce` |
| 5 | Piezas hechas con herramientas | Cuentan para el umbral. Registradas con la orden las referencias de los 3 locales nuevos (§4.3) | `93a6cdf` |
| 6 | Oficios | Lecciones de María y las tres observaciones, con su prueba (§6) | `7e9372f` |
| 7 | «Para cenar esta noche» | **Entra en el pie del Mesón:** consta en su `marca.json` («Cenas de noche, ambiente vivo») | `d0657ce` |
| 8 | Vía de generación | Tabla comparativa en §8. **No decidido ni activado nada de pago** | este commit |
| 9 | Comprobación de salida | Diseñada y probada con un prototipo fuera de `src/` (§9): **detecta 3 de los 4 fallos pedidos (75 %)**, con 8 de 22 casos medidos. No implementada | este commit |
| 10 | Documentación | Este documento vivo; los informes marcados como históricos; actualizados `CONTEXTO-PARA-IA.md`, `ARQUITECTURA.md` (§2, E6 y §11) y el README | este commit |
| 11 | Congelado | Ninguna pieza nueva; las únicas fotos nuevas son las 2 del punto 4 | — |

**Comprobaciones de cierre de esa tanda:** `npm run typecheck` limpio y `npm test` con 135 de 135 [comprobado].

### 0b. Segunda tanda del 09/11 (tus decisiones 1, 2, 3 y 5)

| Decisión | Resultado | Commit |
|---|---|---|
| 1. **Vía del producto: Gemini de imagen de pago** | **La facturación la activas tú.** El código está listo y no genera nada mientras `GEMINI_FACTURACION=no`, que es el valor por defecto. Al activarla, comprueba **antes** de cada envío el tope `GEMINI_TOPE_USD` (1 USD por defecto), apunta cada envío y su coste real en `datos/gasto/gemini.jsonl` y no reintenta nunca. Modelo: `gemini-3-pro-image` (Nano Banana Pro) | este commit |
| 2. DAK y Mesón v007 | **Aprobados** («bastante bien») | — |
| 3. **Comprobación de salida** | **Implementada:** dominio, puerto `RevisorVisual`, adaptador de Gemini, caso de uso, orden `npm run comprobar-foto` y 11 pruebas con las respuestas reales del prototipo. **La calibración con Gemini real está pendiente:** la cuota gratuita sigue agotada (429) | `b3fd5a5` |
| 5. **Orden única** | **Hecha:** `npm run post`, con dos paradas, la referencia exigida, 2 intentos como mucho, comprobación automática, borrador de intención, composición y la pieza contada. **Probada de punta a punta en simulado**, más 9 pruebas nuevas (6 de la orden y 3 del generador de pago con un `fetch` falso). **No se ha usado de verdad:** espera a que actives la facturación | este commit |

**Comprobaciones de cierre:** `npm run typecheck` limpio y `npm test` con **155 de 155** [comprobado]. No se ha generado ninguna foto ni se ha gastado nada en esta tanda.

---

## 1. Objetivo del producto

1. El hostelero sube con prisa una foto del plato, hecha con el móvil.
2. El estudio hace una **foto nueva y profesional del mismo plato**: con otra toma, otra luz y otra calidad, pero los mismos elementos.
3. Con esa foto monta un **post de nivel estudio**, construido sobre una **referencia de Canva o Pinterest** que el usuario elige.
4. **En las 5 primeras creaciones de cada local la referencia es obligatoria.**
5. Los textos solo dicen lo que consta del local, y nada se publica sin el visto bueno.

---

## 2. Fases

| Fase | Estado | Evidencia | Qué falta |
|---|---|---|---|
| MVP (web antigua: Gemini dirige, Higgsfield genera la imagen con el texto) | Hecho, en git | `README.md`, prueba «recorre el flujo entero» (simulada) | Nada de lo nuevo |
| F0 · estabilizar | Hecho (`f9910c2`, `87adaf2`) | Pruebas de fallos, estimación y proporciones | — |
| F1 · compositor | Hecho (etiqueta `f1`) | `diseno/f1/INFORME-F1.md`, `test/compositor.test.ts` | — |
| F1.5 · dirección de arte | Hecho (etiqueta `f1_5`); la FASE 0 de F1.6 lo dio por fallido | `diseno/f1_5/INFORME-F1.5.md` | — |
| F1.6 · referencia obligatoria, foto nueva, benchmark, 4 posts y arreglos | Hecho (etiqueta `f1_6` y 4 commits del 09/11) | Este documento | Lo de §12 |
| **Orden única de punta a punta** | **Hecha el 09/11 y probada en simulado** | `npm run post`, `test/orden-post.test.ts`, `src/aplicacion/post/ordenPost.ts` | Usarla de verdad (facturación) y la intención automática (F3) |
| **Siguiente · F3: el director escribe la intención** desde la ficha de la referencia | Es lo que hoy obliga a parar en INTENCION | — | Todo |
| F4 (pantallas web) y F5 (crítico visual) | No empezadas. La comprobación de salida (§9) es la primera pieza de F5 | `PROPUESTA.md` §13 (histórico) | — |

---

## 3. Qué funciona de punta a punta

- **Generador antiguo (web):** sí. Subes una foto y sale un post, con el método viejo (imagen con el texto dentro, sin referencia ni compositor).
  - Con datos reales, la web arranca y lista los locales [comprobado].
  - La generación real no se ha vuelto a lanzar desde el 03/11, porque gasta.
- **Vía nueva: sí, con `npm run post` (09/11).** La foto subida llega hasta el post exportado. Quedan tres cosas fuera:
  - **la generación real necesita que actives la facturación.** Mientras tanto, la orden lo explica y acepta una foto hecha a mano (`--importar`);
  - **la intención de diseño la escribe una persona:** la orden deja un borrador válido y se para;
  - **está probada solo en simulado**, en una ejecución completa y con 6 pruebas. Con Gemini real no se ha usado.

  **Lo que sigue siendo a mano:** escribir la intención y juzgar la foto en las dos paradas.

---

## 4. Los 4 requisitos centrales

### 4.1 Foto nueva con otra toma, luz y calidad profesionales · **PARCIAL**

- **Plantilla del director** en código: `src/dominio/fotoNueva.ts` y `instruccionesFoto.ts`, con 7 pruebas.
- **Regla nueva del 09/11, «otra toma»** (`esOtraToma`): la altura cambia más de 30°, o cambian al menos dos de:
  - el **lado** (giro de 45° o más alrededor del plato);
  - la **distancia** (un escalón entre general, medio, primer plano y macro);
  - la **altura** (15° o más).
- **Por qué sustituye a «más de 30°»:** la burger de DAK se subió a unos 5°, que ya es su ángulo clásico; subirla 30° la estropea, y girar y acercarse da otra toma.
- **La regla solo mira la propuesta**, no el resultado. El resultado se comprueba aparte, preguntando lado a lado si es el mismo punto de vista (§9).
- **Resultados:**
  - **Mesón, cenital:** es otra toma.
  - **DAK, intento 3:** más cerca y algo más alta, pero **el giro de 45° no salió** (sigue frontal). Es un caso límite.

### 4.2 Posts al nivel de `referencias/` · **PARCIAL**

- 29 fichas en 10 familias, como datos.
- Compositor con arco, papel rasgado, mínimo de 22 px y aviso de separación.
- El nivel lo hemos juzgado yo y una diseñadora. **No ha habido prueba a ciegas contigo frente a las referencias.**
- Faltan en el compositor: giro libre, capa de patrón, didona condensada y manuscrita monolineal.

### 4.3 Referencia obligatoria en las 5 primeras · **PARCIAL: en código, con pruebas y usada; no la exige ningún flujo**

- **Dominio y pruebas:** `UMBRAL_REFERENCIA_OBLIGATORIA = 5`, `comprobarPasoAConcepto` y `piezasQueCuentan`, con 23 pruebas en `test/referencias.test.ts` [comprobado].
- **Desde el 09/11 cuentan las piezas hechas con herramientas.** Se declaran con `pieza` en `proyectos/…/plan.json`.
  - Marcadas: los 7 posts y los 2 carruseles.
  - El benchmark y la maqueta V3 son experimentos y no cuentan.
- **`comprobar` solo lee** [comprobado por prueba].
- **Cuenta actual** [comprobado]:

| Local | Piezas (app + herramientas) | Referencia registrada |
|---|---|---|
| Asador Etxebarri | 4 (2 + 2) | ref-post-30 (F7) |
| DAK Burger | 3 (2 + 1) | ref-post-09 (F2) |
| El Mesón de Cervantes | 3 (2 + 1) | ref-post-22 (F4) |
| Café Albor | 2 (1 + 1) | ref-post-10 (F10) |
| Casa Aranda | 1 (0 + 1) | ref-post-03 (F1), registrada el 09/11 |
| Mesón Lo Güeno | 1 (0 + 1) | ref-post-05 (F3), registrada el 09/11 |
| Candamil | 1 (0 + 1) | ref-post-29 (F6), registrada el 09/11 |

- **Lo que falta:**
  - la web no la llama;
  - **la orden única la exige** (paso REFERENCIA, probado); las herramientas sueltas, no;
  - el chiringuito (`chiringuito-prueba`) no tiene `marca.json` y su referencia (un pin) no está registrada.

### 4.4 Fidelidad por componentes · **IMPLEMENTADA (09/11); CALIBRACIÓN PENDIENTE**

- **En el prototipo detectó 3 de los 4 fallos que pediste (75 %), sin falsas alarmas en 3 aciertos**, con 8 de los 22 casos medidos. Se le escapaba la anatomía fina (V3D, y también S3).
- La versión implementada añade la **pasada por teselas** para esos casos. **Sin probar con Gemini real:** la cuota sigue agotada.
- Va dentro de la orden única, y suelta con `npm run comprobar-foto`.
- Detalle en §9.

---

## 5. Decisiones vigentes

| Fecha | Decisión |
|---|---|
| 06/11 | Lienzo 3:4 con zona segura 4:5; se exporta a 3:4 y 4:5, y las historias a 9:16. Apple Vision solo como adaptador local. Fuentes OFL. El generador antiguo se conserva. Composición, tipografía, foto, fidelidad y personalización se evalúan por separado |
| 07/11 | **Fidelidad FLEXIBLE:** cambian la cámara, la luz, el fondo, la superficie, el encuadre y la colocación; se conservan los elementos, su número, la anatomía, los ingredientes y la vajilla; se descarta si añade algo. ESTRICTA solo si el local lo pide |
| 07/11 | Foto nueva, no foto mejorada. Referencia obligatoria en las 5 primeras. Los mecanismos aprobados se adaptan, no se prohíben |
| 07/11 | Gemini solo en el tier gratuito, sin facturación. **Sustituida el 09/11** para la imagen (fila de la vía) |
| 07/11 | MCP de Higgsfield con `get_cost` antes de cada petición, un tope por tarea y parada tras 2 fallos seguidos |
| 08/11 | La revisión de María es criterio del estudio; pasada a los oficios el 09/11 |
| **09/11** | Regla «otra toma» en lugar de «más de 30°» |
| **09/11** | Las piezas hechas con herramientas cuentan para las 5 |
| **09/11** | Una frase sobre el local entra solo si consta en sus datos («Para cenar esta noche» sí consta) |
| **09/11** | **Vía de generación del producto: Gemini de imagen de pago.** Tú activas la facturación (`GEMINI_FACTURACION=si`) y el código pone el tope (`GEMINI_TOPE_USD`). Higgsfield por el MCP queda solo para pruebas |
| **09/11** | DAK y Mesón v007, aprobados |
| **09/11** | **Congelado:** ninguna pieza ni foto nueva sin autorización. Saldo: 4,81 créditos |
| **09/11** | Commits locales al cerrar cada paso, para no acumular |

---

## 6. Lo aprendido

**Pasado a los oficios el 09/11, con su prueba:**
- en `composicion-y-tipografia`: las lecciones de María;
- en `fotografia-gastronomica`:
  - la regla «otra toma»;
  - empezar por los ejemplos que gustaron;
  - clave baja con entorno real, con la advertencia de que la apoyan pocas imágenes (2 que gustaron frente a 12 que no);
  - la cámara descrita como resultado visible (funcionó en 3 de 5 casos);
  - el recorte nítido con f/8–f/11.

**Nuevo el 09/11:**
- **f/11 con «every layer in sharp focus»** dio una burger nítida de arriba abajo (1 imagen).
- **Pedir un giro alrededor del plato no basta:** salió la distancia y no el lado (1 imagen).
- **El nombre del modelo en el MCP depende de lo que se pida** (§8): «servido `nano_banana_2`» era casi seguro el identificador interno de Pro, no una sustitución. **Los informes anteriores lo leyeron mal.**
- **El tier gratuito de Gemini no aguanta una tanda de revisión.** 3.8 Flash dio 503 o se quedó sin responder toda la tarde, y 3.5 Flash agotó su cuota gratuita (429) después de unas 25 llamadas con imágenes. Para revisar cada foto del producto hará falta contarlo en la decisión de §8.
- **La visión de Gemini ve lo grueso y no lo fino:** detectó una gamba de más, el texto inventado y el posavasos, pero no las tres colas ni los cuerpos fundidos.

---

## 7. Los 4 posts del objetivo principal

Son piezas de prueba (no consta ningún contrato) y la de Etxebarri, además, no es publicable. Antes y después de DAK y Mesón: `diseno/f1_6/img/dak-meson-v006-v007.jpg`.

| | Etxebarri | Café Albor | DAK Burger | Mesón de Cervantes |
|---|---|---|---|---|
| Referencia · familia | post-30 · F7 | post-10 · F10 | post-09 · F2 | post-22 · F4 |
| Foto usada | `etx-post-f7-foto-mcp-2` | `cafe-post-f10-foto-mcp-2` | **`dak-post-f2-foto-mcp-3`** (09/11) | **`meson-post-f4-foto-mcp-3`** (09/11) |
| Versión vigente | v006 | v007 | **v007** | **v007** |
| Fidelidad (a mano) | CONSERVA | CONSERVA, con nota (cambia un latte art) | CONSERVA; todas las capas nítidas | CONSERVA |
| Otra toma | Sí | Sí | **Dudosa:** más cerca y algo más alta, pero frontal | Sí (cenital) |
| Créditos | 4 | 4 | 4 + 2 | 4 + 2 |
| Pendiente | — | — | Tu visto bueno a la toma | **El salmón pierde impacto:** en v006 llenaba medio post; ahora es pequeño dentro del bol. Pie con «Para cenar esta noche» en `proyectos/posts-f1-6/meson/PIE.txt` |

---

## 8. Vía de generación del producto: comparación (decidido el 09/11: Gemini de pago)

**Cómo leer la tabla:**
- **Tasa de acierto:** foto que conserva los elementos **y** es otra toma, medida en nuestras imágenes ya revisadas.
- **Coste por foto final:** coste por intento ÷ tasa de acierto (los reintentos incluidos).

| | **Marketing Studio 2.0 por la API de Higgsfield** | **Gemini de imagen de pago (API de Google) con tope** | **MCP de Higgsfield, solo para pruebas** |
|---|---|---|---|
| Coste por intento (2K) | **0,344–0,350 USD** con 1 referencia (registro); 0,365 con 3 (`/estimate`, 07/11) | **Unos 0,14 USD** con Nano Banana Pro: 0,134 de salida según fuentes externas, más unos 0,005 de entrada. La página oficial también muestra 0,101 USD a 2K para otro modelo de imagen, probablemente Nano Banana 2. **No he podido confirmarlo en la página oficial** | **2 créditos** a 2K (Pro o NB2) y 1,5 para NB2 a 1K [comprobado con `get_cost`]. El crédito del plan Plus sale a unos **0,039–0,049 USD** según fuentes externas, sin confirmar; el registro usa 0,0626 [supuesto] |
| Tasa de acierto medida | **20–60 %** (5 imágenes del benchmark que pedían otra toma): 1 clara (b5), 2 dudosas (b1 manchas, b8 plato más transparente) y 2 que volvieron al ángulo original (b3, b7) | **Sin imágenes propias** (429 sin facturación). [supuesto] Si el MCP servía Pro, vale la del MCP: 40 % | **40 %:** 8 válidas de 20 comparables (S1–S3, V1–V3, V1D/V3D, 8 de los posts y 4 de los tres locales; sin el chiringuito, que no tenía foto real). Hoy, con NB2: 1 válida y 1 dudosa de 2 |
| **Coste por foto final** | **Unos 0,9 USD** (0,58–1,75) | **Unos 0,35 USD** [supuesto: misma tasa que el MCP] | **Unos 5 créditos**, entre 0,20 y 0,31 USD |
| Modelo que se sirve de verdad | El que se pide (`marketing-studio/image`); no se conoce ninguna sustitución. Es un modelo propio de Higgsfield y puede cambiar sin aviso | El que se llama (`gemini-3-pro-image-preview`); la respuesta lo dice, así que es comprobable | **Ambiguo.** Pedido `nano_banana_pro` → trabajo `nano_banana_2`, movimiento «Nano Banana Pro». Pedido `nano_banana_2` → trabajo `nano_banana_flash`, movimiento «Nano Banana 2». Los dos a 2 créditos. **[supuesto, bien apoyado]:** las 23 fotos hasta el 08/11 eran Pro; las 2 de hoy, NB2 |
| Evidencia de calidad | Carrusel de F1.5: 3 de 4 conservan (mismo ángulo a propósito). Benchmark: otras tomas a ras de mesa (b1, b5, b8), pero **no gustó ninguna de las 8** (el estilo de vacío de carbón era del prompt). **Nunca se ha probado con tus prompts que gustaron** (V1 y V3) | Ninguna directa. Si el MCP servía Pro, toda la del MCP | 25 imágenes: **V1 y V3 te gustaron**; Etxebarri, Café, Mesón cenital y los 3 locales pasan. Fallos de anatomía o añadidos en V1, V3D, S3, café 1 y DAK 2 |
| ¿Automatizable? | **Sí:** `generarActivo.ts` (tope acumulado y registro) y el generador de la web antigua | **Sí:** `generarGeminiImagen.ts` (recuento previo, **tope propio en el código**, 1 USD por defecto, registro, sin reintentos para no cobrar dos veces; 15 pruebas). Falta activar la facturación | **No:** necesita una IA en una conversación con el conector. Sirve para pruebas, no para el producto |
| Riesgos | El más caro por foto final. Con tus prompts no hay datos: habría que probarlo antes (2–3 imágenes, unos 1 USD) | **Activa la facturación de Google, que hoy no quieres.** El presupuesto de Google Cloud **solo avisa, no corta**: cortar exige Pub/Sub y una función que desactive la facturación, y llega con retraso. Mitiga el tope propio de nuestra herramienta, que corta antes de enviar. El modelo es *preview*, así que el precio y el identificador pueden cambiar. En el tier de pago Google no usa los datos para mejorar sus productos (según sus términos; no lo he vuelto a mirar hoy) | Depende de una suscripción personal y de una conversación. Modelo opaco. Saldo: 4,81 créditos. El uso desde un producto no está previsto por el servicio [supuesto] |

**Qué modelo se cobra de verdad (punto 8, comprobado):** **los movimientos se etiquetan con el modelo pedido**, y Pro y NB2 cuestan lo mismo a 2K. El cobro, por tanto, no distingue cuál se usó; el identificador del trabajo, sí. La lectura más probable es que nunca hubo sustitución.

**Decisión del 09/11: Gemini de imagen de pago.** Un argumento más a favor que no estaba en la tabla: si el MCP servía Pro, como parece, **las 23 fotos del MCP son evidencia del mismo modelo** que se usará por la API (`gemini-3-pro-image`), incluidas V1 y V3, que te gustaron.

**Fuentes externas consultadas el 09/11** (precios no oficiales, por confirmar):
- [ai.google.dev/pricing](https://ai.google.dev/pricing)
- [laozhang.ai, coste por imagen de Gemini 3 Pro Image](https://blog.laozhang.ai/en/posts/gemini-3-pro-image-api-cost-per-image)
- [Google Cloud: desactivar la facturación con notificaciones](https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications)
- [foro de Google AI sobre el límite de gasto de Gemini](https://discuss.ai.google.dev/t/how-to-limit-my-budget-cost-say-30-a-month-spent-for-gemini-api/34512)
- [Creatify, precios de Higgsfield](https://creatify.ai/blog/higgsfield-pricing-(2026)-plans-and-what-you-ll-actually-pay)

---

## 9. Comprobación de salida automática (implementada el 09/11)

**Implementación:**
- `src/dominio/comprobacionSalida.ts` (`decidirSalida`);
- `src/puertos/RevisorVisual.ts`;
- `src/adaptadores/gemini/RevisorVisualGemini.ts`, con las tres preguntas y las teselas;
- `src/aplicacion/fotos/comprobarFotoNueva.ts`, que guarda `revisionAutomatica` en el activo;
- `npm run comprobar-foto`;
- `test/comprobacion-salida.test.ts`.

**Lo que falta:** medir con Gemini real los 14 casos pendientes y las teselas en V3D y S3. La primera prueba real de la herramienta, sobre V3D y sin guardar, dio 429.

### Diseño

1. **Entrada:** la foto real, la foto generada y la **lista de elementos confirmada**. La da la puerta de entrada; hasta que exista, sirve la lista de la plantilla.
2. **Pregunta A, el checklist** (visión de Gemini), sobre la imagen generada:
   - elemento a elemento, si está y **cuántos hay**;
   - problemas de **anatomía**;
   - **lo añadido** (objetos, alimentos o vajilla que no están en la lista; la superficie y el fondo no cuentan);
   - **texto nuevo** que no está en la foto real;
   - «seguro» o no.
3. **Pregunta B, la toma, lado a lado y sin grados:** si se ve desde una altura parecida, desde el mismo lado y a la misma distancia, y si un fotógrafo diría que la cámara está **en el mismo sitio**.
4. **Decide el código, no el modelo** (función pura del dominio, con pruebas):
   - DESCARTA si falta algo, cambia un recuento, hay anatomía rota, algo añadido o texto nuevo;
   - REVISAR si el modelo no está seguro;
   - si B dice «mismo sitio», no es otra toma.

   El veredicto automático solo filtra antes de enseñarte la imagen: **el tuyo manda**.
5. **Pasada de anatomía por teselas** (diseñada, sin probar). Hace falta por los dos fallos que se escapan (abajo):
   - la imagen generada se corta en 4 recortes a resolución completa;
   - en cada uno se cuentan por separado cabezas y colas (o la pieza equivalente del plato);
   - si cabezas, colas y piezas no cuadran, DESCARTA.
6. **Encaje en la arquitectura:**
   - puerto `RevisorVisual` (`comprobarElementos`, `compararToma`) y adaptador de Gemini;
   - `veredictoDeSalida` en el dominio;
   - caso de uso `comprobarFotoNueva`;
   - el resultado se guarda en `activo.json` → `fidelidad.automatica`, al lado del veredicto humano.
7. **Cuota del tier gratuito:** la prueba la cortó la cuota (§ siguiente). Hacen falta reintentos con espera y que, sin revisor, la imagen quede en REVISAR, nunca en CONSERVA.

### Prueba con los fallos conocidos [comprobado, 09/11]

- **Prototipo:** `proyectos/prueba-comprobacion-salida/prototipo.mts`, fuera de `src/`. Resultados en `resultados.json`.
- **Modelo:** `gemini-3.5-flash`. El principal, 3.8 Flash, estaba saturado (503).
- **Coste:** 0 USD.
- **Se midieron 8 de los 22 casos previstos:** después de unas 25 llamadas, 3.5 Flash agotó la cuota gratuita (HTTP 429) y 3.8 Flash seguía sin responder. Paré para no insistir.

| Caso | Tu veredicto | Checklist automático | Toma (lado a lado) |
|---|---|---|---|
| **V3D**: tres colas | FALLA | **CONSERVA: no lo ve** | — |
| **V1**: tercera cabeza | FALLA | **DESCARTA:** «3 gambas en vez de 2; cabeza adicional detrás» | DISTINTA (correcto) |
| **DAK 2**: texto inventado en el papel | FALLA | **DESCARTA:** «texto tipo periódico legible en el papel» | DISTINTA (**tú dijiste misma**) |
| **Café 1**: posavasos | FALLA | **DESCARTA:** «posavasos redondo de madera bajo una taza» | — |
| **S3**: cuerpos fundidos | FALLA | **CONSERVA: no lo ve** | — |
| V3 | CONSERVA | CONSERVA (correcto) | DISTINTA (correcto) |
| S1 | CONSERVA | CONSERVA (correcto) | DISTINTA (correcto) |
| Etxebarri 2 | CONSERVA | CONSERVA (correcto) | DISTINTA (correcto) |

**Porcentajes:**
- **De los 4 fallos que pediste detecta 3, el 75 %.** Se le escapan las tres colas de V3D.
- Con S3 son 3 de 5, el 60 %. **Los dos que se escapan son de anatomía fina**, los que yo solo vi con la imagen ampliada: de ahí la pasada por teselas del punto 5.
- **Falsas alarmas:** 0 de 3.
- **Toma:** 4 de 5 de acuerdo contigo.
  - El desacuerdo es DAK 2. Mi nota del 07/11 decía «cámara otra vez baja», y el modelo ve un ¾ más alto. Habría que volver a mirarlo entre los dos.

**Lo que falta medir** (mismo script, reanuda solo; espera a que vuelva la cuota gratuita):
- 8 aciertos más, para las falsas alarmas: café 2, DAK 1 y 3, Mesón 1–3, merluza y habas;
- la toma de DAK 3, Mesón 1–3, V2, Etxebarri 1 y b1, b2, b5, b6, donde están todos los casos de «misma toma».

**Con 8 casos, el 75 % es un indicio, no una medida.**

---

## 10. Gasto y saldo

| Fecha | Tanda | Imágenes | Vía y modelo | Coste |
|---|---|---|---|---|
| 03/11 | MVP | 9 | API: Marketing Studio y Grok | **No registrado** ([supuesto] 1,4–2,5 USD) |
| 06–07/11 | F1.5 | 6 | API | 1,977 USD |
| 07/11 | Benchmark | 8 | API | 2,012 USD |
| 07/11 | Society, tanda 2 y foto degradada | 8 | MCP, pedido Pro | 16 créditos |
| 07/11 | 4 posts, intentos 1 y 2 | 8 | MCP, pedido Pro | 16 créditos |
| 07–08/11 | Chiringuito y tres locales | 7 | MCP, pedido Pro | 14 créditos |
| **09/11** | **DAK y Mesón, intento 3** | **2** | **MCP, pedido NB2** (trabajo `nano_banana_flash`) | **4 créditos** |
| | **Total registrado** | **39 trabajos** | | **3,989 USD por la API y 50 créditos por el MCP** |

- **Saldo de Higgsfield:** **4,81 créditos** [comprobado]. Desde el 07/11, 25 cargos de 2 créditos, que coinciden con el registro.
- **Gemini:** 0 USD. Las llamadas de texto y visión en el tier gratuito no se registran.

---

## 11. Problemas abiertos y riesgos

1. **La facturación de Gemini no está activada.** Hasta que la actives, la orden única no genera por la API; se puede importar una foto hecha a mano. Cuando la actives:
   - pon un **presupuesto con alertas** en Google Cloud. Solo avisa, pero avisa;
   - deja `GEMINI_TOPE_USD` bajo, por ejemplo 1–2 USD, para las primeras pruebas.
2. **La toma de DAK es dudosa** y no quedan créditos autorizados para otro intento.
3. **El Mesón cenital cumple la regla pero pierde impacto.** La regla «otra toma» no mide si la foto sirve a la idea del post.
4. **La comprobación de salida está implementada pero sin calibrar con Gemini real.** Un veredicto PASA todavía no es de fiar: por eso la orden se para siempre en tu parada de foto.
5. **La cuota gratuita no basta para revisar cada foto** (§9). Desde el 09/11, las llamadas de texto y visión **sí se registran**, con sus tokens, en `datos/gasto/gemini-texto.jsonl`. Si activas la facturación, también pasarán a pago, a unos 0,005 USD por pregunta (cifra calculada en una fase anterior, sin volver a comprobar). Ese gasto no tiene tope propio.
6. **Fuentes y licencias:** fotos de Wikimedia (CC BY-SA, con atribución), referencias de Canva (solo oficio).
7. **Deuda técnica:**
   - enlaces rotos a `creacion-contenido/`;
   - el gasto del MVP sin registrar;
   - unos 15 scripts sueltos; la orden única los encadena, pero siguen ahí para trabajar paso a paso;
   - el chiringuito sin `marca.json`.
8. **`datos/` no está en git.** La copia del 09/11 la tienes que mover tú a otro disco.

---

## 12. Lo que queda, por prioridad

| # | Qué | Esfuerzo | Coste | ¿Decisión tuya? |
|---|---|---|---|---|
| 1 | **Activar la facturación de Gemini** y poner `GEMINI_FACTURACION=si`, más un presupuesto con alertas en Google Cloud. Después, **un primer post real con la orden**: un local ya conocido y su foto, sin gastar en nada más | Lo tuyo, 15 min; la prueba, 1 h | Unos 0,15–0,45 USD (1–2 intentos más la revisión) | **Sí:** la activación es tuya |
| 2 | **Calibrar la comprobación de salida** con Gemini real: los 14 casos pendientes y las teselas en V3D y S3. Reanuda sola (`proyectos/prueba-comprobacion-salida/`) | Medio día | 0 si vuelve la cuota gratuita; céntimos si ya hay facturación | No |
| 3 | **F3: el director escribe la intención** desde la ficha de la referencia, para que la orden no se pare en INTENCION | 3–5 días | 0 (texto) | No |
| 4 | Puerta de entrada mejor: hoy confirmas la lista que propone el director; falta que el dueño la corrija desde una pantalla | Medio día en línea de comandos | 0 | No |
| 5 | Capacidades del compositor que faltan | 1–2 días | 0 | No |
| 6 | Pantallas web (F4), con la orden única por debajo | Varios días | 0 | **Sí** |
| 7 | Probar con 3–5 fotos reales «con prisa» de hosteleros | 1 h más la generación | Unos 0,35 USD por foto final | **Sí** (las fotos) |

---

## 13. Autocrítica (actualizada el 09/11)

1. **Lo bueno de hoy:**
   - los arreglos de §0 tienen pruebas que fallan con el código antiguo;
   - cada paso tiene su commit;
   - no se ha gastado más de lo autorizado.
2. **Un error mío:** para aclarar el cobro pedí `nano_banana_2` y, sin quererlo, **cambié el modelo** de las dos fotos de hoy respecto a las 23 anteriores. Está anotado en la procedencia, pero DAK y Mesón v007 no son comparables uno a uno con los intentos anteriores.
3. **Corregí una conclusión equivocada** («nos sirven NB2 en vez de Pro») que había repetido en tres informes. La había sacado de un identificador interno sin comprobar qué devolvía al pedir el otro modelo.
4. **Por la noche, la orden única existe y está probada, pero solo en simulado.** No la doy por buena hasta usarla con Gemini real. El diseño del borrador de intención es un marcador de posición, no un diseño.
5. **El riesgo de fondo sigue:** la regla «otra toma» y el checklist miden lo comprobable, no si la foto sirve a la idea (lo muestra el Mesón cenital). Ese juicio sigue siendo tuyo o de una diseñadora.
