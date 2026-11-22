# Estudio de arte: de la dirección agéntica a código real

**22 de noviembre de 2026.** Implementación del sistema propuesto en [INFORME-DIRECCION-DE-ARTE-AGENTICA.md](INFORME-DIRECCION-DE-ARTE-AGENTICA.md), probado con Hydrogen (`gemini-4-hydrogen`) y Nano Banana Pro (`gemini-3-pro-image`) sobre siete encargos reales del repositorio.

## 1. En una frase

**Hydrogen decide la idea y la estructura; el código maqueta con medidas reales; un crítico con rúbrica corrige, y cada parche solo se queda si gana una comparación a ciegas a tamaño de móvil.**

## 2. Estado

- **Funciona de punta a punta con modelos reales:** brief → 3 direcciones → compilación → render → OCR a 360 px → crítica → parche → comparación a ciegas → informe y hojas.
- **Validado en tres corridas reales** (r1, r2 y r3) y en una recompilación sin modelos que mide el efecto de los arreglos del maquetador.
- **La corrida completa del banco con todos los arreglos (r4) está pendiente:** los créditos de Gemini se agotaron a mitad de r3 (HTTP 402). Hay que recargarlos para hacerla.
- **Pruebas:** `npm test` da 487 en verde (19 nuevas en [test/estudio-arte.test.ts](../test/estudio-arte.test.ts)). `npm run typecheck` está limpio.

## 3. Cómo se usa

```bash
# Un encargo, 3 direcciones, hasta 2 vueltas de crítica
npm run arte -- banco/arte/dak-manhattan.json --corrida r4 --direcciones 3 --vueltas 2

# El banco entero, dos encargos a la vez; al final, hoja-resumen y prueba de plantilla
npm run arte -- banco/arte/*.json --corrida r4 --paralelo 2

# Las recetas de una corrida, recompiladas con el código actual y sin llamar a ningún modelo
npm run arte -- banco/arte/*.json --recompilar r3 --paralelo 4

# Métricas de una o varias corridas
npx tsx src/herramientas/arteMetricas.ts r3 r4
```

**Salida:** `datos/arte/<corrida>/<encargo>/`, con:

- una carpeta por dirección y por vuelta (intención, PNG, versión móvil y capas);
- `hoja.jpg`, `informe.md` y `resultado.json`;
- en la carpeta de la corrida, `resumen.jpg` y `plantilla.md`.

**Gasto:**

- **Escenas y garabatos:** tienen su propio presupuesto por ejecución, `ARTE_PRESUPUESTO_USD` (8 USD por defecto, sobre lo ya gastado). Se apuntan en `datos/gasto/gemini.jsonl`.
- **Llamadas de texto:** se apuntan en `datos/gasto/gemini-texto.jsonl`.

## 4. Qué se ha construido

