# Dirección de arte agéntica

**Cómo pasar de «ya sabemos qué contar» a un post, un carrusel o una historia estática que compita con una buena agencia · Pase Hydrogen · 21 de noviembre de 2026 · revisión `988d373`**

> **Autoría y alcance.** Lo redactó Claude Opus 5.5 en Claude Code, como continuación de [INFORME-FABLE-5.2-EDITORIAL.md](INFORME-FABLE-5.2-EDITORIAL.md). La búsqueda amplia en Pinterest la hizo un subagente Haiku; el corte final, la revisión de imágenes y el diagnóstico son míos. Es un informe de investigación, diagnóstico y plan: no se ha tocado el código del producto, no se ha generado ninguna imagen y no se ha publicado nada. Reels y vídeo quedan fuera.

## 1. La respuesta corta

**El compositor de Pase Hydrogen ya sabe pintar piezas de agencia. Lo que no sabe es decidirlas.**

Las mejores salidas del repositorio son la gamba de Etxebarri en carrusel, «MANHATTAN TOWER» de Dak, los churros de Casa Aranda y «merluza» de Candamil. Las cuatro se hicieron con intenciones escritas a mano, capa a capa, con el vocabulario completo del compositor: recorte con máscara, palabra tapada por el producto, patrón tipográfico, texto en arco, sellos, sangrados (§3.2). Las piezas que produce El Pase de forma automática se quedan en bandas de pie, recortes sin texto o la banda crema de `pulpo-2`.

La diferencia no está en los píxeles, sino en **quién decide y con qué palabras**:

