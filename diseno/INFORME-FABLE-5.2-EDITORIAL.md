# Qué contar mañana

**Informe editorial y de producto de Pase Hydrogen · 21 de noviembre de 2026 · revisión `988d373`, árbol limpio**

> **Autoría.** Lo redactó Claude Opus 5.5 en Claude Code. La sesión cambió de modelo con `/model` antes de empezar, y el archivo conserva el nombre del encargo. Durante el trabajo no se generó ninguna imagen de pago, no se publicó nada y no se tocó el código del producto. La búsqueda amplia en Pinterest la hizo un subagente económico (Sonnet) y el corte final es mío.

## 1. Qué construiría primero

**«Mañana»: una propuesta diaria de qué contar, apoyada en un libro del local que recuerda qué es cierto, qué se publicó y qué se prometió.**

Cada tarde, el sistema presenta hasta tres entregas distintas para el día siguiente, más dos salidas: **pedir un dato** y **dejar pasar el día**. Cada opción indica qué pregunta responde, qué hecho del local la sostiene, qué material falta, cuánto trabajo pide y cómo se relaciona con lo ya publicado. La persona elige con un toque. La producción sigue por las vías que ya existen: la orden única, el taller o el Estudio.

**Quién la usaría durante una semana.** En una cafetería pequeña como Café Albor, la dueña o la encargada del turno de mañana.

- **Al cerrar el turno** deja un parte de un minuto: una nota de voz o de texto, una o dos fotos, una duda oída en sala, un cambio de carta o «sin novedades».
- **Después** confirma los hechos que el sistema ha entendido y elige una opción para el día siguiente.
- **Al publicar** marca la entrega como publicada.

El objetivo es no pasar de cinco minutos al día; el piloto tiene que medirlo. El estudio revisa cada lunes la semana anterior y los hilos abiertos, en unos quince minutos.

**Por qué aporta más que otro generador de piezas:**

