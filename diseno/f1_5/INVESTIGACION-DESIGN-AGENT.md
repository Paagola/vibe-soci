# Investigación · design-agent de LangChain (Content Studio)

Estudiado el 2026-11-07, en el repositorio clonado `langchain-ai/design-agent`, commit `a6e1577` del 06/11/2026, con licencia Apache 2.0. Leí el código y los documentos, no solo el README. Lo cito por ruta.

## 1. Qué es

Es el agente de diseño que LangChain usa internamente (lo llaman «Content Studio») y que ha publicado como proyecto abierto.
- **Cómo se usa:** se le pide en Slack como a un diseñador y devuelve archivos terminados de la marca: piezas fijas, conjuntos de anuncios, presentaciones, gráficos, miniaturas y películas.
- **En qué se apoya:** está construido sobre *Deep Agents* y se despliega con *Managed Deep Agents* (MDA). MDA aporta Slack, entornos aislados, memoria, tareas programadas y trazas.
- **Lo que pone el repositorio:** la capa de diseño.
- **Datos que da el propio README, sin verificar:** más de 3000 piezas desde agosto y una mediana de unos 0,50 USD por petición.

## 2. Arquitectura

| Pieza | Qué es | Dónde |
|---|---|---|
| Agente principal | Un modelo (Claude Opus 5.5 por defecto) con un prompt fijo corto (`instructions.md`, 61 líneas) | `agent.py`, `instructions.md` |
| Ayudantes | Subagentes en segundo plano para trabajos largos. Comparten el mismo entorno y avisan al principal cuando terminan, fallan o se atascan | `docs/architecture/orchestration.md` |
| «El ordenador del diseñador» | Un entorno aislado por conversación (Linux con Chrome, ffmpeg, HyperFrames, D2, sharp y fuentes) que se monta con una receta fija. **Las claves no entran en él** | `sandbox/`, `docs/spec.md` §8 |
| Skills | 36 skills que se cargan solo cuando hacen falta. Una de ellas, `media-production`, actúa de enrutador y elige el flujo | `skills/` |
| Wiki de diseño | La doctrina: jerarquía, tipografía, color, maquetación, plataformas y rúbrica. Cada regla lleva su prueba o se marca como «criterio que se pondera» | `skills/design-wiki/` |
| Paquete de marca | Tokens (colores, fuentes, radios, espaciado), logotipos reales, voz y «lenguaje gráfico» (qué significan sus gráficos, qué combinaciones existen, qué se hace y qué no) | `workspace/brand/`, `examples/brands/example-studio/`, `docs/spec.md` §12 |
| Comprobaciones | `brand-lint` revisa colores, fuentes, radios, contraste WCAG, viñetas decorativas y mayúsculas forzadas. `artifact-contract` revisa tamaños y requisitos, y `text-fidelity`, que el texto pintado sea el pedido. Si una comprobación no puede ejecutarse, eso **no cuenta como aprobado** | `workspace/tools/` |
| `look` | Un modelo auxiliar barato mira hasta 8 imágenes y devuelve una respuesta corta. Las imágenes no se acumulan en el contexto del agente principal | `docs/spec.md` §7.8 |
| Varias propuestas | `start_looks` copia el proyecto por cada dirección y un ayudante la desarrolla. La persona elige con `pick_look`, que registra el porqué como observación | §7.6 |
| Aprendizaje | `ObservationStore`: observaciones por skill con su evidencia. Empiezan como «propuestas» y pasan a «mantenidas» si se repiten, se valoran como útiles o las dijo una persona. Lleva votos de útil y de dañina, fusiona las casi duplicadas y descarta las que acumulan dos votos dañinos más que útiles | `src/design_agent/harness/learning.py` |
| Memoria | Una capa de equipo y otra personal. La marca manda sobre ambas | `memory.py`, §7.13 |
| Evaluaciones | 19 tareas de diseño y 7 de comportamiento, con correctores deterministas. **Ningún modelo juzga el gusto** | `docs/evals.md` |

