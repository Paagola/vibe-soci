---
nombre: fotografia-gastronomica
resumen: Dirección fotográfica, estilismo y retoque del producto, y cómo usar la IA para la luz y el entorno sin alterar el plato.
fases: concepto, fotografia, revision
formatos: post, carrusel, historia
---

# Fotografía gastronómica

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
| Estilismo | ¿Qué hay en el plato y cómo está? | **Lo que hay y nada más.** El estilismo de una foto real no se cambia con IA |

## Fidelidad ESTRICTA (por defecto)

Sin autorización del dueño no se cambian:
- los ingredientes;
- la presentación;
- la geometría del plato;
- la vajilla.

Con IA solo se puede tocar **la luz, el entorno y el contexto**, y siempre comprobándolo. Si la idea necesita otro ángulo, se pide al restaurante una foto nueva con una guía visual; no se genera otro ángulo.

**Protocolo con Higgsfield (API):**
1. Antes de pedir, `generarActivo.ts --solo-estimar`. La receta queda versionada en el proyecto y el gasto, en `datos/gasto/higgsfield.jsonl`.
2. Pedir **la misma proporción que la foto de entrada** y decir «no recompongas, no recortes, no redibujes». Si cambia la proporción, el modelo recompone.
3. Enumerar lo que no se puede añadir: guarnición, limón, hierbas, salsa, sal extra, humo, llamas, texto, logotipo. Los modelos tienden a añadirlos.
4. Comprobarlo con `fidelidad.ts`. La herramienta mide la coincidencia de bordes en la zona del producto y saca recortes ampliados lado a lado (cabezas, sal, patas, antenas, colas). **La medida avisa, y el veredicto lo da quien mira.** Si es ALTERA, la imagen se descarta.
5. Solo una imagen con veredicto CONSERVA pasa a PUBLICABLE.

**Lo aprendido con la gamba de Etxebarri (07/11/2026):**

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
| Recortar con una máscara que pierde las antenas | Quita elementos visibles del producto | Si la máscara no sirve, no recortar: componer con la foto entera |
| Generar el fuego o la parrilla «del local» | No hay foto ni datos: se presentaría como real algo inventado | Contar el fuego por su huella real (puntas tostadas, brillo) |
| Ampliar un macro más de 1,6× | Se ve blando en el móvil | Encuadrar más abierto o pedir una foto con más resolución |
| Generar la imagen completa con el texto dentro | El texto sale mal y no se puede editar | La IA hace la foto; el compositor, el texto (separación foto y diseño) |
