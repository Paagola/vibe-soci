# La oficina del estudio · hoja de diseño (kit Diorama 5.7.0)

> Hoja del kit (`templates/DESIGN.md`) rellenada para el **Creative Automation Startup Loft** (15/11/2026).
> Manda sobre la versión anterior, la del pasillo con once puestos.
> Lo que no aplica (combate, vehículos, agua, mecanismos educativos) se ha quitado.

## Decisiones

- **Render:** `stroked-toon`, decisión del usuario. `createStrokedToon` del kit, sin cambios:
  - rampa `[68, 122, 184, 246]`;
  - tinta `#27231e` con grosor `0.0034` (OutlineEffect);
  - antialias, `NoToneMapping` y dpr con tope de 1,5.
  - No se suma un segundo sistema de contornos: el OutlineEffect basta, y un Sobel de normales y profundidad duplicaría líneas.
- **Modelos:** `authored-only`, decisión del usuario.
  - Ningún modelo descargado; todo está hecho a mano.
  - Los profesionales se construyen sobre el rig vestido del kit (`kit/peopleModel-street.js`, MIT). Es código, no un modelo.
- **Perfil:** `sceneProfile: narrative`.
- **Interfaz:** `uiMode: requested-inspection`, por el anexo del 14/11. Nada es permanente: todo aparece bajo demanda y anclado al mundo.
  - Rótulo al pasar por encima.
  - Al pulsar, la cámara se acerca y aparece una tarjeta pegada a la estación.
  - Solo se anuncian sin interacción las paradas que esperan a la persona.
- **Fuente de verdad:** `GET /api/procesos`, de solo lectura. La escena es función de `t` y del estado (`guion.js`).

## Concepto

Un loft de una startup creativa de IA, fotografía gastronómica y diseño:
- ventanales a dos paredes, pilares de hormigón y una pérgola de madera sobre un **jardín central** con olivo;
- tarimas de madera, cristaleras, paneles acústicos y vegetación integrada.

El material del encargo recorre un circuito alrededor del jardín:
- **por la calle del fondo:** recepción → referencias → foto → parada 1 → generador → revisión → parada 2 → segmentación;
- **por la calle delantera:** dirección de arte → imprenta → galería de entrega.

Las zonas comunes (café, lounge, brainstorming y rincón de lectura) son ambiente: no fingen procesos.

### Hora real del navegador (ambiente, no proceso)

- **Mañana o tarde:** cielo claro.
- **Atardecer:** luz cálida.
- **Noche:** luz azulada y lámparas cálidas encendidas en el café, el lounge y la lectura.

### Encaje con la web oscura

El loft es un escenario iluminado sobre la interfaz oscura, decisión explícita: con poca luz no se leerían los procesos.

- Fuera de la losa todo es fondo oscuro: degradado `#121a33` → `#090c16`.
- La paleta de paredes y suelo se bajó un punto tras la primera revisión.
- De noche, la oficina se oscurece con la hora real.

## Plano (`plano.js`, única fuente de verdad, sin three.js)

- **Losa:** 19 × 13 m. Paredes de 3 m con ventanales al fondo (-Z) y a la izquierda (-X); los lados de la cámara quedan abiertos (cutaway).
- **Calles:** red de nodos con anchura libre de 1,2 m. `ruta()` sigue la red por Dijkstra y `enRuta()` da posición y rumbo.
- **Cada estación tiene:**
  - centro y orientación;
  - **entrega:** dónde se para el corredor;
  - **operario:** dónde trabaja el profesional;
  - **ocupa:** el área de colisión.
- **Además:** zonas comunes, árboles con su radio de copa, pilares, jardineras y jardín vertical.
- **Pruebas espaciales** (`test/diorama-plano.test.ts`, 7 casos):
  - todo queda dentro de la losa y nada se solapa;
  - las copas no invaden las calles;
  - las calles mantienen su anchura;
  - cada entrega queda fuera de los muebles y se alcanza a pie;
  - cada operario está en su estación;
  - el circuito es finito.

## Estaciones (`estaciones.js`): cada una con identidad propia

