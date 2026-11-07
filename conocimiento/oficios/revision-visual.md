---
nombre: revision-visual
resumen: Pintar, mirar y corregir con evidencia nueva; cómo se critica una diapositiva y un carrusel, y qué se aprende de cada valoración.
fases: revision, aprendizaje
formatos: post, carrusel, historia
---

# Revisión visual

Que las comprobaciones pasen es el suelo, no el listón. Una pieza no está terminada hasta que **se ha mirado el render** y se ha criticado como lo haría quien la va a rechazar.

## El ciclo

1. **Pintar** con `carrusel.ts` (o `componerDiseno`). Mientras se afina se usa `--borrador`; cuando una versión merece guardarse, se compone sin `--borrador` y queda inmutable, en vNNN.
2. **Leer los avisos del resolutor:**
   - zona segura;
   - tamaño mínimo;
   - ampliación de la foto (más de 1,6×);
   - contraste (WCAG en el peor 10 % de las letras);
   - fidelidad (activos que no se pueden publicar).

   Un ERROR se corrige. Un AVISO se razona.
3. **Mirar con evidencia nueva, no solo la hoja del autor:**
   - `carrusel.jpg`: la serie como se desliza;
   - `movil.jpg`: cada diapositiva a 390 px, como en el móvil;
   - **miniatura borrosa** (entrecerrar los ojos): ¿lo primero que se ve es el foco?;
   - **recortes al 100 %:** bordes de letra, fundidos, halos, la sal o las antenas;
   - **4:5:** que la exportación no corte nada;
   - **antes y después**, si se ha corregido algo medido en píxeles.
4. **Criticar** con la rúbrica (`rubrica.md`). Cada defecto con sitio, por qué importa y cómo se arregla. Se nombran también los aciertos que hay que proteger.
5. **Corregir y volver a mirar.**
   - Dos rondas de corrección sin resolver un defecto bloqueante son el aviso de que el problema está antes: en la idea, en la foto o en la herramienta. Se dice y se vuelve un paso atrás.
   - Un defecto que no arregla ningún parámetro puede pedir una capacidad nueva: por ejemplo el punto negro, cuando apareció un escalón entre la foto y el fondo.

## Qué mirar (lo que una comprobación no ve)

- **¿Dice una cosa?** ¿Se entiende la idea en tres segundos?
- **¿Dónde cae la vista primero?** ¿Y después?
- **¿Algo parece genérico?** (`antipatrones.md`)
- **Escalones de color** entre foto y fondo, halos de recorte, filos de máscara.
- **Texto sobre zonas con mucho detalle**, aunque el contraste pase.
- **El producto:** ¿apetece? ¿Tiene volumen? ¿Se ve turbio en el móvil?
- **En la serie:** ¿hay historia, ritmo, principio y final? ¿Sobra alguna diapositiva? ¿Alguna rompe la identidad?

## Decisiones buenas y malas (de la F1.5)

| Defecto encontrado mirando | Cómo se vio | Arreglo |
|---|---|---|
| Escalón horizontal en la portada de Etxebarri | A tamaño completo; en la miniatura no se veía | Punto negro de la foto = carbón de la marca (capacidad nueva) |
| El grano de sal se perdía en el móvil | `movil.jpg` | Más grande (casi tan alto como las mayúsculas) |
| La frase competía con una pata brillante | `carrusel.jpg` | Llevarla a la penumbra, junto a las puntas tostadas |
| Una mancha blanca desenfocada distraía en el macro | Recorte | Mover el encuadre |
| Qwen y Grok añadían sal | Recortes ampliados de `fidelidad.ts` | Descartar esas imágenes |

## Aprendizaje: qué se guarda y con qué peso

Toda valoración se guarda con **quién** la hizo (`dominio/aprendizaje.ts`):
- **HUMANA del dueño:** la única que forma preferencias de su marca.
- **HUMANA de la dirección del estudio:** forma el criterio del estudio, que vale para todas las marcas.
- **CRITICO** (esta revisión): pista, nunca preferencia.
- **DETERMINISTA** (medidas): dice si cumple, no si gusta.
- **AUTOMATICA** (scripts): no cuenta.

Los motivos se guardan estructurados: aspecto (idea, composición, tipografía, fotografía, fidelidad, personalización, texto), a favor o en contra, y las palabras de quien lo dijo.

Una observación es una hipótesis con una sola valoración humana. Pasa a «observada» con dos piezas distintas a favor y ninguna en contra, y a «confirmada» con tres piezas, o si el dueño lo dice como regla. Si hay valoraciones en los dos sentidos queda **en duda** y no se aplica hasta que el dueño lo aclare. Cuatro valoraciones no son una conclusión.
