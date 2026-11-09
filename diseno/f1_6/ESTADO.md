# Estado real del proyecto `estudio-contenido`

09/11/2026. Informe de solo lectura: no se ha generado nada, no se ha gastado nada, no se ha cambiado código y no hay commit.

**Cómo leer las marcas de cada dato:**
- **[comprobado]**: lo he ejecutado o medido hoy, 09/11.
- **[hecho, sin recomprobar]**: lo hice en una sesión anterior y está en un informe o en la procedencia de un activo, pero hoy no lo he vuelto a mirar.
- **[supuesto]**: deducción mía, sin prueba directa.

---

## 0. Comprobaciones de hoy

| Qué | Resultado |
|---|---|
| `npm run typecheck` | **Limpio**, sin errores [comprobado] |
| `npm test` | **128 de 128** pasan, 0 fallan, 43 suites. El «Error: boom» del registro es un error provocado a propósito por `webEstimacion.test.ts` [comprobado] |
| `git log` | **4 commits** en `main`: `f9910c2` F0, `87adaf2` pendientes de F0, `4a57f81` F1 (etiqueta `f1`) y `3bbfe33` F1.5 (etiqueta `f1_5`, 07/11 14:04). No hay más [comprobado] |
| `git status` | **Todo F1.6 está sin confirmar:** 24 archivos modificados (673 líneas añadidas y 93 borradas), 1 borrado y **306 archivos nuevos** sin seguimiento, que `git status` agrupa en 49 entradas (código, pruebas, conocimiento, 6 marcas, 6 proyectos y `diseno/f1_6/`). `datos/` no está en git [comprobado] |
| Saldo de Higgsfield (MCP `balance`) | **8,81 créditos**, plan *plus* [comprobado] |
| Movimientos de Higgsfield (MCP `transactions`) | Desde el 07/11 hay **23 cargos de 2 créditos (46 en total)**. Coinciden uno a uno con las 23 líneas del MCP del registro [comprobado] |
| Registro `datos/gasto/higgsfield.jsonl` | 67 líneas y **37 trabajos**, todos completados: **3,989 USD por la API** y **46 créditos por el MCP** [comprobado] |
| Registro `datos/gasto/gemini.jsonl` | 1 intento de imagen (`gemini-3-pro-image`), con **HTTP 429** y 0 USD [comprobado] |
| Regla de referencia (`npm run referencia -- comprobar`) | Los cuatro posts de F1.6 pasan con su referencia registrada. Ver §4.3 [comprobado] |

**Dos hallazgos de hoy que no estaban en ningún informe:**
1. **La lista de locales falla con los datos reales.** Los `marca.json` de `candamil` y `casa-aranda`, que creé el 08/11, no pasan el esquema `Marca`: hay nombres de color de más de 30 caracteres. `AlmacenLocalesFicheros.listar()` lanza el error y no devuelve ninguno. Lo he comprobado llamando al almacén desde un script aparte; la web no la he arrancado. **[supuesto]:** la portada de la web real no carga locales. Las pruebas no lo ven porque usan datos simulados.
2. **`npm run referencia -- comprobar` escribe en disco.** Cuando falta la referencia, pinta `datos/locales/<slug>/referencias/propuestas.jpg`. Hoy creó una para `meson-lo-gueno`, que he borrado, y volvió a escribir la de `asador-etxebarri`. Una orden que solo comprueba no debería escribir nada.

---

## 1. Objetivo del producto

1. El hostelero sube con prisa una foto del plato, hecha con el móvil.
2. El estudio hace una **foto nueva y profesional del mismo plato**: con otro ángulo, otra luz y otra calidad, pero los mismos elementos.
3. Con esa foto monta un **post de nivel estudio**, construido sobre una **referencia de Canva o Pinterest** que el usuario elige.
4. **En las 5 primeras creaciones de cada local la referencia es obligatoria.**
5. Los textos solo dicen lo que consta del local, y nada se publica sin el visto bueno.

---

## 2. Fases

