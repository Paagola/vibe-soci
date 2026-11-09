# Estudio de contenido (MVP local)

Convierte **una idea y una foto real del plato** en una pieza para Instagram: un post, un carrusel o una historia. La pieza es creativa, fiel al plato y lleva la identidad del local.

El sistema no rellena una plantilla. Un *director creativo* (Gemini) mira tus fotos, lee lo que ha gustado antes (`biblioteca/`) y te propone 3 conceptos distintos. Tú eliges uno, él escribe el plan y después se generan las imágenes.

- Diseño, decisiones y modelo de datos: [diseno/ARQUITECTURA.md](diseno/ARQUITECTURA.md)
- Diagrama de flujo, director creativo y arquitectura: [diseno/diagrama_flujo.drawio](diseno/diagrama_flujo.drawio)
- Propuesta de la nueva arquitectura creativa: [diseno/propuesta-creativa/PROPUESTA.md](diseno/propuesta-creativa/PROPUESTA.md)
- Material de partida: `../creacion-contenido/` (ya no está en el equipo; los ejemplos usan las fotos de `plantillas/fotos/`)

## Puesta en marcha

```bash
cd estudio-contenido
npm install
cp .env.ejemplo .env      # rellena GEMINI_API_KEY y HF_KEY
npm run estudio           # abre http://localhost:4321
npm test                  # pruebas, sin claves ni gasto
```

`npm run estudio:simulado` arranca en **modo simulado**: el director y el generador son falsos y no gastan nada. También se puede activar o desactivar con el interruptor de la cabecera de la web.
- El modo simulado tiene **sus propios datos** en `datos-simulado/` (locales, piezas y votos). Nada de lo que hagas en simulado aparece en el modo real ni enseña al director real.
- Al cambiar de modo, la web vuelve a la lista de piezas de ese modo.

## Flujo en la web

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
  - La vía de generación del producto **no está decidida** (ESTADO.md §8).

```bash
npm run referencia -- comprobar --local <slug>                      # ¿puede pasar a concepto? Solo lee: nombra las 3 familias propuestas
npm run referencia -- propuestas --local <slug>                     # pinta la hoja de las 3 familias (datos/locales/<slug>/referencias/propuestas.jpg)
npm run referencia -- registrar --local <slug> --id <id> --biblioteca post-11   # o --imagen <captura> o --enlace <url de Canva o Pinterest>
npm run referencia -- captura --local <slug> --id <id> --imagen <captura>       # si el enlace no se pudo leer (Canva suele responder 403)
npm run referencia -- ficha --local <slug> --id <id> --desde ficha.json         # el análisis de la referencia (esquema referencia/ficha@1)
```

**La web todavía no aplica esta regla.** Sus pantallas están pendientes de aprobar (ver `diseno/ARQUITECTURA.md` §11).

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