| Estación | Paso | Qué es | Imagen REAL que enseña |
| --- | --- | --- | --- |
| Tablero de referencias | REFERENCIA | Moodboard de corcho con muestras de color, láminas y un hilo rojo; mesa de organización y archivador | La referencia del encargo, clavada con chinchetas |
| Recepción | FOTO_REAL | Mostrador de lamas, bandeja azul, casillero de clasificación, rótulo con el nombre del local y router con piloto de conexión | La foto subida, en la bandeja |
| Director de fotografía | PROPUESTA | Fondo de papel curvo, mesa de bodegón, dos softboxes, reflector, cámara en trípode y mesa con monitor y flexo | Foto original en la mesa y en el monitor; la propuesta, como papel pintado (es JSON) |
| Parada 1 | CONFIRMAR_ELEMENTOS | Mesa de presentación con atril y carpeta; el tablero, la lámpara y el letrero «TE TOCA» se ponen amarillos solo cuando espera | Foto original en el atril |
| Generador | GENERAR | Máquina modular azul petróleo: cámara de toma acristalada con platina que gira, brazos de luz, panel con pilotos, ranura y bandeja | En la bandeja y en el material, la foto nueva de ese intento |
| Revisor visual | COMPROBAR | Caja de luz, dos pantallas de comparación, tampón, bandejas de aceptadas y devueltas, documentos y estantería | Original y foto nueva en las pantallas; sello con el veredicto real (PASA, DESCARTA, REVISAR) |
| Parada 2 | CONFIRMAR_FOTO | Mesa con la foto ampliada en atril | La última foto nueva |
| Segmentación | MASCARA | Escáner con tapa abierta, barra de luz que barre, torre de proceso y pantalla en brazo | La máscara real |
| Director de diseño | INTENCION | Mesa con tableta gráfica, muestras, reglas y lápices; moodboard de cara a la sala y estantería | La referencia, en el moodboard y en la pantalla |
| Compositor | COMPONER | Imprenta de rodillos con tinteros (cian, magenta y tinta), volante rojo, bandejas, pantalla y mesa auxiliar con guillotina | El post exportado, en la bandeja y en la pantalla |
| Galería de entrega | HECHO | Panel expositor «PUBLICADOS» con un marco grande y siete pequeños, y la bandeja de entrega | El post del encargo en foco (solo cuando el corredor ya lo ha dejado) y los posts terminados anteriores |

**Sin imagen real, el soporte queda en blanco:** papel, o pantalla apagada. Nunca se inventa una imagen.

Además, son datos reales:
- la pizarra del brainstorming, con los platos de los encargos abiertos;
- el rótulo de la recepción, con el local del encargo en foco.

## Personajes (`personajes.js`)

| Personaje | Base | Identidad | Trabaja (solo con dato real) |
| --- | --- | --- | --- |
| Asistente de producción (la mascota) | `mascota.js` a escala 1,2 para alcanzar las mesas de 0,74 m | Casco blanco, cara negra mate, sudadera azul con estrella amarilla, guantes y zapatillas | Lleva el material por las calles, lo deja, lo recoge y lo enseña en las paradas |
| Director de fotografía | Rig vestido del kit (1,69 m) | Pelo corto castaño, sobrecamisa camel, vaqueros y la cámara al cuello | Examina la foto, anota y consulta la pantalla |
| Revisora visual | Ídem | Moño, gafas, chaqueta técnica azul petróleo, acreditación, lupa y sello | Lupa sobre la caja de luz con la cabeza inclinada; compara y sella al final |
| Director de diseño | Ídem | Pelo largo, gafas, camisa terracota, bufanda crema y lápiz de tableta | Dibuja; se para a pensar con la mano en la barbilla y elige muestras |

**Honestidad:** la vida ambiental nunca se confunde con trabajo.
- **Trabajo:** inclinado sobre la mesa, con las manos en ella, y luz o piloto encendido. Solo cuando el guion dice que su estación procesa, es decir, con dato real.
- **Reposo:** erguido, sin tocar la mesa. Respira, mira alrededor, cambia el peso, se estira y cruza los brazos.
- **Espera a la persona en su estación:** brazos cruzados, mirando a la sala.
- **Fallo real:** la mano a la cabeza y una nube sobre la estación con el código HTTP, «…» o «!».
- **Desconexión del backend:** ninguna estación finge actividad, y el rótulo y el piloto de la recepción se ponen en rojo.

## Animación y guion (`guion.js`)

- **Se conservan las reglas de la versión anterior:**
  - el guion es función pura de `t`;
  - al abrir, el material aparece donde está;
  - lo nuevo se añade detrás;
  - los retornos son reales;
  - el foco no salta de encargo en mitad de su recorrido.
- **Nuevo:**
  - el corredor anda por las calles (`plano.ruta`);
  - el material lleva su número de intento y su veredicto, así que la foto y el sello son los de ese intento.
- **Ritmo de escena:** el reloj de la escena no es el tiempo real. En real, el puesto trabaja hasta que llega el siguiente dato.

## Interacción (`interaccion.js`)

