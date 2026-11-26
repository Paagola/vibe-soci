# Catálogo de skills y herramientas para producción de vídeo con agentes de IA

**Fecha de consulta:** 26 de noviembre de 2026  
**Ámbito:** herramientas, motores de composición, skills y pipelines de agentes relacionados con creación, edición, composición y validación de vídeo.

> Este documento es un inventario técnico, no una clasificación ni una selección de herramientas. Reúne los nombres del material inicial y otros repositorios localizados durante la investigación. Las capacidades, licencias y comandos se describen según la documentación pública consultada en la fecha indicada; los repositorios pueden cambiar.

## 1. Cómo leer el catálogo

- **Motor o herramienta:** software que captura, manipula, compone, codifica o analiza medios.
- **Skill:** instrucciones, referencias y, en ocasiones, scripts auxiliares que el agente carga para ejecutar un flujo especializado. Normalmente no sustituye al motor que renderiza.
- **Pack de skills:** colección de instrucciones reutilizables para diferentes tareas o agentes.
- **Pipeline agéntico:** sistema más amplio que coordina fases, herramientas, proveedores y validaciones.
- **Skill especializada:** flujo diseñado para un tipo concreto de pieza o material de entrada. No equivale a un editor universal.

## 2. Motores y herramientas base

### 2.1 HyperFrames