| Fase | Estado | Qué entrega | Evidencia | Qué falta |
|---|---|---|---|---|
| **MVP** (03–04/11) | Hecho, en git | Web local. Gemini escribe el plan e Higgsfield (API) genera la imagen entera, con el texto dentro | `README.md`, `diseno/ARQUITECTURA.md`, 9 imágenes en `datos/piezas/`, prueba «recorre el flujo entero» (simulada) | Nada de lo nuevo: ni foto nueva, ni referencia obligatoria, ni compositor |
| **F0** · estabilizar (06/11) | Hecho, en git (`f9910c2`, `87adaf2`) | Datos simulados separados, cerrojo por pieza, límite diario por zona horaria, exportación a 3:4, 4:5 y 9:16, votos automáticos marcados | Pruebas de `fallos`, `webEstimacion` y `proporciones` | — |
| **F1** · compositor (06–07/11) | Hecho, en git (`4a57f81`, etiqueta `f1`) | Compositor por capas (sharp, SVG y fontkit) que pinta una intención escrita a mano. 3 diseños de DAK | `diseno/f1/INFORME-F1.md`, `test/compositor.test.ts` | Tu valoración: «demasiado robóticos» |
| **F1.5** · dirección de arte (07/11) | Hecho, en git (`3bbfe33`, etiqueta `f1_5`) | Carpeta `conocimiento/` (método de design-agent), perfil de marca v2 de Etxebarri y el carrusel «Y nada más» | `diseno/f1_5/INFORME-F1.5.md`, `proyectos/etxebarri-gamba-carrusel/` | **La FASE 0 de F1.6 lo dio por fallido:** es la misma foto con el mismo ángulo, no parte de ninguna referencia y prohibía mecanismos aprobados |
| **F1.6 · FASE 0** · estudio (07/11) | Hecho, sin commit | Diagnóstico, manual de foto nueva, 29 referencias en 10 familias y plan | `diseno/f1_6/FASE-0.md` | — |
| **F1.6 · FASE 1** · referencia obligatoria (07/11) | Hecho en el dominio y la línea de comandos, sin commit | Regla de las 5 primeras, entrada por imagen o enlace, 29 fichas como datos, fuentes OFL | `src/dominio/referencia.ts`, `test/referencias.test.ts` (19 pruebas), `diseno/f1_6/FASE-1.md` | Web, decidir si cuentan las piezas hechas con herramientas, ficha v2 |
| **F1.6 · benchmark** (07/11) | Hecho, sin commit | 8 imágenes: vía A (foto y texto juntos) frente a vía B (por capas), con Marketing Studio 2.0 y Grok | `diseno/f1_6/BENCHMARK.md` | **Siguen sin respuesta tus decisiones:** la elección ciega, el acento rojo y la imagen extra de F4 |
| **F1.6 · método Society** (07/11) | Hecho, sin commit | S1–S3, V1–V3 y V1D/V3D por el MCP; ensayo del director con el salmón | `diseno/f1_6/METODO-SOCIETY.md` | Pasar lo aprendido a `conocimiento/`: pendiente de tu visto bueno |
| **F1.6 · 4 posts** (07/11) | Hecho a medias, sin commit | Plantilla de foto nueva con la regla de más de 30° y 4 posts compuestos | `diseno/f1_6/POSTS-F1-6.md`, `src/dominio/fotoNueva.ts`, `test/foto-nueva.test.ts` (6 pruebas) | DAK y Mesón no pasan la regla de ángulo; la puerta de calidad no existe |
| **F1.6 · revisión de María** (08/11) | Hecho, sin commit | Correcciones de los 4 posts; el mínimo de mayúscula sube a 22 px y hay aviso de `SEPARACION` | `POSTS-F1-6.md` §10, 2 pruebas nuevas en `compositor.test.ts` | Nueva foto de DAK (pan borroso); pasar las lecciones a los oficios |
| **F1.6 · chiringuito** (08/11) | Pieza de prueba | Carrusel continuo de 5 diapositivas, sacado de un pin | `proyectos/chiringuito-carrusel/ENTREGA.md` | Datos y fotos reales del local |
| **F1.6 · tres locales** (08/11) | Pieza de prueba | Casa Aranda, Mesón Lo Güeno y Candamil, con fotos de Wikimedia | `proyectos/posts-tres-locales/ENTREGA.md` | **Dos `marca.json` inválidos** (§0) |
| **F2** (propuesta) · activos y máscaras | **Parcial**, hecho de paso | `crearMascara.ts`: Apple Vision, luminancia y las dos combinadas | `BENCHMARK.md` | `puertos/Segmentador`, análisis de la foto dentro del flujo |
| **F3** · el director escribe la intención | **No empezada** | — | Todas las intenciones de los posts las escribí yo a mano | Todo |
| **F4** · edición, versiones y exportación en la web | **No empezada** | — | Hay versiones `vNNN` y exportación por línea de comandos | Pantallas: necesitan tu aprobación |
| **F5** · crítico visual | **No empezada.** La puerta de calidad está **diseñada** | — | `POSTS-F1-6.md` §4 | Implementarla y calibrarla |
| **F6** · perfil de marca v2 | Parcial | Solo Etxebarri tiene `perfil.json`; los demás, solo `tokens.json` | `marcas/` | Migración y alta |
| **F7** · activos generados y benchmark | Hecho en la práctica, fuera de orden | `generarActivo.ts` (API), `generarGeminiImagen.ts`, importación del MCP | Registro de gasto | La vía de generación del producto (§9, riesgo 1) |
| **F8** · carrusel e historias | No empezada como fase | Hay dos carruseles compuestos a mano | — | — |

