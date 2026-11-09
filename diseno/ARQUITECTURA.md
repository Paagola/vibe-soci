# Estudio de contenido · diseño del MVP local

Diagrama: [diagrama_flujo.drawio](diagrama_flujo.drawio) (páginas: 1 · flujo, 2 · director creativo, 3 · arquitectura).

## 1. Qué se quiere (requisitos sacados de `creacion-contenido/`)

| # | Requisito | De dónde sale |
|---|---|---|
| R1 | De **una idea** sale una pieza creativa y llamativa para redes. Cómo montar un carrusel es secundario. | README de `creacion-contenido` |
| R2 | **Personalidad propia y creatividad**: nada de colores genéricos, sino la identidad del local. | README |
| R3 | **Fidelidad a las fotos originales**: mismos elementos reales y nada inventado. | README, `Prompts-explicaciones.md` |
| R4 | **No son prompts estrictos.** El sistema da indicaciones de lo que ha gustado. | README |
| R5 | Cada pieza lleva **como mínimo una foto real de un plato**. Opcionales: el local, más platos, vajilla y personas. | `Prompts-explicaciones.md` |
| R6 | **No repetir el mismo ángulo con más calidad.** Hay que recomponer como un fotógrafo profesional. | Plaza y Gambas (no gustaron) |
| R7 | Foto y texto en **una sola generación**, sin cajas detrás del texto y en español exacto. | Guía de herramientas §0 |
| R8 | Coste bajo control: se pide confirmación antes de generar, en lotes pequeños, y nunca se reenvía un trabajo cuyo resultado no se conoce. | Guía §5 |
| R9 | Las correcciones parten de la imagen fallida («keep image 1 almost exactly» y una lista numerada de cambios). | Guía §6.7 |
| R10 | Carrusel coherente: la portada aprobada sirve de referencia al resto. | Guía §4 |
| R11 | Encaja con la app (S06 → S09): mismo brief, mismos límites y mismos nombres. | `diagrama_pantallas_detalle.drawio` |
| R12 | **Solo en local.** La seguridad no es prioritaria, pero el código debe ser legible y mantenible. | Petición del encargo |

## 2. Hallazgo que condiciona el diseño: Nano Banana Pro no está en la API

El catálogo de la API pública de Higgsfield (docs.higgsfield.ai, consultado el 03/11/2026) solo incluye estos modelos de imagen: Soul, Marketing Studio Image, Ads Studio, Grok Image 2.0, Recraft, Qwen Image 3, Ideogram 4.0 y Z-Image. **Nano Banana Pro solo se puede usar desde la web de Higgsfield o con su conector MCP.** Esto confirma el riesgo de la comprobación C-18 de la app.

Por eso el MVP tiene **dos vías de generación** (decisión E6):

- **Por la API.** Se usa un modelo intercambiable. Por defecto es `marketing-studio/image` en modo directo (`enhance_prompt: false`), que admite hasta 16 imágenes de referencia, 4K y edición.
- **A mano.** Se genera en la web de Higgsfield con Nano Banana Pro, siguiendo `plan.md`, y después se ejecuta `importar`. El resto del flujo es el mismo: revisar, corregir, valorar y exportar.

**Otra vía (03/11/2026), corregida el 07/11:** la clave de Gemini del equipo **lista** `gemini-3-pro-image`, pero **ningún modelo de imagen de Gemini tiene tier gratuito en la API**. La llamada real dio HTTP 429 (07/11) y la clave está en el tier gratuito, sin facturación. El adaptador existe (`src/adaptadores/gemini/imagenGemini.ts` y `src/herramientas/generarGeminiImagen.ts`, con tope y registro), pero **no se puede usar sin activar la facturación de Google, y eso no está decidido**.

**Lo que se ha usado de verdad desde el 07/11 (actualizado el 09/11/2026):**
- Todas las fotos nuevas (25) salieron del **conector MCP de Higgsfield**, llamado desde una conversación con una IA, con `get_cost` antes de cada petición. **El código no puede llamar al MCP**, así que esta vía sirve para pruebas, no para el producto.
- **El nombre del modelo no es fiable en las respuestas del MCP:**
  - pedido `nano_banana_pro` → el trabajo responde `nano_banana_2` y el movimiento se etiqueta «Nano Banana Pro»;
  - pedido `nano_banana_2` → el trabajo responde `nano_banana_flash` y el movimiento se etiqueta «Nano Banana 2».

  A 2K, los dos cuestan 2 créditos. Lo más probable es que `nano_banana_2` sea el identificador interno de Pro, pero no está demostrado.
