# Estudio de contenido de SOCIETY

Convierte **una idea y una foto real del plato** en una pieza para Instagram: un post, un carrusel o una historia. La pieza es creativa, fiel al plato y lleva la identidad del local.

En **El pase**, el productor organiza la foto original, la referencia, el inventario, la toma candidata y la entrega en una sola mesa. El flujo de conceptos y generación de piezas del estudio se puede abrir desde **Estudio**.

- Diseño, decisiones y modelo de datos: [diseno/ARQUITECTURA.md](diseno/ARQUITECTURA.md)
- Diagrama de flujo, director creativo y arquitectura: [diseno/diagrama_flujo.drawio](diseno/diagrama_flujo.drawio)
- Propuesta de la nueva arquitectura creativa: [diseno/propuesta-creativa/PROPUESTA.md](diseno/propuesta-creativa/PROPUESTA.md)
- Material de partida: `../creacion-contenido/` (ya no está en el equipo; los ejemplos usan las fotos de `plantillas/fotos/`)

## Puesta en marcha

```bash
npm install
npm run estudio:simulado
```

Abre [El pase](http://localhost:4321). Si el puerto está ocupado, usa `ESTUDIO_PUERTO=4322 npm run estudio:simulado` y abre el puerto 4322. El modo simulado guarda sus encargos en `datos-simulado/` y funciona sin claves ni gasto. El enlace **Estudio** abre las herramientas anteriores en `/index.html`.

En un clon nuevo, pulsa **Nuevo encargo → Usar el local de ejemplo** y sube una foto de `plantillas/fotos/`. Para trabajar con el proveedor real, configura `.env` a partir de `.env.ejemplo` y arranca con `npm run estudio`. `npm test` ejecuta las pruebas en local.

## Un encargo en El pase

### Post editorial

Sube una foto del plato, del servicio o del local. En **Qué quieres mostrar** escribe, por ejemplo, «Gamba roja a la brasa», «Nuestra terraza al anochecer» o «Café solo. Titular “Café del día”». El Pase propone una fotografía limpia de plato o espacio, un diseño con un título o un cartel expresivo. Si quieres trabajar a partir de otra imagen, marca **Elegir una referencia propia o de biblioteca** en las opciones del alta.

La ficha explica la elección, enlaza las piezas estudiadas y propone qué comprobar a tamaño móvil. **Explorar otra dirección** permite comparar las cuatro lecturas antes de confirmar. **Editar dirección** permite cambiar escena, materia y encuadre. En las dos direcciones de fotografía el copy queda vacío.

Tras confirmar, **Encuadrar la foto original** prepara un recorte 4:5 a partir del archivo aportado. El deslizador ajusta su posición. Puedes revisarlo en el Pase sin un envío al proveedor. Para preparar otra perspectiva, elige la cámara en dirección y utiliza el paquete manual o el envío opcional autorizado. La revisión distingue un recorte del original de una toma nueva. En foto limpia se cotejan los rótulos impresos que ya pertenecían al espacio o al producto. Las piezas de prueba conservan su restricción de uso al exportar.

En **Dirigir una toma nueva** puedes indicar la altura y el giro de cámara, el plano y si conservas la vajilla o trabajas en estudio. La toma de estudio mantiene la preparación y las cantidades documentadas. En **Fotografía con un título**, importa la foto limpia o utiliza el original. El taller dibuja el texto confirmado con fuentes locales. En revisión, **Recomponer el título sobre esta misma foto** permite comparar familia y ubicación sin generar de nuevo. [Café y gamba comparados a tamaño móvil](conocimiento/referencias/ensayo-estudio/README.md)

El estudio recoge 256 composiciones de campañas, portafolios, plantillas, identidades y fotografía. Cada ficha describe una decisión visible y enlaza la pieza concreta. [Método y conclusiones](conocimiento/referencias/estudio-editorial.md) · [Corpus consultable](conocimiento/referencias/corpus-editorial.json)

### Cartel integrado

En **Nuevo encargo**, elige **Cartel integrado · 4:5**, sube la foto del local y escribe el nombre del plato. Una referencia de biblioteca ya tiene ficha. Para una imagen propia, puedes describir su encuadre, tipografía y orden de lectura dentro de El pase.

1. Revisa la acción entre producto y letras, el encuadre, la materia y las palabras que se imprimirán. Puedes editar la dirección y seleccionar un fragmento literal de la nota como nombre público. En **Ajustar cámara y encuadre** puedes cambiar la posición, el tamaño del plano, la acción del alimento y la luz. Si conoces el ángulo y el plano de la fuente, indícalos para comprobar el cambio de toma antes de generar. Con una fuente sin medir, la dirección lleva una posición alternativa para el caso en que el generador encuentre la principal en la foto.
2. Para una cenital con el origen indicado, también puedes elegir **Cambiar la colocación mediante detalles del producto**. Marca de dos a cuatro zonas, cada una con un rasgo de una sola pieza. Cuenta las unidades en la foto completa, describe la colocación nueva y revisa la lámina antes de confirmar.
3. Descarga el ZIP. Entrega al generador la dirección y una sola imagen. Normalmente es `producto.jpg`. Si elegiste los detalles, adjunta `muestras.jpg` y conserva `producto.jpg` para el cotejo. Importa el cartel vertical con su permiso de uso. La descarga y la importación funcionan sin claves. También puedes autorizar un envío por Images API si el estudio tiene activado ese proveedor.
4. Compara la imagen con la fuente completa. Si usaste detalles, cuenta las piezas terminadas y sigue el contorno de cada una. En gambas enteras, una cabeza debe conectar con su abdomen y su cola. Devuelve cualquier ramificación o parte duplicada. Busca qué borde oculta ahora a otro, qué cara se ve y cómo cambia la perspectiva. Lee el cartel a 360 px y transcribe las palabras visibles. La lectura automática usa Vision cuando está disponible en macOS. Al devolver la versión puedes señalar el defecto y elegir otra cámara conservando los textos y la dirección del cartel. Esta decisión prepara la siguiente prueba y vuelve a pedir confirmación antes de producirla.
5. Al aprobar se habilita el PNG de 1080 × 1350. El cartel es una imagen plana. Los encargos con foto o candidata de prueba conservan la vista de composición.

El envío opcional por API usa `OPENAI_API_KEY` y un cupo acumulado `OPENAI_TALLER_ENVIOS` mayor que cero en modo real. Cada autorización reserva un envío de una imagen antes de contactar con OpenAI. Una respuesta incierta conserva la reserva y admite importación manual. El precio depende de los tokens de la foto, la instrucción y la imagen de salida. El adaptador utiliza `gpt-image-2` en alta calidad con la imagen de entrada que has confirmado y tamaño 1088 × 1360. [Guía de imágenes](https://developers.openai.com/api/docs/guides/image-generation) y [referencia de edición](https://developers.openai.com/api/reference/resources/images/methods/edit).

### Post por capas y carrusel

1. Sube una foto y elige post por capas o carrusel. Selecciona una referencia si el encargo la requiere.
2. Revisa el inventario, la nueva toma y el plan editorial. La aprobación corresponde a la revisión que tienes en pantalla y autoriza la fotografía dentro del presupuesto indicado.
3. Compara la candidata con la original y decide cuál usar. El compositor prepara las páginas y sus exportaciones 3:4 y 4:5. Puedes corregir una página concreta y conservar las demás y la foto aprobada.

El productor editorial usa Hydrogen para la dirección y las tareas de texto y visión. Recibe los bytes de la foto fuente, el brief y ejemplos de oficio. El compositor resuelve las capas con los recursos locales. El modelo de fotografía se configura por separado. Cada envío de texto o visión consume cupo del encargo, incluidos los reintentos. Si se corta una generación de imagen, la orden recupera una candidata que coincida con la procedencia guardada. Si queda un envío reservado sin foto recuperable, te pide importar la candidata antes de continuar.

La crítica editorial lee las páginas ya renderizadas. Señala la diapositiva y la versión que requieren un ajuste. El productor puede aplicar una corrección acotada por tanda conservando la fotografía aprobada. Si la incidencia persiste, la comanda vuelve a revisión humana y la ficha abre la página afectada.

La mesa admite selección con teclado y vista 2D. La escena se adapta al ajuste de movimiento reducido del dispositivo.

Para abrir un encargo editorial desde terminal, añade `--productor` al comando `npm run post -- nuevo`. En cada parada, copia la huella que muestra la orden y usa `--confirmo --revision <huella>` o `--rechazo "motivo" --revision <huella>` en una terminal interactiva.

## Flujo de conceptos en Estudio

1. **Nuevo local** (una vez): nombre, ciudad, tono, colores en HEX con su muestra y tipografías.
2. **Nueva pieza**: formato (post, carrusel o historia), número de imágenes, idea, tipo y condiciones si es oferta o evento. Sube las fotos reales (al menos una del plato) y, si quieres, una referencia de estilo.
3. **Proponer conceptos**: el director propone 3 conceptos distintos. Pulsa «Elegir este» o pide «Otros 3».
4. **Plan**: textos de cada diapositiva, prompt (plegado), pie, hashtags y enlace a `plan.md`.
5. **Generar la portada** primero y después **Generar todas**: el resto lleva la portada como referencia. Antes de gastar, un modal enseña cuántas imágenes se van a pedir, con qué modelo y cuántas llevas hoy.
6. Por cada versión: **Me gusta / No me gusta** con un motivo, que aprende el director, y **Pedir cambio** (máx. 3 por diapositiva). El cambio que propone el director pasa las mismas reglas que el plan antes de gastar nada: no puede meter cifras que no estén en la idea, en las condiciones o en tu comentario.
7. **Exportar**: post y carrusel salen a 1080 × 1440 (3:4, la proporción con la que se diseñan) en `exportadas/3x4/` y también a 1080 × 1350 (4:5, recortando 45 px arriba y abajo) en `exportadas/4x5/`. Las historias salen a 1080 × 1920 en `exportadas/9x16/`. Además, `pie.txt`. Las exportaciones antiguas (`exportadas/NN.jpg`) no se tocan.

Mientras el director piensa o se generan imágenes, un panel muestra la fase («El director está mirando las fotos…», «Generando las diapositivas 2, 3 a la vez…»), una barra, cuántas imágenes están listas y **«quedan unos X s»**.
- La estimación usa lo que han tardado de verdad las imágenes y las llamadas al director anteriores.
- Si recargas la página, el trabajo sigue y el panel vuelve a aparecer.

Para probar ya mismo, usa los botones **«Cargar ejemplo: post / carrusel»** de la página de inicio:
- el post es del Asador Etxebarri, con la foto real de la gamba;
- el carrusel es de Café Albor, con la tostada y el café.

Las fotos están en `plantillas/fotos/`.

### Generar a mano con Nano Banana Pro

**Nano Banana Pro no está en la API de Higgsfield**, solo en su web y en su conector MCP (y en la API de Gemini, que solo lo da con facturación activada). Si quieres usarlo:

1. Abre `plan.md` desde la sección «Plan». Cada diapositiva trae el prompt y la lista **«Adjunta en este orden»**.
2. Genera en la web de Higgsfield adjuntando las imágenes en ese orden.
3. En la diapositiva, abre **«Importar una imagen hecha a mano»** y súbela.
4. Para cambiar algo, en «Pedir cambio» marca **«Lo genero a mano»**: el estudio te da el prompt nuevo y el orden de los adjuntos, y vuelves a importar.

## Compositor gráfico (F1, en pruebas)

Es la base de la nueva arquitectura ([propuesta](diseno/propuesta-creativa/PROPUESTA.md), [informe de la F1](diseno/f1/INFORME-F1.md)). El diseño se escribe como una **intención**: capas, retícula de 12 × 16, relaciones y textos. El compositor la resuelve a píxeles y la pinta por capas con sharp, SVG y fontkit.
- El texto es exacto porque se pinta con trazos de las fuentes de `recursos/tipografias/` (OFL).
- Cada capa se repinta solo si cambia.
- Cada versión se guarda entera y no se sobrescribe.

Funciona aparte del flujo de la web, que sigue igual.

```bash
npm run activo -- --local <slug> --id <id> --desde <foto> --tipo REAL --uso PUBLICABLE --descripcion "…"   # copia la foto, crea su máscara (Apple Vision, macOS) y guarda su procedencia
npm run f1                                                                                              # compone los diseños de diseno/f1/ en datos/disenos/f1/
```

## Dirección de arte y producción (F1.5, en pruebas)

El orden de trabajo cambia a **primero la idea y después la composición**. La metodología está adaptada de design-agent de LangChain ([investigación](diseno/f1_5/INVESTIGACION-DESIGN-AGENT.md), [informe de la F1.5](diseno/f1_5/INFORME-F1.5.md)):
- [`conocimiento/`](conocimiento/README.md): oficios (dirección de arte, fotografía gastronómica, composición y tipografía, texto publicitario, revisión visual), principios, antipatrones, rúbrica, fichas de referencia y observaciones. El director recibe solo lo de la fase en la que está.
- [`marcas/<slug>/`](marcas/README.md): perfil de marca v2 (constantes, variables, restricciones, material y pendientes, con la fuente de cada dato) y los tokens del compositor.
- [`proyectos/<slug>/`](proyectos/etxebarri-gamba-carrusel/BRIEF.md): brief con registro de afirmaciones, concepto, producción (modelos, prompts, recetas y gasto), intenciones, revisión y pie.

```bash
npm run generar -- proyectos/<slug>/produccion/recetas/<receta>.json --solo-estimar   # precio por la API (gratis); sin --solo-estimar genera, con tope de 5 USD
npm run fidelidad -- --local <slug> --real <id> --generado <id> --veredicto CONSERVA|ALTERA --nota "…"   # ¿conserva el plato? Solo CONSERVA pasa a PUBLICABLE
npm run combinar-luz -- --local <slug> --id <nuevo> --luz <id> --detalle <id> --descripcion "…"           # la luz de una imagen y el detalle de otra (sin coste)
npm run detalle -- --local <slug> --id <nuevo> --desde <id> --recorte x,y,w,h --descripcion "…"          # un detalle real recortado con su máscara
npm run carrusel -- proyectos/<slug> [--borrador]                                                         # compone, guarda versiones y monta las hojas de revisión
```

Cada imagen generada se guarda con su receta, su prompt, su `request_id`, sus referencias y su coste. El gasto queda en `datos/gasto/higgsfield.jsonl`. Nada de esto toca el generador antiguo de la web.

## Referencia obligatoria y foto nueva (F1.6, en pruebas)

El estado vivo del proyecto, las decisiones vigentes y lo que queda están en [`diseno/f1_6/ESTADO.md`](diseno/f1_6/ESTADO.md).

**Decisiones vigentes (09/11/2026):**
- **Referencia obligatoria:** en las 5 primeras piezas de cada local, el diseño parte de un post de referencia (imagen o captura, enlace de Canva o Pinterest, o una familia de la biblioteca). De él se toma el oficio, nunca los textos ni las marcas. El post de referencia no va al generador: se le pasa su ficha en palabras.
  - **Cuentan para las 5 las piezas de la app y las hechas con herramientas.** Una pieza hecha con herramientas se declara en su `proyectos/…/plan.json` con `"pieza": { "fecha": "AAAA-MM-DD", "referencia": "<id>" }`. Los planes sin `pieza` son experimentos y no cuentan.
- **Fidelidad flexible por defecto:** cambian la cámara, la luz, el fondo, la superficie y el encuadre; se conservan los elementos del plato, su número, la anatomía y la vajilla (`marcas/<slug>/perfil.json` → `fidelidad`). Se descarta la imagen que añade algo.
- **Foto nueva, no foto mejorada.** La toma nueva cambia la altura más de 30°, o al menos dos de estas cosas: el lado (giro de 45° o más), la distancia y la altura (15° o más). Está en `src/dominio/fotoNueva.ts` → `esOtraToma`.
- **Gasto:**
  - Gemini, solo en el tier gratuito (texto y visión);
  - Higgsfield por el MCP, solo para pruebas autorizadas, con `get_cost` antes de cada petición.
  - **Vía de generación del producto (09/11): Gemini de imagen de pago.** Tú activas la facturación (`GEMINI_FACTURACION=si`) y el código pone el tope (`GEMINI_TOPE_USD`). Ver «Orden única».

```bash
npm run referencia -- comprobar --local <slug>                      # ¿puede pasar a concepto? Solo lee: nombra las 3 familias propuestas
npm run referencia -- propuestas --local <slug>                     # pinta la hoja de las 3 familias (datos/locales/<slug>/referencias/propuestas.jpg)
npm run referencia -- registrar --local <slug> --id <id> --biblioteca post-11   # o --imagen <captura> o --enlace <url de Canva o Pinterest>
npm run referencia -- captura --local <slug> --id <id> --imagen <captura>       # si el enlace no se pudo leer (Canva suele responder 403)
npm run referencia -- ficha --local <slug> --id <id> --desde ficha.json         # el análisis de la referencia (esquema referencia/ficha@1)
```

**La web todavía no aplica esta regla.** Sus pantallas están pendientes de aprobar (ver `diseno/ARQUITECTURA.md` §11).

## Orden única de punta a punta (en pruebas, 09/11/2026)

De la foto subida al post exportado, con dos paradas para que confirmes. Cada vez que la lanzas sigue desde donde se quedó. El estado está en `proyectos/<proyecto>/post.json`.

```bash
npm run post -- nuevo <proyecto> --local <slug> --foto <ruta> --plato "nota del dueño" --referencia <ref-id>   # [--simular]
npm run post -- <proyecto>                        # sigue hasta la siguiente parada
npm run post -- <proyecto> --confirmo             # confirma los elementos y el gasto, o la foto
npm run post -- <proyecto> --rechazo "motivo"     # rechaza la foto (vuelve a generar si quedan intentos)
npm run post -- <proyecto> --importar <imagen>    # sin facturación: usa una foto generada a mano
```

**Los pasos, en orden:**
1. **Referencia:** obligatoria en las 5 primeras piezas.
2. **Foto subida:** se registra como activo real.
3. **Propuesta del director:** plantilla de foto nueva y regla «otra toma».
4. **■ Confirmas los elementos y el gasto** (como mucho 2 intentos).
5. **Foto nueva:** Gemini de pago, solo con `GEMINI_FACTURACION=si` y con el tope `GEMINI_TOPE_USD`.
6. **Comprobación de salida automática:** si descarta, otro intento; si descarta 2 seguidos, se para.
7. **■ Confirmas la foto.**
8. **Máscara.**
9. **Intención de diseño.** Hasta que el director la escriba (F3) la escribe una persona: si falta, la orden deja un borrador y se para.
10. **Composición y exportación** a 3:4 y 4:5.
11. **La pieza se marca** para el umbral de referencia.

**Modo simulado (`--simular`):** director, generador, revisor y máscara simulados. No gasta nada, y todo va a `datos-simulado/` (los locales y las referencias se leen de `datos/`).

**Comprobación de salida suelta:**

```bash
npm run comprobar-foto -- --local <slug> --generado <id> --real <id> --propuesta proyectos/…/foto/x.final.json [--pieza "gamba=2"] [--sin-guardar]
```

Hace tres preguntas a Gemini:
- un **checklist** frente a la lista de elementos;
- si la **toma** es la misma, comparando las fotos lado a lado;
- la **anatomía**, contando por teselas.

Decide el código. El resultado va al activo (`revisionAutomatica`), y tu veredicto (`fidelidad`) no cambia.

## Lo que aprende el estudio

- `biblioteca/principios.md`: lo que ha gustado y lo que no. **Edítalo** cuando aprendáis algo.
- `biblioteca/ejemplos/*.md`: los prompts que funcionaron y por qué.
- `biblioteca/valoraciones.jsonl`: cada «Me gusta / No me gusta» añade una línea. El director lee los 20 votos más recientes; lo que más le enseña es el **motivo**.

## Gasto y seguridad del flujo

- Antes de generar por la API, un modal dice cuántas imágenes va a pedir, con qué modelo y cuántas llevas hoy. Sin confirmar no se genera nada.
- Hay un límite diario de imágenes por la API (`LIMITE_IMAGENES_DIA`, 40 por defecto). El día se cuenta en la hora de España (`ESTUDIO_ZONA_HORARIA`), no en UTC.
- Un voto o una importación hechos mientras corre un trabajo ya no se pierden: cada cambio se aplica sobre lo último guardado.
- Si una foto no se puede subir a Higgsfield, el siguiente intento la vuelve a subir. Antes había que reiniciar el servidor.
- Cada envío lleva una `Idempotency-Key` y el `requestId` se guarda antes de esperar. Si se corta, «Generar» retoma la espera en lugar de pagar otra imagen.
- Cada diapositiva admite como máximo 3 cambios.
- Si `GEMINI_MODELO` está saturado, el director pasa a `GEMINI_MODELO_RESPALDO`.

## Configuración (.env)

| Variable | Por defecto | Para qué |
|---|---|---|
| `GEMINI_API_KEY` | — | Director creativo |
| `GEMINI_MODELO` / `GEMINI_MODELO_RESPALDO` | `gemini-3.8-flash` / `gemini-3.5-flash` | Modelo principal y modelo de respaldo |
| `GEMINI_MODELO_PRODUCTOR` | `gemini-4-hydrogen` | Modelo de texto y visión de los encargos editoriales |
| `GEMINI_MODELO_PRODUCTOR_RESPALDO` | — | Respaldo opcional de los encargos editoriales |
| `GEMINI_FACTURACION` | `no` | `si` **solo** cuando la clave tenga la facturación de Google activada. Es la vía de generación del producto (09/11/2026). Con `no`, la orden única no genera por la API |
| `GEMINI_TOPE_USD` | `1` | Tope acumulado de gasto en imágenes de Gemini, que el código comprueba **antes** de cada envío (un presupuesto de Google Cloud solo avisa) |
| `GEMINI_MODELO_IMAGEN` | `gemini-3-pro-image` | Modelo de imagen de la vía de producción |
| `HF_KEY` | — | Higgsfield, con el formato `KEY_ID:KEY_SECRET` |
| `HF_MODELO` | `marketing-studio/image` | También `ideogram/v4.0` o `xai/grok-imagine-image-2.0` |
| `HF_RESOLUCION` | `4k` | `1k`, `2k` o `4k` |
| `LIMITE_IMAGENES_DIA` | `40` | Tope de imágenes por la API al día |
| `ESTUDIO_PUERTO` | `4321` | Puerto de la web (solo escucha en 127.0.0.1) |
| `ESTUDIO_SIMULAR` | — | `1` para arrancar en modo simulado |
| `ESTUDIO_DATOS_SIMULADO` | `datos-simulado` | Carpeta del modo simulado |
| `ESTUDIO_ZONA_HORARIA` | `Europe/Madrid` | Zona horaria IANA con la que se cuenta el límite diario |

## Estructura

```text
src/
  web/          servidor local (API JSON, trabajos en segundo plano, tiempo restante) y frontend sin build en web/publico/
  aplicacion/   casos de uso: uno por archivo
  dominio/      modelos zod, reglas puras y errores
  puertos/      interfaces (director, generador, almacenes, biblioteca, imagen)
  adaptadores/  gemini · higgsfield · simulado · ficheros · imagen (sharp)
  contenedor.ts elige los adaptadores según la configuración
biblioteca/     guía creativa (datos, no código)
plantillas/     ejemplos de marca y de brief, con sus fotos en plantillas/fotos/
datos/          locales y piezas reales (no se sube: .gitignore)
datos-simulado/ lo mismo, pero del modo simulado (no se sube)
test/           reglas, clientes HTTP, flujo completo simulado, API web, estimación del tiempo y estabilidad (F0)
```