---

## 3. Qué funciona de punta a punta

**¿Existe un flujo en el que subo una foto y obtengo un post terminado?**

- **En el generador antiguo (la web del MVP), sí, pero con el método viejo.**
  - Funciona así: subes la foto, el director propone conceptos y un plan, Higgsfield genera la imagen entera con el texto dentro y se exporta.
  - No aplica la plantilla de foto nueva, ni la referencia obligatoria, ni el compositor.
  - **Comprobado hoy solo en modo simulado** (`test/web.test.ts`). La última vez que se usó de verdad fue el 03/11.
  - Además, con los datos reales de hoy **la lista de locales falla** (§0).
- **En la vía nueva, la que pediste, no.** No hay una orden ni una pantalla que lo haga. Cada post de F1.6 lo he hecho yo en la conversación, enlazando herramientas sueltas:

| Paso | Cómo se hace hoy | ¿Automático? |
|---|---|---|
| 1. Registrar la referencia | `npm run referencia -- registrar` (ficha escrita por mí) | La orden sí; el análisis de la ficha, a mano |
| 2. Describir la foto y rellenar la plantilla | `src/herramientas/fotoNueva.ts` (Gemini, tier gratuito) → `foto/<x>.json` | Sí, con un reintento si falla la regla |
| 3. Corregir la propuesta del director | Lo hago yo → `foto/<x>.final.json`, con el motivo | **A mano** (en casi todos los casos) |
| 4. Generar la foto | Yo llamo al **MCP de Higgsfield desde la conversación** (antes, `get_cost`) | **A mano.** El código no puede llamar al MCP |
| 5. Importar con procedencia | `importarManual.ts --via mcp` | Sí |
| 6. Comprobar la fidelidad y la regla de ángulo en el resultado | Yo, ampliando la imagen; el veredicto va en `activo.json` | **A mano** |
| 7. Máscara | `crearMascara.ts` (Vision más luminancia); a veces limpio motas a mano | Casi sí |
| 8. Intención de diseño | La escribo yo (`proyectos/<p>/intenciones/*.json`) | **A mano** |
| 9. Componer y exportar a 3:4 y 4:5 | `carrusel.ts` con el `plan.json` del proyecto | Sí |
| 10. Revisión con la rúbrica | Yo | **A mano** |

**En resumen:** lo determinista funciona (plantilla, regla de ángulo sobre la propuesta, compositor, exportación y registro de gasto). Lo que da la calidad (corregir al director, generar, comprobar la fidelidad y diseñar) lo hago yo a mano.

---

## 4. Los 4 requisitos centrales

### 4.1 Foto nueva con ángulo, luz y calidad profesionales · **PARCIAL**

**Hecho:**
- La plantilla del director está en código: `src/dominio/fotoNueva.ts` y `src/adaptadores/gemini/instruccionesFoto.ts`, con 6 pruebas en `test/foto-nueva.test.ts`. Una de ellas reconstruye tu prompt de la gamba a partir de sus huecos [comprobado: pasan].
- La regla de más de 30° está en código, pero **solo compara el ángulo que el director dice ver con el que propone**: no mide el ángulo de la foto generada.

**Resultados [hecho, sin recomprobar]:**
- **4 posts de F1.6:** 2 pasan (Etxebarri y Café). DAK y Mesón fallan la regla dos veces seguidas.
- **3 locales nuevos:** 3 aceptadas, con un reintento en los churros.

**Lo que no funciona:**
- El director lee mal el ángulo de la foto subida: dijo que el salmón era cenital y era un ¾ a 45°, y en un ensayo leyó DAK a 35° cuando estaba a 5°.
- Mete elementos de otros ejemplos: el papel de cuadros y la salsa blanca en DAK.
- Casi nunca trae una idea gráfica como la de tu prompt.
- Cuando la foto subida ya es buena, el modelo vuelve a su geometría (DAK y Mesón).

### 4.2 Posts al nivel de `referencias/` · **PARCIAL**

**Hecho:**
- **29 fichas en 10 familias**, como datos validados: `conocimiento/referencias/fichas/`, `familias.json` y su prueba.
- **Compositor**, con las capacidades añadidas: arco, papel rasgado procedural, mínimo de 22 px y aviso de separación.

**El nivel lo he juzgado yo, más una diseñadora (María) el 08/11:**
- Etxebarri: «sí»;
- Café: «por los pelos»;
- DAK y Mesón: «sí por composición», pero con una foto que no cumple.

No ha habido una **prueba a ciegas contigo frente a las referencias**.

**Faltan en el compositor:**
- giro libre (la familia F3);
- capa de patrón;
- didona condensada;
- manuscrita monolineal.

### 4.3 Referencia obligatoria en las 5 primeras · **PARCIAL: en código y con pruebas, pero no se exige en ningún flujo**