- **Vía de generación del producto (decisión del 09/11/2026): Gemini de imagen de pago** (`gemini-3-pro-image`), detrás del puerto `GeneradorFoto` (`src/adaptadores/gemini/GeneradorFotoGemini.ts`). No envía nada sin `GEMINI_FACTURACION=si` y comprueba el tope `GEMINI_TOPE_USD` antes de cada envío. La comparación está en [`f1_6/ESTADO.md`](f1_6/ESTADO.md) §8.

## 3. Decisiones

| Id | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| E1 | **Todo en ficheros**: JSON para los datos y Markdown para la biblioteca. | Es local, se puede inspeccionar y editar a mano, y no hace falta base de datos. | SQLite: añade dependencia y migraciones sin ganar nada a este tamaño. |
| E2 | **Node 24, TypeScript estricto, ESM y zod.** | Es el mismo stack que `Society-TypeScript/api`, así que los casos de uso se pueden llevar al worker. | Python: obligaría a reescribirlo para la app. |
| E3 | **Puertos y adaptadores.** El dominio y los casos de uso solo dependen de interfaces. | Permite cambiar Gemini o Higgsfield, simular sin gastar y probar el flujo entero. | Llamar a las APIs desde los comandos: queda acoplado y no se puede probar. |
| E4 | **Director creativo en dos pasos**: primero 3 conceptos distintos y tú eliges, después el plan del concepto elegido. | Responde a R1, R2 y R4: la IA propone ideas y tú decides. Así no hay una plantilla única. | Un solo paso que escribe el prompt: sale siempre el mismo recurso. |
| E5 | **La biblioteca son datos, no código**: `principios.md`, `ejemplos/*.md` y `valoraciones.jsonl`. | Lo que gusta cambia, y el equipo lo edita sin tocar código (R4). Cada voto con su motivo enseña al director. | Reglas escritas dentro del prompt en el código. |
| E6 | **Generador intercambiable** con una estrategia por modelo: `marketing-studio/image` (por defecto **en la web antigua**), `ideogram/v4.0` y `xai/grok-imagine-image-2.0`. También la vía manual. **Actualizado el 09/11/2026:** la vía nueva (foto sin texto y compositor) genera con **Gemini de imagen de pago** (decisión del 09/11), con tope en el código. El MCP de Higgsfield queda solo para pruebas (no automatizable). Grok queda descartado para la foto nueva: conserva la geometría de la foto subida (benchmark, 3 de 3). | Ver §2. Cada modelo tiene sus propios parámetros y límites (referencias, longitud del prompt, proporciones). | **Ads Studio**: impone su propia creatividad y rompe R2 y R4. |
| E7 | **Coste**: hay confirmación, un límite diario (40, como D-32) e `Idempotency-Key`. El `requestId` se guarda **antes** de esperar, y si se corta, se reanuda en lugar de reenviar. | R8. | |
| E8 | **Regla de cifras**: un número que sale en la imagen tiene que estar en la idea o en las condiciones. Si no, el plan se rechaza y se pide otra vez. | Es la misma regla que la app (la IA no inventa precios ni fechas). | Fiarse del prompt. |
| E9 | **Modo `--simular`**: un director y un generador falsos que no gastan nada. Desde el 06/11/2026 tiene **sus propios datos** (`datos-simulado/`: locales, piezas y votos). | Para probar el flujo y los tests sin claves. Con los datos aparte, una imagen simulada nunca cuenta como hecha ni se envía como portada en el modo real. | Compartir `datos/` y filtrar por origen en cada regla: es fácil olvidar un filtro. |
| E10 | **Proporciones** (actualizada el 06/11/2026): el feed se diseña y se genera a **3:4 (1080 × 1440)**, con una **zona segura 4:5** en el centro. Se exporta a 3:4 y también a 4:5 (1080 × 1350), que recorta 45 px arriba y abajo. Las historias van a 9:16 (1080 × 1920). | Decisión del usuario. Los tres modelos de Higgsfield admiten 3:4 y marketing-studio no admite 4:5. | La versión anterior pedía 4:5 al director, 3:4 a los modelos y exportaba entre 1350 y 1440 según la imagen. |
| E11 | **Orden de las imágenes fijado por el código**: primero las fotos de la diapositiva, después la referencia de estilo y por último la portada aprobada. El código añade al prompt una leyenda con ese orden. | En los prompts que funcionaron, «Image 1» e «Image 2» importan. Si el orden fuera ambiguo, la imagen saldría mal. | |
| E12 | **Gemini** para el director: visión y salida JSON validada con zod, con un reintento que le devuelve el error. | Capa gratuita (presupuesto 0 €) y es el mismo proveedor que PLAN_PIEZA en la app. | |
| E13 | **Modelo de respaldo y tiempos máximos**. Gemini tiene 90 s por petición; si el principal está saturado (503, 429 o tiempo agotado), se pasa a `GEMINI_MODELO_RESPALDO` y se sigue con él toda la ejecución. Higgsfield tiene 60 s por petición; la espera del trabajo se hace consultando el estado. | En la prueba real del 03/11, `gemini-3.8-flash` daba 503 por alta demanda y `gemini-3.5-flash` respondía. | Esperar sin límite: el comando se quedaba colgado. |

