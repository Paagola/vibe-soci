# Prompt por fases · Sistema agéntico de producción de reels (SOCIETY / El Pase)

**Para quién:** el agente de código que construirá el sistema en este repositorio (Claude Code, Codex o Gemini CLI). Cada fase lleva un bloque «Prompt de la fase» que se puede pegar tal cual. Las fases se ejecutan en orden; una fase no empieza hasta que la anterior cumple su criterio de salida.

**Fecha:** 27/11/2026. **Fuentes que este prompt resume y que el agente debe leer antes de la fase 0:**

| Documento | Qué aporta |
|---|---|
| [PROPUESTA-SISTEMA-AGENTICO-VIDEO-SOCIETY.md](PROPUESTA-SISTEMA-AGENTICO-VIDEO-SOCIETY.md) | Reparto Neon / Hydrogen / Argon, agentes, puertos nuevos, catálogo de efectos, contratos JSON, hoja de ruta. |
| [ARQUITECTURA-AGENTICA.md](ARQUITECTURA-AGENTICA.md) | Quién decide qué, el pase de producción con sus paradas, cómo desarmar una referencia, contrato de plano, contrato con Higgsfield (Magi), montaje, crítica y reparación. Donde habla de Nano por Higgsfield o del MCP, manda este prompt: Nano va por la API de Gemini y Higgsfield solo por su API. |
| [ANALISIS-FLUJO.md](ANALISIS-FLUJO.md) | Qué existe ya en el código (puertos, adaptadores Gemini, productor, huellas, inventario) y qué se reutiliza. |
| [PROPUESTA-REEL.md](PROPUESTA-REEL.md) y [REGISTRO.md](REGISTRO.md) | Piloto Torre de Vega: plan, paradas humanas, gasto, fallos de transporte reales. |
| [piloto-cocteles/README.md](piloto-cocteles/README.md) | Piloto de cócteles: errores del análisis de referencia, tipografía medida, aparición por capas. **Las reglas de su sección «Errores de proceso» son requisitos de este sistema.** |
| [catalogo_skills_herramientas_video_IA.md](catalogo_skills_herramientas_video_IA.md) | Inventario de motores, skills y licencias (HyperFrames, Remotion, FFmpeg, packs de skills, OpenMontage…). |

---

## 1. Qué se construye (una frase)

Un estudio de reels 9:16 (1080 × 1920, 12–15 s, 25 fps) para locales de hostelería donde **Gemini 4 Neon dirige**, **subagentes Gemini 4 Hydrogen ejecutan** con herramientas acotadas, **Argon solo se usa como escalado excepcional**, y **un Productor escrito en código** es el único que gasta, avanza la comanda, aprueba versiones y guarda la verdad. Cada segundo del MP4 final debe poder rastrearse hasta una decisión, un activo aprobado y una fuente del local.

## 2. Principios innegociables

1. **Los modelos proponen; el código ejecuta.** Ningún modelo gasta créditos, cambia el inventario confirmado, aprueba ni reintenta un envío remoto. Esas operaciones son funciones del Productor.
2. **Una sola fuente de verdad:** el expediente versionado (brief, inventario, plan, activos, trabajos remotos, `TimelineManifest`, revisiones, gasto). Tesseract, HyperFrames o FFmpeg reciben representaciones del manifiesto y nunca son la fuente.
3. **Generación cerrada y solo por API, sin MCP:**
   - **Nano Banana Pro** (`gemini-3-pro-image`) para fotogramas, por la **API de Gemini (Google AI Studio)** con `GEMINI_API_KEY`. Es la misma ruta que ya usa el generador de posts: `GeneradorFotoGemini`, `imagenGemini.ts` y `herramientas/generarGeminiImagen.ts`, con tope y registro en `datos/gasto/gemini.jsonl`.
   - **Magi 2** como **único** generador de vídeo, por la **API de Higgsfield** (`ClienteHiggsfield`, `HF_KEY`), con subida de medios, estimación, envío, consulta y descarga por HTTP.
   - **Ningún agente ni adaptador usa el MCP de Higgsfield.** Los IDs, prompts o resultados de sesiones MCP anteriores (REGISTRO, piloto de cócteles) son historial, no entradas del sistema.
   - Las librerías de motion graphics no generan vídeo: solo montan, componen y añaden capas.
4. **Herramientas por lista blanca:** cada agente recibe solo las herramientas y skills de su encargo (`allowedTools`). Las demás no existen para él.
5. **Lo objetivo va a código:** dimensiones, FPS, duración, códecs, LUFS, huellas, cortes, posición de texto y licencias se validan con FFprobe/FFmpeg y Zod, no con el juicio de un modelo.
6. **Lecciones del piloto de cócteles**, convertidas en requisitos:
   - La referencia se descarga completa y se guarda en el repositorio.
   - El análisis se hace por tramo y banda, con fotogramas de inicio, mitad y final y tres campos obligatorios: qué se ve, qué hace el sujeto y qué hace el texto.
   - La tipografía se mide antes de elegir fuente: anchos de tinta, altura de versal, posición, color y efecto de aparición.
   - Toda desviación del original se anota como decisión, con su motivo.
   - La crítica compara con la referencia lado a lado, no solo con la adaptación.
   - Se prueba primero el tramo más difícil.
   - Un texto que aparece al paso de un objeto requiere capas y una máscara desde el plan.
   - No se mueve lo ya medido.

### 2.1 Integrar lo que ya hace el estudio de posts; no construir en paralelo

El estudio de posts y carruseles ya analiza y produce con piezas probadas: iluminación, tipografía, elementos del plato, paleta, capas, retícula, fidelidad. El reel debe **reutilizar y extender esas mismas piezas**, no crear un segundo análisis con otro vocabulario. Un rasgo que el post ya mide (por ejemplo, la dirección de la luz o la escala tipográfica) se mide en el reel con la misma función y se guarda con el mismo esquema, añadiendo solo lo temporal: tramo, banda, tiempo y movimiento.

