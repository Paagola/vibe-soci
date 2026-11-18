# Conocimiento creativo del estudio

Es lo que el director creativo sabe, ordenado por **oficios**. Equivale a las skills de design-agent, adaptado a SOCIETY: restaurantes, fotos reales del producto y nuestro compositor.

- No es una colección de plantillas.
- No es una carpeta de imágenes bonitas.

Cada documento dice en su cabecera en qué **fase** del trabajo sirve. El director pide solo lo de la fase en la que está (`src/dominio/conocimiento.ts`, `seleccionar`).

| Fase | Qué se decide | Documentos |
|---|---|---|
| brief | Qué se sabe del local y qué se puede decir | `oficios/texto-publicitario`, `oficios/direccion-de-arte` |
| concepto | La referencia (obligatoria en las 5 primeras piezas), la idea, la dirección y la narrativa | `oficios/direccion-de-arte`, `referencias/familias`, `ejemplos`, `principios`, `antipatrones`, `referencias/*` |
| fotografia | La foto **nueva** que necesita la idea (otro ángulo, luz y encuadre; los mismos elementos) | `oficios/fotografia-gastronomica`, `ejemplos` |
| composicion | Cómo se ejecuta la idea con el compositor | `oficios/composicion-y-tipografia`, `principios`, `antipatrones` |
| texto | Cada palabra de la pieza y del pie, con su fuente | `oficios/texto-publicitario` |
| revision | Mirar el render, criticarlo y corregir | `oficios/revision-visual`, `rubrica`, `antipatrones` |
| aprendizaje | Qué se guarda de cada valoración y con qué peso | `oficios/revision-visual`, `observaciones/` |

El Pase utiliza un selector local para los posts editoriales de una imagen. Sus observaciones y casos de contraste se pueden revisar en el estudio de 256 composiciones. [Estudio editorial](referencias/estudio-editorial.md)

## Qué hay en cada carpeta

- `oficios/`: cinco oficios. Cada uno explica el proceso, las decisiones que toma y ejemplos de buenas y malas decisiones, casi todos sacados de nuestro propio trabajo (F1 de DAK, F1.5 de Etxebarri).
- `principios.md`: por qué una composición funciona. Cada principio dice si es una **regla comprobable** (con su fuente) o un **criterio que se pondera**.
- `antipatrones.md`: lo que delata una pieza genérica de IA o de plantilla, y cómo se arregla.
- `rubrica.md`: cómo se juzga una diapositiva y un carrusel. Hay dos filtros previos (veracidad y fidelidad) y siete criterios que se explican con palabras, no solo con un número.
- `ejemplos.md`: lo que gustó y lo que no en las piezas del usuario (`biblioteca/ejemplos/`), con la lección de cada una.
- `referencias/familias.md` y `referencias/familias.json`: las 10 familias de los 29 posts de referencia del usuario. `referencias/fichas/post-NN.json`: la ficha estructurada de cada post (esquema `referencia/ficha@1`).
- `referencias/*.md`: fichas de referencias públicas (Think Small, Powers of Ten…). Cada una dice qué aporta, qué recurso se extrae y qué **no** se copia.
- `observaciones/`: lo aprendido de las valoraciones, con su evidencia y su estado (hipótesis, observada, confirmada). Lo escriben las valoraciones, no la intuición.

## Dónde está lo demás

- **Marca de cada restaurante:** `marcas/<slug>/`. `perfil.json` recoge lo constante, lo variable, las restricciones, el material y lo pendiente, con la fuente de cada dato. `tokens.json` son los colores y estilos que usa el compositor.
- **Cada trabajo:** `proyectos/<slug>/`. Contiene el brief, el concepto, la producción (modelos, prompts, recetas y gasto), las intenciones de diseño, la revisión y el pie.
- **Guía del generador antiguo:** `biblioteca/` (`principios.md`, `ejemplos/`, `referencias/`, `valoraciones.jsonl`) sigue igual. La usa el director Gemini actual.

## Cómo crece

Como en design-agent:
- una regla de marca es para siempre, hasta que el dueño la cambie;
- una preferencia es una **observación** con evidencia, nunca una regla.

Lo que una pieza enseña se guarda como observación. Un oficio o un principio solo cambia si una persona lo aprueba, y queda escrita la prueba que lo justifica. Menos reglas y mejor explicadas: el rulebook de 50 000 líneas de LangChain hizo películas peores que una skill pequeña.