## 4. Modelo de datos

Los nombres son los de la app (pieza, diapositiva, generación), en camelCase dentro del JSON.

```text
datos/locales/<slug>/marca.json
  Marca { slug, nombre, ciudad, descripcion, tonos[1–5], colores[{nombre, hex}] (máx. 6), tipografias[{rol, descripcion}] }

datos/piezas/<id>/pieza.json
  Pieza {
    id, localSlug, creadaEn, formato POST | CARRUSEL | HISTORIA, numDiapositivas,
    idea (10–300), tipo PLATO_ESTRELLA | NOVEDAD | OFERTA | EVENTO, condiciones {precio?, fechas?, limites?},
    fotos[{archivo, papel PLATO | LOCAL | VAJILLA | PERSONAS | OTRO, nota?}]   ← mínimo 1 PLATO
    referenciaEstilo? {archivo, nota?}                                         ← solo inspiración
    conceptos[]  Concepto {titulo, mecanismo, fotografia, tipografia, textos[], porQue}
    conceptoElegido?, plan? Plan {diapositivas[{posicion, funcion, textos[], fotos[], prompt}], pie, hashtags[], textoAlt}
    generaciones[] Generacion {diapositiva, version, origen API | MANUAL | SIMULADO, modelo, prompt, referencias[],
                               comentario?, estado PENDIENTE_MANUAL | ENVIADA | COMPLETADA | FALLIDA,
                               requestId?, urlEstado?, archivo?, error?, valoracion?, creadaEn}
  }
datos/piezas/<id>/fotos/  referencia/  generadas/d<n>_v<k>.png  plan.md
  exportadas/3x4/NN.jpg  exportadas/4x5/NN.jpg  exportadas/9x16/NN.jpg  exportadas/pie.txt
  (las exportaciones anteriores al 06/11/2026 están en exportadas/NN.jpg y no se tocan)

biblioteca/principios.md · biblioteca/ejemplos/*.md · biblioteca/valoraciones.jsonl
  Valoracion { fecha, localSlug, piezaId, diapositiva, version, veredicto GUSTA | NO_GUSTA, motivo, prompt, archivo }

datos-simulado/  locales/ · piezas/ · valoraciones.jsonl   ← lo mismo, pero del modo simulado
```

**Escrituras.** `pieza.json` solo se crea con `guardar`. Cualquier cambio posterior pasa por `AlmacenPiezas.actualizar(id, cambio)`, que lee lo último guardado y aplica el cambio con un cerrojo por pieza. Así un trabajo largo no pisa un voto ni una importación hechos mientras tanto.

## 5. Reglas del dominio (`src/dominio/reglas.ts`)

