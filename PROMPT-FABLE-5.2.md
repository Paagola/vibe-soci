# Encargo para Claude Fable 5.2 · Pase Hydrogen

Trabaja con el repositorio local `pase-hydrogen` abierto. Actúa como director editorial de hostelería y arquitecto de producto. Analiza el proyecto completo y entrega un informe en español que me permita decidir qué desarrollar primero.

**La pregunta que tienes que resolver es «¿qué debería contar este local mañana, por qué mañana y qué relación tiene con lo que contó ayer?».** Quiero que una cafetería, coctelería o restaurante pueda crear contenido original, verosímil y constante, incluso en una semana normal sin lanzamientos. Me interesan las historias, los posts, las secuencias entre días y los carruseles cuando tengan sentido. Deja los Reels y el vídeo fuera. La prioridad es el flujo editorial. No necesito un rediseño de la interfaz.

## 1. Averigua qué funciona de verdad

Recorre el código, las rutas web y CLI, los modelos de dominio, la persistencia, los adaptadores, las pruebas, los proyectos reales guardados y la biblioteca creativa. Sigue un encargo desde la entrada hasta la exportación. Contrasta la documentación histórica con la implementación actual. Si encuentras este informe previo, forma tu propio juicio antes de consultarlo: `diseno/INFORME-CONTINUIDAD-EDITORIAL.md`.

Investiga tres pistas concretas. El Estudio clásico contempla historias 9:16, el productor de El Pase tiene su propio brief y el taller consulta encargos recientes. Comprueba a qué usuario sirve cada capacidad y qué ocurre al pasar de una publicación a la siguiente. Para el realismo, reconstruye qué pasó en `proyectos/2026-11-18-pulpo-2/` cuando la comprobación de la foto y la aprobación editorial dieron resultados distintos. Cita rutas, funciones o pruebas para los hallazgos importantes. Distingue lo que funciona de extremo a extremo, lo que funciona en una vía concreta, lo simulado y lo que solo figura en documentación.

## 2. Define y aplica una rúbrica

Define criterios observables y pesos que sumen 100. Evalúa la capacidad de sostener **dos semanas de contenido de un mismo local**. Incluye verdad del negocio, originalidad, continuidad, diversidad de intenciones, historias e interacción, carga de trabajo del hostelero y aprendizaje después de publicar. Explica la escala, justifica cada nota con evidencia y da una prueba concreta que permitiría subirla. Distingue la madurez del software de los resultados reales de audiencia.

Pon a prueba la originalidad con dos preguntas: «¿Podría publicarlo el local de enfrente cambiando solo el nombre?» y «Si el cliente vio la entrega anterior, ¿qué descubre en esta?». Explica cuándo repetir un tema construye identidad o cumple una promesa y cuándo resulta redundante.

## 3. Diseña el flujo que usaría una persona en pleno servicio

Empieza por lo que el negocio puede aportar: una nota de voz o texto, dos fotos, una duda escuchada en sala, un cambio de carta, una acción real de barra o un turno sin novedades. Recorre el flujo hasta decidir la siguiente publicación. En cada etapa indica qué aporta el equipo, qué resuelve el sistema, qué se guarda y qué decisión requiere una persona.

- Antes de elegir formato, presenta hasta tres opciones genuinamente distintas. Para cada una, di qué pregunta responde, qué hecho local la sostiene, qué material falta, cuánto trabajo pide y por qué encaja hoy. Incluye las salidas «pedir un dato» y «dejar pasar el día».
- Define cómo se abre, retoma y cierra un hilo entre fechas. Una entrega debe entenderse por sí sola y aportar algo a quien siguió la anterior. Explica cómo conviven un hilo en curso y un aviso urgente sin perder las promesas pendientes.
- Trata las historias como contenido propio. Desarrolla al menos una secuencia de una a tres pantallas con texto de ejemplo, interacción opcional, quién incorpora el sticker al publicar y qué se propone si hay respuesta, empate, cero votos o resultado desconocido.
- Especifica una memoria editorial por local. ¿Qué compararías entre publicaciones para detectar que, aunque cambien foto y redacción, el mensaje vuelve a ser el mismo? Da una regla comprobable, un ejemplo que deba rechazarse y una continuación que sí merezca publicarse. Distingue borrador, exportación y publicación efectiva.
- Diseña el control de veracidad. Cada afirmación relevante procede de la carta vigente, de una foto real, de una persona identificada o de una observación registrada. Explica qué ocurre si caduca una oferta, se corrige un ingrediente o falta una imagen prometida. Una foto generada no puede demostrar que un hecho ocurrió durante el servicio.
- Cierra con un aprendizaje que cambie una decisión concreta. Separa el gusto del propietario y la reacción del público. Trabaja también con métricas manuales escasas y con datos ausentes.

