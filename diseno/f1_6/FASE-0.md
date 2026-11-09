# F1.6 · FASE 0: estudio y plan

> **Histórico (09/11/2026).** Este informe describe una fase cerrada y ya no manda. El estado vigente, las decisiones y lo que queda están en [`diseno/f1_6/ESTADO.md`](ESTADO.md). Lo que aquí se contradiga con ESTADO.md, vale lo de ESTADO.md.

2026-11-07. Sin código, sin generar imágenes y sin gasto. Solo he hecho tres cosas:
- leer;
- mirar las 29 referencias una a una (en hojas de tres, a su tamaño real de 512 × 640);
- montar hojas de contacto y pedir precios al endpoint gratuito `/estimate` de Higgsfield.

**Hojas de comprobación:**
- [`img/familias-referencias.jpg`](img/familias-referencias.jpg): las 29 referencias agrupadas en 10 familias.
- [`img/etxebarri-frente-a-referencias.jpg`](img/etxebarri-frente-a-referencias.jpg): el carrusel de la F1.5 frente a sus referencias más cercanas.
- [`img/mvp-via-integrada.jpg`](img/mvp-via-integrada.jpg): las piezas de gamba y salmón que generó el MVP de una pasada.

## 0. Resumen

- **Tu diagnóstico es correcto en lo esencial.** Hay cuatro matices de hechos (sección 0.1).
- **El MVP ya consiguió una vez lo que se busca:** la pieza de gamba que generó Grok el 03/11 (`datos/piezas/2026-11-03-gamba-roja-de-palamos-a`) es una foto nueva, con un ángulo a ras de mesa distinto del original y la palabra «BRASA» detrás de las gambas, hecha de una sola pasada. Nadie la llegó a votar.
  - **La otra pieza**, con Marketing Studio y el prompt «recrea el plato exacto», repitió el ángulo. Su NO_GUSTA es uno de los votos **automáticos**.
  - **Conclusión:** la diferencia la marca el prompt («usa la foto solo como lista de elementos» y una cámara concreta), no solo el modelo.
- **Las 29 referencias** se agrupan en **10 familias** (sección 2). Además, sus **mecanismos** (palabra detrás, curva, patrón, contorno, giro) y **recursos** (sello, flecha, papel, cuadros) atraviesan varias familias: no son familias en sí mismos.
- **El carrusel de gambas no encajaría entre las referencias** (sección 3):
  - las cuatro diapositivas son la misma foto con el ángulo del hostelero;
  - la tipografía es una frase, sin palabra protagonista con relación espacial;
  - no hay recurso gráfico ni tres niveles de jerarquía;
  - la diapositiva final no lleva producto, y las 29 referencias lo llevan todas.
- **Propuesta:** dos vías para la foto y el diseño y un benchmark de **8 imágenes por unos 1,90 USD** (tope de 2,70 USD con reintentos) para decidir con datos qué vía sirve para cada familia (sección 4). **No he generado nada.**

### 0.1 Tu diagnóstico, comprobado

| Punto | Veredicto | Lo que he comprobado |
|---|---|---|
| a) El carrusel repite el error de `ejemplos/01` | **Confirmado** | Diapositivas 1–3: recortes de `etx-brasa-campana`, que es la foto real con otra luz y el **mismo ángulo** (¾ desde arriba). La 3 se amplía 1,5× sobre detalle generado. La 4 no lleva foto |
| b) «ESTRICTA» se aplicó como «no tocar la foto» | **Confirmado, con un matiz de historia** | La §15.1 de la propuesta no quedó abierta: el 06/11 decidiste «ESTRICTA por defecto; si hace falta otro ángulo, pedir al restaurante una foto nueva con guía». La F1.5 lo cumplió al pie de la letra, y ahí estuvo el error de lectura: los ejemplos que gustaron cambian la cámara, la luz y el fondo, y conservan los elementos. **Necesito que confirmes que la regla nueva sustituye a la del 06/11** (duda 1) |
| c) CONCEPTO descartó mecanismos aprobados | **Confirmado. Es error mío** | `CONCEPTO.md` descarta «FUEGO detrás» y «la antena firma» porque ya estaban en la biblioteca, y prohíbe «texto detrás del producto». También `conocimiento/antipatrones.md` («la palabra enorme detrás del producto, siempre») y la observación `palabra-detras-no-por-defecto`. Tu frase («tampoco quiero que dependa *siempre* de…») hablaba de repetirlo, y la convertí en prohibición |
| d) No parte de ninguna referencia | **Confirmado. Los rasgos que enumeras, con matiz** | Tres de los rasgos valen para casi todas: producto grande y reconocible, un recurso con propósito y tres niveles. «UNA palabra gigante con relación espacial» está en **10 de 29** (posts 3, 9, 10, 12, 13, 16, 19, 25, 28 y 29). La familia oscura editorial (F4) y la blanca (F6) usan otra cosa: un **logotipo tipográfico** de script con serif o palo seco, y aire |
| e) Gemini solo ve 3 miniaturas elegidas por etiquetas | **Confirmado** | `src/adaptadores/ficheros/elegirReferencias.ts`: 3 puntos por palabra, 2 por tipo y sin repetir tratamiento. El usuario no elige referencia en ningún momento. La F1.5 no usó a Gemini: **las intenciones de la F1 y de la F1.5 las escribí yo**, así que lo «robótico» lo elegí yo, no la IA del producto |
| f) Lo que funcionó salió de una sola pasada | **Confirmado, con matiz** | 03, 04, 05 y 06 son una sola pasada. La 02 tuvo un **paso intermedio**: primero una foto base sin texto y después la pieza en una pasada. 04, 05 y 06 usan una **segunda imagen como referencia de luz** («Lighting like Image 2»). **Límite:** no he podido ver esos resultados, porque los enlaces apuntan a `creacion-contenido/`, que ya no existe (duda 9) |
| g) El conocimiento de la F1.5 no incorpora `ejemplos/` ni `analisis-posts.md` | **Confirmado** | Solo `conocimiento/referencias/biblioteca-usuario.md` enlaza el análisis. `ejemplos/` no llega a ningún oficio |
| Coste «~0,33 USD por imagen 4K» | **No cuadra con el registro** | El registro y `/estimate` de hoy dan para Marketing Studio 2.0 con 3 referencias y 3:4: **0,207 (1K), 0,365 (2K) y 0,579 USD (4K)**. Ver 4.4 |

---

## 1. `ejemplos/`: qué enseñan

### 1.1 Ficha por ficha

