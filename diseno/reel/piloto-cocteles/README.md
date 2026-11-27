# ¿Cuál pides?

Piloto de una carta de cócteles en movimiento. El espectador ve las tres copas juntas y puede comparar el color, el hielo y la crema antes de elegir. El Clover Club ocupa la banda superior, el Old Fashioned la central y el Espresso Martini la inferior. El bar es un escenario generado para este ensayo.

**[Ver el tercer montaje](cocteles-v3.mp4)** · [Segundo montaje](cocteles-v2.mp4) · [Capas del segundo en Tesseract](cocteles-v2.tsrct)

## Errores del segundo montaje y corrección (tercer montaje)

Revisión de Víctor sobre [cocteles-v2.mp4](cocteles-v2.mp4). Cada fallo se documenta con su causa y la regla que evita repetirlo.

| # | Fallo observado | Causa | Corrección en el tercer montaje | Regla para próximos reels |
|---|---|---|---|---|
| 1 | Solo la primera toma es vídeo. Detalle y cierre son fotos con zoom. | El macro y la vista final se montaron como imágenes Nano con movimiento de cámara digital, y los cierres reaprovecharon brutos antiguos invertidos. | Las tres tomas de cada banda son clips Magi 2 nuevos: arrastre, detalle (macro con empuje de cámara) y cierre (el arrastre invertido, que devuelve la copa a su sitio). | Si el reel original es vídeo en todas las tomas, ninguna toma puede ser un fotograma fijo. El plan de tomas declara «vídeo» o «foto» y la revisión lo rechaza si no coincide. |
| 2 | Clover (arriba): sale a la izquierda, 7/10, el original sale del plano. Old Fashioned (centro): gira el vaso, 3/10; en el original hace lo mismo que el de arriba pero a la derecha. Espresso (abajo): debe repetir el movimiento del primero, 0/10. | Foreground estático animado con fotogramas clave desde una pose fija, y el prompt del central admitía giro. La mano del Espresso se compuso a partir del clip del Clover. | Prompts de arrastre explícitos por banda: Clover a la izquierda, Old Fashioned a la derecha, Espresso a la izquierda. El vaso queda recto, no gira, y copa y mano salen completas del cuadro hacia el segundo 3,5. | El movimiento de cada banda se escribe como contrato: dirección, qué agarra la mano, «no gira», y salida total del plano. Se comprueba con fotogramas a 0,5 s antes de aprobar. |
| 3 | Las tipografías son malas. | Se usó Lato Regular de 40 px, ajuste puesto a ojo, sin analizar la tipografía del reel ni usar el taller tipográfico de posts y carruseles. | Se midió el reel de referencia (tabla siguiente) y se reprodujo: Montserrat 400, blanco, una línea, 45 px sobre 1080, posición fija en las tres tomas. Generador: [rotulos.mjs](montaje-v3/rotulos.mjs). | Antes de poner texto, medir en el original familia (serif/sans, contraste), cuerpo relativo al ancho, líneas, caja y color. Elegir la fuente por el catálogo de `recursos/tipografias` y el sistema de `diseno/tipografia-especial`, nunca con la fuente por defecto. |
| 4 | Los nombres aparecen delante de los cócteles. | Rótulo y vídeo en el mismo plano sin separar capas. | Capas por banda, de abajo arriba: fondo y barra, rótulo, copa y mano. El rótulo queda detrás de la copa y se descubre columna a columna en su estela: se sigue el borde de la copa fotograma a fotograma ([capas.mjs](montaje-v3/capas.mjs)). | Todo texto que «aparece al paso del objeto» necesita al menos tres capas (fondo, texto, sujeto) y una máscara del sujeto. Se revisa un fotograma intermedio de cada tramo. |

Las notas del reporte de Víctor (7/10, 3/10, 0/10) quedan como línea base de la siguiente revisión.

### Tercer montaje · 27 de noviembre

[cocteles-v3.mp4](cocteles-v3.mp4), 1080 × 1920, 12 s, 25 fps, con el sonido original. Seis clips Magi 2 nuevos ([manifiesto](brutos/v3/manifiesto.json)): un arrastre y un detalle por bebida. El cierre es el arrastre invertido. Cortes a 4,6 y 6,8 s (el original, a 5,03 y 6,57 s; el arrastre generado termina hacia los 4,3 s). Se regenera con `node montaje-v3/capas.mjs && montaje-v3/montar.sh`.

**Tipografía del reel de referencia, medida** (MP4 de 720 × 1280, 12,1 s, descargado del pin; escala 1,5 a 1080 de ancho):