| Pieza | Archivo | Qué hace |
|---|---|---|
| **Receta** (dialecto del director) | [src/dominio/arte/receta.ts](../src/dominio/arte/receta.ts) | Una dirección es una idea, tres lecturas, un **esqueleto** (7), el producto (escala cualitativa), el titular (escala, relación con el producto, tinta, registro) y hasta 4 **operaciones** combinables (12). El modelo no escribe celdas ni cuerpos. Incluye 11 voces tipográficas del estudio. |
| **Compilador** | [src/dominio/arte/compilarReceta.ts](../src/dominio/arte/compilarReceta.ts) | Traduce la receta a capas con la tensión garantizada. Primero coloca el producto y el titular se ajusta a él, salvo en el cartel, donde manda la letra. Usa **métricas reales de las fuentes** y la **silueta real** del producto, no su rectángulo. Reserva la banda de firma y apoyo. La tinta se mide contra lo que pisa cada texto. Las flechas no cruzan textos. Las pegatinas no tapan texto. Lo que no cabe se quita con una nota. |
| **Rúbrica y variedad** | [src/dominio/arte/rubrica.ts](../src/dominio/arte/rubrica.ts) | Seis dimensiones de 0 a 4 (§6.1 del informe) y nota sobre 100. Huella estructural y distancia entre direcciones: dos direcciones con el mismo esqueleto se rechazan. |
| **Bibliotecario** | [src/dominio/arte/referencias.ts](../src/dominio/arte/referencias.ts) | Lee el corpus curado (`referencias-pinterest/diseno-visual/README.md`). Elige 5 piezas del tipo de local que enseñen operaciones ejecutables sin repetirlas, y le explica al director con qué parte de la receta se ejecuta cada una. |
| **Estudio** (caso de uso) | [src/aplicacion/arte/estudioDeArte.ts](../src/aplicacion/arte/estudioDeArte.ts) | Direcciones, reparación por dirección, holgura del maquetador (baja la escala si no cabe), arreglos medibles sin modelo (tinta, solape, anotación que pisa) y crítica. Las direcciones van en paralelo. El parche se adopta por comparación a ciegas. |
| **Hydrogen**: director, crítico, comparador y juez de plantilla | [EstudioArteGemini.ts](../src/adaptadores/gemini/EstudioArteGemini.ts) e [instruccionesArte.ts](../src/adaptadores/gemini/instruccionesArte.ts) | Ven la foto, las referencias, la pieza a 900 px y a 360 px y las medidas del código. |
| **Nano Banana Pro**: recursos sin comida | [RecursosArteGemini.ts](../src/adaptadores/gemini/RecursosArteGemini.ts) | **ESCENA:** fondo fotográfico sin comida, vajilla, personas ni texto. **GARABATO:** trazos a tinta que se convierten en recurso recortable del color de la marca. Cada uno es un activo `SOLO_PRUEBA_COMPOSICION` con su prompt, modelo y coste, y se reutiliza por huella. **El plato es siempre la foto real recortada.** |
| **Máscara principal** | [src/adaptadores/imagen/mascaraPrincipal.ts](../src/adaptadores/imagen/mascaraPrincipal.ts) | Quita de la máscara otro objeto cortado por el borde que Vision funde con el principal: componentes, y si no los hay, una «cintura». Lo guarda como activo derivado con su procedencia. |
| **Herramientas** | [src/herramientas/arte.ts](../src/herramientas/arte.ts) y [arteMetricas.ts](../src/herramientas/arteMetricas.ts) | Banco, paralelo, hojas, informe, duelo a ciegas contra la pieza previa del local, prueba de plantilla, recompilación sin modelos y métricas. |
| **Banco** | [banco/arte/](../banco/arte/) | 7 encargos: DAK, Etxebarri, Casa Aranda, Mesón de Cervantes, Lo Güeno, Sushita y Torre de Vega. Cada uno trae sus hechos confirmados, el mensaje y la pieza previa del local. |

**Cambios en código existente:**

- [propuesta.ts](../src/dominio/diseno/propuesta.ts):
  - ajustes `ancho-por-linea` y `eje-ancho` en el dialecto;
  - capa `plato` con `recurso` (garabatos);
  - la foto extra a sangre ya no crea una silueta fantasma;
  - **arreglado un fallo del comprobador de textos**: la última palabra de cada frase de los datos no casaba («sin complejos.»).
- [mecanismos.ts](../src/dominio/diseno/mecanismos.ts): exporta la retícula.
- [ClienteGemini.ts](../src/adaptadores/gemini/ClienteGemini.ts): tiempo máximo configurable.
- [MedidorDeFotoSharp.ts](../src/adaptadores/imagen/MedidorDeFotoSharp.ts): la rejilla de la silueta.
- En el informe anterior se corrigió el desregistro: para el texto ya existía (`tinta.registro`).

## 5. Qué salió en las pruebas reales

### 5.1 Lo que funciona