| Ficha | Prompt (resumen) | Qué cambia | Qué conserva | Por qué gustó o no |
|---|---|---|---|---|
| **01** Gamba, NO GUSTÓ | «Recreate the same dish… Keep the prawn's pose, size and anatomy exactly… Change only light and camera… 45 cm, 40°» | Solo la luz | **La pose y el encuadre**, porque el prompt lo pide | Mismo ángulo con más calidad: «el dueño no quiere su foto mejorada, quiere una foto nueva». Corregido con «use it only as the list of elements, not as a layout to copy», a ras de mesa a 10° y con 100 mm macro |
| **02** Chuletón, «FUEGO» detrás | Paso 1: foto base («only as the list of elements… new composition… ¾ a 25°, 85 mm f/2.8, luz dura lateral»). Paso 2: pieza en una pasada con «FUEGO» detrás del plato | Cámara, encuadre, luz y fondo (negro) | Chuletón en lonchas, costra, hueso curvo, plato blanco rectangular, jugo y mantel | La carne «se ve con la costra marcada y la cara del corte a cámara»; la palabra detrás da profundidad; un solo color de texto |
| **03** Gamba, la antena firma | Una pasada: «Keep the same elements… Recompose as a tighter, more dramatic close-up from the side… antennae sweeping up… the longest antenna continues as a hand-drawn line into script "Palamós"» | Cámara (lateral, más cerca), luz y composición | Exactamente dos gambas, sal, plato de cristal, mantel; «correct prawn anatomy» | «El recurso tipográfico nace del plato». Low-key, con el rojo como único color fuerte |
| **04** Cóctel «Salud» | Una pasada: «A new, more professional editorial shot of the exact drink in Image 1, not a copy»; fondo carmesí saturado; flash duro «like Image 2»; «Salud» que se deshace en burbujas | Fondo, luz, cámara y escala | El vaso, el gradiente de la bebida, la piel de naranja y las gotas | El texto se comporta como la bebida |
| **05** Mesón, carrusel | Una pasada por diapositiva: «not a copy»; flash nocturno «like Image 2»; colas de letra que rodean el plato por delante y por detrás; «negro» gigante detrás del bol | Cámara por diapositiva (manos y plato hacia la cámara; bol bajo a 25°) y luz | Platos y vajilla; mismo magenta #E4004B y misma luz en todas | Mecanismos que nacen del plato; sistema común (color y luz) |
| **06** DAK, carrusel | «Rebuild the scene… new, more professional editorial photo, not a copy… Keep exactly the same burger»; mano tatuada sin cara; tipografía aplastada que gotea; «MANHATTAN TOWER» girada como un rascacielos; «STELLAR» en arco orbital | Cámara (baja, casi a la altura de la tabla, ¾), flash e idea por diapositiva | La burger capa a capa, la mano, el papel y el neón | «Cada diapositiva tiene un mecanismo propio que nace del producto». Mismo #FF3B1F y mismo flash |
| **07–12** | Prompts «a la manera de» sacados de los posts del usuario. No son resultados | — | — | Traducen un mecanismo de referencia a un prompt: palabra detrás (07), contorno (08), patrón (09), logotipo tipográfico con papel (10), editorial blanco (11), portada de carrusel con sello (12) |

### 1.2 Manual de foto nueva

Sale de 01 (fallo y corrección), 02, 03, 04, 05 y 06, y de la pieza A del MVP.

1. **Rol de la foto.** «@image1 is a real photo of <plato> at <local>. **Use it only as the list of elements, not as a layout to copy.**» Nunca «keep the pose / same composition / recreate the same»: eso **produce el mismo ángulo** (01 y pieza B del MVP).
2. **Lista de elementos**, cerrada:
   - **Cuántos:** «exactly two whole prawns».
   - **Qué partes:** «heads, long thin antennae, legs».
   - **Estado y textura reales:** «shells glistening with coarse salt, light grill marks».
   - **Vajilla, si se conserva:** «the square pale frosted glass plate».
   - **Cierre:** «**Correct anatomy. Nothing else added.**»
   - **Lo que se deja fuera del plato:** las manchas, el borde de otro plato, los objetos ajenos.
3. **Cámara, en números:**
   - **Altura en grados sobre la mesa:** 10° a ras, 15–25° bajo, 40–45° de comensal, 90° cenital.
   - **Óptica y diafragma:** 35 mm de ambiente, 85–100 mm de producto, macro, f/2.8–f/4.
   - **Distancia o encuadre:** «tight close-up», «the plate fills the lower 50%».
   - **Orientación:** vertical.

   **Con un ángulo distinto del original, y escribiendo qué ángulo tenía este** («Image 1 is shot from high above», pieza A).
4. **Composición:** dónde va el producto («heads large in the lower left»), qué cruza el cuadro («antennae arching across the dark upper part») y qué hueco se reserva para el texto.
5. **Luz:**
   - **Qué fuente:** «one narrow hard side-back light», «direct on-camera flash», «soft daylight from the left».
   - **Dirección y caída de la luz.**
   - **Fondo**, con HEX.
   - **Color:** «red the only strong colour».
   - **Referencia de luz** opcional, como segunda imagen: «Lighting like Image 2».
6. **Foco y textura:** dónde está el foco, la profundidad de campo, el grano y «real texture, nothing plastic».
7. **Texto:**
   - **Vía B:** «no text, no letters».
   - **Vía A:** el texto exacto entre comillas, con «spelled exactly, with accents», y la regla de no añadir otras palabras.
8. **Varias fotos subidas:** todas como referencias de identidad (Marketing Studio admite 16 y Grok 10), con «Images 1–N show the same dish from different angles».

---

## 2. `referencias/`: fichas y familias

**Cómo se miden los datos de las fichas:**
- **Paletas:** medidas con k-means sobre cada imagen (los HEX los da la medida; el papel de cada color lo doy yo).
- **Escalas:** son la altura de mayúscula en porcentaje del alto del lienzo. Son aproximadas, medidas a ojo sobre 512 × 640.
- **Tipografía:** el nombre exacto de las fuentes no se puede saber (son plantillas de Canva), así que doy la clasificación.

### 2.1 Fichas

**post-01 · F5 · «opening hours»**
- **Capas (del fondo al frente):** escena oscura a sangre con bokeh; la mano remueve el matcha con una pajita de bambú (izquierda, cortada por abajo) → tarjeta translúcida esmerilada con esquinas redondeadas → textos → dos hojas que flotan; una pisa el borde de la tarjeta.
- **Retícula:** dos columnas; el texto en la derecha; margen de un 8 % del ancho.
- **Tipografía:**
  - **Titular:** serif itálica de alto contraste en minúscula (≈ 9 %).
  - **Horarios:** palo seco geométrico ligero y medio (≈ 4 %).
  - **Marca:** versalitas pequeñas (≈ 1,5 %).
- **Paleta:**
  - **Oscuros:** sombra #0B0A07 y madera #4A371D.
  - **Titular:** verde claro #C9DE8F, sacado del matcha.
  - **Tarjeta:** ≈ #9F9469 translúcida.