| Rasgo | Medida en el original | Aplicación |
|---|---|---|
| Familia | Sans geométrica de ojo grande (Montserrat). Los anchos de tinta de tres rótulos dan el mismo cuerpo (29,7–29,9 px) con el avance de Montserrat 400 | Montserrat variable, peso 400 |
| Cuerpo | Altura de versal 21 px = 0,70 em → 30 px a 720 | 45 px a 1080 |
| Anchos de tinta | Old Fashioned 214 px, Espresso Martini 243 px, Hará // joyful 181 px | Se comprobó que coinciden con Montserrat 400 |
| Color y efectos | Blanco, sin contorno ni sombra apreciable | Blanco con sombra de 35 % y 2,5 px de difusión, para el mostrador claro |
| Composición | Una línea, alineada a la izquierda, sin mayúsculas forzadas. Inicio de tinta en x = 94, 315 y 107 px; línea de base a 289, 305 y 274 px dentro de cada banda | Origen en x = 138, 470 y 157 y base a 433, 458 y 411 px en nuestra banda de 640 |
| Permanencia | El rótulo no se mueve: está igual en el arrastre, el detalle y la vuelta. Se atenúa en el último medio segundo | Misma posición en las tres tomas, con fundido de salida al final |
| Aparición | Se descubre detrás de la copa y la mano a medida que salen («ul», «/ joyful», «ará // joyful») | Capas fondo / rótulo / copa y mano. Máscara de copa por diferencia con la barra vacía y revelado columna a columna tras su borde |

El v2 había acertado la posición (142/481 px) y falló la familia, el cuerpo y el efecto. La primera versión del v3 estropeó la posición al subir los rótulos a una caja de dos líneas con serif. Regla: medir antes de elegir, y no mover lo medido.

- Direcciones comprobadas en fotogramas: Clover a la izquierda, Old Fashioned a la derecha sin giro, Espresso a la izquierda.
- «¿Cuál pides?» no existe en el original. Se mantiene en Montserrat 500, desde los 8,2 s, sobre un degradado inferior.

Límites: el mate por diferencia puede dejar halo en el borde de la mano. Los detalles son empujes de cámara sobre fotos Nano, con el rótulo sobre un fondo que a veces es claro (la piel de naranja). No hay editable Tesseract de esta versión. No se ha pasado el rótulo por las recetas del taller tipográfico: el original usa letra plana sin tratamiento, así que no hacía falta.

## Errores de proceso y reglas para el sistema

Además de los fallos visibles de la tabla anterior, el análisis del reel de referencia se hizo mal en el origen. Esta sección recoge qué falló en el método, para que el agente director no lo repita.

### Los tramos segundo y tercero se analizaron mal

La referencia se analizó solo como una estructura de cortes («apertura, detalle, vuelta»), con los tiempos de corte medidos (5,03 y 6,57 s) y los contenidos de los tramos 2 y 3 deducidos, no mirados. Releyendo el MP4 completo, lo que ocurre es otra cosa:

| Tramo | Qué se anotó en el piloto | Qué hay en el reel de referencia |
|---|---|---|
| 2 · detalle (5,03–6,57 s, 1,5 s) | Empuje de cámara sobre la espuma, el hielo y los granos, «macro de la bebida». | Primer plano oscuro, fondo casi negro, con acción de elaboración: la guarnición de cítrico deshidratado sobre la espuma rosa con un palillo, el cubo de hielo cristalino en el vaso, unas pinzas colocando el grano o chocolate sobre la espuma beis. El detalle es un gesto del bartender, no un zoom sobre un vaso quieto. |
| 3 · final (6,57–12,1 s, 5,5 s) | «La copa vuelve a la barra»: el arrastre invertido, con el mismo fondo cálido del tramo 1. | Otro decorado y otra luz: fondo negro con un bokeh cálido aislado, copas más cerca del objetivo, y acciones nuevas en vivo (guarnición clavada en el Old Fashioned con una naranja detrás, chorro de espresso cayendo sobre la espuma, cuchara a la izquierda). No es una vuelta al plano 1. |
| Rótulos | Rótulo solo en dos tomas y una fuente supuesta. | Rótulo fijo en las tres tomas, mismo sitio y mismo cuerpo, con fundido final. |
| Gestos | Se midió el primer movimiento de forma global. | El tramo 1 es un arrastre horizontal en cada banda con dirección propia, que se mide por banda. |

Consecuencia: el tercer montaje usa vídeo en todas las tomas y la tipografía medida, pero **los tramos 2 y 3 siguen sin parecerse al original** (zoom sobre foto Nano y arrastre invertido). Para cerrarlo hace falta generar con Magi 2 nuevos fotogramas oscuros por bebida y clips con la acción de guarnición y de vertido, en tomas de 1,5 y 5,5 s. Queda pendiente y registrado como la siguiente iteración.

### Qué falló en el método

1. **Se dedujo en vez de mirar.** Los cortes se midieron con rigor y el contenido de cada tramo se dio por supuesto. La ficha de análisis admitía «interpretación óptica» sin exigir un fotograma por tramo.
2. **Se midió la forma y no la tipografía.** Se anotó fuente, cuerpo y posición del texto sin medirlos. Se escogió una fuente por parecer «bonita» (Lato, luego Instrument Serif) y se ignoró el catálogo de tipografías y el método de medir sobre el original.
3. **Se confundió «mantener el mecanismo» con «reproducir la lista de tomas».** Se conservó el patrón de cortes, y se cambió el contenido del segundo y tercer tramo por uno más cómodo de generar (zoom y arrastre invertido). Un cambio así es una decisión que se anota con su motivo, no una sustitución silenciosa.
4. **Se reaprovechó material para ahorrar en vez de rodar lo que la toma pedía.** Los brutos antiguos invertidos y el foreground estático dieron el «0/10» y el «3/10». La causa no fue la herramienta sino reutilizar lo ya generado sin comprobarlo contra el original.
5. **La revisión se hizo contra la propia adaptación y no contra la referencia.** Los revisores internos puntuaron 8,8 sobre 10 un montaje que el usuario valoró con 0–7 sobre 10. La comparación fotograma a fotograma con el original no formaba parte de la revisión.
6. **No se descargó la referencia.** El MP4 estaba disponible en el propio pin y no se guardó en el repositorio, así que la verificación posterior no tenía qué medir. Mover lo ya medido (el v3 inicial) estropeó además una posición que el v2 tenía bien.

### Reglas para el sistema agéntico

- **Guardar la referencia en el repositorio** (MP4, hoja de fotogramas y medidas) y citarla en cada ficha. Sin referencia local, el análisis no es verificable.
- **Una fila por tramo y por banda**, con un fotograma al inicio, mitad y final, y tres campos obligatorios: *qué se ve*, *qué hace el sujeto* y *qué hace el texto*. Prohibido «detalle» o «macro» como descripción única.
- **Medir el texto antes de elegir fuente:** familia visible, anchos de tinta de al menos dos rótulos, altura de versal, posición de inicio y base, color, efectos y momento de aparición y salida. La fuente se escoge después, con el catálogo y comparando anchos.
- **Cada desviación del original se escribe como decisión**: qué cambia, por qué, y qué se pierde. Una desviación sin motivo anotado es un fallo.
- **La revisión final compara con el original, tramo por tramo,** con la misma hoja de fotogramas lado a lado, y puntúa «parecido» además de «calidad».
- **Prueba del tramo más difícil primero.** Aquí eran el arrastre dirigido por banda y la aparición por capas. Se probaron al final y el arreglo costó una iteración completa.
- **Todo texto con aparición ligada a un objeto en movimiento** necesita capas separadas y una máscara del objeto desde la ficha del plan, no como arreglo posterior.
- **No mover lo ya medido.** Si una versión acertó una medida, la siguiente la conserva salvo decisión anotada.

## Segundo montaje · 27 de noviembre

Los cortes caen a los 5,04 y 6,56 s, los fotogramas más cercanos al pin a 25 fps. La apertura ocupa los fotogramas 0–125, el detalle los 126–163 y la vuelta a la barra los 164–299. Las tres bandas cambian de escala juntas.

En la apertura, a partir de 1,40 s, el fondo limpio, el nombre y el recorte de la mano con el vaso ocupan capas independientes. El Clover y el Espresso salen por la izquierda y el Old Fashioned por la derecha. La mano del Espresso procede del clip del Clover y se compuso sobre el pie de la tercera copa. La trayectoria después del agarre está animada con fotogramas clave a partir de una pose fija. Esto conserva dirección y oclusión, aunque los dedos y el líquido mantienen la pose durante el arrastre.

Cada nombre lleva Lato Regular del catálogo de posts, en una línea de 40 px sobre el lienzo de 1080 px. Las líneas de base quedan a 431 px del inicio de su banda. Los nombres superior e inferior arrancan en x = 142 y el central en x = 481. El texto se descubre con la salida del primer término y conserva su lugar hasta el final.

Los detalles y los cierres usan intervalos de los tres brutos Magi disponibles. El detalle sigue la copa roja, acerca el hielo y la piel de naranja, y encuadra el borde y la crema del Espresso. En el cierre, el Clover vuelve al centro con el clip invertido. Los encuadres se acercan gradualmente. El metraje de partida limita el detalle de la ampliación y el movimiento de la tercera bebida. Las nueve ventanas de montaje proceden de tres brutos. Esta edición se realizó localmente, sin nueva generación de pago.

### Historial del primer montaje

[Máster anterior](cocteles.mp4) · [Editable anterior](cocteles.tsrct). Las decisiones, notas y mediciones que siguen corresponden a esa versión.

## Decisiones tomadas del pin

La referencia dura 12,10 s a 30 fps y mide 720 × 1280. En la apertura, las manos se acercan a tres copas situadas en bandas horizontales. El encuadre cambia en las tres bandas a la vez a los 5,03 s y de nuevo a los 6,57 s. El primer cambio lleva al detalle y el segundo recupera las bebidas con sus nombres. Los dos cortes se midieron en el MP4 completo. [Pin de referencia](https://es.pinterest.com/pin/511017888998079557/)

La adaptación conserva la posición de cada bebida entre cortes. Adelanta el primero a los cuatro segundos para aprovechar el movimiento disponible y da tres segundos a los detalles de espuma, piel de naranja y granos de café. La pregunta final convierte los nombres en una elección.

## Montaje editable

El [proyecto Tesseract 0.8.0](cocteles.tsrct) contiene los medios y las fuentes. Cada banda tiene su propio clip, macro, vista final y rótulo. La pregunta entra a los 8,00 s y queda visible hasta el cierre. La tabla expresa intervalos de destino en fotogramas a 25 fps, con el final excluido. Los tres brutos se leen desde su fotograma cero a velocidad natural.

| Banda | Bruto Magi | Macro Nano | Vista general Nano con nombre |
|---|---:|---:|---:|
| Clover Club | 0–100 | 100–175 | 175–300 |
| Old Fashioned | 0–104 | 104–179 | 179–300 |
| Espresso Martini | 0–106 | 106–183 | 183–300 |

La [mezcla original](sonido.wav) combina piano eléctrico, bajo y escobillas sintetizados con acentos de cristal. El roce de la copa sigue el desplazamiento del Clover y los acentos a los 4 y 7 s anuncian cada cambio de escala. El WAV dura 12 s, en estéreo PCM de 24 bits a 48 kHz.

## Material y gasto

Las tres fotografías de partida están en [fuentes](fuentes/). El expediente heredado conserva los archivos, pero carece de sus URL de procedencia. Los seis fotogramas derivados incluyen una vista general y un macro por bebida. El manifiesto recoge el modelo solicitado, el orden de dependencias, los identificadores y los prompts. La estimación histórica suma 12 créditos. [Rodaje Nano](rodaje-nano.json)

Se recuperaron los tres encargos Magi 2 por su identificador original. Cada uno devolvió 106 fotogramas a 25 fps, con imagen horizontal de 1920 × 1080 y sonido AAC. El Clover se desliza hacia la izquierda, la mano del Old Fashioned entra por la derecha y el movimiento del espresso se concentra en una gota. Se usa el ancho de las bandas para mantener los gestos dentro del cuadro. Los tres manifiestos registran los prompts, las huellas y el estado terminal. La estimación histórica de vídeo suma 0,96 USD. El cargo efectivo no consta en el expediente. Esta reanudación requirió cero generaciones nuevas. [Brutos y manifiestos](brutos/)

## Revisión de entrega

En el primer corte, el borde claro de la copa dificultaba leer «Espresso Martini». Se dividieron los nombres en dos líneas y se oscureció gradualmente el fondo bajo los rótulos. Dos revisores examinaron por separado el MP4 corregido a escala móvil.

| Revisión | Nota | Observación en el máster |
|---|---:|---|
| Dirección de arte | 8,8/10 | Entre 0 y 3,8 s se siguen el deslizamiento y el giro con los vasos enteros. En el cierre se leen los tres nombres. Algunos brillos del bar restan contraste local al rótulo inferior. |
| Edición social | 8,8/10 | La gota del Espresso se aprecia poco en móvil. En el macro se distinguen los granos y desde los 8 s hay cuatro segundos para leer y elegir. |

Se decodificó el MP4 completo. Contiene 300 fotogramas H.264 a 1080 × 1920, 25 fps y 12,00 s. La pista AAC estéreo a 48 kHz midió −15,0 LUFS integrados y −4,09 dBTP con el filtro loudnorm de FFmpeg. Tesseract reabrió y validó el proyecto con sus medios y las dos variantes de Instrument Serif empaquetadas.
