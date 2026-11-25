---
nombre: fotografia-gastronomica
resumen: Dirección fotográfica, estilismo y retoque del producto, y cómo usar la IA para la luz y el entorno sin alterar el plato.
fases: concepto, fotografia, revision
formatos: post, carrusel, historia
---

# Fotografía gastronómica

El estudio de percepción y el ensayo de Café Albor explican cómo traducir una referencia a cámara, iluminación, materiales y sensación, con criterios para revisar la toma. [Método y ejemplos](../../diseno/ensayo-fotografia/README.md)

Una buena dirección de arte no sale de poner una tipografía bonita sobre una foto mediocre. La foto decide más que cualquier otra capa. Este oficio decide **qué foto necesita la idea** y cómo conseguirla sin traicionar el plato.

## Lo que se controla, por separado

Hay que pensarlo por separado y escribirlo por separado en el prompt. «Premium» no dice nada.

| Control | Preguntas | Opciones habituales |
|---|---|---|
| Luz | ¿De dónde viene? ¿Es dura o suave? ¿De qué color? | Una lateral baja y cálida (brasa); cenital suave (mesa de día); flash directo (energía y pop); contraluz (vapor, brillo) |
| Ángulo | ¿Qué muestra mejor la forma del plato? | A ras de mesa (altura, capas); tres cuartos (volumen); cenital (composición del plato) |
| Profundidad | ¿Qué está nítido y qué se va? | Diafragma abierto para aislar; cerrado para una mesa completa |
| Superficie y contexto | ¿Sobre qué está y qué cuenta eso? | La mesa real del local, una superficie neutra o el entorno en penumbra |
| Atmósfera | ¿Qué temperatura y cuánta sombra? | Claroscuro, luz de día o noche con neón |
| Estilismo | ¿Qué hay en el plato y cómo está? | **Lo que hay y nada más.** La colocación puede cambiar si se mantiene el número de piezas; no se añade ningún componente |

## Foto nueva, no foto mejorada

El hostelero sube fotos hechas con prisa: mal ángulo, mala luz, poca calidad y desorden alrededor. **El trabajo es fotografiar de nuevo el mismo plato**, no retocar su foto:
- con el ángulo, la óptica, la luz y el encuadre de un fotógrafo profesional;
- distinto en cada diapositiva de un carrusel.

Recortar o ampliar una sola foto no sustituye a una toma nueva. Es el error de `biblioteca/ejemplos/01` y del carrusel de la F1.5.

**Prueba:**
- en `ejemplos/01`, «la misma foto con más calidad» no gustó, y la corrección cambió la cámara;
- en el MVP (03/11), la pieza de Grok con el patrón de abajo consiguió una toma a ras de mesa con «BRASA» detrás, y la de Marketing Studio con «recrea el plato exacto» repitió el ángulo (`diseno/f1_6/img/mvp-via-integrada.jpg`).

**Otra toma, no la misma (regla del 09/11/2026, en `dominio/fotoNueva.ts` → `esOtraToma`):** la altura de la cámara cambia más de 30°, o cambian al menos dos de: el lado (girar 45° o más alrededor del plato), la distancia (otro tamaño de plano) y la altura (15° o más).
- **Por qué no basta «más de 30°»:** la burger de DAK se subió a unos 5°, que ya es el ángulo clásico de una burger. Subir 30° la convierte en otro plato peor; girar y acercarse da una toma nueva.
- **Prueba:** en el benchmark, un ¾ a 25° sobre un ¾ a 45° volvió a la foto subida (4 imágenes). DAK y Mesón fallaron la regla de 30° dos veces cada uno (07/11).
- **Ojo:** pedir un giro no garantiza que salga. En DAK, intento 3 (09/11), salieron la distancia y la altura, pero la burger siguió frontal. Por eso el resultado se comprueba aparte, preguntando lado a lado si es el mismo punto de vista.

## Empezar por lo que ya gustó (observación del 07/11/2026)

Antes que cualquier referencia externa, el prompt sale de los **ejemplos que gustaron del mismo local o del mismo plato** (`biblioteca/ejemplos/`, los marcados «GUSTÓ»). La referencia externa solo añade lo que esos ejemplos no tienen; nunca sustituye su aspecto.
- **Prueba:**
  - S1–S3 se escribieron tomando la pared de pizarra de post-11 como estilo y no gustó ninguna;
  - V1 (el prompt del usuario de `ejemplos/03`, tal cual) y V3 (la misma estética desde otro ángulo) gustaron mucho.

  Son pocas imágenes: 3 frente a 2 (`diseno/f1_6/METODO-SOCIETY.md`, tanda 2).
