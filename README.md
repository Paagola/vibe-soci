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

**Nano Banana Pro no está en la API de Higgsfield**, solo en su web. Si quieres usarlo:

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