| Regla | Valor |
|---|---|
| Diapositivas por formato | POST 1 · CARRUSEL 3–5 · HISTORIA 1–3 |
| Fotos | al menos 1 con papel PLATO; JPG, PNG o WEBP; máx. 10 MB |
| Condiciones | obligatorias (al menos un campo) si el tipo es OFERTA o EVENTO |
| Plan | tantas diapositivas como `numDiapositivas`, posiciones 1..n, fotos que existen en la pieza y ninguna cifra sin autorizar |
| Correcciones | máx. 3 por diapositiva (D-17); las fallidas del proveedor no cuentan |
| Contenido de una corrección | `problemasDeCorreccion`: empieza por «Keep image 1 almost exactly», cada texto escrito tal cual en el prompt, máx. de palabras del formato y ninguna cifra que no esté en la idea, las condiciones o el comentario del dueño. Si falla, se le devuelve al director (hasta 3 intentos) y no se gasta nada |
| Límite diario | `LIMITE_IMAGENES_DIA` (40 por defecto); cuentan las generaciones por API no fallidas de hoy, y «hoy» es el día en `ESTUDIO_ZONA_HORARIA` (Europe/Madrid por defecto) |

## 6. Capas

```text
src/
  web/            entrada: servidor Express local (127.0.0.1:4321)
    arrancar.ts   lee la config y arranca el servidor
    estudio.ts    dependencias de cada modo (real o simulado), trabajos, estimador y subidas
    trabajos.ts   trabajos en segundo plano en memoria (fase, progreso, avisos, fin estimado)
    estimacion.ts tiempo restante con duraciones reales (imágenes y llamadas al director)
    rutas/        API JSON (/api) y archivos de las piezas (/archivos)
    publico/      frontend sin build: index.html, estilos.css, js/ (módulos ES)
  aplicacion/     casos de uso, uno por archivo, con sus dependencias como parámetro
  dominio/        modelos (zod + tipos), reglas puras y errores
  puertos/        interfaces: DirectorCreativo, GeneradorImagen, AlmacenPiezas y AlmacenLocales (Almacenes.ts),
                  BibliotecaCreativa, ProcesadorImagen
  adaptadores/    gemini/ · higgsfield/ · simulado/ · ficheros/ · imagen/
  config.ts       .env validado con zod
  contenedor.ts   raíz de composición: el único sitio que crea clases concretas
```

Reglas de dependencia: `web → aplicacion → (dominio, puertos)` y `adaptadores → (puertos, dominio)`. Ningún archivo de `aplicacion` ni de `dominio` importa nada de `adaptadores` ni de `web`.

**Trabajos largos y tiempo restante.** Proponer conceptos, escribir el plan, generar y corregir pueden tardar minutos. La web los lanza como trabajos en segundo plano (`202` + id) y el navegador consulta su estado cada 2 s.
- Los casos de uso informan del progreso con un callback opcional `alProgresar`: el mensaje, las imágenes hechas y los pasos que quedan (llamadas al director y tandas de imágenes).
- La web calcula el restante como `director × media del director + tandas × media de imagen`. Las imágenes de una tanda van en paralelo.
  - La media de imagen sale de `creadaEn → terminadaEn` de las generaciones completadas.
  - La del director sale de las últimas 20 llamadas, guardadas en `datos/duraciones.json`.
  - Sin datos se usan 90 s por imagen de la API y 60 s por llamada al director.
- La cuenta atrás solo se reestima al cambiar de paso. Si se pasa, la interfaz dice «casi listo…».
- Los trabajos siguen corriendo aunque se recargue la página. Lo que se pierde si se reinicia el servidor es el trabajo en memoria, no lo pagado: el `requestId` ya está en `pieza.json` y «Generar» lo retoma.

**Gasto.** Antes de generar o corregir por la API, la web pide el presupuesto (`GET /api/piezas/:id/presupuesto`), que no gasta, y muestra un modal con el número de imágenes, el modelo y las usadas hoy frente al límite. La API rechaza `generar` sin `confirmado: true`. El interruptor «Modo simulado» (o `ESTUDIO_SIMULAR=1`) cambia a los adaptadores simulados.

## 7. Equivalencia con la app SOCIETY