**Hecho:**
- `UMBRAL_REFERENCIA_OBLIGATORIA = 5` y `comprobarPasoAConcepto` en `src/dominio/referencia.ts`.
- El caso de uso `comprobarReferencia`, con **19 pruebas** en `test/referencias.test.ts` [comprobado: pasan].
- La orden `npm run referencia`. **Comprobado hoy:**

```text
asador-etxebarri   --referencia ref-post-30 → ✓ Parte de la referencia «ref-post-30» (F7). Piezas reales: 2
dak-burger         --referencia ref-post-09 → ✓ (F2). Piezas reales: 2
meson-de-cervantes --referencia ref-post-22 → ✓ (F4). Piezas reales: 2
cafe-albor         --referencia ref-post-10 → ✓ (F10). Piezas reales: 1
```

**No hecho:**
1. **La web no la llama** (`ARQUITECTURA.md` §11).
2. **Mi cadena de herramientas tampoco la exige:** registrar la referencia es un paso voluntario.
3. **Las piezas hechas con herramientas no cuentan** para el umbral. `piezasRealesDelLocal` solo cuenta `datos/piezas/`, así que los 7 posts y el carrusel de F1.6 no suman. Está pendiente de tu decisión.
4. `comprobar` escribe una imagen (§0).
5. La ficha v2, con la foto descompuesta, sigue propuesta.
6. Los tres locales nuevos no tienen referencia registrada con la orden. La referencia consta solo en `ENTREGA.md` [comprobado: no tienen carpeta `referencias/`].

### 4.4 Fidelidad por componentes · **NO EMPEZADA en código; diseñada**

- **Puerta de entrada:** solo existe la parte que vive en `problemasFotoNueva`: el ángulo propuesto, que haya recuento, que no pida texto y el aviso de menos de 1000 px.
  - **No existe** la confirmación de la lista de elementos por el dueño.
- **Comprobación de salida automática:** **no existe**. No hay `RevisorVisual` ni `ChecklistFoto` en el código [comprobado con grep]. El diseño está en `POSTS-F1-6.md` §4.
- **Hoy, los veredictos los pongo yo a mano** en `activo.json`. Ninguno está calibrado ni revisado por otra persona, salvo los que tú viste (V1 a V3, V1D y V3D).
- **Lo que sí hay** (`npm run fidelidad`, de F1.5) compara bordes **en la misma geometría**. No sirve para fotos con otro ángulo.

---

## 5. Decisiones vigentes

| Fecha | Decisión | ¿Contradice algún documento sin actualizar? |
|---|---|---|
| 06/11 | Lienzo 3:4 (1080 × 1440) con zona segura 4:5; se exporta a 3:4 y 4:5, y las historias a 9:16 | No |
| 06/11 | Apple Vision solo como adaptador local y sustituible. Fuentes OFL, o las del cliente con licencia probada | No |
| 06/11 | El generador antiguo no se toca y sigue funcionando | **Hoy no funciona del todo** (§0) |
| 06/11 | El activo de DAK hecho con Grok solo sirve para probar composición | No |
| 06/11 | Composición, tipografía, fotografía, fidelidad y personalización se evalúan por separado | No |
| 06/11 | Los votos automáticos se conservan marcados y no enseñan al director | No |
| **07/11** | **Fidelidad FLEXIBLE por defecto:** pueden cambiar la cámara, la luz, el fondo, la superficie, el encuadre y la colocación. Se conservan los elementos, el recuento, la anatomía, los ingredientes y la vajilla. **Se descarta si añade un componente.** ESTRICTA solo si el local lo pide. Sustituye a la del 06/11 | **Sí:** `CONTEXTO-PARA-IA.md` («Fidelidad ESTRICTA del plato: la IA no cambia ingredientes ni geometría») y `PROPUESTA.md` §15 (histórico). `conocimiento/` y `perfil.json` de Etxebarri sí están al día |
| 07/11 | Cada foto es una **foto nueva**, no la subida mejorada; la cámara, a **más de 30°** de la original | `CONTEXTO-PARA-IA.md` no lo menciona |
| 07/11 | Referencia obligatoria en las 5 primeras piezas reales de cada local; de ella se toma el oficio, no los textos | `CONTEXTO-PARA-IA.md` no lo menciona |
| 07/11 | Los mecanismos aprobados (palabra detrás, la antena que firma) se adaptan, no se prohíben | El `CONCEPTO.md` de F1.5 lleva una nota de corrección |
| 07/11 | **Gemini solo en el tier gratuito, sin facturación.** No hay modelo de imagen gratis por la API (429). No se propone activar la facturación | **Sí:** `ARQUITECTURA.md` §2 («bastaría un adaptador») y `METODO-SOCIETY.md` §0 punto 5 («sí en nuestra API de Gemini») |
| 07/11 | El MCP de Higgsfield se puede usar sin preguntar por imagen, con `get_cost` antes de cada petición, un tope por tarea y parada tras 2 fallos seguidos en un post | No consta en `README` ni en `ARQUITECTURA` |
| 07/11 | **Modelo pedido:** `nano_banana_pro`. **Modelo servido:** `nano_banana_2` en los 23 trabajos. Se anota en la procedencia | `ARQUITECTURA.md` E6 sigue diciendo «`marketing-studio/image` por defecto». La recomendación del benchmark («Marketing Studio 2.0 para la foto nueva») **quedó de hecho sustituida** por el MCP sin que lo decidieras explícitamente |
| 07/11 | No hay pantallas web nuevas sin tu aprobación | No |
| 08/11 | La revisión de María se adopta como criterio del estudio: mayúscula de al menos 22 px y hueco entre textos | Es una observación, no está en los oficios: pendiente de tu visto bueno |
| siempre | Trabajo por fases; ningún commit sin permiso; repositorio local, sin push | — |