- **Foto:** escena real con acción (remover) y poca profundidad de campo.
- **Recursos:** la tarjeta ordena la información práctica sin tapar la escena; las hojas conectan con el producto.
- **Lectura en móvil:** 1 «opening hours» → 2 horarios → 3 marca. **Funciona** porque el color del titular sale del producto y la información va en dos niveles limpios.

**post-02 · F3 · «SUSHI» con texto curvo**
- **Capas:** naranja plano #DB5B0A con «SUSHI» fantasma repetido tono sobre tono → servilleta verde recortada y girada en diagonal → bandeja cenital recortada con sombra suave, salsera y palillos → textos curvos pequeños alrededor de la bandeja y la salsera → «30 % OFF» en un recuadro discontinuo → «SUSHI» gigante abajo a la derecha.
- **Retícula:** diagonal; bloque del titular a la derecha y abajo; textos menores en las esquinas; margen ≈ 9 %.
- **Tipografía:**
  - **Titular:** grotesca condensada heavy (≈ 14 %).
  - **Subtítulo:** palo seco (≈ 2 %).
  - **Curvas:** versalitas (≈ 1,5 %).
- **Paleta:** naranja #DB5B0A (66 %), verde complementario #81A286 (la servilleta) y blanco roto #F1E3D6.
- **Foto:** cenital recortada, girada unos 20°.
- **Recursos:** texto curvo que abraza el producto y sello de descuento.
- **Lectura:** 1 bandeja (verde sobre naranja) → 2 «SUSHI» → 3 «30 % OFF». **Funciona** por el complementario y por la diagonal, que da movimiento.

**post-03 · F1 · «SUSHI» detrás del plato**
- **Capas:** naranja #D9770A → gran arco más oscuro #BE5F04 detrás del plato → «SUSHI» dos veces, en blanco y gigante; el de arriba queda tapado por el plato, como un eco → plato en ¾ recortado con sombra proyectada → dos piezas con palillos que **entran por las esquinas superiores** → «IT'S SUSHI TIME!» en versalitas espaciadas → texto circular pequeño a la derecha → URL.
- **Retícula:** simétrica y central; margen ≈ 6 %.
- **Tipografía:**
  - **Titular:** grotesca extendida heavy a ancho completo (≈ 14 %).
  - **Antetítulo:** versalitas heavy (≈ 3 %).
  - **URL:** mínima (≈ 1 %).
- **Paleta:** monocromía naranja (fondo y arco), blanco #F5F1ED y cerámica #5C4E36.
- **Foto:** ¾ desde unos 45°.
- **Recursos:** palabra detrás con eco; palillos que llevan la vista al centro; arco como halo.
- **Lectura:** 1 plato → 2 «SUSHI» → 3 antetítulo. **Funciona** por la profundidad en cuatro planos (fondo, arco, palabra y plato).