| Estudio local | App |
|---|---|
| «Nueva pieza» | S06 Idea + S07 Estética + S08 Fotos |
| «Proponer conceptos» + «Elegir este» (plan) | Trabajo PLAN_PIEZA (Gemini, JSON, validación) |
| «Generar» | Trabajo IMAGEN_DIAPOSITIVA (enviar → esperar → guardar) |
| «Pedir cambio» | S09 · regenerar(posicion, comentario), máx. 3 |
| Panel de progreso con «quedan unos X s» | S09 · «Generando 2 de 4 · quedan unos 40 s» (D-19) |
| «Exportar» | sharp → 1080 × 1440 (3:4) y 1080 × 1350 (4:5) / 1080 × 1920 |
| «Me gusta / No me gusta» + biblioteca | **Nuevo.** Es candidato a llevarse a la app (P1) |

## 8. Fuera del MVP

- Varios usuarios a la vez y trabajos que sobrevivan a un reinicio del servidor: el registro de trabajos vive en memoria porque es una herramienta local de una persona.
- Búsqueda automática en Pinterest: la referencia de estilo la aporta el usuario.
- Publicar en Instagram: se publica a mano con lo que sale de `exportadas/`.
- La conversión de HEIC: hay que exportar antes a JPG.

## 9. Estado de las pruebas (actualizado el 06/11/2026, tras la F0)

| Qué | Resultado |
|---|---|
| `npm test`: reglas, estrategias de modelo, clientes HTTP con `fetch` falso, flujo completo simulado, API web, estimación del tiempo y estabilidad (F0) | 55 de 55 |
| Web en modo simulado: API de punta a punta (tests y `curl`) y vistas en Chrome headless | Funciona (la CLI se ha retirado) |
| Director real con Gemini (conceptos y plan) | Funciona, con el modelo de respaldo (03/11) |
| Higgsfield: generar imágenes | Funciona: 9 imágenes el 03/11 (6 con `marketing-studio/image` y 3 con grok) |
| Ejemplos «Cargar ejemplo» | Recuperados el 06/11 con fotos en `plantillas/fotos/`, porque `../creacion-contenido/` ya no existe |

## 10. Sistema creativo v2 (03/11/2026)

**Por qué:** el usuario aportó 30 posts propios de referencia (`creacion-contenido/posts`) como nivel de creatividad y profesionalidad. El análisis completo está en [biblioteca/analisis-posts.md](../biblioteca/analisis-posts.md).

| Cambio | Dónde | Por qué |
|---|---|---|
| Principios reescritos: cinco familias visuales, jerarquía en tres niveles, legibilidad en el móvil y zonas seguras, catálogo de mecanismos texto-producto, color en 2–3 tintas, elementos gráficos con propósito y carrusel como historia | `biblioteca/principios.md` | Es lo que repiten los posts de referencia |
| Seis fichas «REFERENCIA DEL USUARIO» con su mecanismo y un prompt «a la manera de» | `biblioteca/ejemplos/07–12` | Dan al director recursos que puede adaptar y combinar, frente a las piezas «GUSTÓ», que no debe repetir |
| 29 miniaturas de 640 px con un índice de etiquetas (tipo de pieza, familia visual, productos) | `biblioteca/referencias/` | Para que el director **vea** composición y jerarquía, no solo lo lea |
| El director mira 3 referencias afines, de familias visuales distintas, al proponer conceptos; en el plan solo recibe su descripción | `BibliotecaCreativa.leerGuia(afinidad)`, `elegirReferencias.ts`, `DirectorGemini` | Ayuda donde más falta hace sin disparar el tamaño de la petición (unos 3 × 40 KB). Las referencias **nunca** van al generador |
| Conceptos: cada uno de una familia distinta y uno arriesgado; campos opcionales `tratamiento` y `paleta` | `instrucciones.ts`, `modelos.ts` | Más variedad y conceptos más llamativos |
| Plan: `titular`, `transicion` por diapositiva y `hiloVisual` del carrusel; bloque LAYOUT en el prompt | `instrucciones.ts`, `modelos.ts`, `planMarkdown.ts` | El carrusel se planifica como una historia con continuidad visual |
| Reglas nuevas en `problemasDelPlan` | `reglas.ts` | Ver la tabla siguiente |
| Marca con `instagram` y `web` opcionales | `modelos.ts` | Los posts firman con el contacto real; sin estos datos, el director no pone ninguno |

**Reglas nuevas que se comprueban:**

