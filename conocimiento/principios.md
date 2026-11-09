---
nombre: principios
resumen: Por qué una composición funciona; cada principio dice si es una regla comprobable o un criterio que se pondera, y de dónde sale.
fases: concepto, composicion, revision
formatos: post, carrusel, historia
---

# Principios

Cada principio es una de dos cosas:
- **Regla:** se comprueba con una medida o una fuente pública.
- **Criterio:** por defecto se sigue, pero una buena razón lo cambia, y la razón se escribe.

La marca está por encima de los criterios, y lo que pide el dueño en una pieza está por encima de todo, salvo la veracidad y la fidelidad.

## Idea

1. **Primero la idea y después la composición.** Una pieza sin idea es decoración, aunque esté bien compuesta. *Criterio (design-agent, «concept gate»; valoración del estudio del 07/11/2026 sobre la F1).*
2. **Una composición geométricamente correcta no es una composición interesante.** Las reglas evitan errores; el interés lo da la idea. *Criterio (valoración del estudio, 07/11/2026).*
3. **La repetición tiene que ser intencionada.** Un recurso que se repite en todas las piezas se convierte en plantilla. Una repetición dentro de una pieza (la palabra repetida, la misma frase en serie) puede ser la idea. *Criterio.*
4. **No toda pieza necesita titular.** A veces la foto lo dice todo y basta con la firma. *Criterio.*

## Atención

5. **El contraste dirige la atención.** La vista va primero a lo de más contraste de tono, tamaño o color. Si no es el producto, la jerarquía está mal. *Criterio; se comprueba con la miniatura borrosa.*
6. **Un foco por cuadro y dos como mucho.** *Criterio (design-agent, «attention demands»).*
7. **El titular no compite con el producto sin motivo.** Si los dos piden la mirada a la vez, que sea la idea (tensión buscada), no un accidente. *Criterio.*
8. **El texto se lee en el móvil:** altura de mayúscula de 16 px o más en el lienzo de 1080 (se mide) y contraste WCAG de 3:1 para texto grande y 4,5:1 para pequeño (W3C WCAG 2.1, 1.4.3). *Regla.*

## Espacio y escala

9. **El espacio negativo tiene una función:** respirar, aislar o ser el mensaje. Si no tiene ninguna, falta trabajo. *Criterio (el «Think Small» de DDB para Volkswagen, 1959, es el ejemplo canónico).*
10. **El contraste de escala da tensión:** lo monumental junto a lo diminuto. *Criterio.*
11. **Una composición asimétrica puede dar tensión.** La simetría transmite calma y se reserva para cuando es la idea. *Criterio.*
12. **Variar la idea espacial y mantener el sistema.** En una serie cambian la escala, el encuadre y la posición del texto; los márgenes, las fuentes y la paleta se quedan. *Criterio (design-agent, «vary the spatial idea, not the system»).*

## Fotografía

13. **Una foto necesita una luz coherente.** Si en una misma imagen hay dos luces distintas (un producto pegado de otra foto), el ojo lo detecta aunque no sepa decir por qué. *Criterio; comprobado en la F1.5 con el híbrido descartado.*
14. **El negro de la marca es el negro de las fotos.** El punto negro de cada foto se lleva al negro de la marca para que fondo y foto no hagan escalón. *Criterio (F1.5).*
15. **No toda foto necesita un fondo artificial.** La mesa real del local también cuenta algo. *Criterio.*
16. **Los elementos del plato mandan; la foto no.** Se conservan qué es, cuántas piezas hay, la anatomía, los ingredientes y la vajilla. Cambian la cámara, la luz, el fondo y el encuadre (FLEXIBLE por defecto; ESTRICTA si el local lo pide). *Regla (decisión del 07/11/2026, que sustituye a la del 06/11).*
16b. **Foto nueva, no foto mejorada.** Cada pieza (y cada diapositiva) es una toma nueva del plato, nunca la foto del hostelero retocada, recortada o ampliada. *Regla (`ejemplos/01`; valoración del 07/11/2026).*
16c. **Los mecanismos aprobados se adaptan, no se descartan.** Lo que no se repite es la pieza entera. *Regla (valoración del 07/11/2026).*

## Marca

17. **La tipografía comunica personalidad:**
    - una grotesca condensada de cartel de madera dice artesano y sobrio;
    - una condensada ultranegra dice canalla;
    - una serif de alto contraste dice ceremonia.

    *Criterio.*
18. **Los recursos gráficos tienen que pertenecer al universo de la marca.** Un sello, una tira de cuadros o una flecha a mano solo si el local habla así. *Criterio.*
19. **Reconocimiento y variedad:** se reconoce por las constantes (paleta, tipos, voz, firma) y no aburre gracias a las variables (luz, escala, recurso). *Criterio.*
20. **Nada que no conste.** Ni premios, ni historia, ni técnica, ni datos comerciales. *Regla.*

## Texto

21. **Tres niveles como máximo.** Titular, apoyo y firma o dato real. Cada dato una vez; la explicación va al pie. *Criterio (las 29 referencias del usuario; design-agent).*
22. **La puntuación también narra.** Una coma pide seguir y un punto cierra. *Criterio (F1.5).*

## Fuentes

- design-agent de LangChain, Apache 2.0 (estudiado el 07/11/2026): `skills/brand-design`, `skills/design-wiki` (hierarchy-and-layout, typography, review-rubric), `skills/stills`, `skills/image-generation`, `docs/spec.md` §11.3. Ver `diseno/f1_5/INVESTIGACION-DESIGN-AGENT.md`.
- W3C, WCAG 2.1, criterio 1.4.3 (contraste mínimo).
- Fichas de `referencias/`.
- Valoraciones del estudio sobre la F1 (07/11/2026), en `observaciones/estudio.json`.
