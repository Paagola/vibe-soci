# Una fotografía, dos posiciones del titular

El piloto parte de los tres PNG de Víctor y de la versión `bdbc3d6` del taller. La hamburguesa conserva su frontal completo y admite dos maquetas sobre una sola base. Para la tarta y las croquetas se produjeron dos fotografías de estudio, una por alimento. Las tres piezas siguen en revisión. Las imágenes de este directorio se guardan como pruebas de composición.

## Resultados a 360 px

| Pieza | Qué cambia respecto al punto de partida | Qué conviene revisar con la fuente delante |
| --- | --- | --- |
| [Tarta de pistacho](tarta-de-pistacho-candidata.webp) | La caja diagonal sitúa la porción. La vista más baja muestra a la vez el canto pálido y la cobertura. El fondo deja de competir con el tostado. | El borde aparece más ancho y oscuro. Los trocitos de pistacho resultan más gruesos y abundantes. La luz enfatiza una textura del canto que el móvil sólo documenta parcialmente. |
| [Hamburguesa en aire](hamburguesa-aire.webp) | La palabra se lee por encima del pan. La foto conserva ambos extremos del producto, el papel de Bendito Bocado y la luz del neón. El margen prolonga el color de las primeras filas de la foto. | La palabra ocupa una zona relativamente aislada y el salto hacia el pan es amplio. |
| [Hamburguesa con solape](hamburguesa-detras.webp) | El pan interrumpe los trazos centrales. Misma foto, veladura del fondo, familia, cuerpo, tinta y palabra. Sólo cambia la posición de la línea con respecto a la silueta. | Se distingue el contacto en la panza y la descendente de las letras centrales. Conviene leer «Hamburguesa» entera sin consultar la dirección y ampliar la unión con el pan. |
| [Croquetas](croquetas-candidata.webp) | Un borde diagonal de aluminio separa las piezas ovaladas de otras más redondas. La luz lateral hace visibles los granos de la corteza y los intervalos oscuros. | El dorado es más cálido y uniforme. Hay piezas más abultadas a la derecha. La toma deja fuera el rótulo que aparece en el móvil. Las bandejas documentan un lote, con el sabor y la cantidad de una ración comercial pendientes de confirmación. |

La comparación anterior usa «Encuadrar la foto original» en el taller de partida con el recorte central. Para tarta y croquetas compara una toma reinterpretada con un recorte del móvil, por lo que los cambios de luz, fondo y cámara intervienen a la vez. Se usó ImageGen del entorno con las fotos exactas y dirección escrita a mano. Las candidatas se importaron después por la API normal del taller, con los criterios equivalentes guardados en la comanda. Las instrucciones enviadas al modelo permiten distinguir ese paso manual del texto exportable del taller. [Instrucciones de las tomas](instrucciones-de-las-tomas.json)

En la hamburguesa, el taller anterior reubicó el título en papel por el detalle de la foto. El salto a la maqueta en aire incluye un encuadre que conserva todo el original, la tipografía grande y la veladura. La comparación que aísla la posición del titular enfrenta las dos maquetas nuevas. La base y la máscara de ambas tienen idénticas huellas. Se conservan la palabra literal, la familia y la caja en el registro de cada versión. [Foto base limpia](hamburguesa-base.png) · [Máscara de la misma base](hamburguesa-mascara.png) · [Registro de las versiones](ensayo.json)

| Medida a 360 × 450 | En aire | Con solape |
| --- | ---: | ---: |
| Tinta tapada | 0 % | 7,07 % |
| Franja vertical más tapada | 0 % | 26,52 % |
| Percentil 8 del contraste bajo los trazos visibles | 17,95 a 1 | 11,47 a 1 |

El OCR registró fragmentos del papel impreso y falló la transcripción del título en las dos composiciones. La coincidencia literal se comprobó en la capa editable y la lectura, en la imagen a 360 px. Falta el juicio de Víctor sobre legibilidad, apetito y fidelidad. Las proporciones de tinta se calculan con el mismo medidor que utiliza el compositor de carteles. Los límites actuales del solape son 3,5–16 % del total y hasta 36 % por franja. Son tolerancias de composición de esta herramienta.

## Usar las capas en el Pase

