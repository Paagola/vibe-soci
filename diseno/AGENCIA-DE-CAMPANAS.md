# Agencia de campañas para locales

El dueño puede pedir «quiero que los vecinos se acuerden de nosotros al elegir dónde comer entre semana». El estudio propone a quién dirigir cada pieza, qué contar, cuándo compartirla y qué resultado mirar después. El calendario conserva el dato del negocio que justifica cada publicación.

## Del objetivo al encargo de producción

| Paso | Qué hace el estudio | Qué recibe el dueño |
| --- | --- | --- |
| Solicitud | Reúne el objetivo, el primer día y la duración, de una a cuatro semanas. Admite un dato concreto que el dueño confirme para esa campaña. | Un encargo expresado en sus propias palabras. |
| Documentación | Recupera el nombre, la ciudad y los datos disponibles de la marca. En el estudio real incorpora la voz, las restricciones confirmadas y las fichas de platos confirmadas en el chat. | Una referencia legible para cada pieza, por ejemplo el plato y sus elementos. |
| Estrategia | Argon define la ocasión de visita, la intención, el enfoque, la acción y un recuento observable para cada pieza. Reparte entre una y tres piezas por semana, según el objetivo y las fuentes. | El calendario y la razón para hacer cada publicación. |
| Edición | Hydrogen redacta el pie y un guion de una lámina para un post o de tres a seis para un carrusel. Trabaja sobre las fechas, la fuente y la acción decididas en estrategia. | Texto preparado para compartir y una indicación por lámina. |
| Revisión | El código comprueba calendario, fuente, formato, longitud del guion, invitación literal y datos comprobables como cifras o contactos. Argon contrasta el conjunto con el encargo en una llamada independiente. Si encuentra un defecto, pide una corrección concreta y vuelve a revisar. | Una propuesta aprobada editorialmente. Si la segunda revisión encuentra defectos, el estudio informa del motivo. |
| Producción | En el estudio real, la pieza abre un encargo de chat con su guion, evidencia y pie. Una ficha de plato confirmada permite reutilizar su foto. Con otra clase de fuente, el chat permite completar el material visual. | Un encargo que puede retomar y cuyo plan de imágenes puede aprobar. |
| Seguimiento | El dueño anota la cifra que corresponde a la acción y una observación opcional. La siguiente planificación recibe el historial reciente de ese mismo local. | Una medida interpretable como «cuántas personas guardaron este post» o «cuántas preguntas recibimos». |

### Ejemplo hipotético

Casa Pilar cuenta que los jueves sirve guiso de garbanzos. El objetivo es que la gente de la zona se acuerde del local cuando organice la comida de ese día. La ficha del plato identifica los garbanzos y contiene una foto confirmada.

| Decisión | Aplicación |
| --- | --- |
| Intención | Dar a quien organiza la comida un recordatorio que pueda guardar. |
| Guion de carrusel | Abrir con la foto del guiso y el titular «El jueves». Acercarse al detalle de los garbanzos en la segunda lámina. Cerrar con la firma de Casa Pilar y una invitación a guardar la publicación. |
| Pie | «Los jueves servimos guiso de garbanzos en Casa Pilar. Guarda la idea para la próxima comida.» |
| Qué medir | Anotar los guardados de esa publicación. Para saber cuántas visitas hubo haría falta otra observación del negocio. |
| Siguiente campaña | Si hay guardados, el equipo puede explorar otro plato documentado con la misma invitación. Para comparar ambos recuentos conviene anotar cuánto tiempo llevaba publicada cada pieza. |

### Operación del estudio

La renovación del calendario y la preparación anticipada de planes visuales se activan por separado. Con la preparación anticipada activa, el estudio puede preparar el plan de una pieza el día programado o la víspera cuando tiene una ficha con foto confirmada. La generación de las imágenes conserva el paso de aprobación del estudio. Las llamadas reales de texto y visión pueden consumir cuota del proveedor.

El proceso de renovación se ejecuta en el servidor local. Tras un cierre que haya dejado periodos sin atender, el nuevo periodo comienza el día en que el estudio retoma la tarea. Un dato puntual facilitado al crear una campaña, como un especial con fecha, se circunscribe a esa campaña. El modo simulado usa datos locales y una planificación determinista para probar el calendario.

La publicación en redes y la anotación de resultados corren a cargo del local. La integración actual cubre contenido orgánico y producción en el estudio. La compra de anuncios, la lectura automática de estadísticas de las plataformas y la atribución de reservas quedan fuera de esta versión.

## Qué aporta cada repositorio

### Agency Agents

