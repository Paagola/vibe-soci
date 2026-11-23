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
  nueva y su diseño) y el coste antes de producir. Los cambios se piden en el chat («la tercera más oscura»).
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
- **Fotos nuevas:** unos 0,15 USD cada una, con el tope mensual de `GEMINI_TOPE_USD`.
- **Gratis** (en local): recortar, papel, muestras, buscador, degradar, fidelidad, combinar y detalle.
- **El creador de estilos:** solo texto de Hydrogen, unos 0,1–0,4 USD.
