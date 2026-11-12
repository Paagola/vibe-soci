# F3 · Investigación de estilo: de dónde sale cada criterio y cada número

**11–12/11/2026.** Documento de apoyo del código de F3. Cada criterio de oficio y cada margen numérico que aparece en
`src/dominio/diseno/` y `src/adaptadores/compositor/` está aquí con su fuente. Lo que no sale de una fuente, sino de una
decisión mía de calibración, lo digo como tal.

**Cómo leer las marcas:**
- **[fuente]**: el dato está escrito en la fuente citada y lo he leído yo en ella.
- **[medido]**: lo he medido en este repositorio, con sus datos.
- **[decisión]**: lo he elegido yo; digo con qué criterio y qué haría falta para confirmarlo.

**Cómo se buscó.** Búsqueda web, API pública de búsqueda de GitHub (sin autenticar, para no usar ninguna cuenta) y lectura
de los archivos de cada repositorio, descargados a una carpeta temporal aparte y leídos como datos. No se ha copiado código
de ninguno: se toman criterios, márgenes y algoritmos de dominio público, y todo el código está escrito desde cero.

---

## 1. Qué se buscaba

Sistemas **reales** que conviertan en reglas lo que separa una pieza con oficio de la estética genérica de IA: degradados
de fondo, tipografía sin personalidad, todo centrado, todo del mismo peso. Tres preguntas:

1. ¿Qué mide un sistema serio para saber si una composición tiene jerarquía?
2. ¿Qué técnicas concretas le dan a una pieza aspecto de impresa y de hecha a mano, y con qué márgenes?
3. ¿Qué tiene el formato de diseño de un editor de producción que nuestro esquema de intención no tiene?

## 2. Fuentes