**Documentos desfasados:**
- `CONTEXTO-PARA-IA.md`: dice que F1.5 está sin confirmar, que hay 86 pruebas y que la fidelidad es ESTRICTA, y no menciona F1.6. En el paquete va una versión actualizada; el original no lo he tocado.
- `ARQUITECTURA.md`: §2 y E6.
- `biblioteca/ejemplos/*.md` sigue enlazando a `creacion-contenido/`, que ya no existe.

---

## 6. Lo aprendido

### Evidencia razonable (varias imágenes o pruebas)

| Aprendizaje | Con qué |
|---|---|
| «Use it only as the list of elements, not as a layout to copy», junto con una cámara **lejos** de la original, produce una toma nueva. «Recreate / keep the pose» repite el ángulo | Benchmark: 1, 5 y 8 (nuevas) frente a 3, 4, 6 y 7. Piezas A y B del MVP. Ejemplo 01 (NO GUSTÓ y su corrección) |
| Pedir un ¾ a 25° sobre un ¾ a 45° vuelve a la foto subida; más o menos 30° es el umbral práctico | Benchmark: 4 imágenes. En los posts, Mesón (38° y 33°) y DAK (10–15° sobre 5°) |
| Grok conserva la geometría de la foto subida y falla con el texto («GAMB») | Benchmark: 3 de 3 |
| El MCP sirve siempre `nano_banana_2` cuando se pide `nano_banana_pro` | 23 de 23 trabajos [comprobado] |
| Canva bloquea la lectura automática de enlaces (403/400) y Pinterest devuelve un logotipo genérico | Pruebas contra los sitios reales (FASE 1) |
| Apple Vision deja fuera el cristal y el papel; la luminancia se agujerea en lo oscuro; las dos combinadas no pierden nada sobre fondo liso | Benchmark 5 y 8, y los posts |
| El director (Gemini) rellena bien la **estructura** si se le da la plantilla, pero no la **idea gráfica**, y su lista de elementos sale incompleta o contaminada | 3 ensayos (salmón, DAK y café) y 7 propuestas reales |
| Los textos secundarios de menos de unos 34 px de cuerpo no se leen; el nombre del plato tiene que leerse en orden | Una diseñadora, sobre 4 posts y el carrusel |

### Una sola imagen por variante (indicio, no regla)

- **Tu prompt de la gamba (V1) y su variante V3 gustaron; la reescritura «Society» (V2) no.** Es una imagen cada una, y V2 cambiaba varias cosas a la vez.
- **«Clave baja con entorno real» es lo que separa lo que gustó de lo que no.** Lo apoyan 2 imágenes que gustaron frente a 12 que no. Que sea oscura no basta.
- **El método Society (JSON, ficha de texturas, referencia de encuadre):** S1–S3 no gustaron. La luz falló en las tres, y fue un error de mi prompt.
- **JSON frente a párrafo:** S3 falló en anatomía. No se puede concluir nada.
- **Foto muy degradada:** V1D y V3D, las dos mal. No dice nada de una foto de móvil normal.
- **Café:** la frase «a ring of dark wood» provocó un posavasos añadido.
- **Describir la cámara como resultado visible** («the frosted glass plate seen nearly edge-on») funcionó en Etxebarri y en el café, y no en DAK ni en Mesón.
- **Recuento en macro:** en V1 se coló una tercera cabeza a pesar de «Exactly two prawns».

---

## 7. Los 4 posts del objetivo principal

Todos son **piezas de prueba**: no consta el contrato de ningún local, y Etxebarri, además, **no es publicable**.

- **Versiones:** las finales, tras la revisión de María [comprobado: existen].
- **Créditos:** 4 por post (2 intentos de 2 créditos), 16 en total.
- **Modelo:** pedido `nano_banana_pro`, servido `nano_banana_2`.