| Capacidad que ya existe en posts | Dónde está | Cómo la usa el reel |
|---|---|---|
| **Ficha de referencia** `referencia/ficha@1`: familia F1–F10, mecanismos, capas del fondo al frente, retícula, tipografía por rol con escala, paleta HEX medida (k-means), recursos, orden de lectura en móvil, tratamiento y «por qué funciona» | [src/dominio/referencia.ts](../../src/dominio/referencia.ts) · [AnalistaReferenciasGemini](../../src/adaptadores/gemini/AnalistaReferenciasGemini.ts) · [analizarReferencia](../../src/aplicacion/referencias/analizarReferencia.ts) | Cada fotograma clave de cada tramo y banda del reel recibe una `FichaReferencia` con el mismo analista y las mismas instrucciones. El `AnalisisDeReferencia` del reel **contiene** fichas, no las reinventa. |
| **Lectura fotográfica**: cámara, distancia y foco, **luz** (dirección, tamaño, caída, con evidencia en sombras y reflejos), gesto y apoyos, **materiales**, sensación, traslado | `LecturaFotografica` en `referencia.ts` | Se rellena por tramo. Así se habría visto que el tramo 2 de cócteles cambia a fondo negro y luz aislada. El traslado alimenta el `ShotContract` y los prompts Nano/Magi. |
| **Aptitud de la imagen**: post publicado, mockup, marca de agua, captura con interfaz, collage | `TipoDeImagen` y `Aptitud` en `referencia.ts` | Se aplica a fotogramas de la referencia para detectar plantillas, marcas de agua y tarjetas finales que deben quedar fuera (como «Hará // joyful»). |
| **Luz de producción**: modo NATURAL o ESTUDIO, pauta de luz, balance neutro | [src/dominio/luzFotografica.ts](../../src/dominio/luzFotografica.ts) | La misma pauta entra en los prompts de fotograma y de movimiento y en el libro de continuidad. La luz de un plano no cambia entre fotograma y clip. |
| **Elementos y fidelidad**: inventario confirmado con huella, cotejo determinista de propuesta y textos, prompt que solo sale del inventario | [inventario.ts](../../src/dominio/inventario.ts) · [cotejo.ts](../../src/dominio/cotejo.ts) · [promptFiel.ts](../../src/dominio/promptFiel.ts) | Los prompts Nano y Magi se construyen con `promptFiel` desde el inventario. Los rótulos y los nombres del reel pasan por el cotejo. |
| **Comprobación de salida de una foto**: checklist elemento a elemento, recuento, anatomía, añadidos, texto nuevo y misma toma lado a lado | [comprobacionSalida.ts](../../src/dominio/comprobacionSalida.ts) · `RevisorVisual` | Se aplica a cada fotograma Nano y a los fotogramas muestreados de cada bruto Magi (inicio, contacto, salida). |
| **Segmentación** del sujeto | puerto `Segmentador` en [src/puertos/Foto.ts](../../src/puertos/Foto.ts) | Alternativa al mate por diferencia para las capas de texto detrás del sujeto cuando la cámara se mueve. |
| **Sistema tipográfico**: catálogo de familias, buscador por local y plato, recetas `tipografia/receta@1`, verificación con OCR y medida de la letra, motor de texto del compositor | [recursos/tipografias](../../recursos/tipografias/catalogo.json) · [buscarTipografia](../../src/aplicacion/tipografia/buscarTipografia.ts) · [verificarTratamiento](../../src/aplicacion/tipografia/verificarTratamiento.ts) · `LectorDeTexto` · [MotorTexto](../../src/adaptadores/compositor/MotorTexto.ts) | `emparejarFuente` busca en el mismo catálogo. Los rótulos se pintan con el mismo motor de texto y fuentes reales. La legibilidad se comprueba con el mismo OCR sobre el peor fotograma del intervalo. Las recetas especiales solo entran si la referencia lleva tratamiento. |
| **Perfil de marca**: constantes (nombre, paleta, tipografías, voz) y variables | [src/dominio/marca/perfil.ts](../../src/dominio/marca/perfil.ts) | La `TypographySpec` y la paleta parten de la marca. Si la referencia pide otra cosa, se anota como desviación con su motivo, en un sentido u otro. |
| **Dirección y crítica de arte**: receta visual, rúbrica de 0 a 4 por dimensión, corpus de referencias, crítico y comparador | [src/dominio/arte/](../../src/dominio/arte/) · `CriticoDeArte`, `ComparadorDeArte`, `CriticoEditorial` | Los críticos del reel usan esa misma rúbrica sobre fotogramas del máster y añaden los ejes temporales: ritmo, aparición y parecido por tramo. |
| **Productor**: huella de revisión, bitácora, paradas, vía web o terminal | [src/aplicacion/productor/](../../src/aplicacion/productor/) | La comanda del reel es una comanda del mismo Productor, no un estado aparte. |

**Regla para el constructor:** antes de escribir un esquema, un prompt de análisis o una medida nueva, busca si el estudio de posts ya lo tiene. Si existe, se importa y se extiende: versión nueva del esquema (`@2`) o composición dentro del contrato del reel. Si de verdad hace falta algo distinto, se justifica en `diseno/reel/construccion/00-estado.md`. Un test por fase comprueba que el reel llama a la función compartida, por ejemplo que el análisis de un tramo devuelve una `FichaReferencia` válida.

---

## 3. Modelos Gemini: política de uso (núcleo del sistema)

| Modelo | ID API | Papel | Precio (USD/M tokens, entrada/salida) | Tier gratuito |
|---|---|---|---|---|
| **Gemini 4 Neon** | `gemini-4-neon` | **Director/orquestador de alto juicio.** Integra informes, decide entre conceptos, reparte encargos a Hydrogen en paralelo, arbitra entre críticos, hace la lectura final de entregas importantes. | 3,00 / 15,00 | No |
| **Gemini 4 Hydrogen** | `gemini-4-hydrogen` | **Ejecutor por defecto** de todos los subagentes: documentalista, analista, guionista, foto, prompts, movimiento, montaje, motion, sonido, primera crítica. | 1,50 / 7,50 | Sí, con límites. Con datos reales de clientes, usar solo el tier de pago. |
| **Gemini 4 Argon** | `gemini-4-argon` | **Escalado excepcional**: conflicto creativo o técnico que Neon no resuelve, shader o render que sigue fallando, discrepancia de alto riesgo entre críticos. | 2,00 / 10,00 hasta el 30/11/2026; 4,00 / 20,00 desde el 01/12/2026 | No |

Precios tomados de la propuesta del sistema (26/11/2026). **Verificar la tarifa y los IDs en la documentación oficial antes de fijar los topes.** Los tokens de razonamiento también cuentan.

### 3.1 Cómo orquesta Neon (decisión de diseño)

`ClienteGemini` ([src/adaptadores/gemini/ClienteGemini.ts](../../src/adaptadores/gemini/ClienteGemini.ts)) hace `generateContent` con salida JSON validada por Zod, sin *function calling*. **No dar a Neon herramientas que ejecuten acciones.** Neon dirige mediante **decisiones estructuradas que el código ejecuta**:

```
bucle del orquestador (código):
  1. contexto = expediente vigente (brief, inventario, plan, informes, incidencias, presupuesto restante)
  2. decision = Neon.decidir(contexto) → DecisionDelDirector (Zod)
       { encargos: AgentTask[], peticionesAlProductor: PeticionGasto[], veredicto?, siguientePaso }
  3. el código valida cada AgentTask: rol permitido, allowedTools ⊆ lista blanca del rol, presupuesto ⊆ restante
  4. ejecuta en paralelo los encargos independientes con Hydrogen (o con código puro si el rol es determinista)
  5. guarda AgentResult + evidencias en el expediente; las peticiones de gasto pasan a una parada humana
  6. vuelve a 1 hasta que siguientePaso = "parada_humana" | "entrega" | "bloqueado"
```

Este patrón reproduce el «Neon dirige subagentes Hydrogen» sin depender de Google Antigravity y mantiene el principio 1. El *function calling* real queda como mejora opcional de la fase 10, solo para herramientas **de lectura**.

### 3.2 Router y modo sin presupuesto

- `ModelRouter` decide el modelo por `taskType`, criticidad, confianza del resultado anterior, presupuesto restante y capacidades multimodales. Nunca se fija el modelo dentro de un agente.
- **Escalado:** Hydrogen intenta una vez → corrige una vez con el error exacto → Neon recibe artefacto, error y evidencias → Argon solo si Neon declara un problema concreto sin resolver **y** el Productor autoriza el coste.
- **Modo económico (sin Neon):** Hydrogen asume el papel de Director con el mismo contrato `DecisionDelDirector`. Pasar de un modo a otro es cambiar una variable de entorno, no reescribir agentes. Variables nuevas: `GEMINI_MODELO_DIRECTOR` (por defecto `gemini-4-neon`, con respaldo `gemini-4-hydrogen`), `GEMINI_MODELO_ESCALADO` (`gemini-4-argon`) y `GEMINI_TOPE_USD_REEL`.
- **Gasto de modelos:** reutilizar `alUsar` y [registroUso.ts](../../src/adaptadores/gemini/registroUso.ts) añadiendo `agente`, `taskId`, `reelId` y el coste calculado con una tabla de tarifas versionada. Neon solo se llama si el tope del reel lo cubre; si no, se pasa al modo económico y queda registrado.

---

## 4. Agentes y herramientas (matriz de referencia)

**Leyenda de herramientas:**

- **C:** función de código del repositorio, determinista.
- **G:** API de Gemini / Google AI Studio para imagen (Nano Banana Pro). Gasta, así que solo la usa el Productor.
- **H:** API HTTP de Higgsfield para vídeo (Magi 2). Gasta, así que solo la usa el Productor. Sin MCP.
- **F:** FFmpeg/FFprobe.
- **S:** skill de instrucciones cargada en el contexto.
- **R:** runtime de render (Tesseract, HyperFrames).

| Agente | Modelo | Herramientas permitidas | Skills (S) | Entrega (contrato) | Prohibido |
|---|---|---|---|---|---|
| **Productor** | Código, sin LLM | C: almacenes, huellas (`revisionDeEncargo`), bitácora, presupuesto, idempotencia. G: `GeneradorFotoGemini` (Nano Banana Pro, tope y registro de gasto). H: subida de medios, estimación, envío, estado y descarga de Magi 2 por la API (`ClienteHiggsfield`). F: QC final. R: export. | `platform-export` (perfil de entrega de Instagram Reels), `reel-asset-board` (tablero de activos aprobados) | Comanda versionada, aprobaciones, registro de gasto, entrega. | Decidir creatividad. |
| **Director** | **Neon**; Hydrogen en modo económico | Solo lectura del expediente. Emite `DecisionDelDirector`. | `video-planning`, `motion-film-skill` (proceso) | Encargos, elección de concepto, arbitraje, veredicto final. | Gastar, tocar inventario confirmado, aprobar, ejecutar render. |
| **Documentalista** | Hydrogen | C: biblioteca, brief, activos, inventario propuesto, lector de webs/carta. Visión sobre fotos del local. | `website-to-hyperframes`, **solo su fase de análisis** (resumen, paleta, tipografías y assets de la web del local → `DESIGN.md`), con Playwright/Chromium | Inventario con fuente por hecho y región por imagen; hecho, inferencia o duda. | Afirmar recetas o cantidades sin fuente. |
| **Analista de referencias** | Hydrogen; Neon solo para sintetizar varias referencias | C: `descargarReferencia` (MP4 completo, nunca HLS truncado). F: `ffprobe`, detector de cortes global y por región (umbral 0,28 y luego por zona), hojas de fotogramas, tira por corte, `loudnorm`. C: `medirTexto` (caja de tinta, versal, base, color) y `emparejarFuente` contra [recursos/tipografias/catalogo.json](../../recursos/tipografias/catalogo.json). | `reverse-any-video` (HyperFrames), `style-sampling`, `video-shotcraft`, `thumbnails` (hojas de contacto). `descargarReferencia` sobre **yt-dlp** (lo usa `demo-video-creator`). Los scripts de `onetake` (`analyze_ref.py`, `frame_diff.py`) solo se estudian: licencia no comercial | `AnalisisDeReferencia` con una fila por tramo y banda, tres fotogramas, qué se ve, sujeto, texto y tabla conservar/adaptar/descartar/motivo. | Describir un tramo sin fotograma. Elegir fuente sin medir. |
| **Estratega/guionista** | Hydrogen; Neon elige | C: inventario confirmado, análisis de referencia, historial del local. | `video-planning`, `vertical-shorts`, `create-reel-editing-brief` y `grill-me-reel-edit` (`reel-editing-skills`: mapa de beats y preguntas sobre gancho y ritmo), variantes de gancho de `video-agent-skill/reel-editor` | Tres conceptos de **mecanismo distinto**, con gancho, prueba, fuente y escaleta. | Conceptos que solo cambian el titular. |
| **Director de foto y arte** | Hydrogen | C: contratos de plano, libro de continuidad, safe zones, sistema tipográfico (`src/dominio/tipografia`, recetas en `recursos/tratamientos`). | `video-shotcraft`, `motionboard`, `motion-design-skill` | `ShotContract[]`, `TypographySpec` y prompts Nano en inglés con el papel de cada referencia. | Inventar guarniciones, manos o rótulos. |
| **Operador de imagen + revisor de fidelidad** | Hydrogen (revisión); código (normalización) | C: normalizar 2K→1080×1920, hash, hoja de contacto. Revisor visual Gemini existente. **Pide** al Productor la generación Nano Banana Pro por la API de Gemini. | — | Fotogramas aprobables con correspondencia fuente → resultado. | Animar un fotograma no aprobado. |
| **Director de movimiento** | Hydrogen; Neon en planos conflictivos | C: `ShotContract`, compilador de prompt Magi (image-to-video o reference-to-video). F: muestreo a 0,5 s del bruto. **Pide** control de 4 s y tanda al Productor. | `motion-film-skill` (prueba de movimiento corta antes de la pieza completa), `product-launch-motion`, `video-shotcraft` (fichas de cámara). Comprobación de manos con **MediaPipe** (la usa `pitch-video`) en los fotogramas de contacto | Prompt por plano con dirección, contacto, «no gira», salida completa y estado final. Ventanas útiles por bruto. | Enviar a Magi directamente. Reintentar sin consultar el estado. |
| **Montador** | Hydrogen | C: `TimelineManifest` (lectura y escritura de su versión). F: trim, concat, reverse, mate por diferencia con fondo vacío, `alphamerge`. R: Tesseract (`tsrct`). | `video-editing-router`, `ffmpeg-essentials`, `video-qa`, `platform-export`, `thumbnails` (portada desde un fotograma del máster). Para el diseño del `TimelineManifest`: render desde `edl.json` de Vedit y exportación OpenTimelineIO de `remotion-render`, como referencia de formato | Primer corte limpio, capas fondo / texto / sujeto, preview móvil, mapa origen → destino. | Efectos antes del corte limpio. |
| **Motion designer** | Hydrogen; Neon o Argon si el shader es complejo | C: `CatalogoDeEfectos` (lista blanca + Zod de parámetros). R: HyperFrames (+GSAP, GL Transitions). C: compositor de rótulos (fontkit → trazos, Sharp). | `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `gl-transitions`, `motion-design-craft`, `motionboard` (match cuts, tipografía cinética), `product-launch-motion` (motion blur con `tmix`, retícula de beats). Bajo demanda y justificados: GSAP, Lottie/Rive, Three.js, D3/Manim | Efecto con id, parámetros, frames, licencia, fallback y preview. Revelado de texto por máscara. | Efectos sin función narrativa escrita. Paquetes fuera de la lista. |
| **Sonido** | Hydrogen | F: mezcla, `loudnorm` (−14 a −16 LUFS, ≤ −1 dBTP), detección de silencio. C: Whisper/WhisperX si hay voz. | `audio-mixing`, `captions-subtitles`, `voiceover-tts`, `media-use`. Música, SFX y voz: ElevenLabs (API, con licencia y condiciones de datos), ACE-Step (música), Kokoro/Piper (TTS local), whisper.cpp/WhisperX (alineación). Retícula de beats de `product-launch-motion` para cortar a tempo | Mezcla con procedencia y licencias. | Música sin permiso. |
| **Editor de voz / talking-head** (solo si el `SkillResolver` detecta una persona hablando) | Hydrogen | F: cortes y silencios. C: WhisperX o faster-whisper con tiempos por palabra, reencuadre vertical consciente de la cara. | `video-agent-skill/reel-editor` (Apache-2.0), `reel-editing-skills` (`do-a-rough-cut`, `do-a-fair-cut`, `instagram-reel-editor`; MIT), Vedit (MIT), `pitch-video` (MIT, sincronía de voz). **`ghost-editor` excluido** (sin licencia) | Mejor toma, transcripción, cortes por palabra, subtítulos y mapa de inserciones. | Tapar la cara. Atribuir frases que la persona no dijo. |
| **Crítico de fidelidad** | Hydrogen | F: hojas del máster. C: inventario y fuentes. **Hoja comparada referencia ↔ máster por tramo y banda.** | `video-qa`, `thumbnails` (hojas comparadas). Comprobación de manos y dedos con MediaPipe sobre los fotogramas de contacto | `VisualReviewReport` con incidencias, tiempos, fotogramas, responsable y reparación. | Aprobar sin comparar con la referencia. |
| **Crítico editorial/social** | Hydrogen (otra pasada, rúbrica distinta) | F: preview a 360 px, en silencio y con sonido. | `vertical-shorts`, `video-qa` | Gancho, lectura móvil, ritmo, especificidad del local; nota **y parecido con la referencia**. | Inventar métricas de audiencia. |
| **Árbitro** | **Neon**; Argon con autorización | Lectura de ambos informes y del máster. | — | Decisión de reparación localizada. | Ordenar regenerar todo ante un fallo local. |


### 4.1 Herramientas del catálogo que se habían quedado fuera

Revisión de [catalogo_skills_herramientas_video_IA.md](catalogo_skills_herramientas_video_IA.md) contra la matriz. Lo siguiente ya está incorporado en las filas de arriba; esta tabla explica por qué cada pieza importa.

| Herramienta (catálogo) | Agente | Por qué hace falta | Condición |
|---|---|---|---|
| `media-use` (HyperFrames) | Motion designer, sonido | Integra música, SFX, logos, locución y medios generados en la composición. Sin ella, el compositor no tiene una vía documentada para el audio y los recursos de marca. | Apache-2.0 |
| `thumbnails` (agents-video-editing-skills) | Montador, analista, críticos | La entrega incluye portada y el sistema vive de hojas de contacto (referencia, brutos, comparada). | MIT |
| `platform-export` (agents-video-editing-skills) | Productor, montador | Perfil de exportación de Instagram Reels y otras plataformas, además de la validación propia del máster. | MIT |
| `website-to-hyperframes`, solo fase de análisis | Documentalista | Extrae de la web del local paleta, tipografías, assets y descripción visual (`DESIGN.md`). Alimenta el perfil de marca de un local nuevo. No se usa su generación de vídeo. | Plugin de OpenAI sobre HyperFrames. Revisar licencia del plugin. |
| yt-dlp (citado en `demo-video-creator`) | Analista | Descarga fiable del MP4 completo de Pinterest, Instagram o TikTok. En el piloto hubo un HLS truncado y la descarga se hizo a mano. | Herramienta CLI. Respetar los términos de cada plataforma: la referencia es para análisis, no para el montaje. |
| `reel-editing-skills`: `create-reel-editing-brief`, `grill-me-reel-edit`, `reel-asset-board` | Estratega/guionista, Productor | Brief de edición por beats, interrogatorio sobre gancho y ritmo antes de rodar, y tablero de activos aprobados. | MIT. Adaptar al contrato del Productor. |
| `video-agent-skill/reel-editor` | Estratega, montador, editor de voz | Variantes de gancho sobre el mismo bruto, como pide Ads Studio: cambiar el titular sin regenerar. | Apache-2.0 |
| MediaPipe (en `pitch-video`) | Director de movimiento, crítico de fidelidad | Puntos clave de la mano para detectar dedos de más o de menos y contactos imposibles en brutos Magi, el fallo típico de manos con vaso. | Licencias de los modelos MediaPipe |
| `motionboard`, `product-launch-motion` | Motion designer, sonido | Recetas de match cut y tipografía cinética. Motion blur con `tmix` y corte en retícula de beats. | MIT |
| `motion-film-skill` | Director de movimiento, director | Exige una prueba de movimiento corta antes de la pieza completa y valida afirmaciones y procedencia. Es el mismo principio que el control de 4 s de Magi. | MIT |
| ElevenLabs, ACE-Step, Kokoro/Piper, whisper.cpp | Sonido, editor de voz | El agente de sonido no tenía fuente de música, SFX ni voz. Hasta ahora la mezcla del piloto se sintetizó a mano. | Cada servicio tiene licencia, cuota y condiciones de datos propias. ElevenLabs va por API con clave en `.env`; registrar la licencia de cada pista. |
| Vedit (`edl.json`), `remotion-render` (OpenTimelineIO) | Montador (fase 1 y 7) | Referencias de formato de EDL para que el `TimelineManifest` pueda exportarse a editores externos. | Vedit MIT. Remotion sujeto a su licencia, así que solo se toma como referencia de formato. |
| Ruta talking-head: `video-agent-skill`, `reel-editing-skills`, Vedit, `pitch-video` | Editor de voz (nuevo, opcional) | La matriz no cubría encargos con una persona del local hablando, previstos en la propuesta (sección 11). | `ghost-editor` excluido por falta de licencia. |
| MoviePy, Playwright/Chromium | Montador, motion designer | Playwright es requisito del render de HyperFrames y del análisis web. MoviePy queda como alternativa en Python para composición de máscaras, no como ruta principal. | — |

Siguen fuera de la ruta comercial: `onetake` (PolyForm NC), OpenMontage (AGPLv3), `ghost-editor` (sin licencia), Shorz (es MCP y producto de terceros) y Remotion (hasta confirmar licencia). Digital Samba Toolkit y `demo-video-creator` no aportan una herramienta que falte: horizontal, o generación con motores externos al contrato Nano/Magi.


### 4.2 Las skills son una pieza crítica: auditar a fondo e integrar a medida

La calidad de cada agente depende sobre todo de la skill que recibe: sus reglas de oficio, sus recetas, sus listas de comprobación y sus scripts. Por eso **ninguna skill del catálogo entra tal cual**. Cada una se analiza en profundidad, se extrae solo lo que mejora este sistema de reels y se reescribe como skill interna de SOCIETY, adaptada a nuestros contratos, herramientas y reglas.

**Qué significa «analizar en profundidad» una skill.** Leer entero su `SKILL.md`, todas sus referencias, ejemplos y scripts, y su licencia, en la versión fijada. No vale con el README ni con este catálogo. Después, responder por escrito en una ficha:
1. **Qué decisión o tarea de nuestro flujo mejora** (agente, fase y contrato concretos). Si no mejora ninguna, se descarta.
2. **Qué contiene de valor:** reglas de oficio, recetas de planos o efectos, criterios de rechazo, listas de QA, scripts deterministas, parámetros probados.
3. **Qué choca con nuestro sistema:**
   - Generar con otros motores en vez de Nano y Magi.
   - Usar MCP.
   - Llevar su propio orquestador o estado.
   - Asumir formato horizontal, React o Claude Code.
   - Licencia no comercial o desconocida.
   - Instrucciones que permiten al modelo gastar o ejecutar shell.
4. **Qué se incorpora y cómo:** regla, receta, checklist, script envuelto como herramienta C, o parámetro en el `CatalogoDeEfectos`.
5. **Qué se descarta y por qué.**
6. **Cómo se comprobará que aporta:** con qué fixture y qué métrica.

**Cómo se integra.** Lo que se incorpora se reescribe en `recursos/reel/skills/<rol>/<id>/SKILL.md`:
- En español, con nuestro vocabulario (comanda, inventario confirmado, `ShotContract`, `TimelineManifest`, `TypographySpec`).
- Apuntando a nuestras herramientas C, F, G, H y R y a las funciones compartidas con posts (sección 2.1).
- Con las lecciones del piloto de cócteles como reglas explícitas cuando apliquen.

Cada skill interna guarda su procedencia: repositorio, commit o versión, archivos de origen, licencia y hash. Lleva también la fecha de revisión. Una skill de origen con licencia incompatible solo puede inspirar una reescritura independiente; no se copia su texto ni su código.

Hay que partir también de las skills propias que ya existen, antes que de las externas: la skill `director-reels` de Society (contrato de plano, prompts Nano y Magi, revisión de realismo) y `directoria`, ambas citadas en ARQUITECTURA-AGENTICA. Las skills externas se usan para completar los huecos.

**Cómo se demuestra que aporta.** Para cada skill interna se ejecuta la tarea de su agente sobre los fixtures (pilotos de cócteles y Torre de Vega) **con y sin la skill**, con el mismo modelo y las mismas entradas. Solo se activa si mejora la métrica de su fase (por ejemplo, el analista con `reverse-any-video` describe bien los tramos 2 y 3 del pin, o el montador con `video-qa` caza el texto delante del vaso) sin empeorar coste ni tiempo de forma injustificada. Si no mejora, se archiva con su ficha y su motivo.

**Cómo se carga.** El `SkillResolver` entrega a cada agente solo las skills internas aprobadas para su rol y su tipo de material, con un límite de tamaño de contexto por encargo. El expediente de cada reel registra qué skills y qué versiones se usaron.

**Reglas de herramientas:**

- Las herramientas G y H (generar imagen, subir medios, generar vídeo) solo las invoca el Productor. Ambas son APIs HTTP con clave en `.env`; no hay herramientas MCP en el sistema.
- Las herramientas F y R se ejecutan con argumentos validados, nunca con cadenas de shell que escriba un modelo.
- Skills con licencia problemática fuera de la ruta comercial: `onetake` (PolyForm NC), OpenMontage (AGPLv3), `ghost-editor` (sin licencia) y Remotion (hasta confirmar licencia).

---

## 5. Fases de construcción

Formato de cada fase: **objetivo → prompt → criterio de salida**. El agente constructor trabaja en TypeScript (Node ≥ 24, Zod, `tsx --test`), respeta la arquitectura de puertos y adaptadores de `src/` y añade un doble simulado por cada puerto nuevo.

### Fase 0 · Reconocimiento (sin código)

**Prompt de la fase**

> Lee los documentos de la tabla de fuentes y el código de `src/puertos`, `src/adaptadores/gemini`, `src/adaptadores/higgsfield`, `src/aplicacion/productor`, `src/dominio/reel/planReel.ts` y `src/dominio/tipografia`. Lee también todo lo de la sección 2.1: `src/dominio/referencia.ts`, `luzFotografica.ts`, `inventario.ts`, `cotejo.ts`, `promptFiel.ts`, `comprobacionSalida.ts`, `src/dominio/marca`, `src/dominio/arte`, `src/aplicacion/referencias` y `src/aplicacion/tipografia`. Escribe `diseno/reel/construccion/00-estado.md` con tres tablas (la primera recorre una a una las capacidades de la sección 2.1):
> 1. Puertos y adaptadores existentes que el sistema de reels reutiliza tal cual.
> 2. Los que hay que ampliar, con su motivo.
> 3. Los que hay que crear: `ProveedorDeModelos`, `ModelRouter`, `GeneradorVideo`, `AnalizadorTemporal`, `MontadorDeVideo`, `CompositorMotionGraphics`, `CatalogoDeEfectos` y `RegistroDeHerramientas`.
>
> Comprueba también qué binarios hay en la máquina (`ffmpeg` con o sin `drawtext`/freetype, `tsrct`, `npx hyperframes`, `yt-dlp`) y qué credenciales están configuradas (`GEMINI_API_KEY` con `GEMINI_FACTURACION` y `GEMINI_MODELO_IMAGEN`, y `HF_KEY` para la API de Higgsfield; el MCP no se usa), sin imprimir secretos. No escribas código.

**Criterio de salida:** el documento lista cada pieza con su ruta y estado, y la lista de binarios que faltan.

### Fase 1 · Contratos de datos

**Prompt de la fase**

> Crea `src/dominio/reel/contratos/` con esquemas Zod y tipos para todos los contratos que se enumeran a continuación. Parte de los JSON de la sección 9 de la propuesta, pero corrige con las lecciones del piloto de cócteles.
> - **`AgentTask`:** `taskId`, `reelId`, `revisionHash`, `agentRole`, `objective`, `inputs`, `allowedTools`, `allowedEffects`, `outputSchema`, `modelPolicy` y `budget`.
> - **`AgentResult`:** `status`, `artifactRefs`, `evidence[]`, `issues[]`, `confidence`, `usage` con modelo, tokens y USD, y `durationMs`.
> - **`DecisionDelDirector`:** `encargos: AgentTask[]`, `peticionesAlProductor[]`, `siguientePaso` (enum) y `motivo` breve.
> - **`AnalisisDeReferencia`:**
>   - `fuente` con URL, ruta local, SHA-256, dimensiones, fps y duración.
>   - `cortes[]` con su método.
>   - `bandas` o regiones.
>   - `tramos[]`. Cada tramo tiene `tIn`, `tOut`, `porBanda[]` y tres fotogramas en disco. Cada banda lleva `queSeVe`, `queHaceElSujeto` (verbo, dirección, sale de cuadro sí/no), `queHaceElTexto` (aparece, se mantiene o sale, y cómo), `fondo` y **`ficha: FichaReferencia`** (el esquema existente `referencia/ficha@1`, importado de `src/dominio/referencia.ts`, con `lecturaFotografica` obligatoria: luz, cámara, materiales…) y `aptitud` (plantilla, marca de agua, tarjeta final).
>   - `tipografia: TextoMedido[]`.
>   - `decisiones[]` con conservar, adaptar o descartar y su motivo.
>
>   El esquema **rechaza** un tramo sin los tres fotogramas o con `queSeVe` de menos de 40 caracteres.
> - **`TextoMedido`:** texto, caja de tinta, altura de versal en px, x de inicio, línea de base, color, efectos, fuente candidata con su error de ancho y `apareceAlPasoDe` (opcional).
> - **`TypographySpec`:** familia y archivo del catálogo, peso o eje variable, cuerpo, posición por banda, color, sombra, aparición y salida.
> - **`ShotContract`:** campos de la propuesta más `medio: 'video' | 'foto'`, `movimientoSujeto` (dirección, contacto, salida completa, prohibiciones como «no gira») y `capas` (fondo, texto, sujeto con máscara).
> - **`TimelineManifest`:** segmentos con origen y destino en fotogramas, capas, texto anclado y `approvalRef`.
> - **`EffectRecipe`.**
> - **`VisualReviewReport`:** incidencias y, además, `parecidoConReferencia` por tramo y banda.
>
> Añade tests con un caso válido y otro inválido por esquema. Reutiliza el análisis real del pin `piloto-cocteles/referencia/pin-511017888998079557.mp4` como fixture del `AnalisisDeReferencia`, con las medidas del README.

**Criterio de salida:** `npm run typecheck` y `npm test` pasan. El fixture de cócteles valida, y una versión sin fotogramas en el tramo 2 falla.

### Fase 2 · `ProveedorDeModelos`, `ModelRouter` y bucle de Neon

**Prompt de la fase**

> 1. Crea el puerto `ProveedorDeModelos` con `ejecutar<T>(tarea: AgentTask, contexto, esquema: ZodType<T>): Promise<AgentResult & { salida: T }>`. Adaptadores: `GeminiNeon`, `GeminiHydrogen` y `GeminiArgon` sobre `ClienteGemini`, con salida JSON, `alUsar` y tiempos máximos mayores para entradas de vídeo. Doble: `ProveedorModeloSimulado`, determinista.
> 2. Crea `ModelRouter` con la tabla de la sección 3.2. Incluye la escalera de reintentos (Hydrogen ×2 → Neon → Argon con autorización) y la tabla de tarifas versionada en `src/dominio/reel/tarifasGemini.ts`, con fecha de vigencia, para el cambio de Argon del 01/12/2026.
> 3. Crea `aplicacion/reel/orquestador.ts` con el bucle de la sección 3.1. El orquestador valida cada `AgentTask` que proponga el Director contra la lista blanca del rol (sección 4) y contra el presupuesto restante. Ejecuta en paralelo los encargos independientes con un límite de concurrencia y persiste todo en el expediente del reel (`datos/reels/<id>/`) con bitácora JSONL.
> 4. Añade la configuración `GEMINI_MODELO_DIRECTOR`, `GEMINI_MODELO_ESCALADO` y `GEMINI_TOPE_USD_REEL`. Si el tope no cubre una llamada a Neon, el router baja a Hydrogen como Director y lo registra.
> 5. Privacidad: si `GEMINI_FACTURACION` no es `si`, el router **rechaza** enviar datos marcados como reales de cliente; solo admite datos sintéticos o anonimizados.
>
> Tests con el doble:
> - Neon propone un encargo con una herramienta no permitida y queda rechazado.
> - Un encargo que excede el presupuesto se convierte en petición al Productor.
> - Dos encargos independientes se ejecutan en paralelo.
> - El fallo doble de Hydrogen escala a Neon.
> - Sin tope, se usa el modo económico.

**Criterio de salida:** un reel simulado recorre el bucle completo sin red, y el registro muestra el modelo, los tokens y el USD de cada decisión.

### Fase 3 · Registro de herramientas y skills

**Prompt de la fase**

> Crea `recursos/reel/herramientas.json` y su validador. Cada entrada declara:
> - `id`, `tipo` (C, H, F, S o R), roles permitidos y la firma de entrada y salida.
> - Si gasta, la licencia, `usoComercial` (sí, no o pendiente) y la versión fijada.
>
> Carga las de la matriz de la sección 4, incluidas las de la sección 4.1 (yt-dlp, `media-use`, `thumbnails`, `platform-export`, MediaPipe, proveedores de audio y la ruta talking-head) con su licencia y su condición de activación. Crea `SkillResolver`: dado el tipo de material (producto, talking-head, referencia a desarmar, demo web, 3D), devuelve solo las skills pertinentes, siguiendo la tabla 5.3 de la propuesta. El `SkillResolver` solo entrega skills **internas y aprobadas** en la fase 3b, con su hash registrado en el expediente. Las skills externas no se cargan directamente a ningún agente.
>
> Implementa como herramientas C, con argumentos tipados y `execFile` (nunca shell):
> - `ffprobeAnalizar`
> - `extraerFotogramas` (por tiempos y por fps)
> - `hojaDeFotogramas`
> - `detectarCortes` (global y por región)
> - `medirSonoridad`
> - `descargarReferencia` con yt-dlp, o la URL MP4 de mayor resolución de la página como alternativa. MP4 completo; rechaza HLS si la duración no coincide con la declarada.
>
> Las de generación quedan envueltas en el `GeneradorImagen` (API de Gemini) y el `GeneradorVideo` (API de Higgsfield) del Productor.

**Criterio de salida:**
- Un rol que pide una herramienta de otro rol recibe un error.
- Una skill o efecto con `usoComercial` distinto de «sí» no entra en la ruta comercial.
- `descargarReferencia` sobre el pin de cócteles guarda 12,1 s a 720 × 1280.

### Fase 3b · Auditoría profunda e integración de skills

**Prompt de la fase**

> Aplica la sección 4.2 a todas las skills nombradas en la matriz de la sección 4 y en la 4.1, una por una, empezando por `director-reels` y `directoria` de Society.
> 1. Descarga cada skill en la versión fijada a `vendor/skills/<id>@<versión>/`, fuera de la ruta de carga de los agentes. Lee todos sus archivos.
> 2. Escribe su ficha en `diseno/reel/construccion/skills/<id>.md` con los seis apartados de la sección 4.2 y citas exactas (archivo y sección) de lo que se incorpora.
> 3. Reescribe lo que aporta como skill interna en `recursos/reel/skills/<rol>/<id>/SKILL.md`, adaptada a nuestros contratos, herramientas y reglas (API de Gemini y de Higgsfield, nunca MCP; Productor en código; funciones compartidas con posts). Los scripts útiles se convierten en herramientas C con tipos y tests, no se ejecutan desde la skill.
> 4. Mide cada skill interna con y sin ella sobre los fixtures de su fase y anota el resultado en la ficha.
> 5. Resume en `diseno/reel/construccion/skills/README.md` una tabla con skill, agente, decisión (incorporada, parcial, descartada), qué aporta, licencia y resultado de la medición.
>
> No marques una skill como incorporada sin ficha, sin reescritura y sin medición.

**Criterio de salida:**
- Cada skill de las secciones 4 y 4.1 tiene ficha y decisión.
- Las incorporadas tienen skill interna con procedencia y mejora medida.
- Ningún agente recibe texto de una skill externa sin pasar por la reescritura.
- Un test comprueba que una skill interna no menciona MCP, motores de generación fuera de Nano/Magi ni comandos de shell libres.

### Fase 4 · Analista de referencias con metrología tipográfica

Esta fase corrige directamente el fallo del piloto: se dedujo el contenido de los tramos 2 y 3 en vez de mirarlo, y se eligió la fuente sin medir.

**Prompt de la fase**

> Implementa `AnalizadorTemporal` (código) y el agente `AnalistaDeReferencias` (Hydrogen, multimodal).
> 1. **Código:** descargar, `ffprobe`, cortes globales y por región, división en bandas si las hay, tres fotogramas por tramo y banda, y hoja completa a 2,5 fps.
> 2. **`medirTexto` (código, Sharp):** localiza píxeles de texto por umbral y color dentro de la región indicada y devuelve la caja de tinta, la altura de versal, la línea de base y el color medio. **`emparejarFuente`:** para cada fuente y peso de `recursos/tipografias/catalogo.json`, maqueta con fontkit el mismo texto y elige el cuerpo y la fuente que minimizan el error de ancho de tinta en al menos dos rótulos. Validación: con el pin de cócteles debe salir Montserrat, unos 30 px a 720 de ancho, peso 400 aproximado y error ≤ 3 %.
> 3. **Agente (Hydrogen):** recibe los fotogramas y las medidas, y rellena `queSeVe`, `queHaceElSujeto` y `queHaceElTexto` por tramo y banda. No puede escribir una celda sin haber recibido su fotograma. Para la ficha de cada fotograma clave **reutiliza `AnalistaReferenciasGemini` y sus instrucciones**, con familias, lectura fotográfica de luz, cámara y materiales, paleta k-means, capas, retícula y tipografía por rol. Añádele solo el contexto temporal (tramo, banda y qué cambia respecto al fotograma anterior). La paleta y la escala tipográfica salen de las medidas de código, no del modelo.
> 4. **Comprobación cruzada (otra pasada de Hydrogen o código):** compara la descripción con una segunda hoja de fotogramas desplazada 0,2 s y marca las contradicciones.
>
> Fixture de regresión: el análisis del pin de cócteles debe describir el tramo 2 como guarnición o gesto en primer plano oscuro y el tramo 3 como un nuevo decorado con vertido. Una salida que diga «zoom sobre la bebida» o «vuelve la copa» falla el test, porque es justo el error documentado en el piloto.

**Criterio de salida:** el análisis del pin pasa el fixture y la tipografía emparejada coincide con la medida del README.

### Fase 5 · Dirección: conceptos, escaleta y contratos de plano (Neon)

**Prompt de la fase**

> Conecta el `DirectorCreativo` existente con el `ProveedorDeModelos`, usando Neon como modelo por defecto. Entrada: brief, inventario confirmado, `AnalisisDeReferencia` y presupuesto. Salidas:
> - Tres conceptos de mecanismo distinto, validados por código: deben diferir en `mecanismo`, no solo en titular.
> - Tras la elección humana, la escaleta y los `ShotContract[]`.
> - La `TypographySpec` derivada de `TextoMedido` y contrastada con el perfil de marca (`src/dominio/marca/perfil.ts`) y con `buscarTipografia`.
> - La pauta de luz de cada plano con `luzFotografica.ts` (modo NATURAL o ESTUDIO y balance neutro), partiendo de la lectura fotográfica de la referencia.
> - Prompts de fotograma y de movimiento construidos con `promptFiel` desde el inventario confirmado, y textos y nombres pasados por `cotejo`.
> - Una tabla de desviaciones respecto a la referencia, con su motivo.
>
> Validaciones de código:
> - Cada tramo de la referencia tiene un plano propio o una desviación anotada.
> - Si la referencia es vídeo en un tramo, el plano es `medio: 'video'`.
> - La tipografía no se aparta de la medida sin una desviación anotada.
> - Todo texto con `apareceAlPasoDe` declara capas y máscara.
>
> El Director identifica el plano de mayor riesgo para el control de 4 s.

**Criterio de salida:** con el fixture de cócteles, un plan que usa zoom sobre foto en el tramo 2 sin anotarlo queda rechazado. Uno con el gesto de guarnición en vídeo pasa.

### Fase 6 · Generación: Nano Banana Pro (API de Gemini) y Magi 2 (API de Higgsfield)

**Prompt de la fase**

> **Fotogramas · Nano Banana Pro por la API de Gemini (Google AI Studio).** No crees un adaptador nuevo: reutiliza la ruta del generador de posts (`GeneradorFotoGemini`, `src/adaptadores/gemini/imagenGemini.ts`, `src/herramientas/generarGeminiImagen.ts`) con `GEMINI_MODELO_IMAGEN=gemini-3-pro-image`.
> - Amplía la ruta para la petición del reel: hasta 14 imágenes de referencia ordenadas con su papel, aspecto 9:16 o 16:9 según la banda, y 2K.
> - Normaliza a 1080 × 1920 (o al tamaño de banda) guardando el original y el derivado con hash.
> - Cada fotograma pasa la **comprobación de salida existente** (`comprobacionSalida.ts` con `RevisorVisual`: checklist de elementos, recuento, anatomía, añadidos, texto y misma toma). Tras descargar un bruto Magi, la misma comprobación se aplica a sus fotogramas de inicio, contacto y salida.
> - El tope y el registro de gasto son los existentes (`datos/gasto/gemini.jsonl`), más `reelId` y `planoId`.
> - Con datos reales de cliente, exige `GEMINI_FACTURACION=si`.
>
> **Vídeo · Magi 2 por la API de Higgsfield.** Crea el puerto `GeneradorVideo` con `estimar`, `enviar` y `consultar`/`descargar`, y su adaptador sobre el `ClienteHiggsfield` existente (HTTP, `HF_KEY`) con `sand/magi-2/image-to-video` y `reference-to-video`.
> - Los fotogramas aprobados se suben por la API de Higgsfield y se pasan como las URL o IDs que acepte ese endpoint.
> - **No uses el MCP de Higgsfield en ningún paso**, tampoco para cotizar ni consultar.
>
> Aplica las reglas de ARQUITECTURA-AGENTICA, «Contrato con Higgsfield»:
> - 9:16 o 16:9 según la banda, 1080p, segundos enteros entre 4 y 30, y audio decidido.
> - Una generación Magi activa por cuenta: cola en el Productor.
> - Clave de idempotencia ligada a encargo, revisión, activos y parámetros.
> - El ID remoto se guarda antes de consultar el estado.
> - Ante un timeout, primero se consulta el estado y después se decide.
> - Se registra el gasto estimado, debitado y reembolsado.
>
>
> **Prompt de Magi (compilado desde `ShotContract`, en inglés):** sujeto que debe sobrevivir, gesto único con dirección, qué agarra la mano, prohibiciones («never rotated»), salida completa del cuadro antes de t, estado final y «no text». Tras descargar, el código muestrea a 0,5 s y comprueba la dirección de salida con el mate por diferencia (el borde se mueve hacia el lado declarado). Si no cumple, se marca como rechazo y no se monta.
>
> Paradas humanas: aprobación de fotogramas, del control de 4 s y del gasto de la tanda.

**Criterio de salida:**
- Con el doble: una respuesta perdida no duplica el cargo.
- Un fallo bloquea la tanda.
- Un clip que gira en vez de salir de cuadro se rechaza automáticamente con el detector de dirección.
- Con red real, una prueba opcional de 4 s y su gasto registrado.

### Fase 7 · Montaje por capas (Tesseract + FFmpeg + compositor de rótulos)

**Prompt de la fase**

> Implementa `MontadorDeVideo` a partir del `TimelineManifest`. Generaliza lo que el piloto hizo a mano en `piloto-cocteles/montaje-v3/` (`montar.sh`, `capas.mjs`, `rotulos.mjs`):
> - **Rótulos** a partir de `TypographySpec` con el **mismo motor de texto del compositor de posts** (`MotorTexto`, `tipografias.ts`, fuentes reales del catálogo), extendido para exportar capas RGBA por fotograma. No depende de `drawtext`. La legibilidad se verifica con el `LectorDeTexto` (OCR) y la medida de `verificacion.ts` sobre el peor fotograma del intervalo.
> - **Máscara del sujeto:** mate por diferencia o el puerto `Segmentador` existente.
> - **Mate del sujeto:** diferencia contra el fondo vacío cuando la cámara es fija; SAM 2 o GrabCut como adaptador opcional si la cámara se mueve.
> - **Revelado del texto columna a columna** tras el borde del sujeto, usando el mínimo o máximo acumulado del borde según la dirección.
> - **Capas:** fondo / texto / sujeto.
> - **Montaje:** trim, concat y reverse con FFmpeg. Bandas apiladas cuando la referencia es un tríptico.
>
> Adaptador maestro: Tesseract (`tsrct`), con capas nativas y medios y fuentes empaquetados, reabrible. Si `tsrct` no está, el adaptador FFmpeg produce el máster y el expediente lo registra como «sin editable».
>
> `CompositorMotionGraphics` con HyperFrames solo para efectos del `CatalogoDeEfectos` (empieza con 3 o 4: `cut`, `xfade`, un GL Transition y un título GSAP), con preview y fallback.
>
> El montador entrega primero un corte limpio sin efectos.

**Criterio de salida:**
- Reconstruir el v3 de cócteles desde un `TimelineManifest`, idéntico en tiempos y posiciones de rótulo.
- Cambiar solo un rótulo produce un máster nuevo sin gasto de generación.

### Fase 8 · Crítica comparada y reparación localizada

**Prompt de la fase**

> Implementa los dos críticos (dos pasadas de Hydrogen con rúbricas y contextos separados; ninguno ve el informe del otro) y el árbitro (Neon). Parte de lo que ya existe: `CriticoEditorial`, `CriticoDeArte`, `ComparadorDeArte` y la rúbrica de `src/dominio/arte/rubrica.ts`, aplicados a fotogramas del máster. Añade los ejes temporales (ritmo, aparición de capas, continuidad de luz y parecido por tramo). Para comparar con la referencia, usa las mismas `FichaReferencia` del análisis frente a fichas del máster en los mismos tiempos.
>
> Entradas obligatorias:
> - Máster.
> - **Hoja comparada referencia ↔ máster por tramo y banda** (mismos tiempos relativos, lado a lado).
> - Inventario.
> - Plan y desviaciones anotadas.
>
> Cada crítico puntúa dos ejes por separado:
> - **Calidad:** fidelidad u oficio.
> - **Parecido con la referencia:** por tramo y banda.
>
> Toda incidencia lleva tiempo, fotogramas, responsable y reparación. Una desviación no anotada se considera incidencia mayor.
>
> El validador técnico (código) comprueba 1080 × 1920, fps, duración, H.264/AAC, −14 a −16 LUFS y ≤ −1 dBTP, ausencia de fotogramas negros, texto dentro de las zonas seguras y texto que no se mueve sin motivo.
>
> El árbitro convierte las incidencias en `AgentTask` de reparación acotados al segmento o la capa, nunca en «regenerar el reel». Salida del pase: ≥ 8,5 por crítico en ambos ejes, como máximo tres rondas; si no se alcanza, parada humana con el corte y la incidencia.

**Criterio de salida:** el v2 de cócteles debe suspender con incidencias equivalentes a las que puso el usuario:
- Solo hay vídeo en la toma 1.
- Movimientos 7/10, 3/10 y 0/10.
- Tipografía distinta de la medida.
- Nombres por delante de las copas.
- Tramos 2 y 3 distintos del original.

Si los críticos aprueban el v2, la fase no está terminada.

### Fase 9 · Extremo a extremo y paradas humanas

**Prompt de la fase**

> Añade `npm run reel -- <comanda.json>` y las rutas web de la comanda del reel, reutilizando el patrón del Productor de El Pase: huellas, `via: web | terminal` y caducidad de aprobaciones.
>
> Las paradas son:
> 1. Concepto, inventario y gasto.
> 2. Fotogramas.
> 3. Control de 4 s y tanda Magi.
> 4. Máster.
>
> Un cambio de plato invalida sus fotogramas, sus brutos y las aprobaciones descendientes. Un cambio de mezcla solo invalida el máster.
>
> La entrega incluye el MP4, el proyecto editable, los fotogramas, los brutos, el `TimelineManifest`, los prompts efectivos, las recetas de efectos, el informe de los críticos y el registro de gasto (modelos Gemini y Higgsfield por separado).

**Criterio de salida:** en modo simulado pasan las pruebas heredadas (sección 12.1 de la propuesta) y las nuevas (12.2), más las de las fases 4 a 8.

### Fase 10 · Benchmark de Neon, Hydrogen y Argon, y mejoras opcionales

**Prompt de la fase**

> Ejecuta las siete tareas del benchmark (sección 12.4 de la propuesta) con briefs anonimizados, añadiendo **«analizar la referencia de cócteles»** como tarea 8.
>
> Condiciones:
> - Mismas skills, entradas y rúbrica.
> - Puntuación a ciegas.
> - Registro de tokens y USD.
>
> Decide con datos en qué roles Neon mejora el **coste por reel aprobado** y fija la política del router en consecuencia.
>
> Opcional: *function calling* de Gemini solo para herramientas de lectura del expediente y del catálogo.

**Criterio de salida:** un informe con la tabla calidad/coste por rol y modelo, y el router actualizado con su justificación.

---

## 6. Qué no hacer (resumen para el agente constructor)

- No dejes que un modelo escriba comandos de shell, nombres de efectos libres o parámetros sin esquema.
- No uses Neon para tareas rutinarias (FFprobe, subtítulos, keyframes) ni Argon «porque la tarea es larga».
- No envíes datos reales de clientes al tier gratuito.
- No uses el MCP de Higgsfield ni generes Nano Banana Pro por Higgsfield: Nano va por la API de Gemini (la ruta de posts) y Magi 2 por la API de Higgsfield.
- No conviertas Tesseract, HyperFrames u OpenMontage en una segunda fuente de verdad.
- No aceptes un análisis de referencia sin fotogramas por tramo, una fuente sin medir, ni una crítica que no haya visto la referencia.
- No reutilices brutos antiguos o invertidos para ahorrar sin registrarlo como desviación.
- No cargues una skill externa sin auditarla a fondo y reescribirla como skill interna medida (sección 4.2, fase 3b).
- No dupliques lo que ya hace el estudio de posts (ficha de referencia, lectura de luz, elementos e inventario, cotejo, comprobación de salida, tipografía, marca, rúbrica de arte): se importa y se extiende (sección 2.1).
