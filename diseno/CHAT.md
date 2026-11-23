# El chat del estudio

Toda la web es un chat (`npm run estudio` → http://localhost:4321). Se habla con el director (Hydrogen) y todo lo demás
aparece como tarjetas dentro de la conversación: formularios rápidos, progreso y resultados. Debajo del campo, la
**bandeja** tiene todo lo que sabe hacer el estudio, por grupos.

## Cómo se usa

- **Portada:** el orbe. Escribes lo que quieres, el orbe piensa mientras responde el director y la respuesta se
  despliega; después sigues en el chat. Con «Subir la foto del plato» empiezas directamente con la foto.
- **Con la foto:** el director propone la ficha del plato (local, plato, lo que se ve, el mensaje). La corriges y la
  confirmas: los textos de las piezas solo dirán lo que pone ahí.
- **Estética de referencia (antes de cada post o carrusel nuevo):** el estudio junta candidatas y eliges una con
  «Usar esta», «Decide tú» (la mejor de Pinterest) o «Sin referencia»:
  - **Pinterest:** 2–3 búsquedas que propone el director (o unas por defecto). Hydrogen mira las ~30 miniaturas y se
    queda con hasta 6 posts *diseñados*, con una frase de qué oficio enseña cada uno; descarta fotos sueltas, mockups
    y marcas de agua.
  - **Del local:** sus piezas ya hechas en el chat, los encargos exportados y sus referencias registradas.
  - **Del estudio:** la biblioteca (por palabras del plato) y el corpus anotado del tipo de local.

  La elegida pasa a ser la referencia de la conversación: el planificador toma su oficio, no su contenido. Además, el
  planificador recibe siempre las piezas ya hechas para ese local («YA HECHAS PARA ESTE LOCAL») para no repetirse.
  Las imágenes de Pinterest se guardan en `datos/chat/<id>/referencias/` y nunca se publican. Si la búsqueda falla, la
  pieza se planifica igual. `CHAT_SIN_REFERENCIAS=1` desactiva el paso. Coste: una llamada de visión a Hydrogen
  (céntimos).
- **Piezas:** pide un post o un carrusel con tus palabras o desde la bandeja. Ves el plan (cada diapositiva con su foto
  nueva y su diseño, o «foto sola, sin texto») y el coste antes de producir. Los cambios se piden en el chat («la
  tercera más oscura»). Cómo se producen, en «Producción con criterio», más abajo.
- **El director abre herramientas solo:** «quítale el fondo a esta foto» abre «Recortar el plato» con la foto puesta.
- **La rueda:** los carruseles y los resultados con varias imágenes se ven en la rueda (pulsa «Ver en rueda» o una
  imagen). Las referencias de la biblioteca se eligen también en la rueda.

## Qué hay en la bandeja (y de dónde sale)

| Grupo | Herramienta | Qué es | Antes estaba en |
|---|---|---|---|
| Crear | Post o carrusel | Plan con fotos nuevas (Nano Banana Pro) y diseño del estudio de arte | chat (23/11) |
| Crear | Encargo paso a paso | La orden completa: post y carrusel editorial (toma nueva con otro ángulo y luz), cartel integrado, por capas con el productor y con el director F3. Con sus fichas de siempre dentro de la tarjeta | `pase.html` (editorial, integrado, capas); F3 solo con `npm run post` |
| Crear | Direcciones de arte | Direcciones hermanas de una referencia, crítica, comparación a ciegas y acabado con Nano Banana 2 | `npm run arte` |
| Crear | Lote de contenido | Tres posts y un carrusel de tipos variados, fotos nuevas y auditoría | `npm run lote` |
| Crear | Auditoría estética | Hydrogen puntúa las piezas a tamaño de móvil | `npm run lote -- evaluar` |
| Fotos | Foto nueva | Una toma con Nano Banana Pro (con el plato real de referencia) | `generarGeminiImagen` |
| Fotos | Recortar el plato | Máscara de Apple Vision y PNG transparente | `crearMascara` |
| Fotos | Combinar luz y detalle | La luz de una foto y el detalle de otra (pide tu veredicto de fidelidad) | `combinarLuz` |
| Fotos | Extraer un detalle | Un detalle real recortado por brillo | `extraerDetalle` |
| Fotos | Comprobar fidelidad | Correlación de bordes y recortes lado a lado | `fidelidad` |
| Fotos | Foto de móvil con prisa | Degrada una foto para probar el estudio | `degradarFoto` |
| Fotos | Papel rasgado | Recurso procedural | `papelRasgado` |
| Tipografía | Muestras de estilos | Cada estilo especial con la fuente y los colores del local | `npm run muestras-tipo` |
| Tipografía | Sugerir tipografía especial | El buscador (Fase B): qué estilo casa, con razones | worktree `wt-fase-b`, sin commit |
| Tipografía | Crear un estilo | El creador (Fase C): receta → muestras → OCR → crítica, hasta 4 rondas; queda en PRUEBA | worktree `wt-fase-c`, sin commit y sin el bucle (hecho ahora) |
| Tipografía | Aprobar o retirar un estilo | La puerta humana | — |
| Referencias | Elegir una referencia | La biblioteca del estudio, en la rueda | fichas de `pase.html` |
| Referencias | Analizar una referencia | Ficha automática (y aviso de mockups) guardada en el local | analista de la orden |
| Local | Dar de alta un local | Marca, tokens y fuentes | panel antiguo (`index.html`) |
| Local | Gasto | Imágenes de Gemini del mes frente al tope, y texto de Hydrogen | — |

Además, al crear un encargo se pueden marcar tres opciones que la orden tenía y la web no enseñaba: la referencia como
estilo para el generador (@image2), el titular creativo y las fotos de más del dueño para los detalles de un carrusel
F3.

## Producción con criterio (23/11)

El chat produce como se hicieron las mejores piezas del estudio: el cartel de DAK (modo referencia, crítica y acabado),
el carrusel de la ensalada (fotos pedidas para su maqueta y una sola sesión) y el Taller del Pase (portada primero,
revisión de cada toma). Hasta ahora planificaba todo a ciegas y lo maquetaba sin mirar; por eso una foto con aire
acababa convertida en un plato pequeño recortado sobre un color liso.

1. **La referencia, como hermana.** Al elegir la estética, el director la analiza (su ficha: familia, retícula, capas,
   tipografía, paleta; y si es un post de verdad o un mockup). El plan toma su ESTRUCTURA y la mejora («parentesco» y
   «mejora» en la receta); no sus textos ni su plato. La referencia llega también al crítico y al comparador.
2. **El concepto, antes del plan** (23/11). El director propone tres maneras distintas de contar el plato: historia,
   fotografía (puede incluir tomas sin el plato: fuego, cuchillo, manos, local) y titular de portada. Eliges uno o
   «Decide tú», y el plan lo sigue lámina a lámina. Sin este paso, Hydrogen y Argon planificaban el mismo carrusel
   (mismas cinco tomas y hasta el mismo cierre, «Comida en familia»): el límite de la creatividad era el sistema, no
   el modelo. La **portada lleva siempre un titular creativo** (hasta 4 palabras, con idea, sin cifras ni reclamos);
   describir el ingrediente («Rojo jugoso») lo devuelve el código.
3. **Fotos pedidas para su maqueta.** El planificador dice en cada prompt dónde queda el aire y cuánto, en el lado del
   titular; no mete atrezo de la foto real (botellas, copas) salvo que se pida; y puede marcar láminas «solo foto».
4. **Una sesión.** La primera toma se genera sola; las demás la reciben como referencia de continuidad (misma mesa,
   luz, vajilla y paleta; otro encuadre).
5. **Revisión de cada foto.** El director la mira junto a la foto real y la toma anterior: si el plato no es el mismo,
   sale algo que no se pidió o no hay aire, la repite una vez con su corrección. Si la foto ya es la pieza, decide que
   vaya sin texto (nunca la portada de un carrusel).
6. **Maquetación sobre la foto real.** El titular va en el aire de verdad de la foto, buscado celda a celda (también al
   lado o en una esquina, no solo encima o debajo del plato). Una reparación que pase de foto a sangre a plato
   recortado sobre color se rechaza; si el texto no cabe sin tapar una foto nueva, va la foto sola.
7. **Crítica y acabado.** Salvo en «rápido», cada lámina con texto pasa por el crítico (y su parche solo se queda si
   gana a ciegas). El acabado de Nano Banana 2 (fondo, luz, sello, marco, impresión; el código restaura producto y
   textos) va en la portada en «normal» y en todas en «máximo», y solo se queda si gana a ciegas a la versión limpia.
8. **Nada de dominante amarilla.** Es lo que delata una foto de IA (Torre de Vega, 23/11: blancos con R−B de 107 y
   135; la foto real, 11; el carrusel de la ensalada, 6–11). Los prompts piden luz de día neutra y el código quita
   «warm», «golden» o «amber» de la luz (respeta el «golden-brown» de la comida). Cada foto se mide en sus blancos
   (`adaptadores/imagen/dominante.ts`): hasta 30, neutra; hasta 90, la neutraliza el código antes de que la mire el
   director; por encima, se repite con la corrección en el prompt. El acabado de Nano Banana 2 tiene prohibido
   calentar la pieza.
9. **El carrusel como serie** (Torre de Vega, 23/11: el despiece acabó siendo una segunda portada y el cierre se quedó
   sin firma):
   - portada y cierre siempre con texto, y como mucho N−2 láminas solo foto (lo comprueba el plan y lo respeta el
     director al ver las fotos);
   - un parche del crítico o una reparación no puede convertir una lámina en la maqueta de otra;
   - si la maqueta pedida no cabe en la foto nueva, antes de la foto sola se prueba la foto a sangre con el titular y
     la firma en el aire real de la foto.
10. **El titular se lee en el móvil.** El OCR (Apple Vision, en local) lee cada pieza a 360 px; si no lee el titular
   (un hueso o una botella lo tapa), es un problema que se repara, no un aviso. Tolera una letra mal leída.
11. **Repetir con criterio.** En el segundo intento de una foto, el director la compara con el primero y, si salió
    peor, se queda el primero. También repite una toma que copie el encuadre de la anterior de la sesión.
12. **Decisiones a la vista.** Lo que decidieron los agentes (foto repetida y por qué, lámina sin texto, reparación
   rechazada, acabado ganador) sale en el visor de cada lámina y en el mensaje de entrega.

Las láminas se maquetan de tres en tres. Código: `producir` en `servicioChat.ts`, `componerVisual` en
`aplicacion/arte/pieza.ts`, `aireReal` en `dominio/diseno/mecanismos.ts`, `revisarFoto` en `EstudioArteGemini.ts`.

**Modelos.** El director del chat (plan, conceptos, revisión de fotos, crítica, comparación) es el de
`GEMINI_MODELO_ARTE` en `.env`: `gemini-4-argon` desde el 23/11 (antes Hydrogen). Las fotos del plato, con Nano Banana
Pro; el acabado y los recursos gráficos, con Nano Banana 2. Los textos explicativos que se pasan de largo (idea,
parentesco, mejora) se recortan en lugar de rechazar el plan.

## Cómo está hecho

- **Servidor:** `src/aplicacion/chat/servicioChat.ts` (la conversación, el director y las tarjetas),
  `src/aplicacion/chat/herramientas.ts` (el catálogo) y `src/web/herramientasChat.ts` (quién ejecuta cada herramienta:
  la mayoría lanzan la misma orden de `src/herramientas/` que en la terminal, sobre activos registrados a partir de las
  imágenes del chat). Rutas en `src/web/rutas/chat.ts`.
- **Web:** `web/` (React, Vite, Tailwind 4, shadcn). Componentes de 21st.dev en `web/src/components/ui/`:
  - `ai-chat-input` (el campo);
  - `ai-thiking-orb-and-input` (el orbe de la portada y el «pensando»);
  - `works-wheel` (la rueda).

  Los cambios del estudio van marcados con «Estudio:».
- **Encargo paso a paso:** los formularios de `pase.html` traídos tal cual en `web/src/legacy/`, montados dentro de la
  tarjeta por `legacy/encargo.js`.
- **Desarrollo:** `npm run estudio` compila la web y arranca el servidor. Para tocar la interfaz con recarga en
  caliente: `npm run estudio` en una terminal y `npm run web:dev` en otra (http://localhost:5173).

## Coste orientativo

- **Una conversación con el director:** unos 0,02–0,05 USD por mensaje.
- **Fotos nuevas:** unos 0,15 USD cada una, con el tope mensual de `GEMINI_TOPE_USD` (una foto que el director repite
  cuesta dos).
- **Producción de una pieza** (estimación del plan): fotos, más unos 0,10 USD de crítica por lámina con texto y 0,02
  por revisión de foto, más unos 0,20 USD de acabado (la portada en «normal», todas en «máximo»). Un post en «normal»,
  unos 0,5 USD; un carrusel de 5 en «normal», 1,2–1,5 USD.
- **Gratis** (en local): recortar, papel, muestras, buscador, degradar, fidelidad, combinar y detalle.
- **El creador de estilos:** solo texto de Hydrogen, unos 0,1–0,4 USD.