El manual de campaña distribuye estrategia, producción, protección de marca, medición y especialidades por canal entre 10 y 15 agentes. Su primera fase entrega objetivos, público y calendario antes de producir. La fase posterior revisa el rendimiento para orientar nuevas piezas. En este estudio, Argon concentra las decisiones de estrategia y Hydrogen recibe un encargo cerrado por pieza. Compartir ese encargo con el chat evita volver a pedir al dueño la estrategia cuando llega el momento de producir. [Manual de campaña multicanal](https://github.com/msitarzewski/agency-agents/blob/8ae6164602c95ca78828b148b9052460ee426885/strategy/runbooks/scenario-marketing-campaign.md)

Las plantillas de relevo describen la tarea, la evidencia, el entregable y los criterios de aceptación. Un rechazo especifica el defecto y el trabajo para corregirlo. Aquí la evidencia es una entrada identificable de la ficha. El revisor puede pedir otra edición o replantear la estrategia si falla la relación entre la acción y la métrica. El sistema limita cada campaña a una ronda de corrección editorial. [Plantillas de relevo y revisión](https://github.com/msitarzewski/agency-agents/blob/8ae6164602c95ca78828b148b9052460ee426885/strategy/coordination/handoff-templates.md)

La especialidad de carruseles conserva los guiones y relaciona la pieza producida con su rendimiento posterior. Su receta propone seis láminas verticales y una publicación diaria. El estudio conserva el vínculo entre guion, fecha y resultado, y elige el formato según el material confirmado de cada negocio. La composición, las fotos y el control de legibilidad pasan por el taller existente. [Carousel Growth Engine](https://github.com/msitarzewski/agency-agents/blob/8ae6164602c95ca78828b148b9052460ee426885/marketing/marketing-carousel-growth-engine.md) · [Oficio de carrusel del proyecto](../conocimiento/oficios/carrusel-editorial.md)

### Humanizer

La versión 4.0.0, con licencia MIT, propone identificar patrones, reescribir, comprobar que se conservan los hechos y editar de nuevo. Los apartados 1 a 5 ayudan a detectar aperturas grandilocuentes, contrastes forzados y cierres que repiten lo dicho. Los apartados 13, 16, 17 y 22 tratan la importancia exagerada, el tono de venta, la autoridad prestada y los restos de conversación con el asistente. Hydrogen aplica esta lectura al pie y al guion en el idioma de la marca. Conserva expresiones coloquiales, nombres, números y fechas cuando tienen respaldo. [Humanizer v4](https://github.com/blader/humanizer/blob/a32f24407364c74c812b43c15926d638bee1e072/SKILL.md)

«Los expertos coinciden en que es una experiencia gastronómica única» perdería la atribución y los adjetivos al editarse. Si la ficha solo acredita «guiso de garbanzos los jueves», eso es lo que puede acabar en el pie. La segunda lectura se hace sobre el texto ya escrito. La revisión de Argon comprueba después el texto contra la fuente. [Oficio de texto publicitario del proyecto](../conocimiento/oficios/texto-publicitario.md)

### Marketing Skills de Ryze

El asistente de perfiles parte del producto y la geografía, identifica objeciones y desencadenantes de compra, y propone ángulos de mensaje con un nivel de confianza. Para un restaurante, la adaptación práctica consiste en describir una ocasión como «quien busca un sitio para quedar a comer». Esa hipótesis orienta el encargo y se mantiene separada de los hechos sobre el establecimiento. [Investigación del cliente ideal](https://github.com/irinabuht12-oss/marketing-skills/blob/b3bdcd618a61034509f66e48ac0bb588f8defceb/skills/icp-research-assistant/SKILL.md)

El flujo de reutilización descompone una idea principal en varios ángulos conservando la voz y las afirmaciones de la fuente. El generador de variantes distingue lo que se conserva del elemento que cambia entre pruebas. La agencia usa esa distinción para mantener el hilo de campaña y dar una función propia a cada post o carrusel. La acción acordada se conserva al editar para que el resultado anotado siga teniendo sentido. [Reutilización de contenidos](https://github.com/irinabuht12-oss/marketing-skills/blob/b3bdcd618a61034509f66e48ac0bb588f8defceb/skills/content-repurposer/SKILL.md) · [Variantes de texto](https://github.com/irinabuht12-oss/marketing-skills/blob/b3bdcd618a61034509f66e48ac0bb588f8defceb/skills/ad-copy-variant-generator/SKILL.md)

El diseño de pruebas exige hipótesis, control, variable y volumen suficientes para declarar un ganador. El informe para el cliente pide una explicación comprensible vinculada a resultados medidos. Aquí el dueño aporta un recuento por pieza junto a sus observaciones. Argon puede usarlo como indicio para la campaña siguiente. Una comparación entre dos publicaciones orgánicas sigue siendo observacional. El repositorio ofrece conexiones a servicios publicitarios para otros escenarios; esta aplicación utiliza su propio historial local. [Diseño de pruebas](https://github.com/irinabuht12-oss/marketing-skills/blob/b3bdcd618a61034509f66e48ac0bb588f8defceb/skills/ab-test-setup-and-analysis/SKILL.md) · [Informes para clientes](https://github.com/irinabuht12-oss/marketing-skills/blob/b3bdcd618a61034509f66e48ac0bb588f8defceb/skills/client-report-narratives/SKILL.md)