| Vía | Quién decide la idea visual | Repertorio real |
|---|---|---|
| Post y carrusel «por capas» de El Pase (productor) | Gemini elige un tratamiento | 5 tratamientos; el cartel tiene 2 estructuras × 2 superficies ([editorial.ts](../src/dominio/editorial.ts)) |
| Orden de terminal con director de diseño (F3) | Gemini elige un mecanismo | 4 mecanismos, y el código coloca todo lo demás ([propuesta.ts:198-206](../src/dominio/diseno/propuesta.ts#L198-L206)) |
| Taller, foto con título | Código, por reglas | 2 estilos × 4 posiciones, con 2 familias tipográficas ([taller.ts:28-30](../src/dominio/taller.ts#L28-L30)) |
| Intención escrita a mano | Una persona o una IA en conversación | 13 tipos de capa y 4 relaciones ([intencion.ts](../src/dominio/diseno/intencion.ts)) |

Cada vía automática reduce el diseño a **elegir una plantilla de una lista corta**. Y cada pieza parte de **una sola referencia** de Canva cuya «receta» se imita, de modo que tampoco hay invención de estilo.

Las 46 referencias nuevas lo confirman por contraste (§2):

- todas combinan **varias operaciones**;
- **cambian de estructura** de una pieza a otra;
- una de cada cuatro usa **recursos propios** (ilustración, pegatinas, lettering, risografía);
- una de cada seis se apoya en **una frase con idea**.

Ninguna de esas cuatro cosas está al alcance de las vías automáticas.

**Qué construiría primero para una mejora visible:** devolver la pluma al director. Que escriba la intención con el vocabulario completo, guiado por referencias recuperadas por **operación** y no por plantilla, y que una crítica con rúbrica la revise **renderizada a tamaño móvil** y corrija con **parches localizados**. Es lo que ya funcionó a mano, automatizado y comprobable (fase 1 del plan, §7).

**Qué inversión daría más libertad creativa después:**
- **El estilo como programa:** una combinación parametrizada de operaciones, con invariantes de marca.
- **Recursos gráficos propios con transparencia:** ilustración, papel, cinta, sellos o patrones, generados o dibujados aparte del plato.
- **Operadores nuevos en el compositor:** texto en trayectoria, segmentación por ingrediente, collage, lienzo 9:16.

La §8 responde a la pregunta del encargo.

---

## 2. El corpus de referencias visuales

**Dónde está:** [referencias-pinterest/diseno-visual/](../referencias-pinterest/diseno-visual/README.md). Son **46 piezas y 67 imágenes**: 6 de hamburgueserías, 6 de coctelerías, 3 de cafeterías, 1 de panadería, 9 de restaurantes, 5 de pizza, sushi y otros, 11 verticales como referencia para historias y 5 carruseles con su orden comprobado. La [selección profesional](../referencias-pinterest/seleccion-profesional/README.md) del encargo anterior se conserva intacta.

**Cómo se hizo:**

1. **Búsqueda de Haiku.** Unas 300 miniaturas revisadas y 98 imágenes descargadas.
2. **Cinco búsquedas mías** para cubrir familias que faltaban: risografía, collage con pegatinas, collage de prensa y pizarra real.
3. **Corte final con todo a la vista**, y las doce piezas de la §3.4 abiertas a tamaño grande. Salieron 36 imágenes: repeticiones de la misma idea, promociones genéricas, una serie que no era de hostelería, mockups y un personaje con derechos de terceros.

**Lo que enseña el conjunto**, comparado a tamaño móvil con las salidas del proyecto:

1. **Ninguna pieza usa una sola operación; la mayoría combina tres.** «ZEST» une entrelazado, tipografía monumental y retícula editorial. «FESTIVE COCKTAIL», collage, texto en curva y anotación. Las piezas automáticas de Pase Hydrogen aplican un mecanismo, o un tratamiento, cada vez.
2. **La estructura cambia de pieza a pieza:** composición central, pantalla partida, marco, diagrama, tablero de juego, infografía o columna de papel. En el proyecto, todas las piezas automáticas comparten dos o tres estructuras.
3. **Una de cada cuatro piezas usa recursos propios**: ilustración, pegatinas, lettering, risografía u objetos añadidos. Pase Hydrogen no tiene dónde generarlos ni capa donde ponerlos.
4. **Unas 8 de 46 apoyan la idea en una frase con ingenio** («just one? / …maybe two. / fine, three.», «Our secret's out: the main character isn't the chef»). Pase Hydrogen solo admite un titular creativo de una palabra, y solo si el encargo lo permite (`titularCreativo` en [post.ts](../src/dominio/post.ts)). Una frase así **no afirma ningún hecho**, y el código ya sabe detectar reclamos (`RECLAMOS` en [propuesta.ts](../src/dominio/diseno/propuesta.ts)). Se puede abrir con control (§4.7).
5. **Las plantillas buenas existen y sirven de vara de medir.** Varias piezas aprobadas son plantillas profesionales de Canva («Anatomía de una buena pizza», «TABLE 8», «Estamos abiertos») y el carrusel de pizza es un sistema de plantilla aplicado siete veces. Marcan el nivel «correcto» que el sistema debe superar sin que se note que repite.

**Huecos:**

- ninguna historia de Instagram verificada (las verticales son referencias para historias);
- ningún carrusel verificado de hamburguesería ni de coctelería;
- pocas piezas de cafetería, panadería y locales españoles;
- ninguna autoría verificada abriendo la fuente;
- «ZEST» es un concepto generado con IA para una marca ficticia: vale por su decisión de diseño, no como prueba de lo que publica un local.

---

## 3. Auditoría del flujo visual

### 3.1 Cuatro vías, cuatro maneras de decidir

| Vía | Dónde se elige la idea visual | Qué recibe quien decide | Qué puede expresar | Qué ejecuta | Cómo se revisa |
|---|---|---|---|---|---|
| **Estudio clásico** ([instrucciones.ts](../src/adaptadores/gemini/instrucciones.ts)) | Gemini propone 3 conceptos en texto libre (mecanismo, fotografía, tipografía, paleta) | Marca, idea, fotos, principios, ejemplos, 20 valoraciones y 3 referencias por afinidad | Cualquier cosa, en prosa | **Higgsfield genera la imagen entera, con el texto dentro.** Nada es determinista | Voto del dueño. Las cifras se cotejan; las letras y el plato, no. Resultado: «EL ACOMRAÑANTE» y una tostada que no existe |
| **El Pase, post y carrusel «por capas»** ([editorial.ts](../src/aplicacion/productor/editorial.ts), [componerCartel.ts](../src/aplicacion/productor/componerCartel.ts)) | El productor (Gemini) elige un tratamiento por página | Foto, brief, oficio y la ficha de **una** referencia | `CARTEL` (eje vertical o cabecera, sobre papel o sobre foto), `FOTO_LIMPIA`, `FOTO_TEXTO_AL_BORDE`, `RECORTE_DETALLE`, `CIERRE_TEXTO`. Textos solo de marca, ciudad, cuenta o un elemento | Plantillas en código que deciden caja, color y tinta | Crítica sobre las páginas renderizadas, con correcciones de maqueta (recorte, contraste, tamaño, margen, despejar el titular) o revisión humana ([criticaEditorial.ts](../src/aplicacion/productor/criticaEditorial.ts)) |
| **Orden con director de diseño (F3)** ([proponerDiseno.ts](../src/aplicacion/diseno/proponerDiseno.ts), [instruccionesDiseno.ts](../src/adaptadores/gemini/instruccionesDiseno.ts)) | Gemini elige uno de cuatro mecanismos y escribe los textos con su cita | Hechos, ficha de **una** referencia, mapa de la foto (12 × 16 celdas medidas), voces y colores, huella tipográfica del local ([huella.ts](../src/dominio/diseno/huella.ts)) | `TITULAR_DETRAS`, `TITULAR_CON_ACENTO`, `ANOTACIONES` y `PLATO_SOBRE_COLOR`, más un sello y hasta tres anotaciones. El carrusel tiene estructura fija: portada, de 1 a 3 detalles con flecha y cierre | El código coloca todo con el mapa de la foto ([mecanismos.ts](../src/dominio/diseno/mecanismos.ts)) y compila la intención ([propuesta.ts](../src/dominio/diseno/propuesta.ts)) | Pruebas deterministas y una crítica visual que dice si «llega al oficio de la referencia»: un sí o un no, hasta 4 motivos y, si no llega, **otra propuesta entera** |
| **Taller de arte** ([direccion.ts](../src/aplicacion/taller/direccion.ts), [serie.ts](../src/aplicacion/taller/serie.ts)) | Reglas por tipo de producto: 4 rutas y pautas («rebozado», «caparazón», «bebida»…) ([seleccionEditorial.ts](../src/aplicacion/taller/seleccionEditorial.ts)) | Foto, nota, marca y ficha | Cartel integrado generado por `gpt-image-2` con el texto dentro, o foto con título en 2 estilos × 4 posiciones; series con 5 tratamientos (`FOTO`, `ARCO`, `DIPTICO`, `TEXTO_EN_AIRE`, `TIPOGRAFIA`) | Generador de imagen (cartel), o compositor con título | Aprobación humana con casillas y lectura del cartel con Vision a 360 px ([lecturaCartel.ts](../src/adaptadores/imagen/lecturaCartel.ts)) |

**Debajo de todas está el compositor determinista** ([resolutor.ts](../src/adaptadores/compositor/resolutor.ts), [CompositorSharp.ts](../src/adaptadores/compositor/CompositorSharp.ts), [MotorTexto.ts](../src/adaptadores/compositor/MotorTexto.ts)). Pinta 13 tipos de capa:

- relleno, degradado e imagen con ventana;
- recorte con máscara, con filo de pegatina, giro y sangrado;
- sombra;
- texto con 7 ajustes, giro, contorno, corte, tinta impresa, recetas especiales y recorte por el sujeto;
- forma (incluidas mancha y rama);
- texto en círculo o en arco, niveles, textura de grano o de papel, sello de 5 formas, patrón de 5 motivos y trazo a mano de 4 gestos.

Además mide cuatro relaciones (`detras`, `noSolapar`, `contrasteMinimo`, `cruza`), versiona cada capa y exporta a 3:4, 4:5 y 9:16. Usa 23 familias OFL ([recursos/tipografias](../recursos/tipografias/)) y 4 recetas tipográficas especiales: antigua, derretida, neón y papel ([recursos/tratamientos](../recursos/tratamientos/)).

### 3.2 Lo que dicen las salidas reales

Revisé las últimas versiones de las 36 piezas compuestas de `datos/disenos/` y las series del taller a tamaño de móvil (celdas de 260 px).

| Pieza | Cómo se hizo | Qué se ve a tamaño móvil |
|---|---|---|
| Carrusel de la gamba de Etxebarri ([intenciones](../proyectos/etxebarri-gamba-carrusel/intenciones/)) | Intención a mano (F1.5) | Una frase partida entre cuatro tarjetas («Gamba roja de Palamós, / brasa de leña, / sal gruesa / y nada más»), con el grano de sal como punto final. **Es la mejor pieza del repositorio** |
| «MANHATTAN TOWER», Dak ([intención](../proyectos/posts-f1-6/dak/intenciones/post.json)) | A mano, sobre la receta de `post-09` | La palabra repetida en filas y la hamburguesa recortada tapando las centrales. Lectura inmediata y tensión de escala |
| «CHURROS con chocolate», Casa Aranda ([intención](../proyectos/posts-tres-locales/casa-aranda/intenciones/post.json)) | A mano, sobre `post-03` | Color plano, producto delante de la palabra y sello «DESDE 1932». Nivel de plantilla buena |
| «merluza», Candamil | A mano, sobre `post-29` | Aire, palabra vertical que sangra, plato cortado. Contención real |
| `sushita-tabla-sushi` | Director de F3 | Portada correcta; los detalles son el mismo esquema tres veces (nombre, flecha, recorte) |
| `entrecot` y `ensalada-cesar` | Director de F3 | «ENTRECOT» monumental con acento manuscrito: funciona. «ENSALADA CÉSAR» sangra tanto que pierde la E y la R |
| `pulpo-2`, `pulpo-a-la-gallega`, `jamon-con-vino` | El Pase, productor | Banda crema sobre aire negro; titular en una franja de pie; detalles que son recortes sin texto y un cierre que rompe la serie. **Las más flojas** |
| Tarta de pistacho y hamburguesa crujiente | Taller, serie | La portada con el título en una esquina y el resto, fotos sin intervención |

**La conclusión es incómoda pero útil:** el techo visual del sistema lo marca hoy quien escribe la intención, no el motor que la pinta.

### 3.3 Primer eslabón que falla, recurso por recurso

**Escala:** **posible hoy** con otra dirección o una revisión mejor; **parcial** si falta una pieza concreta; **imposible** con las herramientas actuales.

| Recurso de diseño | ¿Hoy? | Primer eslabón que falla | Evidencia |
|---|---|---|---|
| Palabra detrás del producto (oclusión) | Posible | En El Pase, el **vocabulario del productor**: la cabecera sobre foto siempre pinta una banda de papel claro con tinta oscura, sin mirar la luz de la foto | [componerCartel.ts:78-86](../src/aplicacion/productor/componerCartel.ts#L78-L86); `pulpo-2` |
| Producto recortado enorme sobre color plano | Posible | En El Pase, el **esquema** (no hay tratamiento para ello). En F3 existe como `PLATO_SOBRE_COLOR` | Casa Aranda (a mano) |
| Palabra repetida o patrón tipográfico | Posible | El **esquema del director**: no está entre los 4 mecanismos | Capa `patron` en [intencion.ts](../src/dominio/diseno/intencion.ts); Dak (a mano) |
| El producto sale del marco (ventana, polaroid) | Posible | **Esquema del director**. El compositor lo hace con `imagen` + `ventana` + `recorte` `alineadoCon` | `post-06` de la biblioteca |
| Duotono, trama, grano, tinta impresa | Posible | **Dirección**: existe en el dialecto de capas, pero ninguna vía automática lo propone | Capa `foto` con `tratamiento` en [propuesta.ts](../src/dominio/diseno/propuesta.ts) |
| Retícula asimétrica con varios bloques (carta, precio, horario) | Parcial | Los **datos** (no hay carta) y el **esquema** (solo titular, apoyo, firma, acento y anotaciones) | [propuesta.ts:208-230](../src/dominio/diseno/propuesta.ts#L208-L230) |
| Collage (varios recortes, papel rasgado, cinta, superposiciones) | Parcial | **Segmentación**: Vision ya devuelve una máscara por objeto, pero el código las funde en una sola ([mascara.swift:14-20](../src/herramientas/mascara.swift#L14-L20)), y no separa ingredientes dentro del plato. El papel rasgado es un activo hecho a mano. El director no lo puede describir | [SegmentadorVision.ts](../src/adaptadores/imagen/SegmentadorVision.ts), [papelRasgado.ts](../src/herramientas/papelRasgado.ts) |
| Ilustración o garabatos que dialogan con la foto | Imposible (salvo 4 gestos de trazo y una rama fija) | **Recurso gráfico**: no hay capa vectorial importada ni biblioteca de ilustraciones ni generador de recursos con transparencia | `forma: 'rama'` y `trazo` en [intencion.ts](../src/dominio/diseno/intencion.ts) |
| Texto en trayectoria libre, deformado o en perspectiva | Imposible (salvo círculo o arco) | **Compositor** | `circulo-texto` con `arco` es la única curva |
| Tipografía display variada | Parcial | **Catálogo**: 23 familias, pocas de exhibición, sin lettering propio | [recursos/tipografias](../recursos/tipografias/) |
| Fondo o escena nuevos manteniendo el plato real | Parcial | **Generador**: hoy se regenera la foto entera y el plato puede cambiar (cuarto langostino, latte art distinto). Falta componer el plato real recortado sobre un fondo generado sin comida | `pulpo-2`; `cafe-post-f10-foto-mcp-*` |
| Texto dentro de la imagen generada (cartel integrado) | Posible, con riesgo | **Generador**: él dibuja las letras (errata «ACOMRAÑANTE») y el plato. La lectura con Vision ayuda, pero llega tarde | [lecturaCartel.ts](../src/adaptadores/imagen/lecturaCartel.ts), carrusel clásico de Albor |
| Carrusel con variación estructural (frase partida, panorama continuo, curva de densidad) | Posible a mano; no automático | **Esquema de secuencia**: en F3 es portada + detalles + cierre; en el productor, 5 tratamientos; en el taller, 5 tratamientos | [propuesta.ts:249-257](../src/dominio/diseno/propuesta.ts#L249-L257); Etxebarri y chiringuito (a mano) |
| Historia 9:16 | Imposible en El Pase | **Brief**: solo post o carrusel con lienzo 3:4. El lienzo `HISTORIA_9_16` existe, pero nadie lo pide | [brief.ts:46](../src/dominio/brief.ts#L46) |
| Reconocer una composición mediocre | Débil | **Crítica**: la del productor solo corrige maqueta (aprobó la banda crema). La de F3 contesta sí o no frente a una referencia y reescribe entera. Ninguna aplica la [rúbrica](../conocimiento/rubrica.md) que ya existe, compara versiones ni detecta que una pieza «parece plantilla» | [criticaEditorial.ts](../src/aplicacion/productor/criticaEditorial.ts), [instruccionesDiseno.ts](../src/adaptadores/gemini/instruccionesDiseno.ts) |

**Lo posible con otra dirección o mejor revisión** (las cinco primeras filas) da una mejora visible sin tocar el motor. La sexta, la retícula asimétrica, pide además datos de carta. **Lo imposible** (ilustración, texto en trayectoria, segmentación por ingrediente, historia en El Pase) pide herramientas nuevas.

### 3.4 Doce referencias, una a una

Las abrí a tamaño grande. Cada caso responde a cuatro preguntas:

- **Qué decisión la hace funcionar** y qué perdería si se quitara.
- **Hoy:** qué podría resolver Pase Hydrogen y con qué herramientas.
- **Dónde se queda corto** y cómo se comprueba.
- **Capacidad nueva** que la resolvería, junto con otras familias distintas.

**1. «ZEST»** ([vertical](../referencias-pinterest/diseno-visual/historias-verticales/linocutai-e1-afqpshwxy.jpg); concepto generado con IA)

- **Decisión:** la piel del limón se enrosca entre las letras: pasa por delante de la Z, por detrás de la E y la S y otra vez por delante de la T. Sin el entrelazado sería una palabra grande junto a un limón.
- **Hoy:** la palabra monumental, la oclusión de una sola capa, los bloques pequeños de ingredientes y horario y la retícula. Con la intención y la relación `detras`.
- **Corto:** la máscara del sujeto es una sola, así que el producto queda entero delante o entero detrás. **Comprobación:** pintar «ZEST» con un recorte de limón; el entrelazado no se puede expresar en `intencion@1`.
- **Capacidad nueva:** máscaras por parte del producto, con plano por tramo. Sirve también para la cinta que envuelve un vaso, el hilo de queso que cruza una letra o el vapor delante de un titular.

**2. «Bacon Jam»** ([post](../referencias-pinterest/diseno-visual/hamburgueserias/beatrizmolinari1111-e1-afqpshxal.jpg))

- **Decisión:** la hamburguesa sale de un marco blanco que hace de ficha de producto. Sin el cruce del marco, sería una foto con un pie de texto.
- **Hoy:** todo. `imagen` con `ventana`, `recorte` `alineadoCon`, `forma` para el marco y texto.
- **Corto:** ningún director lo puede pedir: no está entre los 4 mecanismos ni entre los tratamientos del productor. **Comprobación:** escribir la intención a mano y renderizar; la parte difícil es la máscara del gesto (mano y pan).
- **Capacidad nueva:** que el director escriba capas (F1). Desbloquea la familia «sale del marco»: polaroid, ventana o ticket.

**3. «BACON BURGER»** ([post](../referencias-pinterest/diseno-visual/hamburgueserias/yashaswiniangiras-e1-afqpshxp7.jpg))

- **Decisión:** palabra monumental en tres líneas, hamburguesa recortada tapando la central y dos hamburguesas pequeñas que dan escala. Sin las pequeñas pierde profundidad; sin la oclusión es un cartel de texto.
- **Hoy:** `TITULAR_DETRAS` en F3, y el compositor a mano (como «MANHATTAN TOWER»). Las pequeñas son el mismo activo escalado.
- **Corto:** El Pase no lo ofrece en la web, y el F3 no puede pedir «el mismo producto a otra escala» como acento. **Comprobación:** pedirlo en El Pase con post «por capas»; solo hay cartel con banda.
- **Capacidad nueva:** vocabulario abierto y repetición del activo como operación. Sirve para ritmo y contador.

**4. «FESTIVE COCKTAIL Creation»** ([post](../referencias-pinterest/diseno-visual/coctelerias/byimmm-e1-afqpshye4.jpg))

- **Decisión:** collage de tres cócteles recortados, preguntas en curva que invitan a responder y letras en cajas como tipografía de etiqueta. Sin las curvas, el texto sería un bloque aparte.
- **Hoy:** recortes (si cada cóctel es un activo), texto en arco (`circulo-texto`), un trazo y sellos.
- **Corto:** las curvas son trayectorias libres, no arcos; los garabatos (rizos, destellos) no están entre los 4 gestos; y no hay letra en caja. **Comprobación:** reproducir con `circulo-texto` y `trazo` y medir la desviación de la curva.
- **Capacidad nueva:** texto en trayectoria Bézier, biblioteca de garabatos SVG y capa de collage. Sirve para la familia de anotación lúdica.

**5. «BAD BATCH LEMONADE»** ([post](../referencias-pinterest/diseno-visual/coctelerias/cori-sass-e1-afqpshz5u.jpg))

- **Decisión:** una retícula asimétrica de papel y foto, donde la copa cruza la frontera, más una carta manuscrita. Sin el cruce serían dos mitades sin relación.
- **Hoy:** casi todo. `forma` para el papel, `textura` de papel, `recorte` de la copa que invade la zona y texto con una manuscrita del catálogo (Caveat, Kaushan).
- **Corto:** el esquema del director (no hay retícula partida) y el **dato** (la lista de ingredientes tiene que venir de la carta confirmada). **Comprobación:** pedirlo a F3; no existe un mecanismo «columna de papel».
- **Capacidad nueva:** retículas como operación y carta vigente como fuente (informe editorial, E3). Sirve para cartas, recetas y avisos.

**6. «just one? / …maybe two. / fine, three.»** ([post](../referencias-pinterest/diseno-visual/coctelerias/fionao0166-e1-afqpshxzr.jpg))

- **Decisión:** el chiste en tres tiempos alineado con tres vasos cenitales y sombras duras. Sin la frase, es una foto de producto.
- **Hoy:** la composición (tres textos pequeños anclados) si existen tres recortes o una foto real así.
- **Corto:** **copy**, porque una frase con giro no cabe en las fuentes de texto (`PLATO`, `ELEMENTO`, `MARCA`, `RECUENTO`, `CREATIVO` de una palabra). Y **material**: hace falta la foto. **Comprobación:** `problemasDeTextos` rechazaría la frase.
- **Capacidad nueva:** copy creativo sin reclamos, con un detector y la aprobación del dueño. Abre la familia del humor y el meme («El cargador / Mi cargador»).

**7. «TÁ NA HORA DE RECARREGAR»** ([post](../referencias-pinterest/diseno-visual/hamburgueserias/novesix-agenciadigital-e1-afqpshzia.jpg))

- **Decisión:** un objeto añadido (enchufe y cable) convierte la hamburguesa en batería. Sin él no hay idea.
- **Hoy:** el fondo partido, el recorte, el titular y el botón.
- **Corto:** el **recurso**: no hay forma de producir el enchufe y el cable como capa aparte. Si se pide al generador de foto, regenera también la hamburguesa. **Comprobación:** pedirlo en el taller; el cartel integrado altera el producto.
- **Capacidad nueva:** generador de objetos con transparencia, sin comida, compuestos bajo el control del código (F6). Sirve para metáforas visuales y atrezo de temporada.

**8. «croissant», portada falsa de revista** ([post](../referencias-pinterest/diseno-visual/panaderias-postres/madewithdaria-e1-afqpshxsn.jpg))

- **Decisión:** parodia de formato: labios, código de barras, pegatinas y el producto en la boca. Sin la parodia no hay chiste ni registro pop.
- **Hoy:** el titular, el recorte con filo y los sellos.
- **Corto:** la **ilustración** (labios) y el **formato parodiado**, que no está en ningún vocabulario. **Comprobación:** no hay capa para importar un SVG ni catálogo de «formatos» (portada, ticket, etiqueta).
- **Capacidad nueva:** capa `ilustracion` y operación «formato prestado». Sirve para tickets, etiquetas, carteles de cine o menús de época.

**9. «THE NEW YORK LARDER»** ([post](../referencias-pinterest/diseno-visual/restaurantes/psychehu-e1-afqpshzty.jpg))

- **Decisión:** muchos productos recortados con un mismo sistema (elipse, sombra y etiqueta en curva) alrededor de un bloque de título. Sin el sistema sería un bodegón desordenado.
- **Hoy:** los recortes, si hay un activo por producto, y las etiquetas.
- **Corto:** **material** (una foto real por producto), **segmentación** (las instancias se funden; [mascara.swift:14-20](../src/herramientas/mascara.swift#L14-L20)) y **etiqueta en curva**. **Comprobación:** con una sola foto de mesa, el compositor no puede separar las piezas.
- **Capacidad nueva:** conservar las instancias por separado y un operador de «sistema» que aplica la misma etiqueta a N elementos. Sirve para cartas visuales y despieces.

**10. «TOMMI'S TUESDAYS»** ([vertical](../referencias-pinterest/diseno-visual/historias-verticales/claudiav7981-e1-afqpshy3to.jpg))

- **Decisión:** ilustración a dos tintas con lettering para una oferta semanal. La identidad la da la técnica de impresión.
- **Hoy:** el texto y el estallido (sello). La trama y el duotono existen.
- **Corto:** la **ilustración** y el **desregistro sobre la imagen** (para el texto ya existe: `tinta.registro`, una segunda impresión desplazada en otro color). **Comprobación:** aplicar `duotono` y `trama` a una foto da una foto tramada, no una risografía ilustrada.
- **Capacidad nueva:** ilustración generada o dibujada, más un pase de impresión con desregistro. Sirve para la familia de cartelería de barrio y los rituales semanales.

**11. «TABLE 8», carrusel del equipo** ([carrusel](../referencias-pinterest/diseno-visual/carruseles/framexformstudio-e1-afqpshztg/01.jpg); plantilla de Canva)

- **Decisión:** retrato documental, un nombre y su rol por tarjeta, y dibujos de verdura en línea blanca que hacen de hilo de la serie. Sin los dibujos sería un carrusel de fotos con texto.
- **Hoy:** las fotos y la tipografía.
- **Corto:** los **dibujos**, las **personas** (hace falta su foto y su permiso; informe editorial, §4.6) y la **secuencia**: las tarjetas comparten estructura con variación de contenido, y F3 solo sabe hacer portada, detalle y cierre. **Comprobación:** pedirlo como carrusel en El Pase.
- **Capacidad nueva:** secuenciador con plantillas de tarjeta por papel (persona, plato, dato) y capa `ilustracion`. Sirve para presentar al equipo, proveedores o la cocina.

**12. «Anatomía de una buena pizza»** ([vertical](../referencias-pinterest/diseno-visual/historias-verticales/andreasanchezamate444-e1-afqpshzkv.jpg); plantilla de Canva)

- **Decisión:** una mano sostiene el producto y cuatro anotaciones manuscritas lo explican; abajo, la zona del enlace. Sin las anotaciones sería una foto de producto en vertical.
- **Hoy:** `ANOTACIONES` de F3 (flecha y texto) y el lienzo 9:16 del compositor.
- **Corto:** la vía (El Pase no hace historias) y el dato (las anotaciones tienen que salir de hechos de la carta). **Comprobación:** pedir una historia en El Pase; no existe.
- **Capacidad nueva:** historia 9:16 con zona de sticker y enlace, y anotaciones desde la carta. Sirve para las historias de explicación del informe editorial (§4.4).

**En resumen:**

- **Solo cambiando la dirección:** 3 de 12 se resolverían ya (2, 3 y 5).
- **Con vocabulario, copy o datos:** 3 más (6, 12 y parte de 9).
- **Con herramientas nuevas:** 6 (1, 4, 7, 8, 10 y 11), que piden máscaras por parte, texto en trayectoria, ilustración, generación de objetos aparte, desregistro o un secuenciador.

---

## 4. Un sistema que pueda inventar estilos

### 4.1 Principio

**El modelo decide; el código garantiza; la crítica mide.** Hoy el modelo decide poco (elige de una lista) y el código decide casi todo. Hay que invertir el reparto en lo creativo y mantenerlo en lo verificable:

- **El modelo:** la idea, la jerarquía, las operaciones y el estilo.
- **El código:** la colocación exacta, la legibilidad, la fidelidad del plato y la exactitud del texto.
- **La crítica:** si la pieza se lee, si tiene tensión y si se parece a otra cosa.

### 4.2 Recorrido de un brief a varias direcciones

| # | Paso o agente | Qué hace | Capacidad creativa que desbloquea |
|---|---|---|---|
| 1 | **Analista de material** (visión + medición) | Mide la foto: mapa de aire (ya existe), máscara por elemento (nuevo), paleta, eje y textura dominante. Dice qué permite la foto: si hay aire para un titular, si el plato aguanta un recorte, si hay un borde que puede sangrar | Las ideas nacen de lo que la foto puede dar, no de una plantilla |
| 2 | **Bibliotecario de operaciones** | Recupera 6 a 10 referencias del corpus indexado por **operación** (oclusión, repetición, anotación, collage…), alimento y registro, y explica qué operación transfiere cada una | El director ve un repertorio, no una sola receta |
| 3 | **Director de arte divergente** | Escribe de 3 a 5 **tesis visuales**: idea, primera lectura, operaciones combinadas y por qué nacen del alimento, el mensaje o el local. Un control de distancia rechaza tesis que comparten estructura | Variedad real entre direcciones |
| 4 | **Guardián de marca** | Separa invariantes (paleta núcleo, voz tipográfica, firma, grano) de lo reinventable (retícula, escala, operaciones, recursos). Se alimenta del perfil `marca/perfil@2` y de la huella tipográfica | Reconocible sin ser repetitivo |
| 5 | **Diseñador de estilo** | Convierte una tesis en un **estilo**: un programa de operaciones con parámetros (§4.4), reutilizable en toda la serie | Inventar tratamientos ejecutables, no describirlos |
| 6 | **Generador de recursos** | Produce recursos con transparencia y procedencia: ilustraciones vectoriales, papel, cinta, sellos, patrones, texturas o fondos sin comida. **Nunca toca el plato** | Collage, ilustración y materia propios |
| 7 | **Maquetador** (el compositor ampliado) | Compila la intención y la renderiza. Comprueba zona segura, contraste, oclusión, cruce y tamaño mínimo | Ejecutar lo imaginado con exactitud |
| 8 | **Crítico con rúbrica** | Puntúa por dimensión sobre renders a 1080 px y a 360 px, con borrosa, cuadrícula de perfil y lectura por OCR. Devuelve **parches** localizados, cada uno con la medida que debe mejorar | Reconocer lo mediocre y arreglarlo sin rehacer lo que funciona |
| 9 | **Comparador** | Enfrenta las direcciones por parejas a tamaño móvil y mide su distancia estructural con piezas anteriores y con plantillas conocidas | Elegir con criterio y evitar el «déjà vu» |
| 10 | **Secuenciador** | Para carrusel e historia, reparte densidad, escala y posición entre pantallas y decide qué cruza de una a otra | Series con ritmo y continuidad |
| 11 | **Persona** | Elige la dirección, aprueba textos y fotos y rechaza parches | Criterio del local y responsabilidad |

### 4.3 Representaciones nuevas

| Representación | Qué guarda | Para qué |
|---|---|---|
| **Tesis visual** (`tesis@1`) | Idea en una frase; hecho que la sostiene; primera, segunda y tercera lectura; operaciones; qué no se hará | Discutir la idea antes de pintar y medir la distancia entre direcciones |
| **Estilo** (`estilo@1`) | Programa de operaciones con parámetros e invariantes de marca; versión; piezas que lo usan | Reutilizar en una serie, variar con control y auditar qué se repite |
| **Intención** (`diseno/intencion@1`, ampliada) | Capas y relaciones, con capas nuevas: `ilustracion` (SVG con transparencia), `texto-trayecto`, `collage` (marcos y cinta), `recorte` por elemento | Lo que pinta el compositor |
| **Parche** (`parche@1`) | Selector de capa, operación acotada (mover, escalar, cambiar plano, quitar), motivo, medida que debe mejorar y medida que no puede empeorar | Corregir sin rehacer |
| **Prueba** (`prueba@1`) | Renders (1080, 360, borrosa, cuadrícula), medidas, puntuaciones por dimensión y parches propuestos | Comparar versiones y aprender |

### 4.4 Cómo se construye un estilo nuevo

Un estilo nace de **tres fuentes cruzadas**:

1. **El alimento:** su forma (torre, espiral, piezas sueltas, líquido), su materia (crujiente, brillante, cremosa) y su gesto (se apila, se moja, se vierte, se corta).
2. **El mensaje:** novedad, ritual, aviso, explicación o promesa (viene del informe editorial).
3. **La identidad del local:** sus invariantes y su registro (popular, premium, de barrio, técnico).

**Rasgos de continuidad** (no se reinventan pieza a pieza): paleta núcleo de dos o tres colores, una o dos voces tipográficas, firma, tratamiento de la foto (luz, grano) y tono de los textos.

**Decisiones reinventables:** retícula, escala del titular, relación texto-producto, recursos gráficos, densidad, recorte, punto de vista y color de acento.

**Catálogo de operaciones combinables** (el director compone; no elige una sola):

| Familia | Operaciones | Estado hoy |
|---|---|---|
| Tipografía con el producto | Ocultar parte de la palabra, contorno al cruzar, palabra que sigue el borde del plato, texto entre capas del producto | Existe, salvo «entre capas», que necesita segmentación |
| Recorte y profundidad | Producto que se sale del marco, sangrado deliberado, sombra proyectada o de contacto, filo de pegatina, varios planos | Existe en el compositor; falta en el esquema del director |
| Retícula | Asimétrica, modular, columna lateral, eje vertical, «portada de revista» con columnas pequeñas | Existe la retícula 12 × 16; faltan plantillas de retícula como operación |
| Repetición y ritmo | Palabra en filas, secuencia de recortes, contador, patrón | Existe el patrón; falta la secuencia de recortes |
| Collage editorial | Papel rasgado, cinta, recortes de varios encuadres, sellos y etiquetas, tipografía de prensa | Parcial |
| Anotación | Flechas, números, cotas y alzado con niveles | Existe |
| Textura y materia | Grano, papel, tinta impresa, risografía con desregistro, semitono | Parcial: el desregistro existe para el texto (`tinta.registro`); falta sobre la imagen |
| Ilustración | Garabatos sobre la foto, personajes, iconos, sustitución de una parte por un dibujo | Falta |

**Ejemplos de combinaciones** que no son una plantilla:

- **«Alzado».** Producto recortado + niveles con cotas + tipografía técnica en una columna lateral: el plato leído como un edificio.
- **«Prensa».** Foto en semitono a dos tintas + titular de prensa condensado + papel rasgado que revela el producto a color.
- **«Mapa del bocado».** Cenital a sangre + anotaciones numeradas + leyenda en una columna estrecha.
- **«Palabra que se come».** Titular monumental + mordisco real del producto que se lleva parte de una letra (máscara del bocado) + sello con un dato real.

### 4.5 Qué se genera, qué se compone y qué falta

| Elemento | Cómo se resuelve | Por qué |
|---|---|---|
| El plato | **Foto real**, o foto nueva con veredicto `CONSERVA` y motivo humano tipificado (informe editorial, E2). Se protege con su máscara | Fidelidad: es lo que el cliente va a comer |
| Texto | **Siempre determinista**, con fuentes locales y texto confirmado; nunca dentro de una imagen generada | Exactitud y edición sin regenerar |
| Composición, color, retícula, oclusión | **Determinista** (compositor) | Comprobable y corregible por capa |
| Fondos, superficies y atmósfera sin comida | **Generación**, en una capa aparte, debajo del recorte real | Libertad de escena sin tocar el producto |
| Ilustración, iconos, garabatos y sellos dibujados | **Generación de SVG** por un modelo de lenguaje, o generación de imagen vectorizada, en capa aparte con licencia y procedencia | Recursos propios del local, reutilizables |
| Texturas y papeles | Procedurales (ya hay grano, papel y tramado) o una biblioteca propia | Coste cero y control |
| Previsualización | Renders a 1080 y 360 px, borrosa, cuadrícula del perfil y comparación de versiones | La crítica y la persona deciden sobre lo que verá el cliente |

**Faltan:**

- **Segmentación por elemento:** conservar por separado las instancias que Vision ya detecta (taza, plato, mano) es barato. Separar ingredientes dentro de un plato pide otro modelo de segmentación o máscaras marcadas a mano.
- **Capa de ilustración vectorial:** SVG con transparencia, recoloreable con los tokens de la marca.
- **Texto en trayectoria:** curvas Bézier y deformación por envolvente.
- **Operador de collage:** marcos irregulares, cinta y superposición de recortes.
- **Desregistro de risografía sobre la imagen** (para el texto ya existe con `tinta.registro`).
- **Medidas automáticas:** mapa de saliencia (qué se ve primero; Vision lo da en local con su petición de saliencia por atención, como ya se hace con el OCR), similitud con plantillas y con piezas anteriores (embeddings de imagen y huella estructural de la intención) y lectura por OCR a 360 px de todo el texto compuesto.
- **Composición 9:16** con zonas de interfaz reservadas.

### 4.6 Carrusel e historia: misma identidad, otra densidad

- **Carrusel.** El secuenciador fija los invariantes de la serie (paleta, voces, firma, retícula base) y reparte por tarjeta una **curva de densidad**:
  - **Portada:** máxima tensión, una sola lectura.
  - **Tarjetas centrales:** cambian escala y punto de vista, y cada una aporta un dato.
  - **Cierre:** el más tranquilo, con la firma.

  Una tarjeta repite la estructura de otra solo si lo hace a propósito (ritmo). Hay **conectores entre tarjetas**: un elemento que cruza el borde, una frase partida, una línea o un panorama continuo (como el chiringuito, hecho a mano).
- **Historia.** Una pantalla 9:16 se lee en 2 o 3 segundos. Se diseña sin el 14 % superior ni el 20 % inferior, con **una idea por pantalla** y la interacción (sticker) reservada como zona vacía. Entre pantallas cambia la densidad, no la identidad. Una historia de tres pantallas puede ser gancho, dato y pregunta.

### 4.7 Proteger el plato y el texto cuando se experimenta

- **El plato** se compone siempre a partir de su máscara. Las operaciones de forma (oclusión, recorte, giro, escala) son transformaciones geométricas, no regeneraciones. Una prueba compara los píxeles dentro de la máscara antes y después de componer: solo cambian por escala, rotación o un ajuste de color global declarado.
- **El texto** vive en capas editables, con su cita al hecho que lo sostiene (ya existe en el dialecto de F3). La crítica no puede proponer texto nuevo. Un parche solo mueve, escala o reordena texto confirmado.
- **Los recursos generados** van en capas aparte, con procedencia y licencia, y la regla «no representa comida ni hechos». Una ilustración de un pulpo no puede insinuar que el plato lleva algo que no lleva.
- **El copy creativo se abre con control.** Una frase con idea («just one? / …maybe two. / fine, three.») puede ir si **no afirma nada** del producto ni del local: precio, origen, premio, ingrediente o superlativo. El detector de reclamos que ya existe (`RECLAMOS` en [propuesta.ts](../src/dominio/diseno/propuesta.ts)) la filtra y el dueño la aprueba como texto. Las afirmaciones siguen necesitando su hecho (informe editorial, §4.6).
- **Una dirección que exige alterar el plato** (otro emplatado, otra vajilla, un ingrediente añadido) **no se puede ejecutar**: se propone como petición de foto al local.

---

## 5. Demostración: un brief, tres direcciones

**Brief (supuesto, tomado de la pieza de prueba de Dak Burger del repositorio):**

- **Local:** Dak Burger, en La Cala de Mijas.
- **Producto:** «Manhattan Tower», una hamburguesa de tres carnes, tres lonchas de bacon y tres de cheddar.
- **Mensaje:** presentar el producto estrella. Es el mensaje más difícil para no caer en plantilla.
- **Material:** una foto del producto de frente, recortable, y los tokens de color de la marca ([marcas/dak-burger/tokens.json](../marcas/dak-burger/tokens.json)).
- **Texto confirmado:** «MANHATTAN TOWER», «3 carnes · 3 bacon · 3 cheddar» y el nombre del local. Nada más.

La pieza existente («MANHATTAN TOWER» repetido en filas) queda excluida: las tres direcciones tienen que ser distintas a ella y entre sí.

### Dirección A · «Alzado»: la torre leída como un edificio

- **Idea:** la hamburguesa se llama torre; se dibuja como el plano de un rascacielos.
- **Primera lectura:** la hamburguesa recortada, enorme y centrada, sobre un fondo de papel de plano (crema con retícula fina azul).
- **Segunda lectura:** las líneas de nivel que salen de cada capa real hacia la derecha («PLANTA 1 · CARNE», «PLANTA 2 · CHEDDAR»…), con la capa `niveles`, que ya existe.
- **Tercera lectura:** «MANHATTAN TOWER» en una columna izquierda, condensada y vertical, como el rótulo de un plano.
- **Abajo:** escala gráfica y firma en versalitas espaciadas.
- **Recurso reconocible:** cotas y niveles anclados a la anatomía real del producto.
- **Post:** como se ha descrito.
- **Carrusel:**
  1. El alzado completo.
  2. Tres tarjetas, una por «planta», cada una con un recorte a escala distinta y una sola cota.
  3. Cierre con la «fachada»: el local, si hay foto.
- **Historia:** una pantalla con el alzado comprimido y el titular arriba, la zona inferior libre, y una encuesta: «¿Hasta qué planta llegas?».

### Dirección B · «Prensa»: la torre como noticia

- **Idea:** el producto estrella tratado como titular de periódico de barrio.
- **Primera lectura:** la hamburguesa a color, recortada, rompiendo un papel rasgado que deja ver debajo una página de prensa en semitono a una tinta (color de la marca).
- **Segunda lectura:** titular de prensa condensado, en dos líneas a todo lo ancho («MANHATTAN / TOWER»), con la hamburguesa tapando la parte baja de la segunda línea.
- **Tercera lectura:** una pastilla tipo «última hora» con «3 · 3 · 3» y una línea fina con «carnes · bacon · cheddar».
- **Recurso reconocible:** papel rasgado con semitono y tipografía de prensa.
- **Post:** como se ha descrito.
- **Carrusel:**
  1. Portada.
  2. «Tres claves»: cada tarjeta, una columna de periódico con su recorte.
  3. Cierre: «dónde leer la noticia», con la dirección confirmada si consta.
- **Historia:** el papel rasgado se abre en dos pantallas. La primera muestra solo el rasgado con «ÚLTIMA HORA»; la segunda, la hamburguesa.

### Dirección C · «Corte»: la torre por dentro

- **Idea:** nueve capas se entienden mejor de perfil y en silencio.
- **Primera lectura:** foto de perfil a sangre, con la cámara a la altura de la carne, y mucho negro arriba. Necesita una toma real del local o una foto nueva `CONSERVA`.
- **Segunda lectura:** números pequeños (01–09) alineados a la derecha, cada uno a la altura de su capa, unidos por filetes finos.
- **Tercera lectura:** «Manhattan Tower» en una serif de exhibición pequeña, arriba a la izquierda, y la firma abajo.
- **Recurso reconocible:** numeración de capas a la altura exacta de la anatomía, con silencio alrededor.
- **Post:** como se ha descrito.
- **Carrusel:** cada tarjeta amplía tres capas, con la numeración continua (01–03, 04–06, 07–09) como hilo.
- **Historia:** un desplazamiento vertical simulado; las tres pantallas recorren la torre de arriba abajo.

**Por qué son direcciones y no variaciones:** cambian la idea, la retícula (central con columna lateral, a todo lo ancho, asimétrica con mucho vacío), la relación texto-producto (anotación técnica, oclusión, numeración silenciosa), el recurso propio (cotas, papel rasgado, numeración) y el registro (técnico, popular, premium). Comparten solo los invariantes: paleta núcleo, firma y fuentes de la marca.

### Revisión simulada de la dirección A

1. **Render a 360 px.** Las etiquetas de nivel, a 34 px en el lienzo de 1080, bajan a unos 11 px en el móvil. Son nueve líneas, una por capa; dos se solapan con el queso que gotea y la primera lectura se va a la maraña de líneas, no a la hamburguesa.
2. **Medidas:**
   - la saliencia más alta queda en el cuadrante derecho (las etiquetas) y no en el producto;
   - el OCR a 360 px lee 4 de 9 etiquetas;
   - el contraste es suficiente;
   - la oclusión es correcta.
3. **Diagnóstico** (dimensión «composición y jerarquía»): demasiadas anotaciones para el tamaño.
4. **Parche acotado:**
   - capa `niveles`: agrupar por tipo, con tres niveles («CARNE × 3», «BACON × 3», «CHEDDAR × 3»), anclados a la primera capa de cada tipo;
   - subir el cuerpo de las etiquetas a 46 px;
   - mover su arranque a `desdeX` 0,62 para que no crucen el queso.
5. **Qué no toca:** la foto, el recorte, el titular, el fondo y la firma.
6. **Comprobación:**
   - la saliencia vuelve al producto;
   - el OCR lee 3 de 3;
   - la puntuación de jerarquía sube;
   - ninguna otra dimensión baja;
   - los píxeles del producto dentro de la máscara no cambian.

   Si alguna empeora, el parche se descarta y se prueba el siguiente.

---

## 6. Cómo comprobar que funciona

### 6.1 Rúbrica visual

**Escala por dimensión de 0 a 4:**

- **0:** ausente o roto.
- **1:** genérico (plantilla reconocible).
- **2:** correcto, pero previsible.
- **3:** decidido, con una intención legible.
- **4:** de agencia: se recuerda y no se confunde.

**Nota final:** suma de `peso × nivel / 4`. La fidelidad y la veracidad son además **compuertas**: si fallan, la pieza no puntúa.

| Dimensión (peso) | Qué se observa | Medida que la apoya |
|---|---|---|
| **Idea** (15) | Se dice en una frase y nace del alimento, del mensaje o del local; sobrevive si se cambia la fuente | La tesis escrita y la prueba «¿podría ser de otro local?» |
| **Composición y jerarquía** (15) | Una primera lectura clara; segunda y tercera ordenadas; espacio con función | Mapa de saliencia; borrosa a 360 px; tiempo hasta reconocer el producto |
| **Oficio tipográfico** (15) | Voces con papel, escala con tensión, cortes, interlineado y puntuación cuidados, legible a 360 px | OCR a 360 px; cuerpo mínimo; relación entre el cuerpo mayor y el menor (≥ 3,5) |
| **Relación imagen-texto** (15) | El texto y el producto se tocan con intención (oclusión, anotación, eje, cruce) | Relaciones medidas (`detras`, `cruza`, `noSolapar`); porcentaje de oclusión |
| **Identidad** (10) | Se reconoce el local sin leer el nombre | Invariantes cumplidos; prueba con el nombre tapado |
| **Variedad real entre direcciones** (10) | Las direcciones difieren en estructura, no solo en color y fuente | Distancia estructural entre intenciones (retícula, operaciones, relaciones) y entre embeddings de imagen |
| **Secuencia** (10) (carrusel e historia) | Portada que pide avanzar, curva de densidad, conectores y cierre | Variación de escala y densidad por pantalla; tarjetas eliminables sin pérdida = 0 |
| **Fidelidad del producto** (10) + compuerta | El plato es el real; no hay texto sin respaldo | Diferencia de píxeles dentro de la máscara; cotejo de textos con sus citas |

### 6.2 Comparación a ciegas a tamaño móvil

1. **Briefs:** 8 briefs equivalentes, con el mismo nivel de material (una foto real, 2 o 3 textos confirmados y los tokens de marca). Se reparten entre hamburguesería, coctelería, cafetería y restaurante, y se elige un mensaje por brief: estrella, novedad, aviso o ritual.
2. **Tres fuentes por brief:**
   - Pase Hydrogen, con la versión que elija la persona entre sus direcciones;
   - un diseñador de agencia con Canva, 45 minutos y el mismo material;
   - una plantilla de Canva bien elegida, adaptada en 10 minutos (línea base).
3. **Presentación:** las 24 piezas, en orden aleatorio, dentro de un marco de teléfono a 360 px de ancho, sueltas y en la cuadrícula del perfil. Sin marcas de origen.
4. **Revisión independiente:** tres personas por separado (un diseñador gráfico, un responsable de marketing de hostelería y un dueño de local). Cada una puntúa la rúbrica, ordena las tres piezas de cada brief y hace una tarea extra:
   - **Prueba de plantilla:** recibe las 8 piezas de Pase Hydrogen mezcladas con 8 de la línea base y las agrupa por «parece del mismo sistema o plantilla». Si los grupos coinciden con el origen más de lo que daría el azar, el sistema **es reconocible como plantilla**.
5. **Criterio de éxito de la fase:**
   - Pase Hydrogen supera a la plantilla en la mediana de las tres personas, en 6 de 8 briefs;
   - empata o supera a la agencia en al menos 3 de 8;
   - la prueba de plantilla no distingue su origen.

### 6.3 Prueba de transferencia

Se elige **un local y un estilo que el sistema no haya visto en desarrollo**, por ejemplo una cevichería con estética de cartel «chicha» o un *kissaten* con estética de imprenta japonesa. Se le da solo su marca y 5 referencias nuevas.

**Aprobado** si:

- sus tres direcciones puntúan al menos 3 en idea y en variedad;
- ninguna reutiliza un estilo ya guardado en `estilo@1`;
- un revisor no las agrupa con piezas anteriores del sistema en la prueba de plantilla.

Así se mide si aprendió **capacidades** (operaciones combinables) y no **plantillas**.

---

## 7. Plan de desarrollo por dependencias

**Esfuerzo relativo:**

- **S:** cambia un paso existente.
- **M:** añade un modelo, un caso de uso y sus pruebas.
- **L:** añade un operador de render o un agente con su bucle.

| Fase | Qué reutiliza | Qué incorpora | Referencias para probarlo | Resultado observable que acredita que funciona | Esfuerzo |
|---|---|---|---|---|---|
| **F0 · Banco de pruebas visual** (lo necesitan todas) | Compositor y hojas de revisión (`movil.jpg`), `probarIntencion` ([ordenPost.ts:908-926](../src/aplicacion/post/ordenPost.ts#L908-L926)), lectura con Vision ([lecturaCartel.ts](../src/adaptadores/imagen/lecturaCartel.ts)), [rúbrica](../conocimiento/rubrica.md) | 8 briefs fijos (foto real, textos confirmados, tokens); renders a 1080 y 360 px, borrosa y cuadrícula; OCR y saliencia con Vision; planilla de la rúbrica de §6.1; página local de comparación a ciegas | Las 36 salidas actuales como línea base, más Las doce de la §3.4 como techo de comparación | Línea base puntuada por tres revisores, con su concordancia; la banda de `pulpo-2` y «ENSALADA CÉSAR» salen marcadas en composición | M |
| **F1 · El director escribe capas** (primera mejora visible) | El dialecto de capas que ya existe ([propuesta.ts](../src/dominio/diseno/propuesta.ts), 11 tipos), `compilarIntencion`, las citas de texto (`problemasDeTextos`), el mapa de la foto y la huella | El director escribe capas (no solo un mecanismo) a partir de **varias** referencias recuperadas por operación. Bucle de render, crítica y parche de hasta 3 vueltas. Disponible en El Pase como alternativa al productor para el post. Arreglo de la cabecera: tinta y velo según la luz medida | [BACON BURGER](../referencias-pinterest/diseno-visual/hamburgueserias/yashaswiniangiras-e1-afqpshxp7.jpg), [FRESH](../referencias-pinterest/diseno-visual/restaurantes/anso0224-e1-afqpshz3d.jpg), [Bacon Jam](../referencias-pinterest/diseno-visual/hamburgueserias/beatrizmolinari1111-e1-afqpshxal.jpg), [BAD BATCH](../referencias-pinterest/diseno-visual/coctelerias/cori-sass-e1-afqpshz5u.jpg), [MELTED](../referencias-pinterest/diseno-visual/hamburgueserias/astral-designs-e1-afqpshx1n.jpg), [REBEL](../referencias-pinterest/diseno-visual/hamburgueserias/jagtt0897-e1-afqpshy-q.jpg), [ingredientes en arco](../referencias-pinterest/diseno-visual/restaurantes/epartridge18-e1-afqpshz-o.jpg) | En los 8 briefs, la mediana sube al menos un nivel en «composición» y en «relación imagen-texto» frente a F0; se usan al menos 5 operaciones distintas; ninguna regresión de fidelidad | M |
| **F2 · Corpus por operaciones** | [corpus-editorial.json](../conocimiento/referencias/corpus-editorial.json) (256), biblioteca, selección profesional y `diseno-visual`; `FichaReferencia` | Taxonomía de operaciones (§4.4), etiquetado por modelo de visión con revisión humana y búsqueda por operación, alimento y registro | Todo el corpus | En 10 consultas, al menos 8 de las 10 primeras referencias son pertinentes según un revisor | S-M |
| **F3 · Crítico con rúbrica y parches** | El patrón de correcciones acotadas de [criticaEditorial.ts](../src/aplicacion/productor/criticaEditorial.ts) y las versiones de [revisarEntrega.ts](../src/aplicacion/productor/revisarEntrega.ts) | Puntuación por dimensión con sus medidas; `parche@1`; comparador por parejas; similitud con plantillas y con piezas anteriores | Un conjunto de 20 piezas con defectos sembrados: la banda crema, el titular que pierde letras, etiquetas ilegibles a 360 px, el carrusel que repite el esquema | Detecta al menos 16 de 20 defectos; en al menos 12, su parche mejora la medida sin empeorar otra; aplicado a las piezas buenas, no propone cambios | M |
| **F4 · Direcciones divergentes y estilo como programa** | [huella.ts](../src/dominio/diseno/huella.ts) (antirrepetición), `marca/perfil@2` (constantes y variables) | `tesis@1`, `estilo@1`, control de distancia estructural, guardián de marca | Cinco hamburguesas con estructuras distintas: [oclusión](../referencias-pinterest/diseno-visual/hamburgueserias/yashaswiniangiras-e1-afqpshxp7.jpg), [objeto añadido](../referencias-pinterest/diseno-visual/hamburgueserias/novesix-agenciadigital-e1-afqpshzia.jpg), [vacío](../referencias-pinterest/diseno-visual/hamburgueserias/jagtt0897-e1-afqpshy-q.jpg), [lettering](../referencias-pinterest/diseno-visual/historias-verticales/hnlburgerlhokseumawe-e1-afqpshwl9.jpg), [juego](../referencias-pinterest/diseno-visual/historias-verticales/krisnawarzone159-e1-afqpshy1.jpg) | Por brief, tres direcciones que superan la distancia mínima. Los revisores las juzgan «distintas» en al menos el 80 % de los casos y, con el nombre tapado, reconocen el local en al menos el 60 % | M-L |
| **F5 · Operadores nuevos del compositor** | `MotorTexto`, resolutor, `mascara.swift` (instancias) | Máscaras por instancia sin fundir; texto en trayectoria y por envolvente; capa `ilustracion` (SVG); operador `collage` (marcos irregulares, cinta); desregistro de risografía sobre la imagen; composición 9:16 con zonas reservadas | [ZEST](../referencias-pinterest/diseno-visual/historias-verticales/linocutai-e1-afqpshwxy.jpg), [FESTIVE COCKTAIL](../referencias-pinterest/diseno-visual/coctelerias/byimmm-e1-afqpshye4.jpg), [NEW YORK LARDER](../referencias-pinterest/diseno-visual/restaurantes/psychehu-e1-afqpshzty.jpg), [GRAPES](../referencias-pinterest/diseno-visual/pizza-sushi-otros/sofiemariep-e1-afqpshxagk.jpg), [KUPANI](../referencias-pinterest/diseno-visual/restaurantes/gfergason-e1-afqpshzxy3.jpg), [collage de prensa](../referencias-pinterest/diseno-visual/historias-verticales/carlymeikle-e1-afqpshymoi.jpg) | Se reproducen 6 referencias hoy imposibles: un revisor confirma que el mecanismo está, aunque cambien el producto y el texto | L |
| **F6 · Generador de recursos con transparencia** | Procedencia de activos ([activos.ts](../src/dominio/activos.ts)), reservas y topes de gasto | Ilustración SVG por modelo de lenguaje; fondos y superficies sin comida por generación de imagen; biblioteca de recursos por local, con licencia | [RECARREGAR](../referencias-pinterest/diseno-visual/hamburgueserias/novesix-agenciadigital-e1-afqpshzia.jpg), [croissant](../referencias-pinterest/diseno-visual/panaderias-postres/madewithdaria-e1-afqpshxsn.jpg), [TOMMI'S](../referencias-pinterest/diseno-visual/historias-verticales/claudiav7981-e1-afqpshy3to.jpg), [TABLE 8](../referencias-pinterest/diseno-visual/carruseles/framexformstudio-e1-afqpshztg/01.jpg) | 3 recursos por local reutilizados en una serie; ningún recurso representa comida ni hechos; diferencia de píxeles del plato igual a 0 | M-L |
| **F7 · Secuenciador de carrusel e historia** | [secuenciaTaller.ts](../src/dominio/secuenciaTaller.ts) (exige variar vista, plano y gesto), [serie.ts](../src/aplicacion/taller/serie.ts), la historia del informe editorial (E6) | Curva de densidad, conectores entre tarjetas, frase partida, panorama, 9:16 con zona de sticker | Carruseles [El Gabán](../referencias-pinterest/diseno-visual/carruseles/elgaban-oficial-e1-afqpshwwm/01.jpg), [THE FOOD / THE MOOD](../referencias-pinterest/diseno-visual/carruseles/giulia-budapest-e1-afqpshyeh/01.jpg), [diagrama](../referencias-pinterest/diseno-visual/carruseles/beatrizmolinari1111-e1-afqpshzjg/01.jpg), [TABLE 8](../referencias-pinterest/diseno-visual/carruseles/framexformstudio-e1-afqpshztg/01.jpg); contraejemplo, [pizza en plantilla](../referencias-pinterest/diseno-visual/carruseles/surya-pasala-e1-afqpshw-h/01.jpg); historias [11AM / 8PM](../referencias-pinterest/diseno-visual/historias-verticales/gabrielmbgs-e1-afqpshykg.jpg), [elige tu mood](../referencias-pinterest/diseno-visual/historias-verticales/geovannadesign-e1-afqpshyhy.jpg), [SOON…](../referencias-pinterest/diseno-visual/historias-verticales/rvoloska-e1-afqpshxds.jpg) | En carruseles de 4 o 5 tarjetas, los revisores no pueden quitar ninguna sin perder algo; las historias se entienden en 2 s en una prueba con 5 personas | M |
| **F8 · Prueba a ciegas y de transferencia** | Todo lo anterior | Protocolo de §6.2 y §6.3 | Briefs nuevos y un estilo no visto | Los criterios de éxito de §6.2 y §6.3 | S (de organización) |

**Orden:**

1. **F0 primero.** Sin banco de pruebas no se puede saber si algo mejora.
2. **F1 y F2 en paralelo.** F1 puede arrancar con un subconjunto de referencias etiquetado a mano y pasar a la búsqueda de F2 cuando exista.
3. **F3 antes de F4.** Divergir sin un crítico que mida produce variedad fea.
4. **F5 y F6 cuando F1–F4 demuestren que el director usa bien lo que ya hay.** Si la nota no sube con el vocabulario actual, añadir operadores no la subirá.
5. **F7 tras F5** (necesita 9:16 y conectores) y **F8 al cerrar cada gran paso.**

**Mejora visible inmediata:** F0 + F1, con el arreglo de la cabecera. Reproduce de forma automática el método que dio las mejores piezas del repositorio.

**Inversión que da libertad creativa:** F4 + F5 + F6. Con ellas, el sistema deja de imitar la receta de una referencia y empieza a combinar operaciones con recursos propios del local.

---

## 8. Respuesta a la pregunta

> **«¿Qué tendría que poder decidir y ejecutar Pase Hydrogen para que un diseñador de agencia no pueda reconocer sus resultados como variaciones de la misma plantilla?»**

Un diseñador reconoce una plantilla porque **la estructura se repite**: mismo sitio del titular, misma relación con el producto, misma densidad, mismos recursos. Cambian solo el color, la fuente y la foto. Para que no la reconozca, Pase Hydrogen tiene que:

**Decidir, en cada pieza:**

1. **La idea**, a partir de un hecho del alimento, del mensaje o del local («la torre como edificio»), antes de cualquier forma.
2. **La primera lectura** y el orden de las otras dos.
3. **La estructura**: la retícula, la escala del titular y la relación texto-producto (oclusión, anotación, eje, cruce, repetición, collage), elegidas y **combinadas** de un repertorio abierto, no de una lista de cuatro.
4. **El estilo como programa**: qué invariantes de marca conserva y qué se reinventa.
5. **Qué no repetir**, comparando con sus propias piezas anteriores y con plantillas conocidas.
6. **Cuándo hace falta un recurso propio** (una ilustración, un papel, un sello) y cuándo basta la foto.
7. **Cuándo parar**, porque la pieza ya se lee y añadir algo la empeora.

**Ejecutar, con garantías:**

1. Componer por capas con **máscaras por objeto**, de modo que el producto tape, cruce o salga del marco donde la idea lo pide, sin regenerar el plato.
2. Operaciones tipográficas de verdad: escala extrema, oclusión, texto en trayectoria, anotaciones ancladas a la anatomía y voces con papel.
3. **Recursos gráficos propios con transparencia**, generados o dibujados aparte y reutilizables en la serie.
4. **Secuencias** que cambian densidad y estructura entre tarjetas y pantallas, con conectores y una historia 9:16 diseñada para su formato.

**Comprobar antes de enseñar:**

1. Renderizar a 360 px, en borrosa y en la cuadrícula del perfil.
2. Medir qué se ve primero, si el texto se lee y cuánto se parece a otra pieza.
3. Puntuar por dimensión y corregir con un **parche** que no toque lo que ya funciona.
4. Ofrecer a la persona **direcciones realmente distintas**, no variantes.

**La prueba de que lo ha conseguido** no es una nota propia. Es que, en la comparación a ciegas (§6.2), un diseñador no consiga agrupar sus piezas por origen mejor que al azar, y que con un local y un estilo nuevos (§6.3) siga produciendo direcciones que no se parecen entre sí ni a lo que ya hizo.