- **Para probar un método** (el de Society, por ejemplo), sus piezas se añaden **de una en una** al prompt que gustó. Reescribirlo entero (V2) perdió la cámara y no enseña qué falló.

## Clave baja con entorno real (observación con POCAS imágenes, no regla)

Lo que parece separar las fotos que gustaron de las que no **no es la oscuridad sola**, sino la clave baja **junto con un entorno real**:
- una superficie que se lee (el mantel en V1, el roble quemado con veta en V3);
- una luz con una fuente clara (el contraluz estrecho en V1, el foco lateral rasante en V3);
- una cámara baja y cercana.

**Con qué imágenes se apoya, y son muy pocas:**
- gustaron 2: V1 y V3;
- no gustaron 12: las 8 del benchmark, oscuras (46–71 % de sombras) pero sobre un vacío de carbón liso, y 4 claras (S1–S3 y V2).

La saturación no separa unas de otras. **Puede cambiar con la próxima imagen:** se revisa en cuanto haya más fotos valoradas.

## La cámara se describe por su resultado visible (observación del 07/11/2026)

Además de los grados y la óptica, el prompt dice **qué se ve** desde esa cámara. Por ejemplo: «the camera almost touching the tablecloth so the frosted glass plate is seen nearly edge-on», o «every cup is a perfect circle».
- **Funcionó en 2 de 4 posts** (07/11):
  - Etxebarri, intento 2: a ras de mesa;
  - café, intento 2: cenital.
- **No bastó en DAK ni en Mesón**, intento 2: cuando la foto subida ya es una buena foto de producto, el modelo vuelve a su geometría.
- **En el cenital del Mesón** (intento 3, 09/11) funcionó. En DAK, intento 3, el giro no salió.

Es una ayuda, no una garantía.

## Recorte nítido de arriba abajo (revisión de María, 08/11/2026)

Un plato que se va a recortar (palabra detrás, patrón) pide **profundidad de campo amplia: f/8–f/11 y «every layer in sharp focus»**. Con f/4, el pan de arriba de DAK salía borroso y se notaba en el recorte.
- **Comprobado en 1 imagen:** DAK, intento 3 (09/11), con f/11 salió nítida de arriba abajo.

## Fidelidad (decisión del 07/11/2026; sustituye a la del 06/11)

**Por defecto, FLEXIBLE** (`marcas/<slug>/perfil.json` → `fidelidad`):
- **Cambian:** la cámara, la óptica, la luz, el fondo, el mantel, el encuadre y la colocación.
- **Se conservan los elementos:**
  - qué plato es;
  - **cuántas piezas** hay;
  - la anatomía correcta;
  - los ingredientes y su estado (sal gruesa, puntas tostadas);
  - **la vajilla**.
- **Se descarta la imagen** si añade un componente nuevo (guarnición, limón, hierbas, sal donde no la había, otra pieza).
- **No se descarta** si solo cambian la luz o el brillo.

**ESTRICTA**, solo si un local lo pide: además se conserva el ángulo, y para otro ángulo se pide al restaurante una foto nueva con una guía visual.

## Manual de foto nueva (de `ejemplos/01–06` y del MVP)

1. **El papel de la foto.** «@image1 is a real photo of <plato> at <local>. **Use it only as the list of elements, not as a layout to copy.**» Nunca «keep the pose», «same composition» ni «recreate the same»: dan el mismo ángulo.
2. **La lista cerrada de elementos:**
   - cuántas piezas («exactly two whole prawns»);
   - qué partes («heads, long thin antennae, legs»);
   - su estado («coarse salt, light grill marks»);
   - la vajilla («the square pale frosted glass plate»);
   - el cierre: «**Correct anatomy. Nothing else added.**»

   Lo que **no** se reproduce: manchas, bordes de otros platos y objetos ajenos.
3. **Cámara en números:**
   - altura en grados sobre la mesa: 10° a ras, 15–25° bajo, 40–45° comensal, 90° cenital;
   - óptica y diafragma: 35 mm ambiente, 85–100 mm producto o macro, f/2.8–f/4;
   - distancia o encuadre;
   - formato vertical.

   El ángulo tiene que ser **distinto del original**, y hay que decir cuál tenía («Image 1 is shot from high above»).
4. **Composición:** dónde va el producto, qué cruza el cuadro y qué hueco se reserva para el texto.
5. **Luz:**
   - fuente, dirección y caída;
   - fondo con HEX;
   - «<color> the only strong colour».

   Si hace falta, una segunda imagen como referencia de luz («Lighting like Image 2»).