| | **Asador Etxebarri** | **Café Albor** | **DAK Burger** | **El Mesón de Cervantes** |
|---|---|---|---|---|
| Referencia · familia | post-30 · F7, macro y papel | post-10 · F10, cenital con texto en arco | post-09 · F2, palabra repetida | post-22 · F4, oscuro editorial |
| Foto original | `etx-real-gamba` (¾ a 45°, luz de día, mantel con mancha) | `cafe-real-cafes`, **382 × 510 px** (la única «con prisa» de verdad) | `dak-real-manhattan` (casi a ras de tabla, unos 5°) | `meson-real-salmon` (¾ a 45–50°) |
| Prompt usado | Intento 1: `proyectos/posts-f1-6/foto/etxebarri.txt` (contradictorio). **Intento 2:** `etxebarri-2.txt`, tu V1 con la regla de anatomía | `cafe.txt`; **intento 2:** `cafe-2.txt` | **Intento 1:** `dak.txt` (40°); intento 2: `dak-2.txt` (45°) | `meson.txt` (10°); **intento 2:** `meson-2.txt` (8°) |
| Foto usada en el post | `etx-post-f7-foto-mcp-2` | `cafe-post-f10-foto-mcp-2` | `dak-post-f2-foto-mcp-1` | `meson-post-f4-foto-mcp-2` |
| Resultado | `datos/disenos/etxebarri/etxebarri-post/v006` | `datos/disenos/cafe/cafe-post/v007` | `datos/disenos/dak/dak-post/v006` | `datos/disenos/meson/meson-post/v006` |
| Fidelidad (mi veredicto, a mano) | **CONSERVA:** unos 10°, a 35° de la original; dos cabezas; nada añadido | **CONSERVA, con nota:** cenital; una taza cambia el dibujo del latte art | Elementos bien. **Falla el ángulo** (unos 10–15° sobre 5°). El intento 2 inventó texto en el papel | Elementos bien. **Falla el ángulo** (38° y 33° sobre 45–50°) |
| Rúbrica (idea · composición · tipografía · foto · personalización) | 4 · 4 · 4 · 5 · 4 | 3 · 4 · 4 · 3 · 3 | 4 · 4 · 3 · 4 · 4 | 3 · 4 · 4 · 4 · 4 |
| ¿Podría estar en `referencias/`? | Sí | Por los pelos | Por composición sí; la foto es casi la tuya mejorada | Sí, pero le falta una idea que nazca del plato |
| Pendiente | — | — | **Tu decisión:** aceptar, otro intento con una cámara extrema o cambiar la regla. Además, el pan de arriba sale borroso | **Tu decisión** (las mismas opciones) |

**La rúbrica es mía**, más la revisión de María. No la ha validado nadie más.

**Imágenes del paquete:** `revision-externa/imagenes/posts/<local>-1-original.jpg` … `-6-capas.jpg`.

---

## 8. Gasto y saldo

| Fecha | Tanda | Qué se generó | Vía | Modelo pedido → servido | Coste |
|---|---|---|---|---|---|
| 03/11 | MVP | 9 imágenes en 7 piezas | API | 6 `marketing-studio/image` y 3 `grok-imagine-image-2.0` | **No registrado.** [supuesto] Entre 1,4 y 2,5 USD a los precios de `/estimate` del 07/11 |
| 06–07/11 | F1.5, carrusel de Etxebarri | 6 fotos de prueba: Qwen, Grok y 4 de Marketing Studio | API | Lo mismo (la API no informa de otro) | **1,977 USD** |
| 07/11 | Benchmark F1.6 | 8 fotos: 5 de Marketing Studio 2.0 y 3 de Grok | API | Lo mismo | **2,012 USD** |
| 07/11 | Society, intento con Gemini | 1 intento de S1 | API de Gemini | `gemini-3-pro-image`, HTTP 429 | 0 USD |
| 07/11 | Society S1–S3 | 3 fotos | MCP | `nano_banana_pro` → `nano_banana_2` | 6 créditos |
| 07/11 | Tanda 2: V1–V3 | 3 fotos | MCP | igual | 6 créditos |
| 07/11 | Foto degradada: V1D y V3D | 2 fotos | MCP | igual | 4 créditos |
| 07/11 | 4 posts, intento 1 | 4 fotos | MCP | igual | 8 créditos |
| 07/11 | 4 posts, intento 2 | 4 fotos | MCP | igual | 8 créditos |
| 07/11 | Chiringuito | 3 fotos solo con texto | MCP | igual | 6 créditos |
| 08/11 | Tres locales | 4 fotos (3 y un reintento) | MCP | igual | 8 créditos |
| | **Total registrado** | **37 trabajos** | | | **3,989 USD por la API y 46 créditos por el MCP** |