**Cómo se hace una pieza fija** (`skills/stills/SKILL.md`):
- es una página HTML que Chrome pinta, y cada elemento es una capa;
- los pocos elementos que sostienen la composición llevan posición absoluta;
- cada tamaño se vuelve a componer, nunca se escala;
- la secuencia es: pintar, pasar las comprobaciones, mirar la hoja de tamaños como lo haría quien la va a rechazar, corregir y entregar.

## 3. Su evolución: de componentes a libertad

Lo explica el artículo «How we built it» (blog de LangChain) y lo resume `docs/spec.md` §11.3:
- **La primera versión** intentaba diseñar por el modelo: tenía **115 componentes reutilizables** (títulos, maquetas, animaciones) con instrucciones de cuándo usar cada uno.
  - Ayudaba a mantener la marca.
  - Pero el agente **repetía las mismas maquetas y animaciones en cada cuadro**, y cerrar esa distancia pedía cada vez más ingeniería.
  - Ellos lo llaman «convergencia distribucional» o «zombie UI»: el modelo rellena lo que no se decide con lo que más ha visto.
- **El reglamento de vídeo** llegó a unas 50 000 líneas y unas 2700 prohibiciones. Midieron en un mismo brief la proporción de cuadros en los que no se mueve nada:

  | Configuración | Cuadros sin movimiento |
  |---|---|
  | El modelo solo | 10 % |
  | Con las skills estándar | 43 % |
  | Con el reglamento completo | 57 % |
  | Con una skill pequeña de movimiento | 18 % |

  Un complemento escrito a mano de unas 2600 líneas hacía mejores películas que el reglamento entero.
- **El cambio:** con un modelo mejor quitaron casi todas las reglas fijas y se quedaron con los principios y la guía de alto nivel. Salió más variedad y menos repetición.
  - Las **reglas de marca** se quedaron como código (tokens y comprobaciones).
  - El **gusto** pasó a ser principios y observaciones que se ponderan.
- **Lecciones que citan:**
  - «Taste comes from context» (el gusto sale del contexto);
  - «Give the agent a designer's computer» (dale al agente el ordenador de un diseñador);
  - «Delete rules when the model improves» (borra reglas cuando el modelo mejora).

## 4. Qué hace que sus resultados sean interesantes sin perder la marca

1. **Libertad en la composición y rigidez en la marca.** El modelo escribe la página que quiere, pero solo con los tokens de la marca, y una comprobación rechaza un color o una fuente ajenos.
2. **La prueba del concepto.** Antes de maquetar hay que nombrar la idea en una frase, y tiene que ser de uno de tres tipos:
   - algo real mostrado;
   - una idea concreta;
   - tipografía con intención.

   La prueba de quitar lo decorativo descarta el relleno: si al quitarlo sigue diciendo algo, la idea es real. «Una pieza floja que pasa las comprobaciones es un rechazo.»
3. **El lenguaje gráfico explica qué significan los gráficos**, no solo qué colores usar. Por ejemplo, en su marca de muestra el acento es «la luz» y hay uno por cuadro.
4. **Las mínimas palabras** y un solo acento por cuadro.
5. **Variar la idea espacial y no el sistema.** En una serie cambia la idea de cada cuadro y se mantienen la retícula, la escala tipográfica y el acento. «Un carrusel es una narrativa, no una plantilla seis veces.»
6. **Pintar, mirar y corregir**, con vistas nuevas:
   - hojas de miniaturas;
   - recortes ampliados del antes y el después cuando el arreglo se mide en píxeles;
   - en un rediseño, el original junto al resultado;
   - dos rondas de corrección como máximo antes de decir que está bloqueado.

## 5. Qué encaja con nuestro proyecto y qué no