- **El director propone direcciones distintas de verdad.** En Casa Aranda propuso un cartel tipográfico («Sin prisa. / CHURROS / CHOCOLATE / CAFÉ» con sello «1932 Málaga»), una ficha editorial en didona y una columna vertical («DESAYUNO»). Son tres estructuras, tres voces y tres registros. El copy creativo («Sin prisa.», «El ritual.», «cenas de noche») no afirma nada que no conste.
- **El crítico es fino y concreto.** Ejemplos:
  - «El sello tapa la "E" de "TOWER" y el OCR no lee el titular a 360 px».
  - «Las anotaciones atraviesan el titular con una flecha».
  - «El plato arrastra un doble corte en su parte superior». Era cierto, y destapó la máscara mal fundida.
- **Su mejor parche es de oficio.** En DAK quitó la pegatina y pasó «TOWER» a contorno donde cruza la hamburguesa. Ese recurso nadie lo había programado para ese caso ([r2](../datos/arte/r2/dak-manhattan/01-cartel-de-neon/)).
- **Las escenas generadas funcionan.** En Lo Güeno, la barra de madera la generó Nano Banana Pro (0,14 USD) y la cazuela es la real, recortada encima ([hoja](../datos/arte/r3/logueno-habas/hoja.jpg)).
- **El garabato funciona.** La explosión de cómic se generó en tinta, se convirtió en máscara y se pintó del rojo de DAK detrás de la hamburguesa real. Probado en seco; todavía no lo ha elegido el director en una corrida.

### 5.2 Números de r3

r3 son 4 encargos completos. DAK cayó por un fallo ya corregido; Sushita y Torre de Vega se cortaron por el 402.

| Medida | Valor |
|---|---|
| Direcciones propuestas / pintadas | 12 / 11 |
| Nota media de la primera versión → de la mejor | 18,7 → 37 sobre 100 |
| Parches adoptados en la comparación a ciegas | 9 de 16 |
| Media por dimensión (0–4) | idea 2,0 · composición 1,4 · tipografía 1,2 · relación 1,2 · identidad 2,3 · acabado 1,5 |
| Tiempo por encargo | unos 4 minutos, con las 3 direcciones en paralelo |

**Cómo leer las notas:**

- La nota de la primera versión es baja porque **cualquier ERROR del compositor la deja en 0** (compuerta de fidelidad y legibilidad).
- La rúbrica es exigente a propósito: un 3 se gana. La pieza más fuerte de la sesión, el cartel rojo de DAK en r1, sacó 63.

### 5.3 La recompilación sin modelos

Son las 12 recetas de Hydrogen de r3, pintadas con el maquetador final:

| Medida | r3 tal como se pintó | Recompilado |
|---|---|---|
| Errores del compositor | 8 | 2 |
| Avisos de letra tapada | 6 | 4 |
| Textos legibles por OCR a 360 px | 37 de 57 | 38 de 57 |

**Los 2 errores que quedan:**

- un PARTIDA que no cabe en la foto de Etxebarri, porque el plato llena el ancho;
- una firma rozada por las antenas de la gamba.

**El cartel de Etxebarri** se rechaza ahora antes de pintar: la foto corta el plato por los dos lados, y el código pide otro esqueleto.

**Hojas:**

- [r3](../datos/arte/r3/resumen.jpg)
- [r3 recompilada](../datos/arte/r3-recompilada/resumen.jpg)

## 6. Defectos encontrados al probar, y su arreglo

Todos salieron de mirar renders reales o de lo que dijo el crítico.