**post-04 · F6 · «SALAD INSPIRATION»**
- **Capas:** terrazo claro (#D0D2D2, #BBB7B1) → plato blanco cenital enorme, cortado por los bordes izquierdo e inferior → ensalada → anotaciones en cursiva con flechas a mano → título fino arriba a la derecha.
- **Retícula:** libre; el plato ocupa ≈ 85 %; margen ≈ 7 %.
- **Tipografía:** palo seco geométrico ligero en versalitas (≈ 4 %) y cursiva fina (≈ 2 %). La jerarquía la lleva la foto.
- **Paleta:** grises de piedra. El único color es el de la comida.
- **Foto:** cenital con luz de día suave y sombra real.
- **Recursos:** las flechas señalan ingredientes reales.
- **Lectura:** 1 plato → 2 anotaciones → 3 título. **Funciona** porque el vacío gris deja mandar al color de la comida, y parece la «carta del chef».

**post-05 · F3 · «SMOKED BEEF MELT» (portada de carrusel)**
- **Capas:** crema #EFE6D0 → titular rojo #FD3837 en dos líneas → subtítulo de tres líneas y píldora «1/3» → sándwich recortado enorme en vista lateral → estrella dentada roja («Only» en script, «$10») que pisa la esquina del sándwich → logotipo pequeño y tira de cuadros roja abajo.
- **Retícula:** columna central; titular a ancho completo arriba; margen ≈ 8 %.
- **Tipografía:** grotesca ultranegra ancha (≈ 10 %), palo seco (≈ 2,3 %) y script dentro del sello. Relación de 4 a 1.
- **Paleta:** crema y un solo acento rojo (texto, sello y tira).
- **Foto:** recorte lateral a la altura de la boca, con el queso fundido real.
- **Recursos:** sello con precio real, contador y tira de cuadros como firma.
- **Lectura:** 1 titular → 2 sándwich → 3 precio. **Funciona** porque responde qué es, cuánto cuesta y que hay más.

**post-06 · F5 · marco polaroid**
- **Capas:** la escena de sushi desenfocada a sangre → marco polaroid blanco central → la misma escena nítida dentro del marco → palillos y pieza que **se salen del marco** arriba a la derecha → textos naranjas dentro del marco → texto circular con estrella → párrafo y URL.
- **Retícula:** central; el marco ocupa ≈ 70 % del ancho.
- **Tipografía:** grotesca heavy (≈ 7 %) y palo seco (≈ 2 %).
- **Paleta:** oscuros #4E443C y #1D1514, marco #F1EEEC y naranja #DA6D2C (el salmón).
- **Recursos:** el marco aísla el sujeto de un fondo recargado y la salida da volumen.
- **Lectura:** 1 pieza saliendo → 2 «SUSHI» → 3 círculo.

**post-07 · F4 · «Restaurant Exclusive Promo»**
- **Capas:** escena real del local, oscura y a sangre (mesa, copa y postre abajo a la derecha) → «Restaurant» en script crema y «Exclusive Promo» en serif condensada → versalitas → estrella amarilla «45 % OFF» sobre la copa → píldora con la URL e iconos.
- **Retícula:** titular centrado en el tercio superior y plato en el inferior; margen ≈ 8 %.
- **Tipografía:** script con florituras (≈ 9 %), serif condensada (≈ 5 %) y palo seco mínimo.
- **Paleta:** negro #080C0E, crema #D2C0AE y amarillo solo en la estrella.
- **Foto:** ambiente real con luz cálida y baja.
- **Lectura:** 1 «Restaurant» → 2 plato y copa → 3 estrella. **Funciona** porque el único color fuerte es el dato.

**post-08 · F5 · «ROMANTIC Dinner» (evento)**
- **Capas:** barra nocturna desenfocada con bokeh cálido y una copa central → iconos de flecha en las esquinas → fecha y hora apiladas → «ROMANTIC» en grotesca y «Dinner» en script → dibujos de línea (copas y sacacorchos) → tres columnas de información y líneas onduladas.
- **Retícula:** tres columnas abajo; margen ≈ 6 %.
- **Tipografía:** grotesca (≈ 6 %), script (≈ 6 %) y columnas (≈ 2,5 %).
- **Paleta:** oscuro #181918, cálidos #A24F2A y #D7853D, y texto amarillo claro.
- **Foto:** ambiente; **no hay producto protagonista**.
- **Lectura:** 1 título → 2 fecha → 3 columnas. **Funciona** para un evento, no para un plato.

**post-09 · F2 · «SANDWICH» ×6**
- **Capas:** crema #FDF4E2 → «SANDWICH» seis veces y «OF THE MONTH», en grotesca extendida extranegra roja #E11312 a ancho completo → sándwich recortado y girado unos 10° sobre las filas 3–5 → marca entre filetes → «ORDER NOW!» y URL.
- **Retícula:** filas a ancho completo; margen ≈ 6 %.
- **Tipografía:** una familia en dos pesos; cada fila ≈ 7 %.
- **Paleta:** crema y rojo; el verde de la lechuga contrasta.
- **Recursos:** la repetición es a la vez textura y titular.
- **Lectura:** 1 sándwich, que rompe el patrón → 2 la palabra → 3 marca.

**post-10 · F10 · «BRUNCH TIME!»**
- **Capas:** cenital a sangre de una bandeja de mezze sobre gris #494749, con una mano que sirve → «BRUNCH» y «TIME!» en serif romana ancha blanca, **en arco siguiendo el borde de la bandeja** → handle vertical.
- **Retícula:** circular; la bandeja ocupa ≈ 90 %.
- **Tipografía:** serif ancha bold (≈ 9 %).
- **Paleta:** pizarra, plata y amarillos y naranjas de los cuencos.
- **Foto:** cenital con luz de día dura y una acción.
- **Lectura:** 1 bandeja → 2 texto → 3 mano. **Funciona** porque la forma del plato dicta la tipografía.

**post-11 · F4 · «HIGH STEAKS»**
- **Capas:** azul noche #192129 → cuenco en ¾ (unos 30°) sobre madera en la mitad baja, con un cuchillo en diagonal → arriba, «Dishes at» en script, «HIGH STEAKS» en didona condensada menta #BDEDEA, un filete vertical y «THAT ARE WORTH YOUR MONEY» en versalitas.
- **Retícula:** titular en el tercio superior izquierdo; el filete separa dos columnas; margen ≈ 10 %.
- **Tipografía:** script (≈ 4 %), didona condensada ligera (≈ 8 %) y versalitas (≈ 2 %).
- **Paleta:** azul noche, menta y los cálidos del plato (#CA652A).
- **Foto:** low-key con luz lateral y aire arriba.
- **Lectura:** 1 «HIGH STEAKS» → 2 cuenco → 3 apoyo. **Funciona** por el juego de palabras, el titular en el aire oscuro y el cuchillo que guía la vista.

**post-12 · F1 · «Tasty BURGER»**
- **Capas:** cobalto #0D65C1 con textura de plástico → «BURGER» en lima #DDE75A, ultracondensada a ancho completo y **tapada abajo por la burger** → burger recortada a la altura del pan → «Tasty» en script blanca cruzando → fila de contacto y píldora lima.
- **Retícula:** central; margen ≈ 7 %.
- **Tipografía:** ultracondensada (≈ 30 %), script (≈ 12 %) y contacto (≈ 1,5 %).
- **Paleta:** cobalto y lima, casi complementarios, y blanco.
- **Lectura:** 1 burger → 2 «BURGER Tasty» → 3 botón. **Funciona** por el contraste máximo y los cuatro planos.

**post-13 · F9 · «SPECIAL MENU / BIBIMBAP»**
- **Capas:** foto de día con flash: fondo azul cielo #048DC0 y azulejos, bandeja en ¾ → «SPECIAL MENU» ultranegra → «BIBIMBAP» azul con contorno blanco, **curvada siguiendo la bandeja** → tres pegatinas de personajes → sello festoneado «only $20» → botón y dirección.
- **Tipografía:** ultranegra (≈ 9 %) y redondeada extendida (≈ 6 %).
- **Paleta:** azul cielo, blanco, marino #09223C y naranja.
- **Lectura:** 1 título → 2 bandeja → 3 pegatinas y sello. **Funciona** para locales desenfadados; es de las más cargadas.

**post-14 · F4 · «Pasta DELLA Casa»**
- **Capas:** bodegón oscuro a sangre (tomates, ajos, queso, tabla) → plato de pasta en ¾ abajo → **logotipo tipográfico** («Pasta» y «Casa» en script, «DELLA» en serif muy pesada, crema #EFE7CF, entrelazados) → versalitas → cita y handle.
- **Tipografía:** script (≈ 9 %), serif negra (≈ 10 %) y versalitas (≈ 2 %).
- **Paleta:** marrones #080804 y #53341E, el rojo del tomate y crema.
- **Foto:** bodegón cálido con atrezo de ingredientes.
- **Lectura:** 1 bloque → 2 plato → 3 cita. **Funciona** porque el texto es una sola forma.

**post-15 · F6 · «SAVOR THE ART OF PASTA»**
- **Capas:** blanco #FFFFFF (71 %) → tenedor con pasta colgando, recortado, que **entra por la esquina superior derecha** → tres etiquetas pequeñas arriba → «Crave» en script dentro de una elipse de línea → titular en neogrotesca suiza negra, muy apretada, en tres líneas abajo a la derecha → «(01)».
- **Tipografía:** neogrotesca (≈ 9 %, interlineado ≈ 0,9 y tracking negativo) y etiquetas (≈ 2 %).
- **Paleta:** blanco, negro y el amarillo de la pasta (#E0991A).
- **Lectura:** 1 pasta → 2 titular → 3 etiquetas. **Funciona** por la retícula de revista y el aire.

**post-16 · F3 · «FREE / SPAGHETTI Bolognese»**
- **Capas:** frambuesa #D04D59 con textura → **franja de papel rasgado** amarilla abajo → tenedor con espaguetis, recortado y vertical, que sale por abajo → «FREE» amarilla #F9CF3F ultra heavy **girada 90°** → «SPAGHETTI» condensada y «Bolognese» en script → estrellas y texto.
- **Tipografía:** «FREE» ocupa ≈ 50 % del alto; condensada (≈ 6 %) y script (≈ 4 %).
- **Paleta:** frambuesa, amarillo y blanco.
- **Lectura:** 1 tenedor → 2 «FREE» → 3 nombre. **Funciona** porque dos verticales marcan el ritmo.

**post-17 · F3 · «SPAGHETTI Bolognese» simétrico**
- **Capas:** ultramar #1803A8 → manchas orgánicas amarillas #E1AB53 → un plato vacío con logotipo cortado por arriba y el plato de espaguetis cortado por abajo (cenitales) → antetítulo espaciado → «SPAGHETTI» y «Bolognese» en script → botón con flechas.
- **Tipografía:** heavy (≈ 7 %), script (≈ 6 %) y versalitas (≈ 2 %).
- **Paleta:** ultramar, amarillo y blanco.
- **Lectura:** 1 título → 2 plato → 3 botón. **Funciona** por la simetría y el contraste.

**post-18 · F8 · «CHERRY Splash»**
- **Capas:** blanco y gris claro con planos diagonales → vaso con bebida roja, hielo y **salpicadura congelada** (recorte) → cerezas volando → «CHERRY» condensada carmesí #A0192E y «Splash» en script de pincel → precio → botón → onda granate abajo.
- **Tipografía:** condensada (≈ 10 %), pincel (≈ 8 %) y precio (≈ 5 %).
- **Paleta:** blanco, carmesí y granate #4B0C16.
- **Lectura:** 1 salpicadura → 2 título → 3 precio. **Funciona** porque hay movimiento y el texto va en zonas limpias.

**post-19 · F8 · «BEST COFFEE EVER»**
- **Capas:** fondo partido (forma orgánica marrón #6E460A a la izquierda y blanco a la derecha) → café con hielo recortado → salpicadura congelada → granos flotando → titular blanco en grotesca extendida black: **macizo sobre el marrón y solo contorno donde cruza el vaso**.
- **Tipografía:** extendida (≈ 8 %).
- **Paleta:** marrón, blanco y beige del café.
- **Lectura:** 1 vaso → 2 titular → 3 botón. **Funciona** porque el titular puede ser enorme sin tapar el producto.

**post-20 · F4 · «Breakfast Delight»**
- **Capas:** negro #050505 → una mano **vierte salsa** desde arriba a la izquierda → plato blanco con postre en ¾ → titular en didona de florituras crema → monograma y marca arriba → nombre del postre abajo a la izquierda.
- **Tipografía:** didona con florituras (≈ 9 %) y palo seco (≈ 2,5 %).
- **Paleta:** negro, crema y el rojo de la salsa.
- **Foto:** low-key de estudio con una acción que tiene causa.
- **Lectura:** 1 plato y chorro → 2 titular → 3 nombre. Hace serie con la 21.

**post-21 · F4 · «Welcome to Fauget Cafe»**
- **Capas:** macro oscura a sangre de un cóctel (romero, naranja y púa con joya) → el nombre del local en serif de florituras crema, muy grande abajo a la derecha → frase arriba a la izquierda → monograma → contacto.
- **Tipografía:** serif de florituras (≈ 14 %) y palo seco (≈ 2,5 %).
- **Paleta:** negro #0D0808, marrones y el naranja del cítrico.
- **Lectura:** 1 vaso → 2 nombre → 3 frase.

**post-22 · F4 · «MOCKTAIL Drink Club»**
- **Capas:** verde profundo #09221A con cortinas, flash directo → copa coupé (amarillo con cerezas) → «MOCKTAIL» en didona condensada rosa a ancho completo → «Drink Club» en script blanca que la cruza → columnas pequeñas de revista → «GOLDEN HOUR» en rosa.
- **Tipografía:** didona condensada (≈ 15 %), script (≈ 8 %) y columnas (≈ 1,8 %).
- **Paleta:** verde, rosa, el amarillo del cóctel y blanco.
- **Lectura:** 1 título → 2 copa → 3 script. **Funciona** como una portada de revista premium.

**post-24 · F7 · «SEAFOOD Paella»**
- **Capas:** macro de paella a sangre arriba (≈ 35 %) y abajo (≈ 30 %) → **franja central de papel blanco rasgado y arrugado** → marca → subtítulo naranja → «SEAFOOD» en condensada azul #5E8DDE y «Paella» en pincel naranja, cruzándose → cuerpo → etiqueta en otro trozo de papel.
- **Tipografía:** condensada (≈ 9 %), pincel (≈ 9 %) y subtítulo (≈ 3 %).
- **Paleta:** el naranja del arroz, el blanco del papel y azul complementario.
- **Lectura:** 1 título → 2 macro → 3 subtítulo. **Funciona** porque el texto tiene una zona propia sobre una textura cargada.

**post-25 · F2 · «dip»**
- **Capas:** oscuro → una **mano que moja** una pieza frita en salsa → «dip» en una rejilla de 3 × 5, blanco en minúscula, detrás de la mano → tiras de cuadros a los lados → sello festoneado rojo → contacto.
- **Tipografía:** geométrica en minúscula (≈ 5 % por fila).
- **Paleta:** negro, blanco, el naranja del frito y granate #8E2A12.
- **Lectura:** 1 mano → 2 «dip» → 3 sello. **Funciona** porque la palabra de la acción es el fondo.

**post-26 · F9 · «Today Special Menu»**
- **Capas:** crema #FEF7E6 → tira de cuadros azul → semicírculo marino #0A3C83 detrás del plato → hojaldre recortado con sombra → script retro gruesa → flecha punteada al producto → círculo con el precio → dibujos de galletas → contacto.
- **Tipografía:** script retro (≈ 10 %) y palo seco (≈ 2 %).
- **Lectura:** 1 «Special» → 2 hojaldre → 3 precio. **Funciona** como pieza retro ordenada.

**post-27 · F9 · «New Seasonal Drink is Here!»**
- **Capas:** crema con personajes de línea → trama de puntos y estrella azul detrás de dos bebidas recortadas que tapan la base del titular → «New» en script de contorno y titular heavy azul #265694 → sello naranja → franja azul rasgada → flechas.
- **Lectura:** 1 titular → 2 bebidas → 3 sello. **Es el límite de densidad:** funciona porque va en tres franjas.

**post-28 · F2 · «SUSHI» ×5 con flechas**
- **Capas:** rojo #EE2607 con un gran círculo blanco → palillos con sushi que entran por arriba a la derecha → «SUSHI» apilado cinco veces en rojo y negro alternos, en ultranegra → texto → **flecha negra a mano** del precio al sushi → «$9» en un círculo de línea → contacto.
- **Tipografía:** ultranegra (≈ 6 % por fila).
- **Lectura:** 1 patrón → 2 sushi → 3 precio. **Funciona** porque las flechas cuentan un recorrido.

**post-29 · F6 · «steak»**
- **Capas:** blanco → rectángulo gris muy claro → plato cenital cortado por el borde derecho → «steak» en geométrica bold terracota (≈ #986548), en minúscula, **girada 90° y sangrando** por la izquierda y por arriba → arco fino oliva → marca, barrita y frase.
- **Tipografía:** la palabra ocupa ≈ 60 % del alto.
- **Lectura:** 1 «steak» → 2 plato → 3 frase. **Funciona** porque el aire la hace parecer de alta cocina.

**post-30 · F7 · «Today's special BEEF BURGER»**
- **Capas:** macro de una burger a sangre en los dos tercios de arriba, sobre bokeh cálido → **papel negro arrugado y rasgado** en el tercio inferior → «Today's special» en script dorada, «BEEF BURGER» en heavy blanca y «TASTY AND HOT» en versalitas.
- **Tipografía:** heavy (≈ 7 %), script (≈ 5 %) y versalitas (≈ 2,5 %).
- **Paleta:** oscuros #483123 y #131011, dorado #CF8944 y blanco.
- **Lectura:** 1 burger → 2 nombre → 3 script. **Funciona** porque el texto tiene una zona propia.

### 2.2 Familias, corregidas

| Familia | Posts | Corrección frente a tu propuesta |
|---|---|---|
| **F1** Color plano + recorte + palabra detrás | 3, 12 | El 9 no es «detrás», es un **patrón** (pasa a F2) |
| **F2** Palabra repetida como patrón | 9, 25, 28 | Familia nueva: coincide con `ejemplos/09` |
| **F3** Color plano de oferta con recurso (girada, curva, simetría, sello) | 2, 5, 16, 17 | El 5 y el 2 llevan sello, pero su aspecto es de color plano |
| **F4** Oscuro editorial: serif o script | 7, 11, 14, 20, 21, 22 | Faltaba el **11** (el más cercano a Etxebarri). El 1 se va a F5 |
| **F5** Escena oscura con información o marco | 1, 6, 8 | Familia nueva: piezas de horario, evento o promo con poco producto, y el marco polaroid |
| **F6** Blanco o claro editorial | 4, 15, 29 | Igual |
| **F7** Macro a sangre + franja de papel | 24, 30 | Igual. El 16 también tiene papel rasgado, pero es de color plano |
| **F8** Salpicadura congelada sobre claro | 18, 19 | Igual |
| **F9** Ilustrado y pegatinas | 13, 26, 27 | Igual |
| **F10** Cenital a sangre con texto que sigue la forma | 10 | El texto curvo es un **mecanismo** (2, 10 y 13), no una familia. El 10 es la única pieza cenital a sangre |

**Mecanismos y recursos, que atraviesan las familias:**

| Mecanismo o recurso | Posts | El compositor hoy |
|---|---|---|
| Palabra detrás del producto | 3, 12 (y ejemplos 02, 05, 07) | **Sí** (`detras`) |
| Contorno al cruzar el producto | 19 | **No**: hay contorno, pero no relleno dividido por la máscara |
| Palabra repetida como patrón | 9, 25, 28 | **A medias**: con varias capas de texto a mano, sin capacidad «patrón» |
| Texto curvo sobre la forma del plato | 2, 10, 13 (y círculos pequeños en 3 y 6) | **Solo en círculo** (`circulo-texto`); no hay arcos parciales ni texto sobre un trazo |
| Palabra girada 90° | 16, 29 (y ejemplo 06) | **Sí** |
| Giro libre del producto recortado | 2, 9 | **No**: un recorte no gira |
| Logotipo tipográfico (script + heavy o serif cruzados) | 7, 12, 14, 16, 17, 22, 24, 30 | **Sin fuentes**: el catálogo no tiene ni script ni serif de alto contraste |
| El producto se sale del marco | 6 | **Sí** (`alineadoCon`) |
| Elementos que entran por los bordes | 3, 15, 16, 28 | **Sí**, si hay activo |
| Platos cortados por los bordes | 4, 17, 29 | **Sí** |
| Acción con causa (mano) | 1, 10, 20, 25 | Es foto: vía A o B |
| Salpicadura u objetos flotando | 1, 18, 19 | Es foto (vía A o B) o varios recortes |
| Sello o estrella de precio | 2, 5, 7, 13, 25, 26, 27, 28 | **No**: solo hay rectángulo, elipse y línea. Hace falta una capa vectorial |
| Flechas a mano | 4, 26, 27, 28 | **No** (capa vectorial o un activo dibujado) |
| Papel rasgado o arrugado | 16, 24, 27, 30 | **No** (un activo de textura con borde irregular) |
| Tira de cuadros | 5, 25, 26 | **No** (patrón vectorial) |
| Formas orgánicas, arcos y semicírculos | 3, 17, 19, 26, 28 | **Solo elipse y rectángulo** |
| Dibujos de línea y personajes | 8, 13, 26, 27 | **No** (activos ilustrados) |
| Tarjeta translúcida con desenfoque | 1 | **No** |
| Contador y numeración | 5, 15 | **Sí** (texto) |

### 2.3 Receta por familia y lo que falta

| Familia | Receta reutilizable | Le falta hoy al compositor |
|---|---|---|
| F1 | Fondo plano saturado (o un color de marca) → una palabra ultracondensada a ancho completo, tapada abajo por el producto entre un 30 y un 45 % → producto recortado, grande, vista lateral, sombra de contacto → script que cruza la palabra → una fila pequeña abajo. Dos o tres tintas, a ser posible complementarias | Fuentes script; máscara fiable (con fondo controlado en la foto nueva, ver 4.3) |
| F2 | Fondo plano o foto oscura → una palabra corta repetida en filas o rejilla, en una sola familia → producto o mano tapando las del centro → como mucho un sello | Capa «patrón»; giro libre del recorte |
| F3 | Fondo plano con textura sutil → producto recortado (cenital o lateral) → palabra girada o arcos alrededor del producto → sello con un dato real → tira, papel o mancha como firma | Texto en arco o sobre un trazo, capa vectorial (sellos, manchas, tiras), papel rasgado, giro libre |
| F4 | Escena o estudio oscuro a sangre, luz lateral o flash → plato en ¾ en la mitad baja con aire arriba → logotipo tipográfico de script con didona o serif en crema o en un color sacado del plato → versalitas pequeñas → una acción opcional | **Fuentes serif de alto contraste y script.** Nada más: es la familia más asequible hoy |
| F5 | Escena del local → la información práctica ordenada (tarjeta o columnas) → dibujos de línea | Tarjeta translúcida, dibujos. Solo para horarios y eventos |
| F6 | Blanco o piedra clara → plato cenital cortado por un borde, o un elemento que cuelga → titular suizo apretado o palabra girada que sangra → etiquetas, (01) o anotaciones con flechas | Flechas a mano |
| F7 | Macro a sangre arriba y abajo → franja de papel rasgado (blanco o negro arrugado) → logotipo tipográfico (heavy y script) encima | Activo de papel con borde rasgado, fuentes script |
| F8 | Fondo claro o partido → bebida recortada con salpicadura congelada y elementos volando → titular que pasa a contorno al cruzar | Contorno dividido por la máscara; la salpicadura tiene que venir de la foto |
| F9 | Flash de día, colores planos → pegatinas o personajes, sellos, flechas, trama → titular heavy o script retro | Casi todo: ilustraciones, trama, sellos |
| F10 | Cenital a sangre → texto en arcos siguiendo el borde del plato → una mano | Texto en arco a partir de la elipse del plato |

---

## 3. Diagnóstico del carrusel de gambas

| Diapositiva | Familia más cercana | Qué tiene | Qué le falta frente a esa familia |
|---|---|---|---|
| 1 · «Gamba roja de Palamós,» | **F4** (post-11) | Low-key, titular en el aire oscuro, producto grande | **Foto con el mismo ángulo que la del hostelero**, solo cambia la luz. El producto está cortado y turbio en el centro, mientras que en el post-11 el plato está entero y se reconoce. Una sola voz tipográfica: falta el contraste de script con serif. No hay tercer nivel ni recurso |
| 2 · «brasa de leña,» | Ninguna | La frase junto a las puntas tostadas | Recorte de 1,05× de la misma foto. En una familia real sería otra toma (a ras de mesa, con antenas cruzando) o una macro con zona propia para el texto (F7) |
| 3 · «sal gruesa» | F7 sin franja | Una idea de textura | Ampliación de 1,5× sobre detalle generado: blando. Sin zona para el texto. El mismo ángulo |
| 4 · «y nada más» | Ninguna | Un grano de sal como punto final | **Ninguna de las 29 referencias tiene una diapositiva sin producto.** En la lógica de las referencias, el cierre enseña el producto y la llamada a la acción (serie del post-05) |

**Conjunto:** ¿podría estar entre las referencias sin desentonar? **No.** Es un editorial minimalista de alta cocina. Le faltan:
- el producto entero y reconocible;
- un color saturado o un negro limpio con contraste;
- una palabra o un logotipo tipográfico protagonista con relación espacial;
- un recurso con propósito;
- tres niveles de jerarquía;
- fotografías nuevas.

**Lo que sí vale de la F1.5 y se conserva:**
- la estimación previa, el tope y el registro de gasto;
- la procedencia de los activos;
- el punto negro;
- `carrusel.ts` y sus hojas;
- la estructura de `conocimiento/`, que hay que corregir;
- el registro de afirmaciones.

La **comprobación de fidelidad por bordes no vale para fotos nuevas**, porque compara la misma geometría. Se sustituye por la lista de componentes de la FASE 2.

---

## 4. Arquitectura de dos vías y benchmark

### 4.1 Lo común a las dos vías

1. Fotos subidas → análisis con visión: elementos del plato, defectos y desorden que no se reproducen. **El dueño lo confirma.**
2. Se elige una referencia (obligatoria en las primeras 5 piezas) → su ficha → su familia.
3. Concepto: qué se toma de la referencia (el oficio, la jerarquía y el mecanismo adaptado al plato) y qué no (textos, marcas, la pieza entera).
4. Plan de toma por diapositiva con el manual de foto nueva (1.2). **Cada diapositiva es una toma distinta.**
5. Vía A o vía B, según la familia (lo decide el benchmark).
6. Comprobación: lista de componentes con recortes lado a lado y veredicto humano. En la vía A, además, lectura del texto.

### 4.2 Las dos vías

| | Vía A · Integrada | Vía B · Por capas |
|---|---|---|
| Qué genera la IA | Foto nueva **y** tipografía en la misma imagen (como 03–06) | Foto nueva **sin texto**, con el fondo controlado |
| Qué hace el código | Comprueba el texto y exporta | Máscara, tipografía, recursos y exportación |
| A favor | Integración física (letras que pasan por delante y por detrás, gotean o se deshacen); es lo que gustó | Texto exacto con acentos, editable y gratis de corregir; recursos vectoriales |
| En contra | Ortografía y acentos («ACOMRAÑANTE» en Café Albor). Cada cambio de texto es otra imagen de pago. El modelo puede añadir texto | Integración más pobre; necesita fuentes (script y serif) y capacidades (curva, sello, papel) |
| Referencia | La ficha en palabras dentro del prompt. **No se envía el post de Canva al generador**, porque copiaría marcas y textos (duda 5) | La ficha se traduce a una intención |

### 4.3 La máscara en la vía B

El fallo de Apple Vision con las antenas vino de recortar una foto con fondo de mantel. En la vía B el fondo lo elegimos nosotros:
- Se pide la foto nueva sobre un **fondo plano de un color que no esté en el producto** (por ejemplo un verde azulado para las gambas rojas).
- La máscara sale **por distancia de color** (croma). Es gratis y determinista, y guarda las antenas porque su color es muy distinto del fondo.
- Se prueba también Apple Vision sobre esa misma imagen.
- Con máscara, el color de fondo se cambia al de la familia o al de la marca sin regenerar.

Esto se mide en el benchmark sin coste adicional.

### 4.4 Benchmark propuesto (no ejecutado)

- **Producto:** la gamba de Etxebarri, porque es la única foto real con resolución. Limitación: es una sola foto, mientras que la FASE 2 prevé varias.
- **Familias:**
  - **F1**, referencia post-12 con post-03: color plano, palabra detrás y script;
  - **F4**, referencia post-11: oscuro editorial.

  Son dos familias de lógica opuesta: recorte frente a escena.
- **Modelos:**
  - **Marketing Studio 2.0** a 2K: conservó la geometría en la F1.5, pero en el MVP repitió el ángulo con un prompt malo;
  - **Grok 2.0** a 2K: hizo el ángulo nuevo en el MVP, pero en la F1.5 añadió sal.

  Hay que saber cuál hace foto nueva con el prompt bueno.

| # | Vía | Familia | Modelo | Precio (`/estimate`, 07/11, 3 referencias, 3:4) |
|---|---|---|---|---|
| 1–2 | A | F1 | MS 2.0 2K · Grok 2K | 0,365 + 0,110 |
| 3–4 | A | F4 | MS 2.0 2K · Grok 2K | 0,365 + 0,110 |
| 5–6 | B (sin texto, fondo croma) | F1 | MS 2.0 2K · Grok 2K | 0,365 + 0,110 |
| 7–8 | B (sin texto, aire para el titular) | F4 | MS 2.0 2K · Grok 2K | 0,365 + 0,110 |
| | | | **Total 8 imágenes** | **1,90 USD** |
| | Reserva: un reintento por vía y familia en el modelo ganador | | | hasta +0,73 USD → **tope de 2,70 USD** |

Otros precios medidos hoy:
- Marketing Studio 2.0 a 1K: 0,207 USD.
- Marketing Studio 2.0 a 4K: 0,579 USD.
- Grok a 1K en calidad low: 0,05 USD.
- Ideogram 4.0: 0,10 USD en QUALITY y 0,03 USD en TURBO, pero admite **una sola** referencia y daría menos fidelidad. Se podría añadir una imagen de Ideogram para la vía A de F1 (+0,10 USD) si quieres medir la calidad del texto.

**Qué se mide en cada imagen:**
1. **Componentes:** dos gambas, cabezas, antenas largas, patas, sal gruesa y, si se conserva, el plato de cristal esmerilado cuadrado; nada añadido.
2. **Ángulo nuevo** frente al original: sí o no.
3. **Texto exacto** y acentos (vía A).
4. Calidad de la foto (rúbrica).
5. **«¿Podría estar entre las referencias?»** e impacto a 390 px.
6. Editabilidad, coste y tiempo.

En la vía B, el diseño se compone sobre las fotos 5–8 sin coste.

**Cómo se decide:** te enseño una hoja ciega por familia (A, B y la referencia, sin decir cuál es cuál). Por familia, la vía A gana si gana en diseño **y** acierta el texto en una de cada dos tiradas. Si no, gana la B. Tu elección se guarda como observación del estudio.

**Requisito previo de la vía B:** añadir al catálogo 2 o 3 fuentes OFL (una didona o serif de alto contraste y una script) para que la comparación sea justa. Es configuración, no código, y se haría en la FASE 1.

---

## 5. Plan de fases (ajustes a tu propuesta)

- **FASE 1** (sin gasto):
  - regla de referencia obligatoria en el dominio, con test;
  - entrada de referencias por imagen o enlace (si Canva o Pinterest bloquean, se pide una captura);
  - ficha de referencia como esquema (los campos de 2.1);
  - las 29 fichas en `conocimiento/referencias/`;
  - el manual de foto nueva y `ejemplos/` en los oficios;
  - quitar las prohibiciones de mecanismos aprobados (CONCEPTO, antipatrones y la observación), con la prueba de este documento;
  - las fuentes OFL de serif y script.
- **FASE 2:**
  - el benchmark (con tu autorización de gasto);
  - el análisis de elementos con visión (Gemini, también de pago: lo estimo antes);
  - el plan de toma;
  - la nueva comprobación de componentes.
- **FASE 3:**
  - las capacidades del compositor que piden las familias elegidas, y solo esas;
  - la rúbrica con «¿podría estar entre las referencias?» y el impacto en el móvil.
- **FASE 4:** el carrusel de Etxebarri rehecho a partir de la referencia que elijas.

### Tres referencias que propongo para la FASE 4

| Opción | Referencia | Cómo sería el carrusel (fotos nuevas distintas en cada diapositiva) |
|---|---|---|
| **1** | **post-11** (F4, oscuro editorial) | 1: las gambas en ¾ a 25°, low-key; «Gamba roja» en didona crema y «de Palamós» en script; versalitas pequeñas. 2: a ras de mesa a 10° con 100 mm macro, las cabezas grandes y las antenas cruzando el aire oscuro (el 01 corregido). 3: cenital a 90° del plato entero con la sal a la vista. 4: el plato con la llamada a la acción del lugar. Es la que más encaja con «sobrio, artesano, fuego» |
| **2** | **post-12** con **post-03** (F1, palabra detrás) | 1: las gambas recortadas enormes, a ras de mesa, sobre hueso plano; «BRASA» en carbón detrás y «de leña» en script cruzando. 2–4: el mismo sistema con otra idea espacial en cada una («SAL» con los cristales, la antena que firma «Palamós», el cierre con el producto y el lugar). Es la de más energía publicitaria, cerca de los ejemplos 02 y 03 |
| **3** | **post-30** con **post-24** (F7, macro y papel) | 1: macro a sangre de las cabezas brillantes; franja de papel negro arrugado (el carbón de la marca) con «Gamba roja» en heavy y «de Palamós» en script. 2–4: otras macros (sal, puntas tostadas, antenas) con la franja en otra posición. Es la más artesana y necesita el activo de papel |

---

## 6. Dudas y supuestos

1. **Fidelidad nueva.** ¿«Flexible en cámara, luz, fondo y encuadre, estricta en elementos» **sustituye** a tu decisión del 06/11 («ESTRICTA; si hace falta otro ángulo, pedir otra foto»)? ¿Para todos los locales por defecto?
2. **¿Qué cuenta como elemento?**
   - **La vajilla** (el plato de cristal esmerilado): ¿se conserva siempre o puede cambiar, como en la pieza A del MVP, que la puso sobre una mesa oscura?
   - **El mantel:** ¿se puede cambiar?
   - **La colocación** («una gamba sobre otra»): ¿se puede cambiar?

   Supongo que la vajilla se conserva, que el mantel y el fondo son libres y que la colocación puede variar si se mantiene el número.
3. **Regla de las 5 primeras piezas.** ¿Cuentan las piezas creadas (en cualquier estado), las generadas o las aprobadas o exportadas? Supongo **creadas en modo real**, por local, sin contar las simuladas.
4. **¿Dónde se implementa la FASE 1?** Dices que no se toque el generador antiguo de la web, pero la entrada de referencias es interfaz.

   Propongo:
   - dominio y casos de uso nuevos, con tests;
   - una herramienta de línea de comandos para registrar y analizar referencias;
   - pantallas web nuevas solo si las apruebas, sin tocar el flujo actual.
5. **¿El post de referencia va al generador como imagen?** En la vía A propongo que **no**: se le pasa la ficha en palabras, para que no copie «Borcelle», precios ni textos. ¿De acuerdo, o quieres probar las dos cosas en el benchmark (+4 imágenes, unos 0,95 USD)?
6. **Benchmark.** ¿Autorizas hasta **2,70 USD** con las dos familias y los dos modelos de 4.4? ¿Prefieres otras dos familias?
7. **Gemini.** El análisis de las fotos y el de las referencias con visión los cobra Google (céntimos por llamada). ¿Lo autorizas en la FASE 1 y la 2 con estimación previa, o lo hago yo a mano en esta conversación, como en esta fase?
8. **Git.** La F1.5 sigue sin confirmar. ¿La confirmo tal cual como referencia antes de cambiar nada (lo recomiendo, igual que hice con la F1), o la descartas?
9. **Resultados de `ejemplos/`.** Las imágenes que gustaron estaban en `creacion-contenido/`, que ya no existe. Si las tienes, ponerlas en `biblioteca/ejemplos/img/` me dejaría **ver** lo que gustó, no solo leer el prompt.
10. **Tolerancia con Grok.** En la F1.5 añadió sal fina y en el MVP cambió el pan de la burger. Con la fidelidad flexible, ¿un cambio de textura (más brillo, más sal) es aceptable o también descarta la imagen? Supongo que **descarta** si añade un componente (sal donde no la había) y que no descarta si solo cambia la luz.
11. **Datos para la vía A.** Cuando el texto va dentro de la imagen, ¿aceptas que no sea editable? Cada cambio supone regenerar.

**No avanzo a la FASE 1 hasta que respondas.**