| Regla | Valor |
|---|---|
| Palabras en la imagen | 30 como máximo por diapositiva (20 en historias); lo largo va en el pie |
| Titular | 5 palabras como máximo, y tiene que ser uno de los textos |
| Textos en el prompt | Cada texto tiene que estar escrito literalmente en el prompt (si no, el generador inventa) |
| Hilo visual | Obligatorio si la pieza tiene más de una diapositiva |
| Cifras | Se aceptan el contador del carrusel (n/N o (0n), si cuadra con el número de diapositivas) y las cifras de un @usuario o una web |

**Reglas que cambian porque los posts del usuario las contradicen:**

- **«Sin cajas ni pegatinas detrás del texto»** pasa a «uno o dos elementos gráficos con propósito»: sello de precio, franja de papel rasgado, tira de cuadros o flechas. Sigue prohibida la caja genérica, así como la interfaz falsa y los datos inventados.
- **«Sin números de diapositiva»** pasa a permitir un contador pequeño y coherente en los carruseles.
- **El recorte del plato real sobre un color plano** pasa a ser una familia válida, siempre con el mismo plato y la misma vajilla.

**Prueba real con Gemini** (03/11/2026, plantillas del Asador Etxebarri). `gemini-3.8-flash` daba 429 o 503 y respondió `gemini-3.5-flash`; los conceptos tardan entre 60 y 150 s y el plan entre 12 y 40 s.

- **Mejora:** los 3 conceptos son de familias distintas (low-key, editorial blanco y macro a sangre).
- **Mejora:** los titulares tienen 1–3 palabras y los prompts traen un bloque LAYOUT con márgenes.
- **Mejora:** el carrusel trae `hiloVisual`, una transición por diapositiva y un contador «01/03» coherente.
- **Pendiente:** con el mismo local y el mismo plato que el ejemplo 02, el primer concepto aún vuelve a «FUEGO detrás del chuletón».
- **Pendiente:** la última diapositiva no siempre llevaba llamada a la acción. Ya se ha reforzado la instrucción, pero no se ha vuelto a probar.

## 11. Pendientes conocidos (revisados el 06/11/2026; ampliados el 07/11/2026)

**F1.6, referencia obligatoria (07/11/2026; ampliada el 09/11).** Mientras un local tenga menos de 5 piezas, una pieza no pasa de brief a concepto sin una referencia elegida y analizada (`src/dominio/referencia.ts`, `comprobarReferencia`). **Cuentan las piezas de la app y las hechas con herramientas** (las que declaran `pieza` en `proyectos/…/plan.json`; decisión del 09/11). Hoy lo aplica la línea de comandos (`npm run referencia`), que **solo lee**: la hoja de familias la pinta `referencia propuestas`. **El flujo web tendrá que respetar esta regla** antes de `proponerConceptos` cuando se aprueben sus pantallas; hasta entonces el generador antiguo no la comprueba.


| Asunto | Afecta al funcionamiento | Estado |
|---|---|---|
| El id de la pieza tomaba la fecha en UTC (una pieza creada a las 00:30 llevaba el día anterior) | Sí: se ve en la web y no cuadra con el límite diario | **Corregido**: `idDePieza` usa `ESTUDIO_ZONA_HORARIA`. Los ids ya creados no cambian |
| Votos automáticos: 3 de los 4 votos de `valoraciones.jsonl` los escribió un script (03/11/2026, misma ráfaga de 30 ms y el mismo motivo) | Sí: el director los leía como gusto del dueño | **Corregido**: se conservan marcados con `origen: AUTOMATICA` y el director solo aprende de los humanos. Copia previa en `datos/copias/`. En los `pieza.json` de esas piezas la valoración sigue tal cual (solo se usa para mostrarla y no influye en la exportación) |
| Enlaces a `../creacion-contenido/` en `biblioteca/ejemplos/*.md`, `principios.md`, `analisis-posts.md` y `referencias/indice.json` | No: el director lee esos textos, pero no abre los enlaces, y el índice de referencias ignora esa nota | **Para otra fase**: decidir si se reponen los archivos (si vuelve a aparecer la carpeta) o se cambian los enlaces por una descripción. Cambiar esos textos cambia lo que lee el director, así que conviene hacerlo con una prueba de conceptos delante |
| Exportar a 4:5 las 9 imágenes generadas antes del 06/11 deja la firma pegada al borde, porque se generaron sin zona segura | Solo para esas piezas | Usar su exportación 3:4. Las nuevas llevan la instrucción de zona segura |