1. **Generadores ya hay tres, y ninguno sabe qué se publicó.** El Estudio clásico, la orden única con productor y el taller producen piezas, pero ningún modelo tiene el estado «publicada». El estado final, `HECHO`, solo significa «compuesta» ([ordenPost.ts:732-737](../src/aplicacion/post/ordenPost.ts#L732-L737)), aunque la escena 3D lo rotule como «PUBLICADOS» ([estaciones.js:518](../src/web/publico/js/diorama/estaciones.js#L518)).
2. **La memoria que existe recuerda cómo se veían las piezas, no qué decían.** El taller y el director de foto comparan cámara, escala y gesto de los seis últimos encargos terminados ([historialFotografico.ts:26-48](../src/aplicacion/post/historialFotografico.ts#L26-L48)). Así evitan repetir la foto, pero no el mensaje.
3. **Los textos de El Pase se limitan al nombre de un elemento, la marca, la ciudad o la cuenta** ([editorial.ts:3-7](../src/dominio/editorial.ts#L3-L7), [taller/direccion.ts:59-64](../src/aplicacion/taller/direccion.ts#L59-L64)). Eso protege contra la invención, pero produce piezas que el local de enfrente podría publicar cambiando el nombre, como «TENTÁCULO DE PULPO A LA BRASA · ASADOR ETXEBARRI».
4. **Los fallos que he encontrado no son de render.**
   - En `pulpo-2` y en `pulpo-a-la-gallega`, la pieza terminó con una foto que la comprobación había descartado (§2.5).
   - En el carrusel clásico de Café Albor, el generador fundió dos tostadas en un plato que no existe y escribió «EL ACOMRAÑANTE» dentro de la imagen. El pie añadió «masa madre», «dukkah artesanal» y «zumo recién exprimido», que nadie había dicho (§2.6).

   Otro generador multiplicaría la salida sin corregir ninguno de estos fallos.
5. **La memoria mejora las vías actuales sin rehacerlas.** Les entrega hechos con fuente, que aportan verdad, y lo ya contado, que obliga a aportar novedad. Hoy el único dato que entra del negocio es una nota de 3 a 300 caracteres ([abrirEncargo.ts:23](../src/aplicacion/post/abrirEncargo.ts#L23)), y el campo `idea` está vacío en los cinco briefs guardados.

Para que «Mañana» funcione hacen falta antes tres piezas que no se ven en pantalla: el estado real de cada entrega (borrador, exportada o publicada), unas compuertas de veracidad que gobiernen y un registro de hechos con fuente y vigencia. El plan de la §7 las ordena.

---

## 2. Auditoría: qué funciona de verdad

### 2.1 Qué he revisado

- **Código.** Unas 26.500 líneas de TypeScript en `src/`: dominio, aplicación, puertos y adaptadores (Gemini, Higgsfield, OpenAI, sharp, Vision y simulados), además de la web Express y su frontend sin compilación.
- **Entradas.** Las rutas web `/api/piezas`, `/api/encargos`, `/api/panel` y `/api/procesos`, los archivos que sirve la web y las órdenes de terminal de `package.json`.
- **Datos guardados.** Las 21 carpetas de `proyectos/`, los diez locales de `datos/locales/`, las siete piezas del Estudio de `datos/piezas/`, los renders de `datos/disenos/` y el gasto de `datos/gasto/`.
- **Biblioteca creativa.** `biblioteca/` (29 referencias, índice, principios y cuatro valoraciones), `conocimiento/` y `referencias-pinterest/` (123 imágenes).
- **Pruebas.** `npm test` pasa **468 de 468** en 58 s y `npm run typecheck` termina limpio.
- **Un encargo de principio a fin.** Seguí `pulpo-2` desde la entrada hasta la exportación, cruzando la bitácora, `post.json`, las tres versiones del brief, los activos, la máscara, la intención, el render y la crítica, y comparé las imágenes.
- **El informe previo** (`INFORME-CONTINUIDAD-EDITORIAL.md`) lo leí después de formarme mi propio juicio. Las diferencias están en la §2.9.

### 2.2 Tres vías de producción y a quién sirven

| Vía | Qué pide | Qué entrega | A quién sirve | Qué ocurre al pasar a la siguiente publicación |
|---|---|---|---|---|
| **Estudio clásico** (`/index.html`, `/api/piezas`) | Formato (post, carrusel o historia), número de imágenes, idea de 10 a 300 caracteres, tipo (plato estrella, novedad, oferta o evento), condiciones y fotos | Tres conceptos, un plan con textos y prompts, la imagen entera generada con el texto dentro (Higgsfield) y una exportación 3:4, 4:5 o 9:16 con `pie.txt` ([modelos.ts](../src/dominio/modelos.ts), [exportarPieza.ts](../src/aplicacion/exportarPieza.ts)) | Al dueño que ya sabe qué quiere anunciar | Nada. Los conceptos descartados solo se recuerdan dentro de la misma pieza. El director lee las 20 últimas valoraciones de todas las marcas, sin filtrar por local |
| **Orden única con productor** (El Pase en `/`, `/api/encargos`, `npm run post`) | Foto, nota del dueño, local, referencia (obligatoria en las cinco primeras piezas) y post o carrusel | Brief versionado, inventario confirmado, foto nueva de pago, comprobación, composición propia, crítica y exportación 3:4 y 4:5 ([ordenPost.ts](../src/aplicacion/post/ordenPost.ts), [brief.ts](../src/dominio/brief.ts)) | Al estudio, para convertir una foto de móvil en una pieza de nivel profesional sin inventar | El director de foto ve las miniaturas de los seis últimos encargos terminados del local para no repetir la toma |
| **Taller de arte** (El Pase, arte integrado o editorial) | La misma foto y la misma nota, más dirección, toma, muestras y ruta editorial | Cartel integrado (paquete ZIP o `gpt-image-2` autorizado), foto editorial y series de carrusel con tomas ([taller.ts](../src/aplicacion/taller/taller.ts)) | A la dirección de arte del estudio | Lo mismo: memoria visual de seis encargos |
| **Herramientas F1 a F1.6** (`npm run activo`, `generar`, `fidelidad`, `carrusel`…) | Rutas y parámetros | Activos con procedencia, recetas y versiones del compositor | Al desarrollador, o a una IA en conversación | Nada |

Las tres primeras vías conviven sin una frontera clara, como ya señalaba la consolidación del 19/11. Ninguna parte de la pregunta «¿qué debería contar mañana?»: todas empiezan por una foto o por una idea ya decidida.

### 2.3 Un encargo de la entrada a la exportación

Este es el recorrido en la orden única con productor, la vía más trabajada:

1. **Alta** ([abrirEncargo.ts](../src/aplicacion/post/abrirEncargo.ts)). La web copia la foto a `proyectos/<proyecto>/foto/subida.*` y crea `post.json`. El único hecho que aporta el negocio es la nota (`plato`, de 3 a 300 caracteres).
2. **REFERENCIA.** Es obligatoria mientras el local tenga menos de cinco piezas ([comprobarReferencia.ts](../src/aplicacion/referencias/comprobarReferencia.ts)). De su ficha se deducen la estética y el tratamiento.
3. **FOTO_REAL.** La foto subida se registra como activo `REAL`, con `uso` `PUBLICABLE` por defecto ([ordenPost.ts:771-796](../src/aplicacion/post/ordenPost.ts#L771-L796)).
4. **PROPUESTA.** El director de foto describe la imagen: ángulo, luz, elementos, recuentos, piezas cortadas y dudas. Después propone otra toma, y el código monta el prompt ([fotoNueva.ts](../src/dominio/fotoNueva.ts)). El productor escribe el brief v1, con el inventario `PROPUESTO`, y el v2, con el plan editorial.
5. **■ CONFIRMAR_ELEMENTOS.** La persona confirma el inventario, el prompt y el gasto. El brief v3 congela el inventario.
6. **GENERAR.** Gemini de imagen, de pago, con reserva y recuperación si la petición se corta. La foto nueva queda como activo `GENERADO` con `uso` `SOLO_PRUEBA_COMPOSICION` ([ordenPost.ts:799-842](../src/aplicacion/post/ordenPost.ts#L799-L842)).
7. **COMPROBAR.** El revisor responde a tres preguntas (lista, toma y anatomía) y el código decide `PASA`, `REVISAR` o `DESCARTA` ([comprobacionSalida.ts:119-130](../src/dominio/comprobacionSalida.ts#L119-L130)). Desde F3.3 la orden ya no reintenta sola y pasa siempre a la parada.
8. **■ CONFIRMAR_FOTO.** La persona elige la candidata o la original, o pide otra explicando el motivo ([ordenPost.ts:553-630](../src/aplicacion/post/ordenPost.ts#L553-L630)).
9. **MASCARA, INTENCION y COMPONER.** El plan editorial se materializa en capas y lo pinta el compositor propio. La crítica del render admite una tanda de correcciones acotadas y la pieza se exporta en 3:4 y 4:5.
10. **HECHO.** `plan.json` recibe `pieza.fecha` y la pieza cuenta para el umbral de referencia.

**Qué se guarda:**

- `post.json`, con el historial de pasos;
- las versiones del brief, en `brief.vN.json`;
- `bitacora.jsonl`, con cada llamada y cada parada;
- `foto/propuesta.json`;
- los activos, con su procedencia y su revisión automática;
- las intenciones, en `intenciones/`;
- los renders versionados, en `datos/disenos/<proyecto>/`;
- la crítica, en `criticas/` y `revision-editorial.json`.

**Qué no se guarda:** para quién es la pieza, qué pregunta responde, qué promete, si se llegó a publicar y qué pasó después.

### 2.4 Las tres pistas

**a) El Estudio clásico contempla historias 9:16, pero nadie las ha producido y El Pase no las admite.**

- **Qué hay.**
  - El formato `HISTORIA` ([modelos.ts:12](../src/dominio/modelos.ts#L12)): de una a tres pantallas y hasta 20 palabras ([reglas.ts:12](../src/dominio/reglas.ts#L12), [reglas.ts:23](../src/dominio/reglas.ts#L23)).
  - Una instrucción al director: «titular grande y breve… la última con la acción», con el 14 % superior y el 20 % inferior libres ([instrucciones.ts:127-128](../src/adaptadores/gemini/instrucciones.ts#L127-L128)).
  - La exportación a `exportadas/9x16/`.
- **Qué es en la práctica.** Un carrusel vertical cuya imagen genera el modelo con el texto incluido. No contempla interacción, ni quién añade el sticker, ni qué hacer con la respuesta.
- **Uso real.** Ninguna de las siete piezas guardadas es una historia: hay seis posts de plato estrella y un carrusel de novedad. Las pruebas solo tocan las reglas, el adaptador de Higgsfield y el lienzo del compositor; ninguna recorre una historia de principio a fin.
- **En El Pase.** Su brief solo admite post o carrusel, con lienzo 3:4 ([brief.ts:46](../src/dominio/brief.ts#L46), [brief.ts:88](../src/dominio/brief.ts#L88)). El compositor tiene un lienzo `HISTORIA_9_16`, pero ninguna vía lo usa.
- **A quién sirve.** Al dueño que entra por el Estudio. Entre publicaciones no aporta nada.

**b) El productor de El Pase tiene su propio brief (`post/brief@1`): sirve para una pieza y no dice nada entre piezas.**

- **Qué hace bien.** Es la «única fuente de verdad del encargo» ([brief.ts:64-130](../src/dominio/brief.ts#L64-L130)) y se versiona en cada cambio. Guarda:
  - la marca y el lienzo, que fija el código;
  - los hechos: nota, inventario y datos por confirmar;
  - el plan y el presupuesto (dos fotos y doce llamadas);
  - las restricciones: `noInventar` y «sin logotipo inventado, sin precios, sin premios, sin afirmaciones comerciales».

  Una vez confirmado, el inventario no cambia sin otra confirmación, y el orquestador para la orden si una propuesta lo contradice ([orquestador.ts](../src/aplicacion/productor/orquestador.ts)).
- **Dónde se queda corto.**
  - Pertenece a un solo encargo y empieza siempre en v1 con los mismos datos de marca.
  - El campo `idea` (concepto, titular y porqué) está a `null` en los cinco briefs guardados.
  - Los textos del plan editorial solo pueden apuntar a `MARCA`, `CIUDAD`, `INSTAGRAM` o un `ELEMENTO` del inventario ([editorial.ts:3-7](../src/dominio/editorial.ts#L3-L7)). No caben un motivo, un dato de carta, una persona ni una pregunta.
- **A quién sirve.** Al estudio, para controlar el coste y la verdad pieza a pieza.

**c) El taller consulta los encargos recientes, pero solo para variar la foto.**

- **Qué consulta.** `postsRecientes` filtra el mismo local, el mismo modo (real o simulado) y el paso `HECHO`. Los ordena por fecha de creación y se queda con seis ([historialFotografico.ts:26-28](../src/aplicacion/post/historialFotografico.ts#L26-L28)). De cada uno pasa el nombre del plato, la vista, el plano, la escena, el gesto, la estructura de páginas y una miniatura.
- **Qué hace con ello.** El director de portada recibe la instrucción «Evita repetir la misma escena, aunque cambie el plato o el atrezzo» ([DirectorSecuenciaGemini.ts:7](../src/adaptadores/gemini/DirectorSecuenciaGemini.ts#L7)), y el director de foto, una parecida ([DirectorFotoGemini.ts:53](../src/adaptadores/gemini/DirectorFotoGemini.ts#L53)). Una prueba lo cubre ([secuencia-taller.test.ts:47-69](../test/secuencia-taller.test.ts#L47-L69)).
- **A quién sirve.** Al modelo que dirige la foto. Es el único vínculo que hay entre piezas, y solo afecta a su aspecto.
- **Dónde falla.**
  - Cuenta como «reciente» lo que nunca se publicó, incluido `pulpo-2` con su foto descartada.
  - No ve las piezas del Estudio clásico.
  - Ignora lo que se dijo: si mañana Etxebarri pide otro pulpo, el director evitará el mismo ángulo, pero repetirá el mismo mensaje.

### 2.5 `pulpo-2`: cuando la comprobación y la aprobación no coinciden

Horas de Madrid, tomadas de `bitacora.jsonl` y `post.json` en [proyectos/2026-11-18-pulpo-2](../proyectos/2026-11-18-pulpo-2/).

| Hora | Qué pasó | Evidencia |
|---|---|---|
| 18/11 00:00 | Se crea el encargo con la nota «pulpo», el local `asador-etxebarri` y la referencia `ref-post-14` («Pasta DELLA Casa», un bodegón oscuro con un lockup crema) | `post.json` |
| 19/11 01:25:54 | La foto subida (cenital, luz plana y un vaso que se cuela) queda como activo `REAL` `PUBLICABLE` | activo `2026-11-18-pulpo-2-real` |
| 01:26:41 | El director propone un ¾ a 25°, girado 60°, con la mitad superior casi negra para el titular. Su inventario tiene siete elementos: los langostinos, «3 (+1 cortado)», marcados como dudosos, y seis elementos que «ve el director; la nota del dueño no lo dice» | `foto/propuesta.json`, `brief.v001.json` |
| 01:26:54 | El productor fija el plan `CARTEL · CABECERA · FOTOGRAFIA`, con el elemento 0 como texto. Primera parada | `brief.v002.json` |
| 01:27:01 | **La persona confirma el inventario 6,4 s después de la parada**, con el recuento dudoso incluido. El brief v3 lo congela y autoriza dos fotos | bitácora |
| 01:27:27 | Foto nueva generada con Gemini de pago: 0,1412 USD | activo `…-foto-1` |
| 01:28:05 | **Comprobación: `DESCARTA`.** Hay cuatro langostinos en vez de tres, y los elementos están «colocados igual que en la foto subida» | `revisionAutomatica` |
| 01:28:40 | **La persona confirma la foto 35 s después.** Se registra `fidelidad: CONSERVA` «tras la comprobación automática (DESCARTA)». Las notas copian los motivos automáticos y no consta ningún motivo humano | activo `…-foto-1` |
| 01:28:40 | La intención pinta una banda crema `#F7E9D5` con el titular en negro sobre la mitad superior | `intenciones/post.json` |
| 01:29:09 | **La crítica del render aprueba sin incidencias.** Se exporta en 3:4 y 4:5, se marca la pieza y el encargo pasa a `HECHO` | `revision-editorial.json`, `plan.json` |

**Quién tenía razón en cada punto.** Comparé la foto subida, la candidata y la exportación.

- **El recuento.**
  - En la original se ven tres langostinos enteros y un cuarto cortado por el borde derecho. El inventario lo anotó como `recuento: 3, cortados: 1`, porque el recuento solo incluye piezas enteras ([fotoNueva.ts:36-50](../src/dominio/fotoNueva.ts#L36-L50)).
  - El prompt pidió «Exactly 3 × peeled cooked prawns», así que la pieza cortada desapareció del contrato.
  - Al abrir el encuadre, el generador completó el cuarto langostino. El revisor aplicó el contrato y descartó la foto. La persona la aceptó, probablemente porque ese cuarto langostino existía.

  **El contrato confundía «lo que se ve entero en la foto» con «lo que lleva la ración».** Eso solo lo sabe la cocina, y nadie le preguntó.
- **La toma.** El director pidió girar la cámara 60°. La candidata conserva el lado y la colocación de la original: es la misma escena con la cámara más baja y el fondo negro. Con la regla documentada (cambiar la altura más de 30°, de 82° a unos 25°) la foto pasaría. Con la regla que el código añadió tras el caso de Sushita, según la cual la misma distribución equivale a la misma toma ([comprobacionSalida.ts:126](../src/dominio/comprobacionSalida.ts#L126)), no pasa. El README solo describe la primera regla. **En este punto, la comprobación acertó.**
- **La crítica.**
  - Recibió la original y la candidata ([revisarEntrega.ts](../src/aplicacion/productor/revisarEntrega.ts)), pero no el veredicto automático.
  - Su repertorio de correcciones es de maqueta, y lo único que puede hacer es escalar a revisión humana ([criticaEditorial.ts](../src/aplicacion/productor/criticaEditorial.ts)). Tampoco vio el cuarto langostino como un cambio de producto.
  - Aprobó un render que contradice el propio plan: la foto se generó con aire negro para un lockup crema como el de `ref-post-14`, y la composición pintó encima un degradado crema con letra negra. La segunda línea, «A LA BRASA», queda sobre la transición gris.
- **El texto.** El dueño escribió «pulpo». El titular «TENTÁCULO DE PULPO A LA BRASA» sale del nombre que el modelo dio al elemento y que se confirmó en 6 s. La palabra «brasa» pasa el cotejo porque aparece en la descripción de la marca, «Asador de brasa con leña» ([cotejo.ts:65-75](../src/dominio/cotejo.ts#L65-L75)). El cotejo comprueba que la palabra exista en alguna fuente, no que este plato se haga a la brasa.
- **El estado.** El activo siguió como `SOLO_PRUEBA_COMPOSICION` a pesar del `CONSERVA` humano ([ordenPost.ts:615-627](../src/aplicacion/post/ordenPost.ts#L615-L627)). La orden de terminal `npm run fidelidad` lo habría pasado a `PUBLICABLE` ([fidelidad.ts:108](../src/herramientas/fidelidad.ts#L108)), de modo que el mismo veredicto tiene efectos distintos según la vía. El compositor dejó un `AVISO`, «no se puede publicar» ([componerDiseno.ts:76-87](../src/aplicacion/diseno/componerDiseno.ts#L76-L87)), que no detiene nada.
- **La misma foto en dos restaurantes.** La foto `f7717b58…` es la subida de `pulpo-a-la-gallega` (Torre de Vega) y también la de `pulpo` y `pulpo-2` (Asador Etxebarri). El modelo no tiene nada que ligue una foto real al local que sirvió el plato.
- **El patrón se repite.**
  - En `pulpo-a-la-gallega`, las tres candidatas salieron `DESCARTA` (0,43 USD en total). Se eligió la tercera y la crítica aprobó.
  - En `plato-de-jamon-con-vino`, una candidata descartada se confirmó a los 13 s. Esta vez la crítica sí paró la pieza, por falta de continuidad (`REVISION_HUMANA`).
- **La interfaz empuja a ir deprisa.** Para rechazar una candidata hay que escribir un motivo. Para usar una descartada basta un botón, y los avisos aparecen plegados ([fichas.js:195-214](../src/web/publico/js/pase/fichas.js#L195-L214)).

**Diagnóstico.** El revisor, la persona, la crítica y el compositor juzgaron cosas distintas, y ninguno tenía autoridad para impedir la publicación, porque la publicación no existe como estado. Lo correcto habría sido:

1. Preguntar a la cocina, ya en la primera parada, cuántos langostinos lleva la ración, porque el recuento era dudoso y había una pieza cortada.
2. Exigir un motivo tipificado para aceptar un `DESCARTA`: o corrige el inventario, o acepta de forma explícita que «no es otra toma».
3. Hacer que esa decisión, y solo esa, cambie el `uso` del activo.
4. Pasar el veredicto automático a la crítica.
5. Impedir que una pieza con un activo de prueba quede «lista para publicar».

### 2.6 Otros hallazgos de veracidad

- **El carrusel del Estudio clásico de Café Albor** ([datos/piezas/2026-11-03-presentamos-nuestra-tostada-de-aguacate](../datos/piezas/2026-11-03-presentamos-nuestra-tostada-de-aguacate/)):
  - **Portada:** una tostada flotante que mezcla las dos reales, con aguacate, tomates y dos huevos. La única valoración humana del repositorio la rechazó: «le falta más naturalidad… no volando».
  - **Segunda imagen:** el titular «EL ACOMRAÑANTE», con errata, generado dentro de la imagen.
  - **Pie:** añade «masa madre», «dukkah artesanal», «en su punto» y «zumo recién exprimido». Las reglas del Estudio solo vigilan las cifras ([reglas.ts:104-143](../src/dominio/reglas.ts#L104-L143)), así que los adjetivos y las afirmaciones pasan.
- **El brief de plantilla de Café Albor no coincide con su foto.** El brief dice «tostada de aguacate, huevo pochado y dukkah». En la foto se ven sésamo blanco y negro por encima, jamón en esa tostada y una segunda tostada con tomate que el brief no nombra. Es el caso típico de «pedir un dato» antes de publicar nada.
- **Las dos fotos de Café Albor miden 382 × 510 px.** Quedan por debajo del mínimo de 1000 px con el que el propio código avisa ([fotoNueva.ts:34](../src/dominio/fotoNueva.ts#L34)). Sirven como prueba de lo que hay en el local, pero no para un post a 1080 px ni para recortes de detalle.
- **Los locales de prueba llevan nombres de negocios reales.** Asador Etxebarri, por ejemplo, es un restaurante real y conocido, y no hay ningún dato de su carta. El sistema no puede distinguir un plato del local de una foto de otra procedencia (§2.5).
- **El taller también cierra encargos con activos de prueba.** `tarta-de-pistacho` y `hamburguesa-crujiente` están en `HECHO` con candidatas importadas como `SOLO_PRUEBA_COMPOSICION` y aprobadas.

### 2.7 Documentación frente a implementación

| Lo que dice la documentación | Lo que hace el código hoy |
|---|---|
| README: «si descarta, otro intento; si descarta 2 seguidos, se para» | Siempre pasa a `CONFIRMAR_FOTO` y decide la persona ([ordenPost.ts:501-551](../src/aplicacion/post/ordenPost.ts#L501-L551)). Los bloqueos antiguos se reinterpretan al leerlos ([post.ts](../src/dominio/post.ts)) |
| README: «Solo CONSERVA pasa a PUBLICABLE» | Es cierto en la terminal ([fidelidad.ts:108](../src/herramientas/fidelidad.ts#L108)) y falso en la orden única, donde `CONSERVA` no cambia el `uso` |
| README: «Las piezas de prueba conservan su restricción de uso al exportar» | Solo queda un `AVISO` en `resuelto.json`. Los JPG no llevan ninguna marca y el encargo pasa a `HECHO` |
| README: la toma nueva se define por el ángulo | El código también descarta por la misma distribución ([comprobacionSalida.ts:40-52](../src/dominio/comprobacionSalida.ts#L40-L52)) |
| README: «La web todavía no aplica esta regla» (referencia obligatoria) | La aplican la orden y el taller |
| README y Estudio: historias de una a tres pantallas | Solo existen en el Estudio clásico y no se han usado nunca. El Pase no las ofrece |
| `DESIGN.md` del diorama: «Galería de entrega · HECHO · PUBLICADOS» | `HECHO` significa compuesto. La publicación no se registra |
| `CONTEXTO-PARA-IA.md` (09/11) y `diseno/f1_6/ESTADO.md` | No conocen El Pase, el productor ni el taller, como ya advertía `CONSOLIDACION-2026-11-19.md` |
| `CONSOLIDACION`: 435 y 438 pruebas | Hoy son 468 y pasan todas |

### 2.8 Qué funciona y en qué grado

| Grado | Capacidades |
|---|---|
| **De extremo a extremo, con datos reales guardados** | La orden única con productor para un post: `pulpo-2` y `pulpo-a-la-gallega` llegaron a `HECHO` con Gemini real. El Estudio clásico para post y carrusel con Higgsfield (siete piezas del 03/11). El compositor determinista con versiones. La bitácora, el presupuesto de llamadas y la recuperación de envíos cortados |
| **En una vía concreta** | El carrusel del productor (`plato-de-jamon-con-vino` quedó en revisión humana). La foto editorial y la serie del taller (`tarta`, `hamburguesa`) con candidatas importadas. La referencia obligatoria. La memoria visual de seis encargos (taller y director de foto). El cotejo de textos frente a la nota, el inventario y la marca |
| **Simulado** | `npm run estudio:simulado` y `--simular`, con director, generador, revisor y máscara simulados y los datos en `datos-simulado/`. Los críticos simulados de las pruebas |
| **En el modelo o en la documentación, sin uso** | Las historias 9:16 y el lienzo `HISTORIA_9_16` del compositor. El aprendizaje por observaciones (de la hipótesis a la confirmación), que solo tiene cuatro votos, tres de ellos automáticos |
| **No existe** | Publicación efectiva, calendario, hilos entre entregas, carta vigente, vigencia de ofertas, personas identificadas, observaciones de sala, interacción en historias y métricas de audiencia |

### 2.9 Diferencias con el informe previo

Comparto su dirección: memoria entre entregas, veracidad compartida y estado de publicación. Discrepo en cuatro puntos:

1. Afirma que el proyecto «ya puede producir… la historia vertical». Solo puede hacerlo el Estudio clásico, con la imagen entera generada, y nunca se ha usado.
2. No advierte que las 29 referencias propias son plantillas de Canva (§6.1).
3. Su lectura de `pulpo-2` se queda en que hubo «evaluaciones de cosas distintas». No reconstruye el recuento cortado, la toma sin girar, la confirmación en 6 s, el activo de prueba exportado ni la foto compartida con otro local.
4. Su nota de 37,5 valora reglas por pieza que, en los casos guardados, no gobernaron el resultado. Mi rúbrica pesa esa evidencia.

---

## 3. Rúbrica: ¿puede sostener dos semanas de un mismo local?

**Unidad evaluada.** Dos semanas de contenido de un local, desde lo que aporta el equipo hasta la decisión sobre la semana siguiente.

**Escala, común a todos los criterios:**

| Nivel | Qué tiene que poder observarse |
|---|---|
| **0** | No existe ni en los datos ni en el código. |
| **1** | Hay reglas o datos parciales, pero no gobiernan el resultado en los casos guardados. |
| **2** | Funciona pieza a pieza en al menos una vía, y lo demuestra un proyecto guardado o una prueba. |
| **3** | Conecta las entregas de una semana del mismo local con un estado persistente, y una prueba automática recorre esa semana. |
| **4** | Se ha sostenido durante dos semanas con un local real, con publicación registrada y decisiones trazables. |

**Puntuación.** Se suma `peso × nivel / 4` de cada criterio. Mide la **madurez del software**. Los resultados de audiencia van en una columna aparte y no puntúan, porque hoy no hay ni una publicación registrada.

| Criterio (peso) | Qué se observa | Nivel | Evidencia | Prueba que permitiría subirlo | Audiencia |
|---|---|---:|---|---|---|
| **Verdad del negocio** (20) | Cada afirmación tiene fuente y vigencia, una foto generada no acredita hechos y las compuertas bloquean | 1 | Hay un cotejo léxico y el taller exige el nombre literal. Pero `pulpo-2` y `pulpo-a-la-gallega` terminaron con fotos `DESCARTA`, la misma foto sirvió para dos locales y el pie clásico inventó afirmaciones (§2.5, §2.6) | Reproducir `pulpo-2` en simulado. Sin un motivo tipificado no se puede usar la candidata. Con «había un cuarto langostino cortado», el inventario pasa a cuatro y el activo a `PUBLICABLE`. Ninguna pieza con un activo de prueba llega a «lista para publicar» | Sin datos |
| **Originalidad** (15) | Supera las dos preguntas de la §3.1 | 1 | Los textos se limitan al plato, la marca y la ciudad, y los mecanismos vienen de plantillas. Variar la foto no cambia el mensaje | De diez propuestas, ocho citan un hecho que solo este local puede afirmar (una persona, un proveedor, un cambio de carta, una duda de sala), y una segunda persona no consigue trasladarlas al local vecino | Sin datos |
| **Continuidad** (15) | Hay hilos que se abren, se retoman y se cierran entre fechas, y cada entrega se entiende sola | 1 | Solo hay continuidad dentro del carrusel (`hiloVisual`, `transicion`). La crítica la vigiló en `jamon-con-vino` | Una historia del jueves retoma una pregunta publicada el lunes, aporta un hecho nuevo y cierra el hilo. Tras reiniciar, el hilo conserva su estado | Sin datos |
| **Diversidad de intenciones** (10) | Hay razones variadas para publicar: avisar, ayudar a elegir, explicar, presentar a alguien, responder o cumplir una promesa | 1 | Las siete piezas clásicas son de plato estrella o de novedad, y las rutas de El Pase son tratamientos visuales, no intenciones | Un plan de dos semanas reúne al menos cinco funciones distintas, y ninguna se repite tres veces seguidas sin un motivo registrado | Sin datos |
| **Historias e interacción** (10) | Las historias tienen función propia, el sticker está previsto y hay ramas según el resultado | 1 | Hay un formato 9:16 en el Estudio, sin interacción y sin uso. En El Pase no hay nada | Se exportan de una a tres pantallas 9:16 con la zona del sticker y sus instrucciones, y cada uno de los cuatro resultados (respuesta, empate, cero o desconocido) produce una propuesta distinta | Sin datos |
| **Carga del hostelero** (10) | Minutos al día, entradas que acepta y decisiones que pide | 2 | Una pieza lleva pocos minutos y la bitácora lo mide: en `pulpo-2`, 3 min 26 s desde la primera llamada hasta la exportación. Pero el dueño sigue teniendo que decidir qué contar, y las paradas se confirman en segundos | En el piloto, la mediana queda en cinco minutos al día o menos por local, y al menos el 70 % de los días se resuelven con una sola decisión | — |
| **Constancia y plan** (10) | Plan de dos semanas con huecos, incidencias y recomposición | 0 | No hay plan, ni calendario, ni capacidad | Una incidencia a mitad de semana reordena el plan sin perder promesas, y la semana 2 se recompone a partir de lo registrado en la 1 | — |
| **Aprendizaje tras publicar** (10) | Publicación, métricas manuales, el gusto del dueño separado de la reacción del público, y decisiones que cambian | 1 | Existe un modelo de observaciones con estados y autor (dueño o estudio). Hay cuatro votos, uno humano, y nada del público | Con dos observaciones comparables, una propuesta cambia y las cita. Si faltan datos, no cambia nada | Sin datos |

**Resultado: 25/100.** Desglose: 5 + 3,75 + 3,75 + 2,5 + 2,5 + 5 + 0 + 2,5. Es una nota de madurez para sostener una quincena, no de calidad visual: el compositor y la dirección de foto están por encima de lo que sugiere la cifra. Además, una afirmación inventada, una imagen de prueba publicada o un resultado de público inventado bastan para suspender una quincena, sea cual sea la media.

### 3.1 Dos preguntas de originalidad

1. **«¿Podría publicarlo el local de enfrente cambiando solo el nombre?»**
2. **«Si el cliente vio la entrega anterior, ¿qué descubre en esta?»**

| Pieza | Pregunta 1 | Pregunta 2 |
|---|---|---|
| `pulpo-2` exportado: «TENTÁCULO DE PULPO A LA BRASA · ASADOR ETXEBARRI» | Sí: cualquier asador o pulpería con un plato de pulpo y langostinos | Nada, porque no hay una entrega anterior conectada |
| Carrusel clásico de Café Albor: «ESTRELLA / EL ACOMPAÑANTE / EMPIEZA EL DÍA EN MÁLAGA» | Sí: cualquier cafetería de Málaga con tostada y café | Nada |
| Las 29 referencias propias | Sí, por diseño: son plantillas con «Borcelle» y «reallygreatsite.com» | No aplica |
| Carrusel propuesto en la §5 para el jueves 26, sobre las tres tazas con los datos de la barra | No: habla de sus tazas, de su bandeja y de lo que explica su barra | La respuesta a la pregunta del lunes |

**Cuándo repetir construye identidad:**

- **Un ritual con un hecho nuevo cada vez:** «la taza de la semana» con un origen distinto, o «lo que sale del horno a las 8».
- **Una promesa cumplida:** se vuelve al tema porque se anunció que se volvería.
- **Un regreso que cuenta qué ha cambiado:** «vuelve la torrija; este año, con pan de…».
- **Un marco visual estable**, que hace reconocible la serie mientras el contenido cambia.

**Cuándo resulta redundante:** cuando se repiten el sujeto, la afirmación y la petición en poco tiempo sin ningún hecho nuevo. «Prueba nuestra tostada» el lunes y «Tu tostada favorita te espera» el miércoles son la misma entrega con otras palabras, aunque cambien la foto y el formato.

---

## 4. Un flujo para alguien en pleno servicio

### 4.1 Etapas

| Etapa | Qué aporta el equipo | Qué resuelve el sistema | Qué se guarda | Qué decide una persona |
|---|---|---|---|---|
| **1. Parte** (un minuto como mucho, durante el turno o al cerrarlo) | Lo que tenga a mano: una nota de voz o de texto, una o dos fotos, una duda oída en sala, un cambio de carta, una acción real de barra o «sin novedades» | Transcribe, separa los hechos candidatos, los clasifica (carta, observación, persona, foto o aviso) y hace como mucho una pregunta | Cada `hecho` queda `PROPUESTO` con quién lo aportó, cuándo y por qué medio. Las fotos entran como activos `REAL` con su fecha, su autor y el local | Nada en ese momento |
| **2. Confirmación de hechos** (1–2 min) | Confirma, corrige o descarta, y fija la vigencia cuando la hay («hasta el domingo») | Detecta contradicciones (la foto muestra sésamo y el brief dice dukkah), enlaza cada hecho con la carta y pide permiso si aparece una persona | Cada `hecho` pasa a `CONFIRMADO`, con versión, quién confirma, fecha, vigencia y permiso | Quién confirma cada tipo: la cocina, la barra o la dueña |
| **3. Propuesta de mañana** (automática, al final del día) | — | Prepara hasta tres opciones, más «pedir un dato» y «dejar pasar». Consulta la memoria: repeticiones, promesas que vencen y capacidad | Una `propuesta` con sus opciones, sus razones y lo que se descartó | Qué opción elige, con una frase opcional |
| **4. Producción** | Fotos nuevas, solo si la opción las pide | Abre un encargo o una pieza en la vía que corresponda, enlazados al hilo y a los hechos | La `entrega` en estado `BORRADOR`, con su ficha semántica | Las paradas de hoy, pero con un motivo obligatorio para saltarse un descarte |
| **5. Paquete de salida** | — | Reúne los archivos, el texto y las instrucciones del sticker, y comprueba la condición de salida: hechos vigentes y activos publicables | La `entrega` en estado `EXPORTADA` | Publicar en la app y añadir el sticker |
| **6. Publicación** (10 s) | Toca «publicada» e indica la hora; si quiere, añade el enlace o una captura | Cierra la entrega y actualiza las promesas | La `entrega` en estado `PUBLICADA` | — |
| **7. Resultado** (historia a las 24 h, post a las 72 h) | El recuento visible, las respuestas, los comentarios del mostrador o «sin dato» | No saca conclusiones de una sola observación | Una `observacion` de audiencia con su ventana | Quién la anota |
| **8. Retomar o cerrar** | — | Propone el siguiente paso del hilo o su cierre honesto | El estado del `hilo` | Aceptar o archivar |

### 4.2 Antes de elegir formato: tres opciones, pedir un dato o dejar pasar

Cada opción se describe con cinco campos: **qué pregunta responde, qué hecho la sostiene, qué material falta, cuánto trabajo pide y por qué hoy.** El formato se decide después, según el trabajo que haga la pieza:

- una información que caduca pide una historia;
- algo que el cliente querrá consultar más tarde pide un post guardable;
- un proceso con pasos documentados pide un carrusel;
- una pregunta breve cabe en una sola pantalla.

**Ejemplo: Café Albor, martes 24/11 por la tarde** (con los supuestos de la §5):

| Opción | Pregunta que responde | Hecho que la sostiene | Qué falta | Trabajo | Por qué hoy |
|---|---|---|---|---|---|
| **A. Qué lleva por encima la tostada** | «¿Eso negro es sésamo?» | La foto de la tostada, que es real, y el brief de cocina, que dice dukkah | **Que la cocina confirme qué es**: la foto enseña sésamo. Además, una foto nueva, porque la de archivo mide 382 px | Un minuto de cocina y una foto en el pase | Todavía ningún hilo habla de la tostada, pero no puede salir sin el dato |
| **B. Las tres tazas** (sigue lo del lunes) | «¿Por qué no los servís en la misma taza?» | La foto de los cafés, que es real, y la promesa del lunes («esta semana») | Los nombres y las diferencias, en palabras de la barra, y tres fotos nuevas de las tazas | Dos minutos de barra y tres fotos | La promesa vence el domingo y conviene cumplirla antes del fin de semana |
| **C. El rincón para trabajar** | «¿Se puede ir con el portátil?» | Solo la descripción de la marca | **Una foto real** del rincón y la norma de la casa (enchufes, franjas horarias) | Una foto y dos datos | Nada lo pide hoy y esperar no cuesta nada |
| **Pedir un dato** | — | — | A la cocina: «¿lo de encima es dukkah o sésamo?». A la dueña: «¿abrís el 6 y el 8 de diciembre?» | 30 s cada pregunta | Desbloquea la opción A y el aviso del puente |
| **Dejar pasar el día** | — | — | — | Ninguno | El lunes ya hubo historia, y el miércoles hay más turno |

**Recomendación del sistema: hoy, pedir los datos; el jueves, preparar la opción B.** Publicar la A sin confirmar sería inventar, y para la C no hay material.

### 4.3 Hilos entre fechas

**Qué guarda un hilo:**

- la pregunta que lo abre;
- la promesa pública, con su texto y su plazo;
- sus entregas;
- la evidencia que necesita;
- su estado: abierto, pendiente de evidencia, cumplido, cerrado sin cumplir o caducado.

**Ciclo de vida:**

- **Se abre** con una entrega que pregunta o promete algo en público.
- **Se retoma** con una entrega que resume en una frase el paso anterior («El lunes os enseñamos tres tazas…») y añade un hecho nuevo.
- **Se cierra** cuando responde a la pregunta, o con un cierre honesto si falta la evidencia: «No pudimos hacer la foto del obrador; os lo contamos con palabras».

**Reglas:**

- **Cada entrega se entiende sola.** Si alguien no vio la anterior, el resumen le basta; si la vio, encuentra el dato nuevo.
- **Como mucho, dos hilos abiertos por local.** Las promesas se hacen con margen («esta semana», no «mañana a las 9») para absorber un turno complicado.
- **Un aviso urgente no rompe un hilo.** El aviso («hoy sin espresso hasta…») ocupa el hueco del día y caduca. El paso pendiente del hilo pasa al siguiente hueco libre sin mover la fecha prometida. Si la promesa vence antes, el sistema propone cumplirla en una sola pantalla o aplazarla con una frase.
- **Cada propuesta empieza por la promesa que vence antes.**

### 4.4 Una historia con función propia

**«Tres tazas» (Café Albor, lunes 23/11): dos pantallas, y una tercera opcional el jueves.**

| Pantalla | Foto | Texto | Interacción |
|---|---|---|---|
| 1 | Una foto nueva de la bandeja hecha esa mañana. Si no la hay, la de archivo enmarcada, sin ampliarla a sangre | «Tres cafés con leche. Tres tazas distintas.» | — |
| 2 | La misma foto, más cerca de las tazas, sin recortar por debajo de la resolución real | «No es una cuestión de tamaño. Esta semana os lo explica la barra.» | Sticker de preguntas «Pregunta a la barra», opcional |
| 3 (jueves, solo si ha llegado el dato) | Una foto nueva de la taza pequeña | «[Nombre de la taza pequeña]: [lo que cambia, en palabras de la barra]» | Encuesta «¿Cuál pides tú?» con dos opciones: «La pequeña» y «La grande» |

**Quién pone el sticker:** quien publica, a mano desde la app. El paquete deja libre el 20 % inferior de la pantalla y trae el texto del sticker listo para copiar. Hasta donde sé, la API de publicación de Instagram no añade stickers interactivos; conviene comprobarlo antes de automatizar nada.

**Qué se propone según el resultado** de la encuesta del jueves, anotado a las 24 h:

- **Hay respuesta y gana una opción.** La siguiente entrega desarrolla la ganadora con un hecho nuevo, por ejemplo «La pequeña la servimos en esa taza porque…», contado por la barra. El porcentaje no se publica si nadie lo ha visto.
- **Empate.** No se fuerza un ganador: se cuenta la opción mejor documentada, o se cierra el hilo con las dos en una frase.
- **Cero votos.** No se dice «nadie votó». El hilo se cierra presentando el dato como decisión propia. Se anota «0 respuestas, encuesta a las 9:30» y no se saca ninguna conclusión de un solo caso.
- **Resultado desconocido**, porque nadie lo miró o porque caducó. Se registra como desconocido y la siguiente entrega no menciona el resultado.

### 4.5 Memoria editorial por local

**Ficha semántica de cada entrega.** Estos son los campos que se guardan:

| Campo | Contenido |
|---|---|
| `sujeto` | Producto, persona, espacio o servicio |
| `hechos` | Identificadores de los hechos que cita |
| `pregunta` | La pregunta del público que responde |
| `afirmacion` | El hecho principal que afirma |
| `funcion` | Avisar, ayudar a elegir, explicar, presentar a alguien, responder, cumplir o cerrar |
| `peticion` | La llamada a la acción |
| `hilo` y `paso` | A qué hilo pertenece y en qué punto |
| `evidencia` | Qué activos usa y de qué tipo: real del día, real de archivo o generado |
| `estado` | Borrador, exportada, publicada, retirada o caducada |

**La regla, comprobable.** Una propuesta **se rechaza por repetida** cuando cumple tres condiciones a la vez:

1. Entre las seis últimas entregas **publicadas** del local, o entre las de los últimos catorce días, hay una con el mismo `sujeto`.
2. Esa entrega tiene la misma `afirmacion` o la misma `pregunta`.
3. La propuesta **no cita ningún hecho nuevo**.

Hay tres excepciones, y cada una deja escrito su motivo: que sea un paso declarado de un hilo abierto, que sea un ritual declarado con un hecho nuevo o que el hecho haya cambiado de versión (por ejemplo, un horario nuevo).

La comparación se hace sobre **identificadores de hechos**, no sobre palabras ni sobre píxeles. Dos redacciones del mismo reclamo citan el mismo hecho, así que se detectan aunque no compartan ni una palabra.

**Ejemplo que debe rechazarse:**

- Lunes, post publicado: «Nuestra tostada de aguacate y huevo pochado, para empezar bien el día». Cita H1, un hecho de carta.
- Miércoles, propuesta de historia: «¿Ya has probado la tostada de la casa?».

Mismo sujeto, mismo hecho H1, misma función (presentar) y ningún hecho nuevo: **se rechaza**.

**Continuación que sí merece publicarse:** el jueves, «El lunes os enseñamos la tostada. Lo de encima es [respuesta de cocina, H7]». Cita H7, un hecho nuevo confirmado por la cocina; es el paso 2 de un hilo y responde a una pregunta. **Se acepta.**

**Borrador, exportación y publicación no cuentan igual:**

- Un **borrador** no cuenta en la memoria.
- Una **exportación** cuenta como pendiente: impide que otra entrega contradiga sus hechos, pero no se considera vista por el público.
- Una entrega **publicada**, con la hora confirmada por una persona, es lo único que cuenta como visto por el público.
- Las simulaciones y las entregas de otros locales no cuentan nunca.

### 4.6 Control de veracidad

Cada afirmación relevante se enlaza con un hecho de uno de estos cuatro tipos. Si no tiene ninguno, se quita la frase o se pide el dato.

| Fuente | Qué la acredita | Ejemplo |
|---|---|---|
| **Carta vigente** | Una entrada versionada, con fecha de inicio y de fin, ingredientes, alérgenos y precio si lo hay, confirmada por la dueña | «Tostada con jamón y aguacate» |
| **Foto real** | Un activo `REAL` con autor, fecha y local. Si se usa para decir «hoy», tiene que ser de hoy | La bandeja de los tres cafés |
| **Persona identificada** | Su nombre o su rol, qué dijo y cuándo, y su permiso para citarla o mostrarla | «Lo explica la barra: …» |
| **Observación registrada** | Quién la hizo, cuándo y en qué turno | «Dos mesas preguntaron por el pan» |

**Qué pasa cuando algo cambia:**

- **Caduca una oferta.** Sus borradores se invalidan y sus exportaciones sin publicar se bloquean. Las entregas publicadas quedan marcadas para retirarlas o corregirlas; las historias caducan solas.
- **Se corrige un ingrediente.** Se crea una versión nueva del hecho y todas las entregas que citaban la anterior pasan a revisión. Si la corrección afecta a un alérgeno, se propone una corrección pública.
- **Falta una imagen prometida.** El paso del hilo se aplaza con una frase o se cumple con otra evidencia real, como el texto de la cocina. La imagen nunca se genera.

**Una foto generada puede ilustrar un plato de la carta, pero no demuestra que algo ocurriera.** No sirve para decir «hoy ha salido así», «la terraza estaba llena» o «así lo prepara Ana»: eso exige una foto documental de ese día, o ninguna. El estudio debe fijar además su política de etiquetado de IA y revisar la de la plataforma.

**Las compuertas gobiernan:**

- aceptar una candidata descartada exige un motivo tipificado;
- el `uso` de un activo solo cambia por esa decisión;
- la crítica recibe el veredicto automático;
- una pieza con un activo de prueba no puede quedar «lista para publicar».

### 4.7 Un aprendizaje que cambia una decisión

- **El gusto del propietario.** Sus elecciones y rechazos entre opciones, cada uno con su motivo. Ya existe un modelo para ello ([aprendizaje.ts](../src/dominio/aprendizaje.ts)): separa la evidencia humana de la del estudio y distingue cuatro estados (hipótesis, observada, confirmada y en duda). Sirve para proponer lo que le gusta, no para concluir que funciona.
- **La reacción del público.** Los recuentos que la dueña puede ver y anotar: respuestas a una encuesta, mensajes, guardados de un post, comentarios en el mostrador. Cada recuento lleva su ventana (24 h para una historia; 72 h y siete días para un post) y, si se conoce, su denominador, es decir, el alcance.
- **Con métricas escasas.** Solo se compara dentro del mismo local y del mismo formato. Para cambiar una regla hacen falta al menos dos observaciones comparables. Si falta el denominador, se guarda el recuento bruto y no se calculan tasas.
- **Con datos ausentes.** Se anota «sin dato» y no se aprende nada. El sistema nunca rellena un hueco con una suposición.

**Una decisión concreta que puede cambiar.** Supongamos dos historias con encuesta publicadas a la misma hora. Si ambas terminan con 0 respuestas anotadas y la encargada registra que nadie lo comentó en el mostrador, la semana siguiente no se abre ningún hilo con encuesta: se usa el sticker de preguntas o la pregunta pasa a un cartel en la barra. Si al menos una tiene respuestas, la encuesta se mantiene.

Que a la dueña no le guste el fondo negro, en cambio, modifica la dirección de foto, pero no toca el calendario.

---

## 5. Una quincena de Café Albor

### 5.1 Supuestos

- **S1. El local.** Café Albor es el local de ejemplo del repositorio. Uso su nombre, su ciudad, su descripción, sus tonos y sus colores, tomados de [plantillas/marca-cafe-albor.ejemplo.json](../plantillas/marca-cafe-albor.ejemplo.json).
- **S2. Las fotos.** Trato las dos fotos, [cafe-albor-cafe.webp](../plantillas/fotos/cafe-albor-cafe.webp) y [cafe-albor-tostada.webp](../plantillas/fotos/cafe-albor-tostada.webp), como si las hubiera hecho el equipo, aunque su procedencia real no consta. Miden 382 × 510 px: valen como prueba de lo que hay en el local, pero no para publicar a 1080 px.
- **S3. El brief de la tostada.** El de [brief-carrusel.ejemplo.json](../plantillas/brief-carrusel.ejemplo.json) cuenta como palabra de la dueña. Su contradicción con la foto (sésamo, jamón, una segunda tostada) es real, y la trato como un dato pendiente.
- **S4. El equipo.** Tres roles, sin nombres: la **dueña**, que confirma hechos, publica y anota resultados; la **barra** (una persona) y la **cocina** (otra persona).
- **S5. La capacidad.** Hasta cuatro entregas por semana. Un post y la historia que lo anuncia el mismo día cuentan como una sola entrega. El domingo no se publica nunca.
- **S6. Lo que no está en los datos.** No hay horario, precios ni carta. Nada de eso se publica sin confirmarlo.
- **S7. La incidencia (supuesta).** El miércoles 25/11, a las 8:05, la dueña deja una nota de voz: «La máquina no tira. El técnico viene a mediodía. Hay café de filtro». Es un hecho de entrada, no un resultado.
- **S8. La audiencia.** Ningún resultado de audiencia se inventa: aparece como «por anotar», y la semana 2 se recompone por ramas.

**Fechas.** La semana 1 va del lunes 23/11 al domingo 29/11, y la semana 2, del lunes 30/11 al domingo 06/12, Día de la Constitución. El martes 08/12 también es festivo nacional, así que el aviso del «puente» es real y hay que confirmarlo a tiempo.

### 5.2 Semana 1

| Día | Hecho disponible | Intención | Formato | Texto público (ejemplo) | Vínculo | Responsable | Condición de salida |
|---|---|---|---|---|---|---|---|
| Lun 23 | La foto de la bandeja (real, de 382 px) | Abrir el hilo «tres tazas» con una pregunta | Historia de dos pantallas (§4.4) | «Tres cafés con leche. Tres tazas distintas.» / «No es una cuestión de tamaño. Esta semana os lo explica la barra.» | Abre el hilo A, con la promesa «esta semana», que vence el domingo 29 | Publica la dueña; la barra se compromete a dar el dato | Solo sale si la barra acepta explicarlo esta semana; si no, no se promete nada y se deja pasar el día. Debe llevar una foto de esa mañana; si a las 9:30 no la hay, sale la de archivo enmarcada |
| Mar 24 | El brief de cocina y la foto no coinciden | Pedir un dato | Sin publicación | — | Prepara el hilo B, «la tostada», sin abrirlo en público | Responde la cocina; la dueña pregunta además por el horario del puente | La propuesta solo se activa cuando llega la respuesta de la cocina |
| Mié 25 | **Incidencia (S7):** no hay espresso, pero sí café de filtro | Aviso útil | Historia de una pantalla | «Hoy, hasta mediodía, sin espresso. Tenemos café de filtro.» | Interrumpe el día, pero **el hilo A sigue en pie** | La dueña | Sale si a las 8:30 la máquina sigue sin funcionar. Se borra o se actualiza («Ya funciona») cuando la reparan, y caduca a las 23:59 |
| Jue 26 | *Supuesto:* la máquina se reparó el miércoles a las 13:10, y la barra da los nombres y las diferencias de las tres tazas (contenido por confirmar) y hace tres fotos nuevas | Cumplir la promesa del hilo A | Carrusel de cuatro tarjetas (una portada con la bandeja y una tarjeta por taza) y, el mismo día, la historia con la encuesta de la §4.4 (pantalla 3) | Portada: «Las tres tazas del lunes». Tarjetas: «[Taza pequeña]: [dato de la barra]»… | Paso 2 del hilo A, que lo cierra. Se entiende sin haber visto la historia del lunes | La barra escribe y confirma; la dueña publica | Sale si los tres datos de la barra y las tres fotos están listos antes de las 11:00. Si no, pasa al viernes con la promesa intacta |
| Vie 27 | *Supuesto:* la cocina responde sobre la tostada (contenido desconocido) y hace una foto en el pase | Según la respuesta: si confirma los ingredientes, **post guardable**; si no responde, se insiste a través de la dueña | Post 4:5 con la foto nueva de la tostada | «Encima: [respuesta de la cocina]. Debajo: [pan confirmado].» | Abre y cierra el hilo B en una sola entrega, porque no hubo promesa pública | Confirma la cocina; publica la dueña | Solo sale con la respuesta y la foto nueva; si faltan, no se publica |
| Sáb 28 | Turno fuerte, sin ningún hecho nuevo | Dejar pasar | Sin publicación | — | — | — | La propuesta recuerda que el hilo A vence mañana si el jueves no se cumplió |
| Dom 29 | — | Descanso fijo | Sin publicación | — | Si el hilo A sigue sin cumplir, el sistema propone para el lunes un cierre de una pantalla | — | — |

### 5.3 Semana 2, recompuesta con lo registrado

El lunes 30 por la mañana, el sistema lee lo ocurrido en la semana 1 y ordena la nueva en este orden:

1. Las **promesas** vencidas o pendientes.
2. Los **datos** que llegaron: la respuesta de la cocina y el horario del puente.
3. Los **hechos nuevos** del parte del fin de semana.
4. La **capacidad**.

Ninguna regla depende de inventar un resultado.

| Día | Hecho disponible | Intención | Formato | Texto público (ejemplo) | Vínculo | Responsable | Condición de salida |
|---|---|---|---|---|---|---|---|
| Lun 30 | Estado del hilo A al cierre del domingo | **Si el jueves se cumplió:** solo se abre un hilo nuevo si hay un hecho nuevo; si no lo hay, se deja pasar. **Si no se cumplió:** se cierra con honestidad | Nada, o una historia de una pantalla | Si no se cumplió: «Lo de las tazas, esta semana sin falta: la barra estuvo a tope.» | Hilo A | La dueña | Nunca hay más de una promesa activa a la vez |
| Mar 01 | Resultado de la encuesta del jueves, según lo anotado: respuestas, empate, cero o desconocido | **Si hubo respuestas:** responder con un hecho nuevo de la barra. **Si hubo cero o es desconocido:** no se menciona el resultado; si el parte trae algo nuevo de la barra, se cuenta en una historia, y si no, se deja pasar | Historia, o nada | «[Opción con más respuestas, tal como se anotó]: [explicación de la barra].» El resultado nunca se redacta antes de anotarlo | Paso 3 del hilo A | La barra y la dueña | Tiene que constar el resultado o la observación. Si no consta, esa frase no se escribe |
| Mié 02 | **Fecha límite** del horario del puente | Pedir el dato, si todavía falta | Sin publicación | — | Aviso del puente | La dueña | Si a las 20:00 no hay dato, el aviso del viernes se cae y el sistema lo comunica |
| Jue 03 | El hilo B | **Si el post del viernes salió, no se repite la tostada** (§4.5). Si quedó pendiente y la cocina ya ha respondido, sale hoy | Post, o nada | «Encima: [respuesta de la cocina]…» | Hilo B | La cocina y la dueña | La respuesta de la cocina está confirmada y hay foto nueva |
| Vie 04 | Horario del puente, **si se confirmó**: domingo 6 y martes 8 | Aviso útil | Post guardable e historia | «Puente de diciembre: domingo 6, [horario]; martes 8, [horario].» | Aviso con vigencia hasta el martes 8 a las 23:59 | La dueña | El horario está confirmado por la dueña. Al caducar, el post se archiva o se edita |
| Sáb 05 | Lo que traiga el parte | Dejar pasar, salvo que haya un hecho de hoy con foto de hoy | Nada, o una historia | — | — | — | Si se cuenta algo del día, la foto tiene que ser del día |
| Dom 06 | Festivo | Solo se publica si el local abre y está confirmado | Historia | «Hoy abrimos [horario].» | Aviso del puente | La dueña | Consta que el local abre |

**Qué muestra esta quincena.**

- Hay días sin publicación por decisión: el 24, el 28, el 29 y quizá el 5.
- Una incidencia interrumpe la semana sin romper el hilo A.
- La promesa se hace con margen.
- Hay dos peticiones de datos con fecha límite.
- La semana 2 empieza por lo pendiente.
- Cuando dos entregas caen el mismo día o se supera la capacidad semanal, gana la promesa que vence antes. Si el carrusel del jueves 26 pasa al viernes 27, la tostada pasa a la semana 2, que es lo que recoge la fila del jueves 03.
- Ninguna entrega da por supuesto un resultado de audiencia.

### 5.4 El mismo flujo en una coctelería y en un restaurante con pizarra

**Coctelería con una preparación documentada.**

- **Material.** La barra fotografía de verdad cada paso de una preparación larga, por ejemplo una infusión que reposa varios días antes de filtrarse, y apunta los tiempos.
- **Lo que decide el sistema.**
  - La preparación es un proceso con fechas conocidas de antemano, así que propone una **serie entre días** anclada en ellas: el día que se pone a reposar, el día que se filtra y el día de la primera copa.
  - Cada paso exige una foto real de ese día. El proceso completo se resume en un **carrusel guardable** al final.
  - Las historias de la espera pueden llevar una pregunta («¿Qué esperas encontrar?») o una cuenta atrás.
  - La promesa tiene la fecha que marca la receta, no la que conviene al calendario.
  - Una imagen generada no puede enseñar «la primera copa».
  - Lo que se diga del sabor y la graduación sale de la barra. Conviene revisar los límites que la normativa de publicidad de bebidas alcohólicas imponga al local.

**Restaurante con una pizarra que cambia durante el servicio.**

- **Material.** La foto de la pizarra de hoy y lo que se va agotando.
- **Lo que decide el sistema.**
  - La verdad caduca en minutos, así que propone **historias con hora** y nunca posts: un post seguiría diciendo «hay rabo de toro» a las cuatro de la tarde.
  - Una historia a las 13:00 con la pizarra de hoy y otra a las 14:30 con «Se acabó el [plato]», solo si la sala lo confirma. Un cierre cuando cierra la cocina.
  - El hilo dura un servicio. Solo hay continuidad entre días si existe un ritual confirmado («los jueves, [plato]»).
  - La foto de la pizarra tiene que ser de hoy; la de ayer no vale, ni recompuesta.
  - Sin foto nueva generada y sin carrusel: en pleno servicio, el equipo dispone de diez segundos.

**Por qué decide distinto.** El motor es el mismo; cambian tres variables del hecho:

- **cuánto dura**: días frente a minutos;
- **qué evidencia lo acredita**: fotos del proceso frente a la pizarra del día;
- **cuánto tiempo tiene el equipo**: una tarde de preparación frente a diez segundos.

El formato, la cadencia y la interacción salen de esas tres variables, no de un calendario intercambiable del tipo «lunes producto, miércoles equipo, viernes promoción».

---

## 6. Referencias de Pinterest con oficio

### 6.1 Calibración con la biblioteca propia

Abrí las 29 imágenes de [biblioteca/referencias](../biblioteca/referencias/) junto con su [índice](../biblioteca/referencias/indice.json). **Son plantillas de Canva con fotos de banco:** llevan «reallygreatsite.com», «Borcelle», «Fauget», «Larana», «123 Anywhere St.» y «+123-456-7890». Por definición, el local de enfrente puede publicarlas cambiando el nombre. Enseñan mecanismos gráficos, no operaciones editoriales.

**Las decisiones que sí tienen valor:**

| Referencia | Decisión concreta que vale | Para qué sirve en un local real |
|---|---|---|
| `post-04` | Flechas manuscritas que nombran cada ingrediente sin tapar el plato | Explicar un plato con datos de carta confirmados |
| `post-10` | El titular sigue la curva de la bandeja y una mano sirve | Mostrar una acción con causa; la forma del producto decide la tipografía |
| `post-15` | Numeración «(01)» y tres etiquetas en la parte superior | Presentar la pieza como parte de una serie, con promesa de continuidad |
| `post-20` y `post-21` | La misma tipografía, el mismo color y la misma marca en dos productos | Mantener la coherencia de una serie entre fechas |
| `post-01` | El horario en un bloque translúcido y ordenado | Dar un aviso práctico jerarquizado, solo con datos confirmados |
| `post-05` | Un contador «1/3» en la portada | Prometer de forma explícita que hay un carrusel |
| `post-29` | Mucho aire y una palabra en vertical que acompaña al plato | Contención, frente a la plantilla saturada |
| `post-03` y `post-12` | El producto tapa parte de la palabra | Profundidad gráfica; el compositor ya lo hace con máscara |

El listón de la nueva selección está **por encima** de esta biblioteca: publicaciones reales de negocios o estudios identificables, en las que la idea nace de un hecho propio del local.

### 6.2 El primer lote de Pinterest

Revisé las 123 imágenes en hojas de contacto. La mayoría no sirve:

- recetas de blogs y colecciones de datasets;
- fichas de recetas de una cadena (Texas Roadhouse);
- fotos de clientes sin intención editorial (Bar Louie);
- campañas de gran consumo (Alpro, Malibu, Starbucks EE. UU.);
- collages presentados como si fueran un formato.

Lo aprovechable se concentra en tres fuentes:

- **sketch London:** cuatro carruseles con un mismo set por serie, la cocina con personas y gestos, y el menú servido en su vajilla propia;
- **Square Mile Coffee Roasters:** una serie con fechas;
- **Starbucks France:** su «ME / YOU», como mecanismo de interacción.

### 6.3 La selección profesional

La selección está en [referencias-pinterest/seleccion-profesional/](../referencias-pinterest/seleccion-profesional/README.md), y el README de la carpeta lleva primero a ella.

**Cómo se hizo.** Un subagente económico consultó 416 pines públicos y descargó 132 candidatas de 29 identidades. Las revisé junto con el primer lote en hojas de contacto. **Aprobé 20 piezas de 13 negocios.** Cada una enseña una operación distinta:

| Formato | Piezas aprobadas |
|---|---|
| **Series en fechas distintas** | Square Mile × Chocolarder: anticipar, revelar y usar. Lune: un producto nuevo en tres entregas que añaden información. Stumptown × Sophia Wilson: una colaboración que crece entre estaciones. Origin: la ceramista que hace las tazas |
| **Carruseles completos** | Origin: la carta de invierno con un mismo gesto, y una guía de cursos que permite decidir. sketch: el trabajo detrás del plato, y la carta de otoño firmada por sus jefes de cocina |
| **Historias nativas de Pinterest** | GAIL's: el edificio y su pasado. Starbucks France: «me and you». Es la única cadena, incluida solo por el mecanismo de interacción |
| **Posts** | Cerrar una edición con fecha (Lune). La carta de temporada en cartel y el café en su finca (Stumptown). Un cambio del espacio con su autor (Origin). El calendario propio de la casa (Dishoom). El ritual anual (Pophams). Texto e imagen en una sola idea con el rótulo del local (Altro Paradiso). Un aviso con hora (Dante). El atrezo que explica el producto (Onyx). Una colaboración con el vecino (Blue Bottle × Smitten) |

**Dos repeticiones literales, documentadas como contraejemplos de la regla de la §4.5:**

- Origin publicó la misma imagen de la ceramista el 6 y el 20 de octubre (archivo idéntico byte a byte).
- Lune repitió la escargot de harissa en dos fechas.

**Huecos que no he podido cerrar:**

- ninguna historia de Instagram verificada;
- los carruseles están comprobados como carruseles de Pinterest, no de Instagram;
- cinco piezas son pines guardados por terceros: su autoría se apoya en el texto de Instagram que reproducen («X on Instagram», o el pie escrito en primera persona, en el caso de Blue Bottle);
- no hay ningún local español aprobado;
- no encontré una referencia de calidad para la pizarra del día, para una preparación de barra paso a paso ni para la respuesta a una pregunta de clientes.

---

## 7. Plan de desarrollo por orden de dependencia

**Esfuerzo relativo:**

- **S:** cambia un paso existente y sus pruebas.
- **M:** añade un modelo y un caso de uso con su almacén.
- **L:** añade un flujo completo con interfaz.

| # | Entrega | Código que reutiliza | Datos nuevos | Esfuerzo | Prueba de aceptación observable |
|---|---|---|---|---|---|
| **E1** | **Estado real de cada entrega**: borrador, exportada, publicada o retirada. Un botón «publicada», con la hora y, si se quiere, el enlace. El rótulo «PUBLICADOS» del diorama pasa a «Terminados» hasta que haya publicaciones | `EncargoPost.historial`, `resumirEncargos` ([consultasPost.ts](../src/aplicacion/post/consultasPost.ts)), `escribirJsonAtomico`, `PiezasHechasFicheros` y el patrón de `AlmacenBriefFicheros` | `datos/locales/<slug>/entregas/<id>.json` (`entrega@1`: origen, que puede ser encargo o pieza; estado; fechas; enlace) | S | Tras exportar `pulpo-2`, la lista de publicadas sigue vacía. Al marcarlo como publicado el 21/11 a las 09:12, aparece, y sigue ahí tras reiniciar. Los encargos simulados y los de otros locales no salen |
| **E2** | **Compuertas que gobiernan.** Aceptar un `DESCARTA` exige un motivo tipificado, que corrige el inventario o acepta «no es otra toma». El `uso` cambia solo con esa decisión, como en `fidelidad.ts`. La crítica recibe el veredicto automático. Un activo de prueba es un `ERROR` para «lista para publicar» | `CONFIRMAR_FOTO` ([ordenPost.ts:553-630](../src/aplicacion/post/ordenPost.ts#L553-L630)), `decidirSalida`, `avisarActivosDePrueba`, [fidelidad.ts:108](../src/herramientas/fidelidad.ts#L108) y `fichas.js` | `fidelidad.decision` y `fidelidad.motivoHumano`. En el inventario, la `racion` (confirmada por la cocina) separada de lo `visibleEnFoto` | S | Se reproduce `pulpo-2` en simulado. «Usar candidata 1» queda desactivado hasta elegir un motivo. Con «había un cuarto langostino cortado», el inventario pasa a cuatro y el activo, a `PUBLICABLE`. Sin motivo, el encargo no llega a «lista para publicar» |
| **E3** | **Libro de hechos del local**: carta vigente, observaciones, personas, fotos reales y avisos, cada uno con fuente, versión, vigencia y permiso. El cotejo deja de buscar palabras y pasa a exigir hechos | El patrón `Dato`/`FuenteDato` de [perfil.ts](../src/dominio/marca/perfil.ts), la huella de [inventario.ts](../src/dominio/inventario.ts), `datosPorConfirmar` del brief, [cotejo.ts](../src/dominio/cotejo.ts) y [nota.ts](../src/dominio/nota.ts) | `datos/locales/<slug>/hechos.jsonl` (`hecho@1`: tipo, texto, fuente con quién, rol, medio y fecha, vigencia, confirmado, permiso, versión y `reemplazaA`). El sha de cada foto real queda ligado al local | M | Cambiar «dukkah» por «sésamo» invalida los borradores que lo citan, bloquea las exportaciones sin publicar y marca las publicadas. El pie clásico de Albor no pasa, porque «masa madre» no tiene hecho. La misma foto no se registra como real en dos locales sin un aviso |
| **E4** | **Memoria editorial y detector de repetición** (§4.5) | `postsRecientes` para lo visual, el modelo de evidencia de [aprendizaje.ts](../src/dominio/aprendizaje.ts) y `PostReciente` | La ficha semántica dentro de `entrega@1`: sujeto, hechos, pregunta, afirmación, función, petición, hilo y evidencia | M | Con seis entregas publicadas de prueba, una paráfrasis del mismo reclamo se rechaza con su motivo y una continuación con un hecho nuevo se acepta. Los borradores, los simulados y los otros locales no cuentan |
| **E5** | **«Mañana»**: el parte del turno, tres opciones, pedir un dato y dejar pasar, hilos con promesas y vencimientos, y urgencias que no rompen los hilos | `ClienteGemini.generarJson` con esquemas zod (como ya hace el productor), los decoradores de presupuesto y El Pase como superficie | `hilo@1` y `propuesta@1` (opciones, razones, la elegida y las descartadas), y el parte del turno con su transcripción | M-L | Con los supuestos de la §5 como datos de prueba: el martes propone «pedir un dato», porque el dukkah no está confirmado. El miércoles propone el aviso y mantiene la promesa A. El lunes de la semana 2, la primera opción atiende la promesa que vence antes |
| **E6** | **Historias como entrega propia**: 9:16 desde el compositor, pantallas con intención, zona e instrucciones del sticker y ramas según el resultado | `HISTORIA_9_16` y `zonaSegura` del compositor, las reglas de `HISTORIA` y `exportarPieza` (`9x16/`) | `historia@1`: pantallas (texto, foto y zona del sticker), interacción (tipo, pregunta y opciones) y resultado (`RESPUESTAS`, `EMPATE`, `CERO` o `DESCONOCIDO`) | M | Exporta tres PNG de 1080 × 1920 con la zona inferior libre y un `pie.txt` con el texto del sticker. Cada uno de los cuatro resultados produce una propuesta distinta |
| **E7** | **Aprendizaje con métricas manuales** | Los estados y autores de [aprendizaje.ts](../src/dominio/aprendizaje.ts) | `observacion-audiencia@1`: entrega, ventana, recuento, denominador (o `null`) y quién lo anota | S-M | Sin datos no cambia ninguna regla. Con dos observaciones comparables, una propuesta cambia y las cita |

**Orden:**

1. **E1 y E2** van primero porque son independientes y pequeñas. E2 cierra el tipo de fallo de `pulpo-2`.
2. **E3**, la base de la veracidad.
3. **E4**, que necesita E1 y E3.
4. **E5**, que necesita E1, E3 y E4.
5. **E6** puede avanzar en paralelo a E5, pero sus ramas dependen de E5.
6. **E7** va al final.

Para el piloto basta una versión mínima de E1 a E5.

---

## 8. Piloto mínimo

**Formato.** Dos semanas con **un local real**, una cafetería pequeña. Si es posible, también una coctelería o un restaurante con pizarra, para contrastar.

- Se usan E1 a E5 en su versión mínima.
- Hasta tener E6, las historias se exportan por la vía clásica o se componen a mano.
- No se genera ninguna foto nueva, salvo que la dueña la pida para ilustrar un plato de la carta.

**Qué observaría, por local y por semana:**

| Señal | Cómo se mide | Se mantiene si… | Se retira o se rehace si… |
|---|---|---|---|
| Minutos del equipo | Bitácora del parte y de las decisiones | La mediana es de 5 min al día o menos | Supera los 10 min al día dos semanas seguidas: el parte pide demasiado |
| Opciones útiles | Días en que se eligió una opción sin reescribirla | Ocurre el 60 % de los días o más | Se reescriben más de la mitad: mejor proponer una sola opción y preguntar |
| «Pedir un dato» | Datos que llegan antes de su fecha límite | Llegan el 60 % o más | Llegan menos del 40 %: la petición se hace tarde o a la persona equivocada |
| Entregas con un hecho propio | Fichas semánticas que citan al menos un hecho del local | Son el 80 % o más | Si no se llega, «Mañana» no aporta nada frente a un generador |
| Promesas cumplidas | Promesas cumplidas a tiempo sobre promesas vencidas | Se cumplen el 80 % o más | Se cumplen menos de la mitad: dejar de prometer en público y publicar solo entregas sueltas |
| Repeticiones | Duplicados que detecta una segunda persona y que el sistema dejó pasar | 0 | Basta uno para revisar la ficha semántica |
| Veracidad | Afirmaciones sin hecho, imágenes de prueba publicadas o resultados inventados | 0 | Basta uno para detener el piloto y corregir |
| Publicación registrada | Entregas marcadas como publicadas frente a las que aparecen en la cuenta | El 90 % o más | Menos del 70 %: la memoria no es fiable y hay que simplificar el registro |
| Interacción | Historias con el resultado anotado, sea cual sea | El 70 % o más | Tres encuestas seguidas sin respuestas y sin ningún comentario en el mostrador: retirar las encuestas del repertorio de ese local |

**Cómo leer el resultado.** Dos semanas bastan para decidir si el flujo es **practicable y veraz**, no para saber si «funciona» con la audiencia: los recuentos de una quincena son anécdotas y se guardan para compararlos más adelante.

Seguiría adelante si se cumplen cuatro condiciones:

- el equipo dedica cinco minutos al día o menos;
- al menos el 80 % de las entregas llevan un hecho propio;
- no hay ningún incidente de veracidad;
- cada semana se completa al menos un hilo.

Si alguna falla, retiraría lo que no funcione según la tabla antes de añadir funciones nuevas.