1. Prepara un post con «Fotografía con un título». En «Editar dirección» fija el foco, el rasgo de la foto que conservarás y la comprobación a 360 px. La comanda confirmada vincula esas decisiones con la fotografía y el texto. Una foto pura utiliza el mismo criterio visual.
2. En «Producir el post», importa la foto 4:5 o conserva la foto original completa con margen para el título. Revisa la primera candidata antes de encargar otra toma.
3. Abre «Recomponer el título sobre esta misma foto» y «Componer con la silueta». Elige aire o detrás del borde. Puedes ajustar la familia y confirmar otro fragmento literal de la nota original. El texto confirmado sigue siendo una capa editable. Cada corrección crea una versión sobre la misma base y conserva sus permisos.
4. El modo local utiliza el segmentador que ya emplea el productor. También se puede importar una máscara PNG opaca de 1080 × 1350, con el sujeto blanco y el fondo negro. En modo simulado se utilizó una máscara real generada por Apple Vision sobre la base descargada. El taller reutiliza la máscara de la misma foto y permite descargar ambas capas.
5. Compara a tamaño móvil. Una observación visual queda ligada a la versión. Los controles de formato, integridad, contraste, uniformidad y OCR se consultan por separado. Si la tinta cubre demasiado o carece de contraste, la candidata anterior sigue disponible para probar otra composición.

## Referentes inspeccionados

Se abrieron las imágenes de los portafolios y se compararon a escala reducida. Los enlaces de origen identifican proyectos de autor o de estudio. El registro conserva además la URL exacta de imagen y la huella de los bytes inspeccionados. La muestra no acredita publicaciones concretas en Instagram ni métricas sociales. [Registro de referencias](referencias.json)

- **Canto y acabado.** En Bliss Bakery una vista oblicua deja ver el interior del corte y lo que ocurre en la cubierta. En la fotografía de Kimberly Espinel para *Rebel Comfort*, con estilismo de Katie Marshall, el perfil claro y las puntas tostadas se separan sobre un fondo oscuro. La dirección de la tarta traslada el ángulo y la separación de tonos y conserva el pistacho documentado. [Bliss Bakery, Spotted Productions](https://spottedproductions.com/work/bliss-bakery/) · [Kimberly Espinel](https://thelittleplantation.co.uk/london-food-photographer-portfolio)
- **Jerarquía frontal.** STACKHOUSE coloca una gran palabra color crema encima de la hamburguesa frontal. A 360 px se distinguen primero el titular y las capas de la hamburguesa, después los reclamos periféricos. Usamos el ancho de la palabra y el contraste. El solape con el pan se ensayó en el taller. Dlamini describe la pieza como un concepto de portafolio para una marca ficticia. [STACKHOUSE, Phiwe Dlamini](https://contra.com/p/MLBPlEFO-stackhouse-bold-burger-restaurant)
- **Corteza y ritmo.** En la fotografía de Eva Salorio, las croquetas cambian de orientación dentro de un recipiente oval y los pequeños huecos dejan distinguir contornos. El centro abierto muestra la receta de aquella toma. Para el encargo de Víctor se conserva el exterior entero y se usa el borde de las dos fuentes documentadas para separar los grupos. [Croquetas, Eva Salorio](https://evasalorio.com/wp-content/uploads/2025/09/Croquetas-DEF.jpg) · [Créditos](https://evasalorio.com/portfolio/)

## Reserva y regresiones

La foto cenital de tostadas, café y zumo se reservó hasta cerrar la posición y los umbrales de la hamburguesa. La fotografía pura entró por la ruta normal. En el recorte central, el plato ocupa buena parte del borde superior. Con el título «Tostada» y la máscara de Vision, ambas búsquedas devolvieron un aviso de lectura y conservaron la candidata en papel para elegir otra maqueta. Es un límite observado en una mesa con varios sujetos. [Tostada a tamaño móvil](reserva-tostada.webp)

Se verificaron también la comanda de café con su título en papel y la comanda de gamba sin texto, con su dirección de relieve del caparazón. En esos dos casos se encuadró la fuente para comprobar el flujo de versiones, sin producir una nueva fotografía. Los siete encargos de ensayo fueron locales y sólo de prueba. El registro indica cero envíos a la API de producción y conserva los avisos visuales por candidata. [Ensayo](ensayo.json) · [Ensayo anterior de café y gamba](../ensayo-estudio/README.md)