**Conversión de créditos [supuesto]:** 46 créditos son unos 2,88 USD con 0,06256 USD por crédito, la relación que usa el registro. Da **unos 6,86 USD en Higgsfield**, sin contar el MVP.

**Saldo [comprobado]:** **8,81 créditos**, unas 4 imágenes a 2 créditos.

**Gemini de texto y visión** (el director): tier gratuito, 0 USD. Esas llamadas **no se registran en ningún sitio**, así que no puedo decir cuántas fueron.

**Fuera del registro:** en los movimientos de Higgsfield aparecen cargos del 05/11 (Nano Banana 2.1 a 1,5 créditos, GPT Image y Nano Banana Pro) y del 22/10 (What If y otros). No constan en este proyecto. **[supuesto]:** son de otro trabajo tuyo.

---

## 9. Problemas abiertos y riesgos

1. **La vía de generación de todo F1.6 no la puede usar el producto.** Las 23 fotos salieron del MCP, que llamé yo desde la conversación. El código no puede llamarlo.
   - La API de Higgsfield no tiene Nano Banana.
   - Gemini cobra por imagen y decidiste no activar la facturación.
   - La alternativa automatizable probada es Marketing Studio 2.0 por la API (unos 0,35 USD por imagen a 2K, buenas tomas nuevas en el benchmark), pero se dejó de usar sin cerrar esa decisión.
   - **Es el bloqueo principal para un flujo de punta a punta.**
2. **¿Qué modelo se usa de verdad?** El trabajo dice `nano_banana_2`, pero los movimientos lo cobran como «Nano Banana Pro» a 2 créditos (el 05/11, Nano Banana 2.1 costaba 1,5). **No lo sé.**
3. **Hay tres días de trabajo sin commit:** 24 archivos modificados, 1 borrado y 306 nuevos.
   - `datos/` (475 MB de diseños y 296 MB de activos) no está en git ni tiene copia que me conste.
4. **Los `marca.json` de Candamil y Casa Aranda son inválidos** y rompen la lista de locales (§0). Los creé a mano sin validarlos con el esquema de la app.
5. **`referencia comprobar` escribe en disco** (§0).
6. **La fidelidad y la rúbrica dependen de mi ojo:** es autoevaluación. Hay unas 33 imágenes revisadas a mano y ninguna comprobación automática.
7. **La regla de más de 30° solo mira la propuesta**, no el resultado. Para una torre de burger quizá no sea la condición correcta: pendiente de tu decisión.
8. **Casi no se ha probado con fotos «con prisa»:**
   - el café de 382 px (pasó);
   - la gamba degradada a mano (falló);
   - las tres de Wikimedia son fotos razonables.

   No ha entrado **ninguna foto real tuya de un hostelero** desde el MVP.
9. **Licencias:**
   - las fotos de Wikimedia (CC BY-SA 2.0) exigen atribución y el permiso del local;
   - las referencias son plantillas de Canva: se usan solo como oficio.
10. **Decisiones tuyas sin responder:**
    - benchmark: la elección ciega, el rojo de la gamba y la imagen extra de F4;
    - DAK y Mesón;
    - si las piezas hechas con herramientas cuentan para el umbral;
    - implementar la puerta de calidad;
    - el commit;
    - pasar las lecciones de María y las observaciones a los oficios;
    - «Para cenar esta noche» en el pie.
11. **Lo que informes anteriores afirmaron y resultó incompleto:**
    - **F1.5:** el carrusel se dio por terminado, pero eran recortes de la misma foto con el ángulo del hostelero (FASE 0 §3).
    - **`METODO-SOCIETY.md`:** dijo que Nano Banana Pro estaba «en nuestra API de Gemini (comprobado hoy)». Estaba listado, pero no se puede usar sin facturación (429).
    - **`BENCHMARK.md`:** concluyó «Marketing Studio 2.0 es el modelo», y después todo se hizo con otro modelo, servido por el MCP.
    - **`POSTS-F1-6.md`:** «`comprobar` deja pasar los cuatro» es cierto, pero esos posts no cuentan para el umbral y la orden es voluntaria.
    - **`ENTREGA.md` de los tres locales:** «como un usuario normal», pero los `marca.json` no los podría abrir la app.
    - **`CONTEXTO-PARA-IA.md`:** sigue con los datos del 07/11 por la mañana.
12. **Deuda técnica:**
    - los enlaces rotos a `creacion-contenido/`;
    - `ejemplos.zip` y `referencias.zip` sin dueño en `biblioteca/`;
    - las llamadas de Gemini de texto sin registro;
    - unos 15 scripts sueltos en `src/herramientas/` sin un orquestador;
    - el gasto del MVP sin registrar.

---