| De design-agent | ¿Lo traemos? | Por qué |
|---|---|---|
| Skills pequeñas que se cargan por fase | **Sí** → `conocimiento/oficios/` con cabecera y `seleccionar()` | Es el antídoto contra la plantilla y el reglamento gigante |
| Wiki con reglas probadas o criterios ponderados | **Sí** → `conocimiento/principios.md`, `antipatrones.md` | Sostiene el criterio sin convertirlo en un catálogo |
| Paquete de marca con «lenguaje gráfico» | **Sí, adaptado** → `marcas/<slug>/perfil.json` con constantes, variables, restricciones, material, pendientes y la fuente de cada dato | Nuestro problema añade la fidelidad y la falta de datos del local |
| La marca como código | **Sí** → `tokens.json` y los `@token` del compositor | Ya lo teníamos; ahora también el punto negro |
| Prueba del concepto y de quitar lo decorativo | **Sí** → `oficios/direccion-de-arte.md`, `rubrica.md` | |
| Pintar, mirar y corregir | **Sí** → `carrusel.ts` (serie, móvil, capas), `fidelidad.ts` (recortes lado a lado), `oficios/revision-visual.md` | |
| Observaciones con evidencia y estado | **Sí, más estricto** → `dominio/aprendizaje.ts` | Aquí el gusto del dueño solo lo dice el dueño, y separamos humana, crítico, determinista y automática |
| Rúbrica y veredicto | **Sí** → `conocimiento/rubrica.md`, con nuestros siete criterios | |
| Fichas de referencia (estudiar, no copiar) | **Sí** → `conocimiento/referencias/` | |
| HTML pintado en Chrome como motor | **No, de momento** | Nuestro compositor (SVG, sharp y fontkit) ya da capas, texto exacto y reproducibilidad sin Chrome. La libertad que aporta su HTML la conseguimos ampliando la intención **cuando una idea lo pide** (F1.5: `trasTexto`, `puntoNegro`). Una capa vectorial libre queda como el siguiente paso con valor |
| Slack, MDA, LangSmith y subagentes | **No** | Somos una web local y una app (SOCIETY). El orquestador sería trabajo de la F2 o posterior |
| HyperFrames, vídeo y sonido | **No** | Fuera de alcance |
| Paper (lienzo compartido) | **No** | La edición directa sería la web del estudio |
| Generación de imagen OpenAI o Google | **Sustituido** por la API de Higgsfield, con estimación previa, tope de gasto y comprobación de fidelidad | Decisión del proyecto |

## 6. Lo que hemos añadido nosotros (no está en design-agent)

- **Fidelidad del producto medida.** `fidelidad.ts` compara bordes en la zona del producto y saca recortes lado a lado. Una imagen generada no se publica sin el veredicto CONSERVA. En la F1.5 detectó solo una cabeza redibujada (0,087).
- **Gasto vigilado.** `generarActivo.ts` estima antes de enviar, se niega a pasar del tope o a usar modelos sin importe cerrado y apunta cada petición.
- **Procedencia de cada activo:** receta, prompt, `request_id`, referencias con su huella y derivaciones deterministas.
- **Quién valora:** el dueño frente a la dirección del estudio, y lo humano frente a lo automático.

## 7. Fuentes consultadas

- Repositorio `github.com/langchain-ai/design-agent`, commit `a6e1577`:
  - documentos: `README.md`, `instructions.md`, `CHANGELOG.md`, `docs/spec.md` (§7, §11, §12), `docs/architecture/*`, `docs/evals.md`;
  - skills: `skills/media-production`, `stills`, `brand-design`, `design-wiki` (y sus `references/`), `visual-verify`, `reference-study`, `image-generation`, `content-brief`;
  - código y ejemplos: `src/design_agent/harness/learning.py`, `examples/brands/example-studio/graphic-language.md`, `.agents/skills/brand-onboarding`, `workspace/tools/brand-lint.mjs`, `text-fidelity.mjs`.
- Artículo «How we built it» del blog de LangChain (`langchain.com/blog/design-agent`), leído el 07/11/2026.
- Documentación de la API de Higgsfield (`docs.higgsfield.ai`, `llms.txt`, páginas de modelos y facturación), consultada el 07/11/2026.