- **Al pasar por encima** (o al enfocar con el teclado los botones ocultos de cada estación) aparece un rótulo con el nombre y la función.
- **Al pulsar:**
  - **Cámara:** se acerca a 12,5 m de la estación, enfocada entre la estación y la entrega.
  - **Oclusión:** oculta lo que se interpone (pérgola, pilares, árboles, colgantes, cristaleras), comprobando rayos hacia las esquinas, el profesional y la entrega.
  - **Tarjeta:** aparece al lado, fuera del rectángulo que la estación ocupa en pantalla, con cuatro apartados:
    - **Ahora:** el dato real; si no hace nada, lo dice.
    - **Después:** el siguiente paso real y quién lo hace, con los matices del dominio (devolución al generador, una devolución al director de diseño).
    - **Te toca:** si es su caso, qué tiene que decidir la persona y un botón amarillo a `#/encargo/<proyecto>`.
    - **Lo último que entregó:** la nota real del historial, con miniatura real.
- **Cierre:** con Escape, el ×, «Vista general», al alejarse (más de 1,6 veces la distancia de foco) o con «Recolocar cámara». Nunca hay más de una tarjeta.
- **Indicador del borde:** si la parada que espera queda fuera de cuadro, un indicador amarillo en el borde lleva a ella.

## Rendimiento (medido el 15/11/2026, Chrome sin ventana con Metal, este Mac, 1440 × 900 a pantalla completa)

| Medida | Valor |
| --- | --- |
| Fotogramas por segundo en marcha | 30, el tope de `fpsMax` (estable) |
| CPU por fotograma | 2,3–5,2 ms según la toma; con ruido de medida |
| Llamadas de dibujo por fotograma (sombras, color y contorno) | 825; eran 585 en la escena anterior, con cuatro veces menos objetos |
| Triángulos por fotograma (tres pasadas) | ≈ 732 000; eran 905 000 antes de simplificar las cajas pequeñas |
| Oculta, fuera de la vista o en pausa | 0 fotogramas |
| `prefers-reduced-motion` | 0 fotogramas en reposo; un fotograma fijo por cada cambio real |
| Desmontar y volver a montar (5 veces) | 1 canvas en la página; contextos liberados con `forceContextLoss` |
| Descarga hasta entrar en la oficina | ≈ 15 KB (`vistas/oficina.js`, `index.js`, `montar.js`) |
| Descarga al entrar | three.js r170 y addons, 773 KB (≈ 190 KB con gzip; Express no comprime) + módulos de la escena, 201 KB |

**Optimizaciones:**
- fusión de lo estático por material (`fusionarEstaticos`, con el contrato `userData.vivo`);
- fusión por articulación en los personajes (`fusionarArticulaciones`): de unas 100 mallas a unas 30 por persona;
- cada árbol y cada elemento ocultable, fusionado dentro de sí;
- geometrías en caché por forma;
- cajas pequeñas con un solo segmento de bisel;
- sombras solo en lo que las proyecta.

## QA

- **Capturas** (fuera del repositorio): `scratchpad/capturas/final/01…20`, las 20 que pide la sección 23. También:
  - `capturas/v-h2/` (oficina real con un encargo simulado);
  - `capturas/esc/` (desconexión, reconexión y noche).
- **`frames.mjs` del kit:** corredor, director de foto, revisora y director de diseño, todos `ok`. Antes, el director de foto y la revisora salían `FROZEN` porque su gesto de trabajo era demasiado fino; se amplió.
- **Pruebas:** `test/diorama-plano.test.ts`, `test/diorama-guion.test.ts` y `test/web-procesos.test.ts`, este último con las imágenes reales servidas.

## Descartado y por qué

- **El aro sobre la cabeza de la mascota:** a escala de juguete se leía como el ala de un sombrero.
- **El contorno de tinta en cada masa de follaje:** las copas parecían espuma de anillos. Las copas no llevan contorno; el tronco y la jardinera, sí.
- **Operarios decorativos en las máquinas:** el que decide se distingue de la máquina que ejecuta.
- **Pantallas o tablones que tapan la cara del director de diseño:** se movieron a un lado.
- **El corredor entregando delante del profesional:** en el estudio de foto y en la revisión entrega por un lado.
- **Parpadeo:** el rig del kit fusiona los ojos con la cabeza por material para ahorrar llamadas. Separarlos solo para parpadear costaría más de lo que aporta.
- **Consumo por agente en la tarjeta:** `/api/procesos` no lo trae y el anexo no lo pide; no se inventa.
- **Un segundo sistema de contornos** (Sobel de normales y profundidad): duplicaría las líneas del OutlineEffect.

## Limitaciones

- **A tamaño de héroe,** los personajes miden unos 40–60 px. Se leen con la órbita y el enfoque.
- **El primer plano no se comprueba píxel a píxel:** la tarjeta se coloca fuera del rectángulo de la estación, pero un objeto de otra estación puede quedar delante.
- **Pruebas solo en simulado:** ni una con la facturación real. Lo que se ve con datos reales es lo que dé `/api/procesos` en modo REAL, con las mismas rutas.
- **El reloj de escena no es el real:** la escena cuenta lo que pasó, en orden, a su ritmo.
