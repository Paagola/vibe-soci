# ¿Cuál pides?

Piloto de una carta de cócteles en movimiento. El espectador ve las tres copas juntas y puede comparar el color, el hielo y la crema antes de elegir. El Clover Club ocupa la banda superior, el Old Fashioned la central y el Espresso Martini la inferior. El bar es un escenario generado para este ensayo.

[Ver el segundo montaje](cocteles-v2.mp4) · [Abrir sus capas en Tesseract](cocteles-v2.tsrct)

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