| Síntoma | Causa | Arreglo |
|---|---|---|
| Las direcciones que no compilaban se perdían | Una sola vuelta de propuesta para todas | Reparación por dirección y holgura del maquetador |
| Firma y apoyo «no caben» con producto enorme | El producto ocupaba su rectángulo entero | Silueta real en rejilla y banda reservada para los textos pequeños |
| El titular «monumental» no llenaba el ancho, o desbordaba | Anchos de letra estimados | Métricas reales del motor tipográfico |
| El producto tapaba la última línea entera | Se colocaba el titular antes que el producto | Primero el producto; el titular se ajusta para que se tape el 40 % de las mayúsculas en el punto más alto |
| Las antenas o los tentáculos decidían el tapado | Canto = borde de la caja | Canto = donde empieza el cuerpo de la silueta (18 % de masa) |
| El titular subía y pisaba la firma | La relación «detrás» sin límites de movimiento | Puede bajar, nunca subir de su caja |
| Las flechas tachaban el titular | Las anotaciones solo buscaban cercanía | La flecha no cruza textos y el rótulo deja una columna de aire |
| La pegatina tapaba el acento o el titular | Último recurso sin límite | Monta como mucho un tercio sobre el titular o el producto; si no, se quita |
| «ABA», «ESAYUN» | La palabra vertical sangraba y perdía letras | Zona segura y ancho de columna medido |
| Sello ilegible (mayúsculas de 20 px) | Radio fijo | Radio según el dato |
| «Trozo duplicado» sobre el pulpo | Vision fundía un segundo plato cortado por el borde | Máscara principal (cintura), como activo derivado |
| «Sin complejos» rechazado | El punto final quedaba pegado a la palabra | Arreglado en `normalizar` |
| Notas de 0 por errores medibles | — | Arreglos del código antes de la crítica: otra tinta, titular detrás, quitar la anotación que pisa |

## 7. Consumo

| Concepto | Valor |
|---|---|
| Llamadas a Hydrogen (estudio de arte) | 81 |
| Tokens de entrada | 701 000 |
| Tokens de salida | 74 000 |
| Tokens de razonamiento | 412 000 |
| Imágenes de Nano Banana Pro | 2, por 0,28 USD (una escena y un garabato) |

- No hay tarifa verificada de Hydrogen en el repositorio, así que no se estima su importe.
- El razonamiento pesa más que la salida. Si el coste importa, el crítico es el candidato a un modelo más barato: el director y el comparador son los que más aportan.
- En disco: `datos/arte/` ocupa unos 500 MB, porque guarda cada vuelta con sus capas. `datos/` no entra en git.

## 8. Lo siguiente, por orden

1. **Recargar créditos y correr r4:** el banco entero con todos los arreglos, `--vueltas 2`. Da la cifra que falta: nota y duelo a ciegas contra la pieza previa de cada local, y la prueba de plantilla entre locales.
2. **Bajar el coste por encargo:**
   - el crítico con menos razonamiento o un modelo más barato;
   - en la reparación, enviar la foto pequeña.
3. **Que el director use GARABATO y ESCENA con criterio:** las dos operaciones existen. Hay que medir en r4 si las elige y si suben la nota.
4. **Operadores que faltan del informe:**
   - texto en trayectoria;
   - collage con papel rasgado;
   - desregistro sobre la imagen;
   - composición 9:16 con zonas reservadas;
   - secuenciador de carrusel con esta receta.
5. **Prueba de transferencia (§6.3):** un local y un estilo que el sistema no haya visto.

---

## 9. Modo referencia y acabado con Nano Banana 2 (22/11)

**Contexto.** El flujo principal parte de un post de referencia que elige el cliente. El director tiene que estudiarlo y hacer una pieza que se le parezca mucho, con criterio propio, y mejor que ella. Después, un modelo de imagen secundario le da el acabado profesional. Ese modelo es Nano Banana 2, no el Pro, que es caro y se reserva para la foto del plato.

### 9.1 Qué se ha añadido

| Pieza | Qué hace |
|---|---|
| **Modo referencia** (`--referencia`) | Hydrogen estudia la referencia (imagen y ficha): qué la hace funcionar y qué es mejorable. Propone direcciones **hermanas**, cada una con su «parentesco» y su «mejora». Una adaptación literal cuenta como fracaso. El crítico suma la dimensión «referencia» (peso 20) y el comparador ve la referencia como listón. |
| **Esqueleto PATRON** (familia F2) | La palabra repetida, una por fila, ajustada al ancho con métricas reales, más el remate en la misma voz y color. El producto va girado delante, la marca entre filetes y el apoyo al pie. |
| **Acabado integral** (`--enriquecer`) | Hydrogen elige de 2 a 4 mejoras entre **fondo, sello o chip, elementos dibujados, luz y sombra, marco y acabado de impresión**. Nano Banana 2 las aplica sobre la pieza terminada. |
| **Protección** | El código restaura píxel a píxel el producto, los textos y el patrón. De cada sello protege solo sus letras: el «1932» puede pasar a etiqueta troquelada, pero la cifra no cambia. |
| **Métricas de gasto** | `npx tsx src/herramientas/arteMetricas.ts --gasto <fecha>` calcula el gasto en USD con las tarifas oficiales. |

