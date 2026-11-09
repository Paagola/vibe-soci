---
nombre: composicion-y-tipografia
resumen: Diseño editorial y publicitario con el compositor; jerarquía, escala, espacio, tipografía y cómo escribir la intención.
fases: composicion, revision
formatos: post, carrusel, historia
---

# Composición y tipografía

La composición ejecuta la idea; no la sustituye. Se escribe como **intención** (`diseno/intencion@1`):
- capas;
- cajas en la retícula o en fracciones;
- relaciones;
- textos.

El compositor resuelve los píxeles, comprueba las reglas y pinta por capas.

## Jerarquía

- **Un foco por diapositiva.** Lo más grande y con más contraste es aquello para lo que existe la pieza. Dos focos son el máximo; tres son dos piezas.
- **Lo secundario baja de verdad:** mucho más pequeño, más ligero o con menos contraste. Si la firma casi iguala al titular, compite con él.
- **Tres niveles, y nada más.** Titular (una palabra o un logotipo tipográfico), un apoyo corto y la firma o un dato real. Es lo que repiten casi todas las referencias del usuario (`referencias/familias.md`). Cada dato aparece una vez y lo largo va al pie.
- **Entrecerrar los ojos:** en la miniatura borrosa, lo primero que se ve debe ser el foco (`revision-visual`).

## Escala y espacio

- **El protagonista es grande.** Un plato pequeño solo en un fondo vacío se lee como aire muerto, salvo que el vacío sea el mensaje.
- **El espacio negativo tiene función:**
  - si el vacío está pensado, transmite seguridad;
  - si el cuadro está lleno, transmite nervio;
  - si un cuadro se ve vacío por descuido, le falta trabajo (más producto, más escala), no adornos.
- **Contrastes de escala:** una frase monumental frente a una firma diminuta, o el producto a sangre frente a mucho aire. Generan tensión.
- **Asimetría con intención:** texto en bandera a la izquierda y producto cargado a un lado. El centrado se reserva para cuando hace falta (un cartel o un sello).

### Lecciones de la revisión de María, diseñadora (08/11/2026)

Salen de su revisión de los 4 posts de F1.6 (`diseno/f1_6/POSTS-F1-6.md` §10; antes y después en `diseno/f1_6/img/posts-f1-6-revision-maria.jpg`). Cada una cita la pieza de la que sale en `observaciones/estudio.json`.

- **Aire entre bloques y espacio repartido.** Dos textos apilados necesitan un hueco claro (el compositor avisa con `SEPARACION` por debajo de 0,35 cuerpos del más pequeño), y el espacio se reparte sin dejar zonas muertas arriba o abajo. «No tengas miedo a aumentar las distancias entre los elementos» (Mesón, Etxebarri).
- **Si la composición es simétrica, el producto va centrado.** Un producto desplazado en una composición centrada parece un error, no una intención («que el café no esté centrado es un delito capital»). La asimetría de arriba sigue valiendo cuando toda la composición es asimétrica.
- **El nombre del plato se lee entero y en orden.** Un juego tipográfico (palabra repetida, palabra detrás) no puede tapar ni desordenar el nombre: en DAK, «MANHATTAN» pasó arriba para que se leyera «MANHATTAN TOWER».
- **Dos textos enfrentados llevan el mismo peso alrededor.** Si a un lado hay dos elementos y al otro uno, el de los dos parece más bajo (Mesón, v005). Mejor un solo bloque.
- **Menos texto.** Cinco textos en el 40 % superior (Mesón) son demasiados: lo que sobra va al pie de la publicación.

## Relaciones entre texto e imagen

Es el vocabulario; ninguna es obligatoria y ninguna se repite por costumbre.

| Relación | Cómo se escribe | Úsala cuando… |
|---|---|---|
| El texto en el aire que deja la foto | Caja en la zona oscura y relación `noSolapar` | La foto tiene un vacío natural (claroscuro) |
| La palabra detrás del producto | Relación `detras` con cobertura por franjas | **Mecanismo aprobado** (ejemplos 02, 05 y 07; posts 3 y 12). Se adapta al producto; lo que no se repite es la pieza entera |
| El producto que se sale del marco | `recorte` con `alineadoCon` | El marco cuenta algo; si no, sobra |
| Un detalle del producto como signo | `recorte` con `trasTexto` | Un elemento real puede hacer de signo (el grano de sal como punto final) |
| Texto que señala la prueba | Caja junto al detalle | La frase nombra lo que se ve («brasa de leña» junto a las puntas tostadas) |
| Texto en curva | `circulo-texto` | Un sello con sentido (precio, fecha) |