| Fuente | Licencia | Qué es | Qué se toma |
|---|---|---|---|
| [`yanliudesign/mono-color-skill`](https://github.com/yanliudesign/mono-color-skill) (3639 estrellas, actualizado 09/2026). Leídos `SKILL.md` y `design-system/{compositions,rhythm,typography,imperfections,colors,carriers}.json` | MIT | Un sistema de diseño editorial a una y dos tintas, escrito como datos: 9 composiciones, 3 perfiles de tensión, 7 papeles tipográficos, 5 imperfecciones de impresión con sus márgenes, y una puerta de calidad final | Los márgenes de la **tinta impresa**, el **salto de escala**, «un foco y una zona de descanso», «un solo gesto a mano», «el titular cruza al objeto», y la idea de semilla estable |
| [`Azure12355/editorial-food-poster`](https://github.com/Azure12355/editorial-food-poster) (09/2026). Leídos `SKILL.md` y `references/prompts.md` | MIT | Una dirección de arte para carteles de comida: fondo marfil, un producto enorme, una palabra de acción gigante con la que la comida interactúa, serif alta para el nombre, itálica con una raya a mano y flechas finas que señalan ingredientes reales | El **trazo a mano** (raya y flechas), el **corte tipográfico** («SNAP»: la palabra se parte como la galleta), «un solo color de acento, sacado de la comida» y «no pongas solo un titular grande debajo de la foto» |
| [`luckdvr/photo-riso-poster`](https://github.com/luckdvr/photo-riso-poster) (08/2026). Leído `SKILL.md` | MIT | De una foto a un cartel de risografía que solo dibuja hechos observables | «Cada marca responde a un hecho; lo decorativo se borra» y «la tipografía también lleva evidencia» (un recuento: `x 002`). Es nuestra regla de no inventar, vuelta recurso creativo |
| [`sergiomrebelo/evo-poster`](https://github.com/sergiomrebelo/evo-poster). Leídos el README y `src/@evoposter/evaluator/src/metrics/*.mjs` | MIT | Composición evolutiva de carteles tipográficos (tesis doctoral en el CISUC, Portugal; métricas publicadas en EvoMUSART 2024, basadas en Harrington et al., 2004) | Que la fracción de blanco, el equilibrio visual y el número de familias **se pueden medir**; de ahí las medidas de oficio. No se toman sus fórmulas |
| [`jwagner/smartcrop.js`](https://github.com/jwagner/smartcrop.js). Leído `smartcrop.js` | MIT | Recorte que busca lo importante de una foto | Las dos señales del «mapa de la foto»: detalle (bordes) y saturación |
| [`antiboredom/p5.riso`](https://github.com/antiboredom/p5.riso). Leída su documentación (`antiboredom.github.io/p5.riso`) | Anti-Capitalist License: **no se reutiliza código** | Simulación de risografía en p5.js | Los parámetros con los que se describe una trama: forma, frecuencia, ángulo (45° por defecto) e intensidad |
| [Formato de diseño de Polotno](https://polotno.com/docs/schema) (`text-element`, `image-element`, `figure-element`) | Documentación pública | El esquema JSON de un editor de producción tipo Canva | La lista de lo que nos faltaba: giro libre en todas las capas, máscara de imagen, texto curvo, contorno, desenfoque |
| [Informe de tendencias de Canva para 2026](https://www.businesswire.com/news/home/20251210696597/en), «Imperfect by Design» (por la prensa; no he leído el informe entero) | — | Encuesta a 1000 creadores | Contexto: lo pulido ha dejado de diferenciar porque la IA lo da gratis. No se toma ningún número |

**Leídas y no usadas:**
- **`CyberAgentAILab/OpenCOLE`** (Apache 2.0) y **LayoutPrompter** (`microsoft/LayoutGeneration`, NeurIPS 2023): generación de maquetas con modelos de lenguaje. Confirman el enfoque que ya tenía la propuesta (el modelo decide y el código coloca), pero necesitan modelos propios o ejemplos recuperados, y no aportan una regla que podamos comprobar.
- **`graphic-design-ai/creatiposter`** (ByteDance, 06/2025): el repositorio solo tiene el README; el código no está publicado.
- **`mattdesl/riso-colors`** (MIT): la lista de tintas reales de risografía. Nuestras piezas usan la paleta de cada local, no un catálogo.
- **Rediseño de Burger King de JKR (2021):** solo he podido leer resúmenes de prensa (el artículo de Dieline es de pago). Lo único contrastado son sus cuatro principios («mouthwatering, big and bold, playfully irreverent, proudly true») y que la tipografía Flame imita las formas de la comida. No sale ningún número de ahí.

## 3. Los números del código y de dónde sale cada uno

### 3.1 Medidas de oficio (`src/dominio/diseno/oficio.ts`)

| Constante | Valor | De dónde sale |
|---|---|---|
| `SALTO_DE_ESCALA_OBJETIVO` | 5 | **[fuente]** `mono-color-skill`, `SKILL.md` §4: «Use one dramatic scale jump: largest text is 5-12 times the microcopy size», y su puerta de calidad: «Does the type hierarchy use a 5x-12x scale jump». Sus papeles tipográficos (`typography.json`) dan de 4:1 a 20:1 según el papel |
| `SALTO_DE_ESCALA_MINIMO` | 3,5 | **[decisión]**, calibrada con **[medido]**: las cuatro piezas de F1.6 que aprobaste miden 3,85 (Café Albor), 4,83 (DAK), 6,10 (Etxebarri) y 8,49 (Mesón). Con 3,5 ninguna aprobada salta, y sí lo hacen las dos más planas del repositorio: Mesón Lo Güeno (2,81) y la diapositiva 4 del chiringuito (1,38). **Observación, no regla (4 piezas):** la de menor salto, Café Albor, es la que el informe de F1.6 dio por más floja |
| `PALABRAS_MAXIMAS` | 30 (20 en historias) | Regla del propio proyecto (`diseno/ARQUITECTURA.md` §10) |
| `NIVELES_MAXIMOS` | 4 | Regla del proyecto: tres niveles (titular, apoyo, dato) más la firma (`conocimiento/oficios/composicion-y-tipografia.md`) |
| `VOCES_MAXIMAS` | 3 | Proyecto («dos familias como máximo») más **[fuente]** `mono-color-skill` §4: una tercera voz solo como una interrupción manuscrita corta, «never dates, locations, essential facts» |
| Un solo gesto a mano | 1 | **[fuente]** `mono-color-skill`: `manual_gesture_limit: 1` en las nueve composiciones y, en la puerta de calidad, «exactly one manual gesture family rather than several decorative doodle styles» |
| `RECURSOS_MAXIMOS` | 2 | Regla del proyecto (`diseno/propuesta-creativa/PROPUESTA.md` §10.1: «≤ 2 recursos») |
| Relación `cruza`, mínimo | 4 % de las letras | **[decisión]**. El criterio es **[fuente]** (`mono-color-skill`: «Type collides with the object… Do not place every line in a detached safe zone above the image»; `editorial-food-poster`: «no pongas solo un titular grande debajo de la foto»). El 4 % es el umbral por encima del ruido de la medida, que se hace a un cuarto de resolución |

`aire`, `sujeto` y `todoCentrado` se miden y se guardan, pero **no generan avisos**: `mono-color-skill` pide del 25 al 55 % de
papel vacío y un objeto que ocupe del 45 al 80 %, pero esos márgenes son de un cartel sobre papel en blanco, y nuestras
piezas llevan muchas veces la foto a sangre, donde «vacío» no significa lo mismo. Los cuatro posts aprobados dan un aire de
0,36 a 0,78 **[medido]**: demasiado disperso para poner un umbral con cuatro piezas.

### 3.2 Tinta impresa (`Tinta` en `src/dominio/diseno/intencion.ts`; se pinta en `src/adaptadores/compositor/tinta.ts`)

| Efecto | Margen recomendado | De dónde sale |
|---|---|---|
| `densidad` (cobertura irregular) | 0,06–0,12 | **[fuente]** `imperfections.json`: «Uneven ink density», `range_percent: [6, 12]` |
| `bordeSeco` (canto reseco) | 0,01–0,04 | **[fuente]** «Dry-ink edge breakup», `range_percent: [1, 4]` |
| `registro` (segunda impresión desplazada) | 5–15 px | **[fuente]** «Registration drift», `range_mm: [1, 3]`. El paso a píxeles es una **[decisión]**: tomo el lienzo de 1080 px como una hoja de 210 mm de ancho (5,1 px por mm) |
| `huecos` del trazo a mano | 0,04–0,12 | **[fuente]** «Broken manual gesture», `gap_percent: [4, 12]` |
| Semilla estable | hash de la identidad de la capa | **[fuente]** `seed_strategy: "stable hash of subject, exact text, palette, and layout"` y `preserve_across_retries: true` |
| Solo en texto grande: `ALTURA_MINIMA_PARA_TINTA` | 48 px de mayúscula | El criterio es **[fuente]** (`guardrails`: «Apply registration drift only to image or display plates, never microcopy»; «Never reduce display-text readability below thumbnail scale»). Los 48 px son una **[decisión]**: algo más del doble del mínimo de lectura (22 px). Hay que confirmarlo mirando renders |

Los topes del esquema (0,4, 0,15 y ±24 px) son más anchos que el margen recomendado a propósito: sirven para probar, no
para producir.

### 3.3 Trama de semitonos (`src/adaptadores/compositor/tramado.ts`)

| Dato | Valor | De dónde sale |
|---|---|---|
| Ángulo por defecto | 45° | **[fuente]** documentación de `p5.riso`: `halftoneImage(img, shape, frequency, angle, intensity)`, ángulo 45 por defecto, que gira la trama para que no interfiera |
| Formas | punto y línea | **[fuente]** `p5.riso` ofrece línea, cuadrado, círculo, elipse y cruz. Implemento las dos que más cambian el resultado |
| Radio del punto para una cobertura `d` | `paso × 0,7213 × √d` | **[decisión]** geométrica: un punto de radio `paso × 0,707` (media diagonal) llena su celda; el 0,7213 añade un 2 % para que el negro pleno no deje poros |
| Borde del punto | suavizado 1 px | **[decisión]**: un punto de bordes duros se ve como mapa de bits al exportar a JPEG |

### 3.4 Mapa de la foto (pendiente de escribir; lo usará el director de diseño)

**[fuente]** `smartcrop.js` puntúa cada zona con el detalle (filtro de Laplace, `detailWeight: 0.2`) y la saturación
(`saturationWeight: 0.1`, a partir de `saturationThreshold: 0.4`), tras reducir la imagen (`scoreDownSample: 8`). Nuestro
mapa usará las mismas dos señales por celda de la retícula, para decirle al director dónde hay aire sin gastar tokens de
visión en ello.

## 4. De la investigación a las capacidades

| Técnica | Fuente | En el esquema | Dónde se pinta |
|---|---|---|---|
| Giro libre de texto, recorte y forma | Polotno (`rotation` en todos los elementos); post-09 (sándwich girado unos 10°); pendiente desde F1.6 | `giro` en `texto`, `recorte`, `forma`, `sello` y `patron` | `resolutor.ts` (`girarMatriz`), `CompositorSharp.ts` |
| Tinta impresa | `mono-color-skill` | `tinta` en `texto`, `forma`, `sello` y `patron` | `tinta.ts` |
| Trazo a mano: raya, círculo, flecha y tachado | `editorial-food-poster`, `mono-color-skill`; posts 4 y 28 | capa `trazo` | `trazoAMano.ts` |
| Corte tipográfico | `editorial-food-poster` («SNAP») | `corte` en `texto` | `CompositorSharp.ts` (`svgDeTexto`) |
| El titular toca al producto | `mono-color-skill`, `editorial-food-poster` | relación `cruza`; `recortarCon` en `texto` | `resolutor.ts`, `CompositorSharp.ts` |
| Contorno al cruzar el producto | post-19; pendiente en `familias.json` (F8) | `recortarCon: dentro` más `contorno` | `CompositorSharp.ts` (`recortarConSujeto`) |
| Sello con dato real | posts 5, 7, 13, 26 y 27; `PROPUESTA.md` §5.2 | capa `sello` | `formas.ts`, `CompositorSharp.ts` |
| Palabra repetida y tira de cuadros | posts 9, 25 y 28; pendiente en `familias.json` (F2) | capa `patron` | `CompositorSharp.ts` (`pintarPatron`) |
| Campo de semitonos que se desvanece | `mono-color-skill` («pale halftone field» como zona de descanso) | `patron` con `motivo: puntos` | `tramado.ts` |
| Foto a una o dos tintas | `mono-color-skill`, `p5.riso` | `retoque.duotono`, `retoque.tramado` | `tramado.ts`, `CompositorSharp.ts` (`retocar`) |
| Escena desenfocada detrás del recorte | Polotno (`blurEnabled`); familia F5 | `retoque.desenfoque` | `CompositorSharp.ts` |
| Manchas y bloques de color | posts 17, 19 y 28 | `forma` con `figura: mancha` o `poligono` | `formas.ts` |
| Papel sin estucar | `editorial-food-poster` (`references/prompts.md`: «a barely perceptible paper texture») | `textura` con `recurso: papel` | `tinta.ts` |
| Versalitas, cifras antiguas y florituras | práctica tipográfica; fontkit las admite | `rasgos` en el estilo de texto | `MotorTexto.ts` |
| Medidas de oficio | `mono-color-skill`, `evo-poster` | `medidas.oficio` y avisos JERARQUIA, DENSIDAD, VOCES, GESTOS y CRUCE | `oficio.ts` |

## 5. Lo que no se ha tomado, y por qué

- **Reducir la foto del plato a una o dos tintas por defecto.** Es el centro de `mono-color-skill`, pero en un post de
  restaurante la foto tiene que dar hambre y ser fiel al plato. El duotono y la trama quedan para lo que acompaña (una
  foto del local, un eco detrás del recorte, un campo de textura), nunca como tratamiento por defecto del plato.
- **Interacción física entre comida y letras** (el chocolate que gotea sobre la palabra, la pasta que pasa por delante y
  por detrás). Solo puede hacerlo el modelo de imagen; es la «vía de escape» que ya contempla la propuesta (§5.5).
- **Envejecido automático** (sepia, papel amarillento, bordes rotos). `mono-color-skill` lo prohíbe expresamente salvo
  que se pida, y nuestros antipatrones también («textura de papel por defecto»).
- **Fórmulas de `evo-poster`.** Miden carteles hechos solo de texto sobre fondo liso; con una foto a sangre no sirven
  tal cual.

## 6. Límites de esta investigación

- No he podido leer el informe de Canva entero ni el caso de Burger King de primera mano.
- `mono-color-skill` y `editorial-food-poster` son instrucciones para que una IA genere la imagen entera, no motores de
  composición: sus márgenes son los que sus autores consideran correctos, no medidas sobre un corpus. Los tomo como
  punto de partida razonado y los marco para calibrar con tus piezas.
- Ningún umbral de oficio se ha contrastado todavía con tu juicio más allá de las cuatro piezas aprobadas de F1.6.