### 9.2 Resultados

| Prueba | Qué salió |
|---|---|
| Análisis de la referencia | Muy bueno. Ejemplos: «el patrón es textura y titular a la vez»; «el remate y el pie son fórmulas de plantilla»; «el recorte sin sombra parece pegado». |
| Direcciones hermanas contra la pieza previa del local | Ganan 2 de 5 duelos (DAK en ref-r1 y ref-r2). Pierden los de Casa Aranda y la tercera corrida de DAK. |
| **Elementos aislados** (generados por separado y colocados por el código) | **Últimos en 5 de 5 comparaciones a ciegas**: salen densos y ensucian. Quedan desactivados por defecto (`--aislados`). |
| Solo trazos a mano, insertados en contexto | Ganan a la base en campo libre (Casa Aranda, 2 de 2) y pierden sobre un patrón tipográfico denso (DAK). |
| **Acabado integral** (fondo, sello, luz, acabado) | **Gana a ciegas en 3 de 3.** DAK sube de 69 a 80. En Casa Aranda la nota del crítico no sube (sus defectos son de maquetación), pero el comparador prefiere el acabado. |

Hojas:

- [acabado de DAK](../datos/arte/acabado-dak/dak-manhattan/enriquecida.jpg)
- [acabado de Casa Aranda (Eco)](../datos/arte/acabado-eco/casa-aranda-churros/enriquecida.jpg)
- [acabado de Casa Aranda (Prensa)](../datos/arte/acabado-prensa/casa-aranda-churros/enriquecida.jpg)
- [trazos en campo libre](../datos/arte/ref-r3/casa-aranda-churros/enriquecida-1.jpg)

### 9.3 Coste

| Concepto | Coste |
|---|---|
| Llamada a Hydrogen | Unos 0,05 USD (1,50 USD/M de entrada y 7,50 USD/M de salida, razonamiento incluido) |
| Imagen de Nano Banana 2 a 1K | 0,069 USD |
| Encargo con referencia, 2 direcciones y acabado de cada una | 1–1,3 USD |
| Acabado de una pieza ya hecha | Unos 0,25 USD |

### 9.4 Fallos encontrados y corregidos hoy

- **`sharp` devuelve 3 canales al leer en crudo una imagen gris.** La rejilla de la silueta salía con el triple de valores (en las corridas del 21/11 estaba mal leída), y la protección quedaba desalineada. Ahora se pide un solo canal y hay pruebas de regresión.
- **La máscara principal quitaba piezas del conjunto** (las tazas junto a los churros). Ahora solo quita objetos cortados por el borde de la foto.
- **PATRON:**
  - una REPETICION dentro duplicaba el patrón;
  - el remate largo cambiaba de color;
  - el apoyo dejaba un punto huérfano;
  - con voces condensadas salían solo 3 filas.

### 9.5 Pendiente

1. **Conectar el estudio al flujo principal** (`ordenPost`): la referencia del encargo pasa al estudio y el resultado vuelve como intención.
2. **Medir de nuevo el contraste de los textos tras el acabado:** si el fondo se oscurece, un texto restaurado puede perder contraste. Hoy solo lo ve el crítico.
3. **Maquetación de Casa Aranda:** el crítico insiste en dos cosas que el acabado no arregla, el producto demasiado grande y el titular separado del producto.

---

## 10. Lote de posts y carruseles con Nano Banana Pro (22/11)

**Para qué.** Medir el nivel estético actual del sistema con mucho material a la vez y de todo tipo: carteles, pero también el plato solo, el ambiente del local, gente celebrando, el proceso en cocina y los detalles. La foto principal se genera con **Nano Banana Pro** (por el MCP de Higgsfield); el director es Hydrogen y la maquetación la hace siempre el código.