- **Tipo:** framework de composición y renderizado de vídeo mediante HTML, CSS, JavaScript y medios.
- **Repositorio:** [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)
- **Documentación y producto:** [hyperframes.heygen.com](https://hyperframes.heygen.com/)
- **Función:** el agente escribe escenas HTML; HyperFrames permite previsualizarlas y renderizarlas como MP4. La composición puede controlarse por tiempo y renderizarse de forma determinista. No requiere React.
- **Capacidades citadas en el proyecto:** composición, títulos y tipografía cinética, subtítulos, overlays, transiciones, efectos, gráficos, medios, transcripción, TTS y render local o en la nube. El registro incluye bloques y componentes reutilizables.
- **Requisitos de la CLI actual:** Node.js 22 o superior y FFmpeg.
- **Comandos de inicio:**

  ```bash
  npx hyperframes init mi-video
  cd mi-video
  npx hyperframes preview
  npx hyperframes render
  ```

- **Instalación de skills:**

  ```bash
  # Pack de skills desde skills.sh
  npx skills add heygen-com/hyperframes

  # Actualizar el conjunto base
  npx hyperframes skills update

  # Todas las skills publicadas
  npx hyperframes skills

  # Instalar el conjunto completo con skills.sh
  npx skills add heygen-com/hyperframes --all
  ```

- **Conjunto base de seis skills:** `/hyperframes`, `/hyperframes-cli`, `/hyperframes-registry`, `/media-use`, `/reverse-any-video`, `/style-sampling`.
- **Tres skills adicionales publicadas bajo demanda:** `/figma`, `/slideshow`, `/remotion-to-hyperframes`.
- **Transiciones:** hay un registro de transiciones y bloques, incluidos efectos basados en shaders WebGL. Por ejemplo, el CLI permite añadir bloques registrados como `flash-through-white`.
- **Licencia:** Apache-2.0 para el framework y el conjunto open source. La aplicación alojada/Studio puede tener planes y créditos propios, distintos del render local.

### 2.2 Remotion

- **Tipo:** framework de composición de vídeo programático basado en React.
- **Web:** [remotion.dev](https://www.remotion.dev/)
- **Skills oficiales:** [Agent Skills](https://www.remotion.dev/docs/agents/skills) · [repositorio](https://github.com/remotion-dev/skills)
- **Función:** componer escenas, secuencias, animaciones, audio, gráficos y subtítulos en React; renderizar vídeo o imágenes fijas y generar timelines editables.
- **Instalación de skills:**

  ```bash
  # Desde un proyecto Remotion
  npx remotion skills add

  # Sin tener Remotion instalado previamente
  npx skills add remotion-dev/skills

  # Crear un proyecto con las skills
  npx create-video@latest --skills
  ```

- **Skills oficiales publicadas en la documentación consultada:**
  - `/remotion-best-practices`: skill paraguas que incluye las demás.
  - `/remotion-create`: creación de proyectos y composiciones.
  - `/remotion-markup`: markup React, composiciones, animación, layout, tipografía, media, efectos y audio.
  - `/remotion-studio`: vista previa mediante Remotion Studio.
  - `/remotion-render`: render de vídeo e imágenes y exportación OpenTimelineIO.
  - `/remotion-maps`: mapas animados, rutas, marcadores, GeoJSON, Mapbox, MapLibre, MapTiler y CesiumJS.
  - `/remotion-elements`: elementos y componentes de Remotion.
  - `/remotion-captions`: subtítulos y captions.
  - `/remotion-saas`: composición e integración de casos SaaS.
  - `/remotion-interactivity`: vídeo interactivo.
  - `/remotion-docs`: consulta de la documentación.
  - `/remotion-license`: licencia, FAQ, términos y compra de licencias.
  - `/remotion-upgrade`: actualización de Remotion, paquetes y skills.
  - `/remotion-multimedia`: manejo de multimedia en navegador con Mediabunny y lectura de metadatos de audio/vídeo.
- **Transiciones:** `TransitionSeries` es una API/componente de composición de Remotion para organizar escenas y transiciones; no es una skill independiente de la lista anterior.
- **Licencia:** la política vigente consultada distingue una Free License para individuos y organizaciones de hasta tres personas (sujeta a sus términos) y Company License para organizaciones que no cumplen esa exención. Para estas últimas, Remotion for Creators se publica a 25 USD/mes por usuario y Remotion for Automators a 0,01 USD por render, con mínimo de 100 USD/mes. La elegibilidad depende de la organización y del uso; consultar siempre la FAQ oficial antes de integrar un render automático.

### 2.3 FFmpeg y ffprobe

- **Tipo:** herramientas de línea de comandos para procesamiento, análisis y codificación audiovisual.
- **Web:** [ffmpeg.org](https://ffmpeg.org/) · [documentación](https://ffmpeg.org/documentation.html) · [licencias](https://ffmpeg.org/legal.html)
- **FFmpeg:** corte, concatenación, escalado, conversión de códec, filtros, mezcla de pistas, normalización de audio, fades, subtítulos, LUTs, extracción de fotogramas, miniaturas y muxing.
- **ffprobe:** lectura de metadatos del contenedor y streams: resolución, proporción, FPS, duración, códecs, bitrate, canales y frecuencia de audio.
- **Usos de control de calidad:** validar resolución y formato vertical 9:16, duración, presencia de audio, códec, FPS, streams y metadatos; extraer fotogramas para inspección visual.
- **Licencia:** FFmpeg se distribuye bajo LGPL 2.1 o posterior; algunas partes opcionales se encuentran bajo GPL. La licencia efectiva de un binario compilado depende de las opciones y componentes habilitados. Los códecs y librerías incluidos pueden tener condiciones propias.

### 2.4 Playwright y Chromium

- **Tipo:** automatización de navegador y captura de interfaz.
- **Web:** [playwright.dev](https://playwright.dev/)
- **Uso en estas pipelines:** abrir una web o app, ejecutar interacciones, capturar la interfaz, generar fotogramas y renderizar escenas HTML a través de Chromium headless. Varias skills implementan una función temporal del tipo `seek(t)` y piden a Playwright que renderice cada frame.
- **Requisitos:** Playwright y un navegador Chromium instalado. Los comandos concretos dependen del proyecto.

### 2.5 MoviePy

- **Tipo:** biblioteca Python de edición y composición audiovisual.
- **Web:** [MoviePy](https://zulko.github.io/moviepy/)
- **Uso:** componer vídeo desde Python, clips, texto, imágenes, transiciones y pistas de audio. El pack `agents-video-editing-skills` documenta MoviePy 2.x.
- **Paquetes mencionados:** `moviepy>=2` y `pillow`.

### 2.6 Herramientas de transcripción, voz y audio

Estas herramientas aparecen como componentes opcionales o integraciones en las skills y pipelines descritas más adelante:

- **Whisper / faster-whisper:** reconocimiento de voz y transcripción; `faster-whisper` es una implementación optimizada que se usa, entre otros, en `onetake` y Vedit.
- **WhisperX:** transcripción con timestamps a nivel de palabra y alineación temporal; se usa en pipelines de edición que necesitan sincronizar subtítulos y cortes.
- **whisper.cpp:** ejecución local de modelos Whisper en C/C++; aparece como verificación local opcional en `demo-video-creator`.
- **Kokoro TTS:** síntesis de voz local empleada por las herramientas de narración de `onetake`.
- **Piper TTS:** TTS local incluido como ruta disponible en el ecosistema OpenMontage.
- **Azure Speech:** integraciones de Azure para speech-to-text y text-to-speech en OpenMontage.
- **ElevenLabs:** TTS, música y efectos de sonido; usado por `demo-video-creator`, OpenMontage y otros flujos mediante API.
- **Fish Audio y Qwen3-TTS:** proveedores o modelos de voz que aparecen en las colecciones OpenMontage y Digital Samba.
- **ACE-Step:** generación musical que aparece en Digital Samba.
- **OpenAI Whisper:** opción de transcripción para el pack `agents-video-editing-skills`.

Los modelos, servicios de voz, música y generación pueden tener licencias, cuotas, tarifas y condiciones de datos separadas de la licencia de la skill que los invoca.

### 2.7 Motores y bibliotecas gráficas adicionales

- **GSAP:** animación temporal, tweens, timelines, easing y stagger. Se usa con HyperFrames y HTML.
- **Lottie:** formato/runtime de animaciones vectoriales que puede incorporarse a composiciones.
- **Rive:** herramienta/runtime para animación interactiva y gráficos vectoriales.
- **Three.js:** gráficos 3D en navegador y escenas WebGL.
- **Manim:** animación programática, especialmente matemáticas, diagramas y explicaciones visuales.
- **D3.js:** gráficos y visualizaciones de datos.
- **Blender:** composición y render 3D, personajes, cámaras, luces y escenas; opcional en el toolkit de Digital Samba y citado por `motion-film-skill`/OpenMontage.
- **Motion Canvas:** framework de animación programática; aparece como formato/código que se puede migrar o portar en el ecosistema HyperFrames.
- **Shaders WebGL / GLSL:** efectos de transición y tratamiento visual basados en GPU.

## 3. Packs de skills y sistemas de producción generales

### 3.1 Skills oficiales de HyperFrames

**Repositorio:** [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)

El proyecto publica nueve skills para agentes. Las seis del conjunto base son:

| Skill | Ámbito documentado |
|---|---|
| `hyperframes` | Contrato de composición y flujo de trabajo; estructura HTML, movimiento, planos, subtítulos, overlays y estilo. |
| `hyperframes-cli` | Scaffold, lint/check, inspección de frames, timeline, preview, render local/nube, compartir y diagnóstico. |
| `hyperframes-registry` | Buscar e instalar bloques, componentes, efectos, transiciones, overlays, gráficos y títulos reutilizables. |
| `media-use` | Integrar música, SFX, imágenes, iconos, logos, locución, avatares, vídeo generado, transcripciones y otros medios. |
| `reverse-any-video` | Analizar un vídeo de referencia y convertirlo en un proyecto HyperFrames editable. |
| `style-sampling` | Explorar y muestrear estilos visuales y referencias de composición. |

Las tres publicadas bajo demanda son `figma`, `slideshow` y `remotion-to-hyperframes`.

**Instalación:** `npx skills add heygen-com/hyperframes` o `npx hyperframes skills update`. La instalación completa está descrita en el apartado HyperFrames.

### 3.2 Skills de Remotion

**Repositorio y documentación:** [remotion-dev/skills](https://github.com/remotion-dev/skills) · [documentación oficial](https://www.remotion.dev/docs/agents/skills)

La documentación oficial consultada enumera 14 skills. Sus nombres y ámbitos están en el apartado Remotion de este catálogo. `/remotion-best-practices` funciona como skill paraguas; las restantes cubren creación, markup, Studio, render, mapas, elementos, captions, SaaS, interactividad, documentación, licencia, actualización y multimedia.

**Instalación:** `npx remotion skills add` dentro de un proyecto Remotion, o `npx skills add remotion-dev/skills`.

### 3.3 OpenMontage

- **Repositorio:** [OpenMontageInc/OpenMontage](https://github.com/OpenMontageInc/OpenMontage)
- **Web:** [openmontage.video](https://www.openmontage.video/)
- **Tipo:** sistema de producción de vídeo agéntico, no una skill aislada.
- **Dimensión declarada en el README actual:** 12 pipelines de producción, más de 100 herramientas y más de 700 archivos de skills y conocimiento de producción. El número de archivos incluye referencias y documentos de conocimiento; no equivale necesariamente a 700 skills independientes.
- **Agentes indicados:** Claude Code, Cursor, GitHub Copilot, Windsurf y Codex, además de otros asistentes capaces de leer archivos y ejecutar código.
- **Flujo de trabajo:** investigación, propuesta, guion, planificación de escenas, generación/selección de activos, edición, composición y publicación. Incluye puertas de aprobación y controles de calidad.
- **Pipelines descritos:** explainers animados, animación, presentador/avatar, piezas cinematográficas, clip factory, documental con metraje real, híbridos, localización/doblaje, reutilización de podcasts, demos de pantalla y talking-head, entre otros.
- **Herramientas por grupos:** vídeo, audio, gráficos, mejora, análisis, avatares y subtítulos. Entre ellas aparecen generación de vídeo, generación de imagen, TTS, música, mezcla, mejora de audio, subtítulos SRT/VTT, upscaling, eliminación de fondo, análisis de escenas y extracción de fotogramas.
- **Motores de composición mencionados:** Remotion, HyperFrames y FFmpeg. OpenMontage puede seleccionar un runtime para cada producción.
- **Skills internas:** organizadas en `core`, `creative`, `meta` y `pipelines`; cubren herramientas base, técnicas creativas, revisión/checkpoints y etapas de cada tipo de producción.
- **Skills/capacidades técnicas externas listadas:** FFmpeg, Remotion, HyperFrames, WhisperX, Azure Speech, sincronización de subtítulos, color grading, generación de voz, música, SFX y generación de imagen.
- **Instalación documentada:** `make setup`; consultar el README y la guía del repositorio para prerequisitos, proveedores y claves. La documentación consultada menciona Python 3.10+, FFmpeg, Node.js parcheado/reciente y un agente de código.
- **Licencia:** GNU AGPLv3. Es relevante para cualquier redistribución o integración del propio sistema.

### 3.4 Agent Video Editing Skills

- **Repositorio:** [iamaanahmad/agents-video-editing-skills](https://github.com/iamaanahmad/agents-video-editing-skills)
- **Tipo:** colección general de 14 skills portables para agentes de código.
- **Agentes documentados:** Claude Code, Codex, Kiro, GitHub Copilot, Antigravity, Windsurf, Cursor, Gemini CLI, Cline, OpenCode y Zed.
- **Skills incluidas:**
  1. `video-editing-router`: enruta la petición hacia las skills del pack.
  2. `video-planning`: brief, guion, escenas y cálculo de frames.
  3. `ffmpeg-essentials`: corte, unión, resize, compresión, velocidad y filtros.
  4. `platform-export`: exportación para YouTube, X, LinkedIn, Instagram, TikTok y web.
  5. `remotion-programmatic-video`: vídeo compuesto como código React.
  6. `moviepy-python-video`: composición Python con MoviePy 2.x.
  7. `captions-subtitles`: Whisper, SRT/ASS, subtítulos quemados y palabras resaltadas.
  8. `voiceover-tts`: síntesis de voz, audio por escena y ritmo.
  9. `audio-mixing`: ducking, loudness, limpieza de ruido y música.
  10. `screen-recording-demos`: grabaciones de pantalla con Playwright.
  11. `vertical-shorts`: reencuadre 9:16, safe zones y hooks.
  12. `motion-design-craft`: timing, easing, springs y jerarquía visual.
  13. `thumbnails`: selección de fotogramas, contact sheets y composición de texto.
  14. `video-qa`: inspección con probe, detectores y criterios de aceptación.
- **Instalación con npx:**

  ```bash
  npx agents-video-editing-skills --agent claude,kiro,codex --rules
  ```

- **Instalación alternativa desde el repositorio:**

  ```bash
  git clone https://github.com/iamaanahmad/agents-video-editing-skills
  cd agents-video-editing-skills
  python scripts/install.py --agent claude,codex,kiro --rules --project /ruta/al/proyecto
  ```

- **Requisitos declarados:** Node.js 18.3+ para el instalador npx; Python 3.9+ para el instalador Python; FFmpeg y ffprobe para la mayoría de las skills; Node para Remotion; MoviePy/Pillow para la skill MoviePy; Whisper para transcripción; Playwright para grabaciones de navegador.
- **Licencia:** MIT.

### 3.5 Digital Samba — Claude Code Video Toolkit

- **Repositorio:** [digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit)
- **Tipo:** toolkit y espacio de trabajo de producción con skills, comandos, plantillas y herramientas.
- **Función:** crear vídeos a partir de una petición o plantilla: guion, voz, música, imágenes y clips, composición y render. Incluye vídeos de demos de producto, release notes, explicadores, tutoriales, Shorts y piezas con personaje 3D.
- **Tecnologías y proveedores mencionados:** Remotion, FFmpeg, Playwright, Blender opcional, Qwen3-TTS, FLUX, ACE-Step y proveedores de GPU cloud como Modal o RunPod.
- **Inicio documentado:**

  ```bash
  git clone https://github.com/digitalsamba/claude-code-video-toolkit.git
  cd claude-code-video-toolkit
  uv sync
  claude
  ```

  En Claude Code, el repositorio documenta los comandos `/setup` y `/video`.

- **Requisitos indicados:** Node.js 22+ (24 LTS recomendado), Claude Code y `uv` para las dependencias Python. FFmpeg es opcional para el ejemplo mínimo y se usa en flujos de postproducción.
- **Costes:** los modelos pueden ejecutarse en una GPU cloud propia; el coste depende del proveedor, modelo y duración. El README publica ejemplos de costes medidos, no una tarifa universal.
- **Licencia:** MIT.

### 3.6 `website-to-hyperframes` (skill de OpenAI)

- **Skill:** `website-to-hyperframes`.
- **Repositorio:** [openai/plugins — SKILL.md](https://github.com/openai/plugins/blob/main/plugins/hyperframes/skills/website-to-hyperframes/SKILL.md)
- **Tipo:** skill de conversión de una URL en un vídeo HyperFrames.
- **Entrada:** una página o web que se quiere convertir en anuncio social, product tour o vídeo promocional.
- **Flujo documentado:** captura y análisis de la web; elaboración de `DESIGN.md`; guion; y sucesivas etapas de planificación, composición y revisión del vídeo.
- **Artefactos iniciales:** resumen del sitio, paleta, tipografías, assets, descripción visual, `DESIGN.md` y `SCRIPT.md`.
- **Relación con HyperFrames:** pertenece al repositorio de plugins de OpenAI y usa HyperFrames; no debe confundirse con una skill llamada `website-to-video` que aparece en otras colecciones.

El README del plugin HyperFrames de OpenAI describe también un conjunto que agrupa `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `gsap` y `website-to-hyperframes`. El repositorio oficial de HeyGen mantiene su propio conjunto de nueve skills, con sus mecanismos de instalación independientes.

## 4. Skills especializadas por tipo de vídeo

Las siguientes entradas son skills o repositorios orientados a casos concretos. Se presentan por familia funcional, no por preferencia ni calidad.

### 4.1 Producto, lanzamiento, motion design y demos de producto

#### 4.1.1 `onetake` — feitangyuan

- **Repositorio:** [feitangyuan/onetake](https://github.com/feitangyuan/onetake)
- **Tipo:** skill especializada de motion design para vídeos cortos de producto.
- **Alcance declarado:** launch videos, teasers, piezas de 10–30 segundos y demos narradas de funcionalidades de hasta aproximadamente 60 segundos.
- **Método:** una composición HTML controlada por `window.__seek(t)`, una biblioteca de movimientos (`lib/motion.js`), material grabado del producto, diseño sonoro y verificación automática. Cada propiedad visual se deriva del tiempo, para que los fotogramas puedan renderizarse de forma repetible.
- **Tratamiento visual:** tipografía cinética, movimientos enlazados entre planos, cámara continua, motion blur, interfaz real o reconstruida en HTML desde capturas, efectos de sonido sintetizados y ritmo musical.
- **Análisis de referencia:** estudia un vídeo de referencia, cortes, ritmo, pausas, fotogramas y continuidad para construir una propuesta de movimiento.
- **Scripts citados:** `analyze_ref.py`, `record_footage.py`, `probe.py`, `render.py`, `stills.py`, `vo_tools.py`, `frame_diff.py`, `sfx_palette.py`, `verify_promo.py`, `gallery.py` y `test_motion.js`.
- **Render descrito:** drafts a 1080p30 y finales con opción 4K60, motion blur y procesamiento por fotogramas.
- **Instalación:**

  ```bash
  # Claude Code
  git clone https://github.com/feitangyuan/onetake.git ~/.claude/skills/onetake

  # Codex / agentes que usan el directorio .agents/skills
  git clone https://github.com/feitangyuan/onetake.git ~/.agents/skills/onetake
  ```

- **Dependencias:** Python 3, Playwright/Chromium, NumPy, SciPy, Pillow, Matplotlib, FFmpeg y Node.js. OpenCV se utiliza para análisis de referencias; la narración puede requerir faster-whisper y Kokoro TTS.
- **Licencia:** PolyForm Noncommercial 1.0.0. Permite usos no comerciales; no concede permiso de uso comercial. El repositorio indica una licencia comercial separada.

#### 4.1.2 `product-launch-motion`

- **Repositorio:** [AbubakrChan/product-launch-motion](https://github.com/AbubakrChan/product-launch-motion)
- **Tipo:** skill de motion design para vídeos de lanzamiento de producto.
- **Método actual (v2):** composición HTML con función pura `seek(t)`, escenas conectadas por una forma/movimiento continuo, ritmo alineado a una cuadrícula de beats, springs cerrados y efectos sintetizados. El render usa Playwright y FFmpeg con `tmix` para motion blur.
- **Versiones:** el README mantiene una implementación anterior en `legacy/`, descrita como más adecuada para explicadores narrados; la versión principal actual es v2.
- **Instalación:** `npx skills add AbubakrChan/product-launch-motion`.
- **Licencia:** MIT para la skill y sus referencias. Los vídeos de ejemplo y sus recursos externos pueden tener derechos independientes.

#### 4.1.3 `motion-film-skill`

- **Repositorio:** [Iziedking/motion-film-skill](https://github.com/Iziedking/motion-film-skill)
- **Tipo:** skill creativa de pipeline multip motor para anuncios, launch films, explicadores y product walkthroughs.
- **Método:** propone direcciones creativas, guion, brief y una prueba de movimiento de 6–8 segundos antes de construir la pieza completa. Elige la técnica por plano: HTML/canvas, DOM/HyperFrames, Remotion, Manim/D3, shaders, Blender, Three.js, captura real de producto o montaje por lista de cortes con FFmpeg.
- **Validación:** render determinista, revisión de afirmaciones del producto, procedencia/licencia de assets, QC de frames, códec, color, loudness y reporte de exportación.
- **Instalación:**

  ```bash
  npx skillfish add Iziedking/motion-film-skill
  # alternativa directa desde GitHub
  npx github:Iziedking/motion-film-skill
  ```

- **Requisitos de render:** Node.js 18+, FFmpeg/ffprobe y Chromium mediante Playwright. Blender y Python se utilizan para determinadas rutas 3D, Manim, subtítulos o cutouts.
- **Licencia:** MIT.

#### 4.1.4 `motionboard`

- **Repositorio:** [krisyangdev/motionboard](https://github.com/krisyangdev/motionboard)
- **Tipo:** skill para HyperFrames que reúne recetas de planos y técnicas de motion design para vídeos de lanzamiento.
- **Contenido declarado en el README consultado:** 38 recetas de planos, incluidos match cuts, logo reveals, tipografía cinética, efectos tipo liquid glass y animaciones de interfaz. Cada receta incluye una recreación en código y material de referencia/preview.
- **Uso documentado:** construir un plano aislado o planificar una pieza de lanzamiento completa; también portar movimientos a una web.
- **Instalación:**

  ```bash
  npx skills add krisyangdev/motionboard
  ```

- **Requisitos:** Node.js 22+, HyperFrames y FFmpeg.
- **Licencia:** MIT, según el repositorio.

#### 4.1.5 `video-shotcraft`

- **Repositorio público consultado:** [digitalpublisher/video-shotcraft](https://github.com/digitalpublisher/video-shotcraft)
- **Repositorio de origen referenciado por el instalador:** [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)
- **Tipo:** skill de diseño de planos para vídeos cinematográficos de producto.
- **Contenido declarado en el README actual:** 152 shot recipe cards, 209 estilos/previews de movimiento y una plantilla de producción.
- **Método:** storyboard, animación y diseño sonoro con Remotion; captura real de páginas, cámara 2.5D, cortes sincronizados con beats y SFX.
- **Instalación documentada:**

  ```bash
  npx skills add Vincentwei1021/video-shotcraft
  ```

- **Licencia de la skill/repositorio:** Apache-2.0. Remotion conserva sus propias condiciones de licencia; los assets de audio tienen atribuciones y condiciones propias descritas en el repositorio.

#### 4.1.6 `motion-design-skill`

- **Repositorio:** [theatlasteam/motion-design-skill](https://github.com/theatlasteam/motion-design-skill)
- **Tipo:** skill de diseño de movimiento para interfaces y piezas de producto.
- **Capacidades:** películas HTML dirigidas, tipografía cinética, coreografía de UI, controles de estilo iOS, lanzamientos de dispositivos 3D y música MIDI sincronizada con la imagen.
- **Ejemplos incluidos:** controles de movimiento, launch de interfaz, canvas interactivo, dispositivo 3D y composición musical MIDI. Los ejemplos son proyectos ejecutables, no solo capturas.
- **Instalación:** `npx skills add theatlasteam/motion-design-skill`.
- **Nota de dependencias:** algunas demos se abren como HTML; otras necesitan `npm ci`, HyperFrames, Three.js, un modelo GLB con derechos de uso o herramientas Python/FFmpeg. El proyecto advierte que la licencia del código no concede derechos sobre modelos o medios de terceros.
- **Licencia:** MIT para el código y documentación originales. Geist, GSAP, HyperFrames, Three.js, modelos 3D y archivos de audio conservan sus licencias respectivas.

#### 4.1.7 `demo-video-creator`

- **Repositorio:** [chacha95/demo-video-creator](https://github.com/chacha95/demo-video-creator)
- **Tipo:** skill que convierte la URL de un producto en un vídeo de lanzamiento horizontal.
- **Formato documentado:** 1920×1080, 30 FPS, H.264/AAC, aproximadamente 40–60 segundos y master de audio a −14 LUFS.
- **Método:** capturas reales de la interfaz y de los outputs, una locución continua, movimiento alineado con beats, efectos de impacto, mezcla y QA. Puede generar versiones en inglés y coreano y aceptar una película de referencia.
- **Límite documentado:** salida horizontal; el README no la presenta como skill para Reels 9:16.
- **Instalación:** `npx skills add chacha95/demo-video-creator`.
- **Requisitos:** Node.js 20+, FFmpeg/ffprobe, Python 3 + NumPy, Playwright/Chromium, HyperFrames y clave de ElevenLabs para voz/música. whisper.cpp y yt-dlp son opcionales.
- **Licencia:** MIT.

### 4.2 Grabaciones reales, talking-head, reels, podcasts y clips

#### 4.2.1 `ghost-editor`

- **Repositorio:** [kurbaitaev/ghost-editor](https://github.com/kurbaitaev/ghost-editor)
- **Tipo:** skill de edición de reels verticales a partir de grabaciones talking-head con tomas repetidas, titubeos y pausas.
- **Capacidades documentadas:** escoger las mejores tomas, recortar pausas, sincronizar captions palabra a palabra, evitar tapar la cara, incorporar motion graphics y B-roll, y preparar un reel vertical 1080×1920.
- **Estilos:** el README consultado declara 19 estilos, incluidos Clean OS, Seoul list, RESULT, Face RESULT, stan style, vector explainer, POV montage, Whiteboard, Kinetic doc, Step Deck, Product page, Tactile paper, Caption News, News Package, Telestrator, Halftone Dossier, Swiss Grid, Data Story y Hologram HUD.
- **Instalación documentada:** clonar en `~/.claude/skills/ghost-editor` y seguir `docs/INSTALL.md`:

  ```bash
  git clone https://github.com/kurbaitaev/ghost-editor ~/.claude/skills/ghost-editor
  ```

- **Requisitos indicados:** Claude Code, Mac con Apple Silicon, espacio de disco para FFmpeg/Node/Python/Whisper/OpenCV; una clave de Gemini para la comprobación de B-roll y ElevenLabs solo para la narración del modo explainer.
- **Compatibilidad:** Linux y Macs Intel aparecen como no probados.
- **Licencia:** no se ha confirmado un archivo LICENSE en la ficha/README consultados; la etiqueta “open-source” del README no sustituye a una licencia explícita.

#### 4.2.2 `video-agent-skill`

- **Repositorio:** [sunithvs/video-agent-skill](https://github.com/sunithvs/video-agent-skill)
- **Tipo:** plugin de Claude Code con dos skills.
- **`reel-editor`:** Reels, TikTok y Shorts en 1080×1920; layouts de cara, split-screen, picture-in-picture, punch-ins, textos cinéticos, tarjetas y sellos sincronizados con la voz, B-roll, efectos de interfaz y variantes de hook.
- **`youtube-editor`:** vídeos largos de 5–60 minutos en 1920×1080; jump cuts, zooms, tarjetas de capítulo, lower thirds, B-roll, música, SRT, descripción, créditos, thumbnail y render por fragmentos reanudables.
- **Render:** una página HTML temporal (`seek(t)`) renderizada con Playwright y FFmpeg.
- **Instalación como plugin:**

  ```bash
  claude plugin marketplace add sunithvs/video-agent-skill
  claude plugin install video-editor@video-agent-skill
  ```

- **Instalación manual:** clonar el repositorio y ejecutar `./install.sh`.
- **Licencia:** Apache-2.0; las fuentes incluidas citadas en el README tienen SIL Open Font License 1.1.

#### 4.2.3 `pitch-video`

- **Repositorio:** [codeswithroh/pitch-video](https://github.com/codeswithroh/pitch-video)
- **Tipo:** skill para producir un pitch, demo de producto o vídeo de presentación a partir de una grabación de la persona hablando.
- **Método:** transcripción, eliminación de silencios, ajuste de ritmo, captura automatizada de la web/app con Playwright, cortes sincronizados con las frases, subtítulos, burbuja de cámara, explicadores animados, efectos cinematográficos, música atenuada bajo la voz y verificación de sincronía labial/audio.
- **Ejecución:** local, con FFmpeg, Whisper/whisper.cpp y Playwright; el README describe una ruta sin subir el vídeo a un editor cloud.
- **Instalación:** `npx skills add codeswithroh/pitch-video`.
- **Licencia:** MIT. Los modelos Whisper y MediaPipe descargados mantienen sus licencias de origen.

#### 4.2.4 `reel-editing-skills`

- **Repositorio:** [hash-anmol/reel-editing-skills](https://github.com/hash-anmol/reel-editing-skills)
- **Tipo:** pack de seis skills para editar Reels mediante un proceso por etapas.
- **Skills:**
  - `grill-me-reel-edit`: entrevista sobre hook, ritmo y decisiones editoriales.
  - `create-reel-editing-brief`: brief de producción y mapa de edición por beats.
  - `reel-asset-board`: recopilación y aprobación de assets.
  - `do-a-rough-cut`: transcripción de tomas repetidas y primer montaje.
  - `do-a-fair-cut`: ajuste de cortes, eliminación de silencios y dead air.
  - `instagram-reel-editor`: edición final en HyperFrames, captions, overlays, motion graphics y render verificado.
- **Instalación:** instalar HyperFrames; después clonar el repositorio y copiar las seis carpetas de `skills/` al directorio de skills del agente.
- **Requisitos:** FFmpeg y ffprobe; Node.js y HyperFrames para el paso final; un motor de transcripción.
- **Licencia:** MIT.

#### 4.2.5 Vedit

- **Repositorio actual:** [OpenOrbitLabs/Vedit](https://github.com/OpenOrbitLabs/Vedit)
- **Tipo:** editor de vídeo open source con CLI y skill para Claude Code.
- **Capacidades:** corte de silencios y muletillas, selección de mejores tomas, cortes a nivel de palabra, jump cuts, zooms, captions animados, reencuadre vertical consciente de caras, títulos, lower thirds, B-roll, picture-in-picture, thumbnails y exportación multi-formato.
- **Formatos/presets citados:** YouTube, Shorts, TikTok, Reels, LinkedIn, podcast y tutorial; puede generar 16:9, 9:16, 1:1 y 4:5.
- **Flujos adicionales:** transcripción/análisis, autocut, render desde un `edl.json`, contact sheets, captions, multicámara, reframe y TTS.
- **Instalación documentada:**

  ```bash
  git clone https://github.com/onetwothird/vedit.git
  cd vedit
  pip install -e ".[all]"
  vedit doctor
  ```

- **Requisitos:** Python y FFmpeg; las funciones avanzadas utilizan faster-whisper, edge-tts, OpenCV y NumPy.
- **Licencia:** MIT para el código. La fuente Poppins incluida se declara SIL Open Font License 1.1; marcas, logos y artworks externos no quedan cubiertos por MIT.

#### 4.2.6 Shorz — Claude Video Editing Skill / MCP

- **Skill/repo:** [Vossy/claude-video-editing-skill](https://github.com/Vossy/claude-video-editing-skill)
- **Aplicación:** [Shorz](https://shorz.ai/)
- **Tipo:** skill/MCP que permite a un agente operar el editor de escritorio Shorz.
- **Capacidades expuestas según el README:** proyectos, paneles, edición de archivos, recortes, clips cortos, subtítulos, avatares, thumbnails, generación y publicación. El README consultado menciona 187 herramientas MCP; el catálogo puede cambiar según la versión.
- **Instalación descrita:** instalar la aplicación Shorz y conectar su MCP local; también se puede clonar el repo de skills y copiar `shorz-mcp` a `~/.claude/skills/`.

  ```bash
  git clone https://github.com/Vossy/claude-video-editing-skill
  cp -r claude-video-editing-skill/shorz-mcp ~/.claude/skills/
  ```

- **Costes:** el README indica que parte de las herramientas MCP no requieren créditos y que la generación con IA utiliza créditos de Shorz; verificar precios y límites vigentes en su web.
- **Licencia:** la carpeta/documentación de la skill se declara MIT; la aplicación Shorz es un producto independiente y no debe considerarse software MIT por esa razón.

#### 4.2.7 `video-editor` — hcsum

- **Repositorio:** [hcsum/video-editor](https://github.com/hcsum/video-editor)
- **Tipo:** pipeline de edición asistida por agente para grabaciones de pantalla, talking-head y demos.
- **Secuencia:** `ffprobe` de los originales; transcripción con `mlx_whisper`; plan de edición; corte base destructivo con FFmpeg; composición de subtítulos/títulos/callouts/zooms con Remotion; inspección de fotogramas antes del render final; validación posterior.
- **Instalación/ejecución:**

  ```bash
  npm install
  npm run remotion:studio
  npm run remotion:render
  ```

- **Requisitos:** FFmpeg y ffprobe; transcripción `mlx_whisper` orientada a Apple Silicon, sustituible por otro backend Whisper.
- **Licencia:** no consignada aquí como verificada; revisar los archivos del repositorio antes de reutilizar o redistribuir código.

### 4.3 Nombre parecido: `onetake-videogen`

- **Repositorio:** [Nael-Nathanael/onetake-videogen](https://github.com/Nael-Nathanael/onetake-videogen)
- **Tipo:** proyecto/skill diferente del repositorio `feitangyuan/onetake`.
- **Descripción:** skill para trabajar con una instalación local de OneTake y realizar modos de edición, explicador y animación ilustrada. El flujo presupone tener instalado ese motor local.
- **Diferencia importante:** no es el mismo `onetake` de motion films descrito en el apartado 4.1.1 y no debe confundirse con el servicio comercial [onetake.ai](https://www.onetake.ai/).
- **Instalación y licencia:** comprobar README y LICENSE del repositorio antes de instalarlo o utilizarlo comercialmente.

## 5. Herramientas auxiliares y conceptos del flujo de producción original

Estos elementos aparecían en el material inicial como parte de la integración propuesta; no son repositorios de skills independientes:

- **`MontadorDeVideo`:** nombre propuesto para un puerto/interfaz de la arquitectura que aislaría el motor de composición del resto del sistema.
- **Adaptador HyperFrames:** implementación concreta del puerto mediante la CLI y el proyecto HTML de HyperFrames.
- **Doble simulado:** implementación de prueba del puerto para verificar el flujo sin renderizar un vídeo real.
- **Plan temporal del director:** estructura de escenas/cortes, duración, transiciones, rótulos, audio y referencias temporales para componer el vídeo.
- **Validación de plan:** comprobaciones de duración, fotogramas aprobados, fuentes tipográficas disponibles, claims o cifras autorizadas y reglas de marca.
- **Postproceso FFmpeg:** mezcla final, codificación, extracción de fotogramas y verificación de formato y streams.
- **`RevisorVisual`:** papel/agente que inspecciona fotogramas extraídos del render para detectar fallos visuales. Es un rol del flujo, no una herramienta concreta.

El documento `ARQUITECTURA-AGENTICA.md` mencionado en el resultado inicial no estaba disponible en el material recibido para esta recopilación; por tanto, este apartado refleja únicamente los nombres y responsabilidades descritos en el texto pegado.

## 6. Instaladores y comandos reunidos

Los siguientes comandos aparecen en la documentación de los repositorios citados. La instalación real puede depender del sistema operativo, del agente de código y de las versiones disponibles.

```bash
# HyperFrames: CLI y proyecto
npx hyperframes init mi-video
npx hyperframes preview
npx hyperframes render

# HyperFrames: skills
npx skills add heygen-com/hyperframes
npx hyperframes skills update
npx hyperframes skills

# Remotion: skills oficiales
npx remotion skills add
npx skills add remotion-dev/skills
npx create-video@latest --skills

# OpenAI website-to-hyperframes: consultar el SKILL.md del plugin
# https://github.com/openai/plugins/tree/main/plugins/hyperframes/skills/website-to-hyperframes

# Agent Video Editing Skills
npx agents-video-editing-skills --agent claude,kiro,codex --rules

# Digital Samba Video Toolkit
git clone https://github.com/digitalsamba/claude-code-video-toolkit.git
cd claude-code-video-toolkit
uv sync

# onetake (feitangyuan)
git clone https://github.com/feitangyuan/onetake.git ~/.claude/skills/onetake

# product-launch-motion
npx skills add AbubakrChan/product-launch-motion

# motion-film-skill
npx skillfish add Iziedking/motion-film-skill

# motionboard
npx skills add krisyangdev/motionboard

# video-shotcraft
npx skills add Vincentwei1021/video-shotcraft

# motion-design-skill
npx skills add theatlasteam/motion-design-skill

# demo-video-creator
npx skills add chacha95/demo-video-creator

# ghost-editor
git clone https://github.com/kurbaitaev/ghost-editor ~/.claude/skills/ghost-editor

# video-agent-skill
claude plugin marketplace add sunithvs/video-agent-skill
claude plugin install video-editor@video-agent-skill

# pitch-video
npx skills add codeswithroh/pitch-video

# Vedit
git clone https://github.com/onetwothird/vedit.git
cd vedit
pip install -e ".[all]"
vedit doctor

# Shorz Claude skill
git clone https://github.com/Vossy/claude-video-editing-skill
cp -r claude-video-editing-skill/shorz-mcp ~/.claude/skills/
```

OpenMontage y `reel-editing-skills` tienen pasos de instalación específicos descritos en sus respectivos READMEs; no se resumen en un comando único porque requieren configuración o copia de directorios adicionales.

## 7. Licencias identificadas

| Proyecto | Licencia o estado consultado | Observaciones |
|---|---|---|
| HyperFrames | Apache-2.0 | Framework, CLI y skills open source; separar de servicios/planes alojados de HeyGen. |
| Remotion | Free License / Company License | Free License para individuos y empresas de hasta tres personas, con términos; para organizaciones fuera de la exención, Creators: 25 USD/usuario/mes; Automators: 0,01 USD/render, mínimo 100 USD/mes. Confirmar elegibilidad con la FAQ. |
| FFmpeg | LGPL 2.1+; componentes opcionales GPL | La configuración/build y las dependencias incluidas determinan condiciones aplicables. |
| OpenMontage | GNU AGPLv3 | Licencia copyleft con obligaciones al distribuir o poner a disposición versiones modificadas en red. |
| agents-video-editing-skills | MIT | Pack de skills. |
| Digital Samba Video Toolkit | MIT | Toolkit. Los proveedores/modelos y activos externos conservan sus propias condiciones. |
| onetake (feitangyuan) | PolyForm Noncommercial 1.0.0 | No autoriza uso comercial bajo la licencia gratuita del repositorio. |
| product-launch-motion | MIT | La licencia de la skill no transfiere derechos de vídeos demo o activos externos. |
| motion-film-skill | MIT | Revisar derechos de assets, fuentes y librerías de terceros. |
| motionboard | MIT | Revisar dependencias y recursos externos del proyecto. |
| video-shotcraft | Apache-2.0 | Remotion y los assets SFX/música mantienen condiciones propias. |
| motion-design-skill | MIT | Dependencias, fuentes, GLB y medios de terceros conservan sus licencias. |
| demo-video-creator | MIT | Requiere servicios/recursos externos, entre ellos ElevenLabs para la configuración descrita. |
| ghost-editor | No verificada | No se encontró una licencia explícita en la ficha/README consultados. |
| video-agent-skill | Apache-2.0 | Fuentes incluidas: SIL OFL 1.1 según README. |
| pitch-video | MIT | Los modelos descargados (Whisper/MediaPipe) conservan licencias upstream. |
| reel-editing-skills | MIT | Depende de HyperFrames y del motor de transcripción instalado. |
| Vedit | MIT | Fuentes y marcas incluidas pueden tener licencias/condiciones propias. |
| Shorz skill | MIT para la skill | No implica que la aplicación Shorz esté licenciada como MIT. |
| hcsum/video-editor | No verificada | Revisar LICENSE del repositorio antes de reutilizarlo. |
| onetake-videogen | No verificada aquí | Revisar LICENSE y dependencias. |

## 8. Fuentes principales

- [HyperFrames — repositorio](https://github.com/heygen-com/hyperframes) · [guía de skills](https://github.com/heygen-com/hyperframes/blob/main/AGENTS.md) · [web](https://hyperframes.heygen.com/)
- [Remotion — Agent Skills](https://www.remotion.dev/docs/agents/skills) · [licencia y precios](https://www.remotion.dev/docs/license/faq)
- [FFmpeg — legal/licencias](https://ffmpeg.org/legal.html)
- [OpenMontage — repositorio](https://github.com/OpenMontageInc/OpenMontage) · [documentación](https://github.com/OpenMontageInc/OpenMontage/tree/main/docs)
- [Agent Video Editing Skills](https://github.com/iamaanahmad/agents-video-editing-skills)
- [Digital Samba — Claude Code Video Toolkit](https://github.com/digitalsamba/claude-code-video-toolkit)
- [OpenAI plugin — website-to-hyperframes](https://github.com/openai/plugins/tree/main/plugins/hyperframes/skills/website-to-hyperframes)
- [onetake](https://github.com/feitangyuan/onetake)
- [product-launch-motion](https://github.com/AbubakrChan/product-launch-motion)
- [motion-film-skill](https://github.com/Iziedking/motion-film-skill)
- [motionboard](https://github.com/krisyangdev/motionboard)
- [video-shotcraft](https://github.com/digitalpublisher/video-shotcraft)
- [motion-design-skill](https://github.com/theatlasteam/motion-design-skill)
- [demo-video-creator](https://github.com/chacha95/demo-video-creator)
- [ghost-editor](https://github.com/kurbaitaev/ghost-editor)
- [video-agent-skill](https://github.com/sunithvs/video-agent-skill)
- [pitch-video](https://github.com/codeswithroh/pitch-video)
- [reel-editing-skills](https://github.com/hash-anmol/reel-editing-skills)
- [Vedit](https://github.com/OpenOrbitLabs/Vedit)
- [Shorz — skill MCP](https://github.com/Vossy/claude-video-editing-skill) · [aplicación](https://shorz.ai/)
- [hcsum/video-editor](https://github.com/hcsum/video-editor)
- [onetake-videogen](https://github.com/Nael-Nathanael/onetake-videogen)

---

**Fin del catálogo.** Inventario consultado el 26 de noviembre de 2026; comprobar los README, comandos, licencias, requisitos y disponibilidad de cada repositorio antes de una instalación o despliegue.