## 4. Demuéstralo con hostelería realista

Construye una quincena para un solo local con recursos limitados. Puedes usar el brief y las dos fotos de Café Albor. Marca claramente cualquier supuesto. Para cada entrega indica día, hecho disponible, intención, formato, ejemplo de texto público, vínculo con otra entrega, responsable y condición de salida. Incluye días sin publicación y una incidencia a mitad de semana. Enseña cómo se recompone la segunda semana a partir de lo ocurrido en la primera. No inventes votos, testimonios, precios ni resultados para que el calendario parezca funcionar.

Contrasta el mismo flujo con dos casos breves: una coctelería con una preparación documentada y un restaurante con una pizarra que cambia durante el servicio. Debe quedar claro por qué, con esos materiales, el sistema tomaría decisiones diferentes. Evita calendarios intercambiables como «lunes producto, miércoles equipo, viernes promoción».

## 5. Exige oficio a las referencias de Pinterest

El primer lote de Pinterest fue rechazado por su calidad. Usa las referencias propias de `biblioteca/referencias/` y su índice para calibrar el nivel. Abre las imágenes y explica qué decisiones concretas tienen valor. Trata `referencias-pinterest/` como material candidato pendiente de selección. La procedencia de una cuenta conocida, el número de descargas y un título atractivo no acreditan calidad.

Si hay delegación disponible, encarga a un subagente económico buscar ampliamente en Pinterest publicaciones de locales, campañas identificables y trabajos de estudios con cliente conocido. Prioriza identidades diferentes y piezas con producto reconocible, intención clara, fotografía o dirección de arte deliberada y una idea que pueda explicarse. Haz tú el corte final mirando las imágenes juntas. Descarta fichas domésticas genéricas, miniaturas de vídeo, diseños de banco repetidos, mockups sin una publicación legible y fotos de clientes sin intención editorial. Prefiero veinte piezas que enseñen algo distinto a cien variaciones de una plantilla.

Busca posts, carruseles completos con tarjetas en orden, historias estáticas y al menos una serie de publicaciones del mismo negocio en fechas distintas. Verifica el formato y la procedencia. Un collage no demuestra un carrusel, un rectángulo vertical no demuestra una historia y un guardado por un perfil no acredita autoría. Crea la selección aprobada dentro de `referencias-pinterest/seleccion-profesional/`. Actualiza el README principal para que lleve primero a esa selección. Por cada imagen, deja archivo, qué se ve, local o autor cuando conste, enlace al pin, fuente original si se conoce y qué operación editorial se puede aprender. Si la búsqueda o un formato quedan sin verificar, documenta ese hueco. Usa las referencias para aprender mecanismos; los textos, hechos y fotos del negocio deben tener origen propio.

## 6. Devuélveme una decisión de desarrollo

Guarda el informe en `diseno/INFORME-FABLE-5.2-EDITORIAL.md`. Abre con la primera función que construirías, quién la usaría durante una semana y por qué tiene más valor que añadir otro generador de piezas. Incluye la auditoría con evidencias, la rúbrica aplicada, el flujo propuesto, la quincena de ejemplo y un plan de desarrollo por orden de dependencia. Para cada entrega especifica qué código reutilizar, qué datos nuevos guardar, el esfuerzo relativo y una prueba de aceptación observable.

Termina con el piloto mínimo que permitiría decidir si merece la pena seguir. Especifica qué observarías para mantener o retirar una función. El alcance de este encargo es el análisis, el informe y la biblioteca de referencias. No implementes funciones del producto, no generes contenido de pago y no publiques en redes.