### 10.1 Cómo funciona

```bash
npm run lote -- plan banco/arte/*.json --corrida lote-1   # Hydrogen planifica el lote de cada local
# (las fotos de pedidos.json se generan con Higgsfield y se dejan en <encargo>/generadas/<id>.png + <id>.json)
npm run lote -- componer --corrida lote-1 [--encargos a,b] [--visuales x,y] [--sin-reparar]
npm run lote -- evaluar --corrida lote-1                  # Hydrogen audita la hoja de cada local
```

| Paso | Qué hace |
|---|---|
| **Plan** | Por local: 3 posts de tipos distintos y 1 carrusel de 4 diapositivas, con un máximo de 5 fotos generadas. Cada visual dice si usa la foto real o una generada (con su prompt de fotógrafo) y lleva su receta. Todo texto tiene que estar en los hechos, como siempre. |
| **Prompt final** | Al prompt del director se le añaden tres cosas: la fidelidad al plato (la foto real va como `@image1` cuando sale el plato), el local, y la imagen sin texto. Desde hoy también: el aire para el texto tiene que salir de la escena, nunca de una franja vacía. |
| **Componer** | Las fotos generadas se registran como activos `SOLO_PRUEBA_COMPOSICION`, con su máscara de Apple Vision y su procedencia, y se comprueba que no traigan franjas planas. El código maqueta cada visual con su receta. **Si la receta no cabe en la foto real, o ya pintada tiene errores medidos, Hydrogen la repara viendo esa foto** (hasta dos vueltas). Las reparaciones se guardan y no se vuelven a pagar mientras no cambien ni la foto ni la receta del plan. |
| **Evaluar** | Hydrogen ve la hoja de cada local y puntúa cada pieza (0–4), con fortalezas, debilidades y un veredicto. |

### 10.2 Defectos encontrados al probar, y su arreglo

| Defecto | Arreglo |
|---|---|
| **La receta se planificaba antes de que existiera la foto generada:** 20 de 49 visuales no cabían en la foto de verdad. | `componer` repara con Hydrogen viendo la foto real, como el flujo normal (proponer → compilar → reparar). |
| **FOTO_A_SANGRE: el apoyo y la firma caían en la franja por la que el compositor mueve el titular hacia el plato** (Etxebarri: «PRODUCTO Y FUEGO» encima de «BRASA CON LEÑA», contraste 1:1). | Toda la franja `entre` del titular cuenta como ocupada. Prueba de regresión en `mecanismos.test.ts`. |
| **Texto pequeño sobre luces y sombras de la foto:** ninguna tinta llega a 4,5:1 y el arreglo del código solo probaba la otra tinta. | Sobre una foto a sangre, el arreglo pone velo oscuro en el lado del texto y tinta clara. |
| **Nano Banana Pro tomó «clean dark shadow space for typography» al pie de la letra** y pintó una franja negra plana del 29 % (Lo Güeno). | Hay una regla nueva en el prompt final, y `franjasPlanas()` avisa al componer. La foto se repitió y salió bien (2 créditos). |
| **REPETICION fuera de PATRON a contraste máximo** (Torre: negro sobre blanco a 21:1, con el apoyo y la firma ilegibles encima). Ningún invariante lo detectaba. | La repetición es fondo: si contrasta más de 2:1 con el campo, se mezcla hacia el campo hasta unos 1,45:1. |
| **Hydrogen no soltaba la firma ni el apoyo largos** aunque el código dijera que no cabían, porque las instrucciones dicen que la marca se reconoce por su firma. | La reparación dice ahora explícitamente qué sobra primero (el apoyo), que la firma puede ir corta o no ir, y que si nada cabe hay que cambiar de esqueleto. |
| **El almacén de diseños no sobrescribe versiones,** así que recomponer una pieza paraba el lote entero. | Cada composición va en su carpeta fechada, y un fallo en una pieza conserva su versión anterior. |