## Tipografía

- **Dos familias como máximo.** Display para la frase y texto para la firma. La mono solo cuando la marca la pide.
- **El tamaño se pone para el móvil:** un lienzo de 1080 px se ve a unos 360–400 px. **La altura de mayúscula mínima es de 22 px en el lienzo** (por debajo, el compositor da error) y **los textos secundarios van a unos 34 px de cuerpo o más**, la firma incluida. Prueba: los 4 posts de F1.6 llevaban textos de 24–28 px y varias personas que los vieron dijeron que eran demasiado pequeños (08/11; `observaciones/estudio.json` → `texto-secundario-legible`).
- **Caja:**
  - frases en minúscula de oración cuando son frases (y la continuidad entre diapositivas lo agradece);
  - mayúsculas cuando la marca las pide o la palabra es un cartel.
- **Partición de líneas:** sin viudas y sin «de», «la» ni «y» al final de línea (lo hace el motor). Con `\n` cuando el sentido manda.
- **Puntuación con intención:** una coma al final de una diapositiva pide pasar a la siguiente, y un punto cierra.
- **Sin efectos:**
  - ni contorno ni sombra en el texto;
  - el peso, con una fuente que lo tenga de verdad.

## La retícula como soporte, no como molde

La retícula de 12 × 16 con 72 px de margen da alineaciones y márgenes iguales en toda una serie. No obliga a llenar columnas.
- **Fracciones del lienzo:** se pueden usar, y se puede sangrar a propósito.
- **Zona segura:** 4:5 dentro de 3:4. El texto queda dentro salvo que sangre adrede (`sangrado: true`).

## Capacidades del compositor (vocabulario)

- **Fondos:** relleno y degradado lineal o radial, con modos de fusión.
- **Foto:** con encuadre (`enfoque`, `zoom`) y retoque (brillo, contraste, saturación, calidez y punto negro).
- **Recortes:** con máscara (Apple Vision o umbral) colocados por escala y ancla, alineados con su foto o tras un texto.
- **Sombra:** proyectada o de contacto.
- **Texto:** con ajustes (ancho, alto, eje de anchura, caja o fijo), giro de 90°, contorno y en círculo.
- **Grano:** determinista.
- **Relaciones:** `detras`, `noSolapar` y `contrasteMinimo`.

**Añadir una capacidad nueva solo cuando una idea la necesita, y documentar por qué.** En la F1.5 se añadieron dos:
- `trasTexto`: el grano de sal como punto;
- `puntoNegro`: el negro de la marca en las fotos.

Pendientes que tendrían valor real cuando una idea los pida:
- texto que siga cualquier trazo (no solo un círculo);
- giros libres;
- máscara de una foto con una forma irregular;
- una capa vectorial libre (SVG con los colores de la marca) para recursos propios sin catálogo.

## Decisiones buenas y malas

| Mala | Por qué | Buena |
|---|---|---|
| Titular arriba y producto pequeño abajo, con aire muerto entre los dos (Etxebarri, borrador 1) | Es la plantilla de cartel de manual | El producto monumental sangra, y la frase vive en el aire oscuro, pegada a su borde |
| La frase encima de una pata naranja brillante (Etxebarri 2, borrador 2) | Compite con el producto y se lee peor | Moverla a la zona en penumbra, junto al detalle que nombra |
| El mismo tamaño de frase en todas las diapositivas | Plano, sin ritmo | El tamaño decrece y la posición baja: el ritmo es parte de la idea |
| Un grano de sal del tamaño de un punto tipográfico (Etxebarri 4, v1) | En el móvil no se ve, y la idea depende de verlo | Casi tan alto como las mayúsculas: se lee como un objeto que hace de punto |
| Etiquetas y líneas para «explicar» un plato (DAK B) | Parece una infografía | Una frase y la foto: lo que explica la foto no se escribe |
| Textos a 24–28 px y apelotonados contra el borde del papel (Etxebarri v005, Mesón v005) | No se leen en el móvil y el bloque parece apretado | 34 px o más y el aire repartido (v006, revisión de María) |