## 10. Lo que queda, por prioridad

| # | Qué | Esfuerzo | Coste | ¿Decisión tuya? |
|---|---|---|---|---|
| 1 | **Commit de F1.6** (con las piezas de prueba marcadas) y copia de `datos/` | 15 min | 0 | **Sí** (permiso) |
| 2 | Arreglar los dos `marca.json` (acortar los nombres de color) y añadir una prueba que valide todos los `datos/locales/*/marca.json` | 30 min | 0 | Sí: tocar datos existentes |
| 3 | Que `referencia comprobar` no escriba nada (la hoja, con una opción aparte) | 30 min | 0 | No |
| 4 | **Decidir la vía de generación del producto:** Marketing Studio 2.0 por la API, el MCP solo para pruebas o otra | — | Unos 0,35 USD por foto si es Marketing Studio | **Sí** |
| 5 | **Comprobación de salida automática** (visión con Gemini gratis, elemento a elemento, ángulo estimado), calibrada con las unas 33 imágenes ya revisadas | 1–2 días | 0 (tier gratuito, con límites) | Sí («¿la implemento?») |
| 6 | Puerta de entrada: la lista de elementos con recuento que el dueño confirma, primero en la línea de comandos | Medio día | 0 | No (sin pantalla) |
| 7 | **Una sola orden de punta a punta** (`npm run post -- --local … --foto … --referencia …`): exige la referencia, plantilla, generación por la vía del punto 4, importación, máscara, comprobación, componer y exportar, con paradas para que confirmes | 2–3 días | Lo que cueste cada foto | Depende del 4 |
| 8 | Que la intención de diseño la escriba el director a partir de la ficha de la referencia (F3) | 3–5 días | 0 (Gemini gratis) | No |
| 9 | Decidir si las piezas hechas con herramientas cuentan para las 5 | — | 0 | **Sí** |
| 10 | DAK y Mesón: otro intento con una cámara extrema, o revisar la regla | 15 min | 2–4 créditos por post (saldo: 8,81) | **Sí** |
| 11 | Pasar a los oficios las lecciones de María y las observaciones (ejemplos que gustaron, clave baja con entorno) | 1 h | 0 | **Sí** |
| 12 | Actualizar `CONTEXTO-PARA-IA.md`, `ARQUITECTURA.md` §2 y E6, y el README | 1 h | 0 | No |
| 13 | Capacidades del compositor que faltan (giro libre, patrón, didona condensada, manuscrita) | 1–2 días | 0 | No |
| 14 | Pantallas web nuevas (F4) | Varios días | 0 | **Sí** (aprobación) |
| 15 | Probar con 3–5 fotos reales «con prisa» de hosteleros | 1 h más la generación | Unos 4 créditos por foto con reintento | **Sí** (las fotos) |

---

## 11. Autocrítica

1. **Me he desviado hacia hacer piezas en lugar de hacer el producto.**
   - En tres días hice el benchmark, la prueba Society, 4 posts, el chiringuito, tres locales nuevos y la ronda de María. Cada pieza enseña algo, pero el objetivo era «subo una foto y sale un post».
   - Ese flujo sigue sin existir: cada post son unos 10 pasos que hago yo en la conversación.
2. **He apoyado todo el trabajo reciente en una vía que el producto no puede usar** (el MCP desde la conversación) y no lo he dicho con la fuerza necesaria. La decisión del modelo de producción quedó abierta mientras se acumulaban resultados de otro modelo.
3. **El requisito más importante, la fidelidad comprobada, sigue siendo mi ojo.** Diseñé la puerta de calidad y no la construí. Me evalúo yo mismo la fidelidad y la rúbrica, y eso no escala ni es fiable.
4. **La regla de la referencia existe, pero mi propia cadena se la salta:** es voluntaria y lo hecho no cuenta. Está «hecha» en el dominio, no en el uso.
5. **He roto datos sin darme cuenta:** los `marca.json` inválidos. Escribí datos a mano sin pasarlos por el esquema de la app, y las pruebas no lo cubren.
6. **Demasiados documentos, demasiado largos y que se contradicen:** 6 informes en `diseno/f1_6/` (casi 2000 líneas) y un `CONTEXTO-PARA-IA.md` desfasado. Las fases se han partido en sub-fases (FASE 0, FASE 1, benchmark, Society, posts…) que ya no casan con el plan F0–F8 de la propuesta.
7. **Lo que cambiaría:**
   - congelar las piezas de prueba;
   - hacer el commit;
   - arreglar los dos fallos de §0;
   - que decidas la vía de generación;
   - construir **una sola orden** de punta a punta con la puerta de salida automática;
   - medir el resultado solo con fotos reales y con prisa de hosteleros, y con una prueba a ciegas tuya frente a las referencias.

   Hasta entonces, ninguna pieza nueva.