6. **Foco y textura:** punto de foco, profundidad de campo, grano y «real texture, nothing plastic».
7. **El texto:**
   - por capas (vía B): «no text, no letters»;
   - integrado (vía A): el texto exacto entre comillas, «spelled exactly, with accents» y ninguna otra palabra.
8. **Varias fotos subidas:** todas como referencias de identidad (hasta el máximo del modelo).

**Protocolo con Higgsfield (API):**
1. Antes de pedir, `generarActivo.ts --solo-estimar`. La receta queda versionada en el proyecto y el gasto, en `datos/gasto/higgsfield.jsonl`.
2. **Enumerar lo que no se puede añadir:** guarnición, limón, hierbas, salsa, sal extra, humo, llamas, texto y logotipo. Los modelos tienden a añadirlos.
3. **Comprobar los componentes** con recortes lado a lado y **veredicto humano**. En la F2 sustituye a la medida de bordes, que solo sirve para comparar la misma geometría y se confunde con la luz.
4. **Solo pasa a PUBLICABLE lo aprobado.**

**Lo aprendido al volver a iluminar la gamba con el mismo ángulo (F1.5, 07/11/2026).** Es útil para saber qué modelo conserva la geometría, pero aquello no era una foto nueva:

| Modelo y prompt | Resultado | Veredicto |
|---|---|---|
| Qwen Image 3 Edit, 2K | Mueve y agranda las gambas, añade sal y pinta un foco en el plato | ALTERA (correlación 0,447) |
| Grok Image 2.0, 2K | Conserva la pose, pero añade una purpurina de sal fina | ALTERA (0,417) |
| Marketing Studio 2.0, 2K, luz «penumbra» | Conserva todo; la luz queda plana | CONSERVA (0,656) |
| Marketing Studio 2.0, 2K, claroscuro duro | Conserva; drama real, pero las colas se pierden | CONSERVA (0,512, desplazamiento 0) |
| Marketing Studio 2.0, 4K, claroscuro duro | **Redibuja la cabeza y las patas** | ALTERA (0,087) |
| Marketing Studio 2.0, 4K, claroscuro con relleno | Conserva; el plato queda beis y apagado | CONSERVA (0,674) |

Lecciones:
- el mismo modelo y el mismo prompt a otra resolución pueden alterar el producto, así que **cada imagen se comprueba**;
- la medida detecta sola los cambios grandes (0,087);
- los pequeños (sal añadida) solo se ven en los recortes.

## Combinar en lugar de regenerar

Si una imagen tiene la luz y otra el detalle, y las dos conservan el producto y están alineadas, `combinarLuz.ts` toma las frecuencias bajas (la luz) de una y las altas (el detalle) de la otra. Es determinista, no cuesta nada y no inventa nada. Limita la ganancia para que no salgan halos. Así se hizo la foto de campaña de Etxebarri sin pagar una tercera generación.

## Retoque en el compositor

- **Punto negro:** el negro más profundo de la foto pasa a ser el negro de la marca (p. ej. el carbón #111111). Así la foto y el fondo liso comparten negro y no hay escalones (`retoque.puntoNegro`).
- **El mismo retoque para todas las fotos de una campaña:** la coherencia de la luz es la de la serie.
- **Aclarar o oscurecer zonas** con degradados en «luz suave» sobre el producto. Con mesura: es retoque, no efecto.

## Decisiones buenas y malas

| Mala | Por qué | Buena |
|---|---|---|
| Pegar el producto real (con luz de día) sobre un entorno generado de noche | La luz no casa y se nota recortado (prueba de Etxebarri, descartada) | Volver a iluminar la foto entera y comprobar la fidelidad |
| Recortar con una máscara que pierde las antenas | Quita elementos visibles del producto | Generar la foto nueva sobre un fondo controlado (carbón liso o croma) para que la máscara salga limpia |
| Cuatro recortes de una misma foto como carrusel (F1.5) | No hay fotografía nueva: la diapositiva 3 era una ampliación de 1,5× con detalle inventado | Una toma nueva por diapositiva, cada una con su ángulo, luz y distancia |
| Generar el fuego o la parrilla «del local» | No hay foto ni datos: se presentaría como real algo inventado | Contar el fuego por su huella real (puntas tostadas, brillo) |
| Ampliar un macro más de 1,6× | Se ve blando en el móvil | Encuadrar más abierto o pedir una foto con más resolución |
| Generar la imagen completa con el texto dentro | El texto sale mal y no se puede editar | La IA hace la foto; el compositor, el texto (separación foto y diseño) |
