# Fotografía creíble para posts de restaurantes

Para ver cómo se compone una fotografía con titulares superpuestos, recortes y efectos editables, consulta el [ensayo de carteles de coctelería](../ensayo-carteles/README.md).

## Qué percibe el espectador

En una prueba de Califano y Spence, varias imágenes generadas parecieron más apetecibles que sus equivalentes fotográficos cuando los participantes desconocían la procedencia. Informar de la procedencia cambió las valoraciones. Los autores describen un riesgo concreto para un restaurante: la generación puede aumentar la abundancia aparente de una ración. En otro experimento con 87 personas y 60 pares de alimentos, las imágenes generadas recibieron en promedio menor puntuación de realismo y menos ganas de comer el alimento. El efecto depende de la imagen, el contexto y lo que se pregunta. Conviene evaluar por separado «¿me apetece?», «¿me creo esta escena?» y «¿reconocería lo que me servirían?». [Estudio de Califano y Spence](https://www.sciencedirect.com/science/article/pii/S095032932400051X) · [Experimento con 60 pares de alimentos](https://pmc.ncbi.nlm.nih.gov/articles/PMC13477471/)

La evidencia sobre detección también tiene límites. En un estudio sobre paisajes, arquitectura e interiores, los observadores justificaron decisiones por geometrías imposibles, luz incoherente y detalles sin sentido. Algunas imágenes sintéticas resultaron difíciles de detectar. Para gastronomía trasladamos ese hallazgo como criterio de dirección y revisión. Una sombra desplazada justifica corregir una taza. La calidez, la nitidez o la simetría aisladas dicen poco sobre la procedencia de la foto. [Estudio perceptivo y análisis de las respuestas](https://doi.org/10.3389/frai.2025.1707336)

## Cómo se construye la sensación

Estas asociaciones son hipótesis de dirección que se pueden comprobar mirando dos versiones del mismo plato.

| Intención | Decisión de toma | Qué comprobar en móvil |
| --- | --- | --- |
| Cercanía de quien está a punto de probarlo | Poner la cámara a la altura del comensal, con el borde de la mesa próximo y una zona nítida al alcance de la mano | ¿Tengo un sitio en esa escena? ¿El primer plano ayuda a reconocer la ración? |
| Expectación | Elegir el instante anterior a un gesto documentado, con el peso o la dirección visibles | ¿Se entiende qué va a pasar? ¿Los puntos de apoyo y las oclusiones son posibles? |
| Quietud o intimidad | Dejar que una fuente lateral alcance parte de la escena. Reservar espacio de baja actividad visual alrededor del sujeto | ¿La zona tranquila sigue perteneciendo a la mesa o a la pared? ¿Se conserva el volumen en sombra? |
| Energía | Acercar la cámara al recorrido de un gesto. Congelar el sujeto principal o introducir barrido en lo que se mueve | ¿Puedo seguir la dirección? ¿Hay una razón física para que solo esa zona se desenfoque? |

Una escena puede ser limpia, gráfica y deliberadamente escenificada. En el ensayo de café, las diferencias de diámetro y de color entre bebidas cuentan más sobre el producto que cualquier grano añadido. Unas tazas con el mismo brillo que la madera, tres rosetas idénticas o un exceso de espuma pueden captar atención y a la vez alejar la imagen de lo que sirve el local.

## Método de toma con Nano Banana Pro

Google recomienda describir sujeto, composición, acción, entorno y estilo, y concretar cámara, luz y formato. En una composición con varias imágenes, conviene identificar el papel de cada una. El estudio lo aplica de la siguiente forma. [Guía de Nano Banana Pro](https://blog.google/products-and-platforms/products/gemini/prompting-tips-nano-banana-pro/) · [Ejemplos fotográficos de la API](https://ai.google.dev/gemini-api/docs/image-generation#photorealistic-scenes)

1. **Fijar los hechos del producto.** Contar unidades visibles, tamaños relativos, estado y vajilla. Dejar como desconocido lo que oculta el borde o el desenfoque. Guardar aparte la estética del post de referencia.
2. **Leer la referencia mediante evidencias.** La elipse de un borde orienta sobre la altura de cámara. Una sombra corta y dura sugiere una fuente pequeña respecto al sujeto. Una etiqueta de «cinematográfico» no explica ninguna de las dos. Registrar las señales que sostienen cada interpretación, incluido qué no se puede determinar.
3. **Elegir un instante y una mirada por lámina.** Partir de qué se descubrirá al deslizar. Una vista baja descubre altura. Un cambio lateral revela qué objeto estaba tapado. Una inclinación gratuita también inclina los líquidos y puede romper la credibilidad. Consultar las últimas piezas del local antes de elegir la apertura.
4. **Dar al modelo un encargo visible.** Describir en prosa la cámara respecto al sujeto, su tamaño en cuadro, plano de foco, dirección y caída de la luz, superficies de contacto y espacio previsto para el título. Si una fuente colorea la escena, indicar qué alcanza. La mesa, la loza y la dirección de la luz mantienen la continuidad del carrusel. La posición de cámara y el gesto pueden cambiar.
5. **Comprobar y corregir una causa cada vez.** Comparar el producto con la fuente y la perspectiva con la toma anterior. Revisar primero a tamaño móvil para jerarquía y emoción. Ampliar después para recuento, uniones, reflejos y foco. «La taza trasera parece suspendida, asienta la base y acorta la sombra» permite evaluar el siguiente intento. Mover un titular pertenece al compositor y conserva la exposición elegida.

Por ejemplo, una indicación de toma para el café del ensayo podría ser:

> Use the product reference for the three cup sizes, glaze and drinks. From the far side of the serving board at seated eye level, place the largest cup to the right. Keep the front lip and the nearest milk pattern in focus. A window to camera left puts a narrow highlight on the glaze and a much softer one on the wood. The board touches the table along its base. Let the upper third recede into a quiet café wall for the headline. Make a new vertical photograph without lettering.

## Ensayo de Café Albor

La fotografía de partida presenta tres tazas de distinto tamaño en una tabla. La referencia de diseño presenta otro producto, texto en un campo oscuro superior y una composición dividida por un filete fino. El reto es trasladar esa jerarquía a una escena que conserve la identidad del café. [Foto de producto](../../plantillas/fotos/cafe-albor-cafe.webp) · [Cartel de referencia](../../biblioteca/referencias/post-11.jpg)

La interpretación «A tres sorbos» se hizo con ImageGen como ejemplo independiente de dirección. El tablero entra en diagonal, el campo superior admite una serif grande y la luz separa el esmalte de la madera. Las tres bebidas se distinguen. La ventana visible y la regularidad de las espumas dan un acabado más publicitario que el de la foto del local. Esta maqueta incorpora letras en el raster y sirve para comparar las decisiones visuales. [Ver interpretación de dirección](cafe-direccion.webp)

En «Un hueco para tres.», un segundo director partió de la ficha que produjo Gemini Argon al ver el cartel. Nano Banana Pro recibió la foto de las bebidas y produjo una toma de 896 × 1200. El compositor del estudio la llevó a 1080 × 1440 y añadió el titular en Fraunces y la firma en Work Sans. La ventana a la derecha explica el brillo de los esmaltes y la dirección de las sombras. El paso al lado opuesto de la tabla hace visible el cambio de cámara. El OCR a 360 px recuperó el titular, la marca y la ciudad. La toma de imagen costó 0,143952 USD. [Ver post producido](cafe-estudio.jpg)

En la toma Pro, la taza posterior se reconoce pero pierde buena parte de su dibujo de leche por el solapamiento. La pequeña señal en relieve de la taza delantera de la fuente apenas se aprecia. De aquí salen dos instrucciones de revisión reutilizables: verificar **cuánto se ve de cada unidad** y comprobar **qué rasgo permite reconocerla**. En el siguiente encargo de este tipo pediríamos desplazar la cámara hasta separar los tres bordes y llevar la marca visible a la zona de foco. Una comparación de dos piezas permite identificar ajustes concretos. Para medir una preferencia del público harían falta más platos, más tomas y evaluación a ciegas.

## Comprobaciones en el chat

- **Carrusel desde el formulario.** Con las mismas fotos de Café Albor, el director real ofreció tres conceptos, cada uno con tres láminas. Al aprobar «Tres cuartos y editorial en azul», el estudio produjo tres fotografías Pro. La portada presenta las tazas y reserva aire para el nombre, la segunda baja la cámara al borde del esmalte y la última permite leer las tres espumas desde arriba. Al pedir por chat mover el titular de portada, se conservó el identificador del carrusel. Los tres archivos de fotografía conservaron su SHA-256 y las otras dos láminas conservaron su render. Otra edición permitió recolocar el texto pequeño de portada dentro del margen de seguridad. La portada aún recuerda el encuadre de la foto de partida. Ese parecido motivó pedir cambios observables de perspectiva y oclusión en el encargo de cámara. [Ver carrusel de Café Albor](cafe-carrusel.jpg)
- **Carrusel con un plan archivado.** Para probar el camino de producción con otro restaurante, se partió de tres láminas de un plan anterior de Torre de Vega. Se generaron las tres fotografías con Pro. La primera maquetación dejó el cierre sin firma. La corrección recupera el texto aprobado sobre la misma toma y coloca la firma del local en una zona legible. [Ver carrusel de Torre de Vega](carrusel.jpg)
- **Imagen secundaria bajo petición.** En otra pieza de cinco láminas, el chat añadió un detalle de sal sobre pizarra a la derecha de «Escamas de sal». Nano Banana 2 generó únicamente el recuadro. Las cuatro capas anteriores coincidieron byte a byte, al igual que las otras cuatro láminas. En la lámina editada se midieron 29.929 píxeles distintos, todos dentro del recuadro. [Comparar antes y después](edicion-chip.jpg)
