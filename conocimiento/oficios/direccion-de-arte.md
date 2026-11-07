---
nombre: direccion-de-arte
resumen: Del restaurante y su mensaje a una idea, una dirección de arte y una narrativa, antes de tocar una sola capa.
fases: brief, concepto, composicion
formatos: post, carrusel, historia
---

# Dirección de arte gastronómica

El compositor sabe colocar, medir y pintar, pero no sabe diseñar. Este oficio decide **qué** se pinta y **por qué**. El orden importa: primero la idea y después la composición.

## Proceso

1. **El restaurante.** Lee el perfil (`marcas/<slug>/perfil.json`). Separa sus constantes, lo que lo hace reconocible, de sus variables, lo que puede cambiar en esta pieza. Mira el material real: qué fotos hay y qué se ve en ellas a resolución completa.
2. **Qué quiere comunicar la pieza.** Un mensaje que un desconocido pueda repetir. Si hacen falta dos, son dos piezas.
3. **Qué se puede decir.** Prepara el registro de afirmaciones (`texto-publicitario`). La idea solo puede apoyarse en lo documentado y en lo que se ve.
4. **Referencias pertinentes.** Dos o tres fichas de `referencias/`, y de cada una solo el recurso que sirve.
5. **La idea.** En una frase. Tiene que ser de uno de estos tres tipos:
   - **algo real mostrado**: el producto, su textura, la huella del fuego;
   - **una idea concreta**: una metáfora o un giro que solo esta pieza puede hacer;
   - **tipografía con intención**: el mensaje mismo, grande y exacto.
6. **La dirección de arte.**
   - El mundo cromático, a partir de la paleta de la marca.
   - La fotografía: la luz y el plano.
   - Las tipografías, con su papel.
   - Los recursos gráficos, que serán uno o ninguno.
   - Lo que **no** se va a hacer.
7. **La narrativa**, si hay más de una pieza o diapositiva: qué hace cada una y qué pasa de una a la siguiente.
8. **Qué fotos y recursos necesita la idea.** Primero la foto real. Si hay que generar algo, que sea con fidelidad (`fotografia-gastronomica`).
9. **La composición.** Cada diapositiva con su idea espacial propia, escrita como intención (`composicion-y-tipografia`).
10. **Ejecutar, mirar y corregir** (`revision-visual`). Una pieza no está terminada hasta que se ha mirado el render.

## La prueba de la idea

Quita mentalmente todo lo decorativo: líneas, etiquetas, sellos, degradados y texturas.
- Si lo que queda sigue diciendo algo, la idea es real.
- Si queda un titular sobre un fondo, era relleno.

Una pieza que pasa todas las comprobaciones y aun así parece genérica **no pasa**.

## Constantes y variables

| Constante (se mantiene) | Variable (puede cambiar) |
|---|---|
| Nombre y firma, paleta, tipografías y sus papeles, voz | Tratamiento fotográfico, escala, encuadre, posición del texto |
| Lo que el local no quiere (restricciones) | Grado de experimentación, dentro del margen del perfil |
| La fidelidad del producto | El recurso gráfico, que puede no haberlo |

La marca se reconoce por las constantes, y la pieza no se repite gracias a las variables. Si dos piezas del mismo local solo se diferencian en la foto, se ha hecho una plantilla.

## Restricciones, no plantillas

Las **restricciones** garantizan la calidad:
- legibilidad;
- contraste;
- zona segura;
- fidelidad;
- exportación.

Las **plantillas** limitan las soluciones y no se usan. El catálogo de capacidades del compositor es vocabulario, no menú: no se empieza eligiendo un «mecanismo». Se empieza por la idea y se busca la capacidad que la ejecuta. Si no existe y la idea lo vale, se construye.

## Carruseles

Un carrusel es una sola idea contada en secuencia. Cada diapositiva tiene que merecer el gesto de deslizar.
- **Lo que no puede faltar:** un principio (gancho), un desarrollo, algo que cambie la perspectiva y un final.
- **Continuidad:** se mantiene el sistema (paleta, tipografías y márgenes) y cambia la idea espacial de cada diapositiva.
- **Lo que hay que evitar:** cuatro diapositivas con la misma estructura y otra foto.
- **La portada** es la pieza más trabajada, porque es la que aparece en la cuadrícula.

## Decisiones buenas y malas (de nuestro trabajo)

| Mala | Por qué | Buena |
|---|---|---|
| DAK · B «Alzado»: líneas de nivel, alturas y rótulos («ático», «tercero») | Convierte la burger en un esquema técnico: es la estructura del compositor, no una idea publicitaria (valoración del estudio, 07/11/2026) | Etxebarri: el fuego no se dibuja con recursos, se cuenta con la huella real en el producto (las puntas tostadas) |
| DAK · C «Ventana»: foto enmarcada y titular vertical | Rígido: se nota que es un ejercicio de reglas | Etxebarri 1: producto monumental a sangre y frase en bandera en el aire oscuro |
| Repetir «palabra enorme detrás del producto» porque funcionó una vez | Una idea que se repite se convierte en plantilla | Buscar un recurso que nazca de este producto: el grano de sal como punto final |
| Contar el «viaje de Palamós a Axpe» | No hay datos de procedencia ni de transporte: sería inventar | Contar solo lo documentado: «gamba roja de Palamós, brasa de leña, sal gruesa y nada más» |
| Cuatro diapositivas con «foto + titular arriba» | Monotonía, aunque cambie la foto | La frase baja de la portada al pie y la cámara se acerca hasta un grano |

## Cómo se escribe una dirección

En `proyectos/<slug>/CONCEPTO.md`:
- la idea en una frase;
- las ideas descartadas y por qué;
- el mundo, la fotografía, la escala, la tipografía y los recursos;
- lo que no se hace;
- la narrativa, diapositiva a diapositiva;
- las referencias, con lo que se toma de cada una y lo que no.

La dirección se versiona: si la revisión obliga a cambiarla, se apunta qué cambió y por qué.
