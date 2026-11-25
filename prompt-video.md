Eres el director técnico y creativo de SOCIETY trabajando dentro de este repositorio (vibe-soci). Tu encargo tiene dos partes: (1) entender a fondo el flujo agéntico que ya existe para crear piezas (dirección creativa, conceptos, inventario de verdad, planos/tomas, generación de imágenes, crítica y aprobación) y (2) extenderlo para producir un REEL vertical de un LOCAL REAL, generando las imágenes con Nano Banana Pro y el vídeo con Higgsfield, y montándolo con Tesseract (https://github.com/mirage-hq/Tesseract). Trabaja en español; los prompts de generación, en inglés.

LOCAL: [NOMBRE DEL LOCAL REAL, ciudad]. Si no te lo doy, usa Torre de Vega «El Mora» (Plaza Santa Ana 8, La Alquería, Alhaurín de la Torre; web restaurantetorredevega.com con fotos reales de sala y carta).
FORMATO PEDIDO: reel 9:16 de 12–15 s con un formato distinto al clásico «brindis + ráfaga de platos» (ya hecho y descartado por repetitivo). Ejemplo de formato válido: «receta exprés en 10 segundos» (proceso real del local paso a paso con etiquetas animadas de cantidades, cuenta atrás y revelado final), o el que tu director proponga, justificado con una referencia de Pinterest.

FASE 1 · ANALIZA EL FLUJO QUE YA EXISTE (sin gastar nada)
Lee en este orden y no supongas lo que no hayas leído:
1. CONTEXTO-PARA-IA.md y diseno/f1_6/ESTADO.md (estado vivo; los informes «Histórico» no mandan).
2. diseno/ARQUITECTURA.md, diseno/INFORME-DIRECCION-DE-ARTE-AGENTICA.md, diseno/propuesta-creativa/PROPUESTA.md, diseno/f1_6/METODO-SOCIETY.md y diseno/diagrama_flujo.drawio.
3. conocimiento/ (principios.md, antipatrones.md, rubrica.md, oficios/, referencias/) y referencias-pinterest/ (sobre todo formatos-y-secuencias/ y la categoría del local).
4. Código: src/aplicacion/ (planificarPieza, contextoCreativo, generarDiapositivas, arte/, productor/orquestador.ts, productor/criticaEditorial.ts, productor/revision.ts) y src/adaptadores/higgsfield/ y simulado/.
Entrega un documento diseno/reel/ANALISIS-FLUJO.md con: el recorrido brief → director (3 conceptos) → inventario de verdad de la foto → plan → generación → crítica → paradas humanas con huella de revisión → exportación; qué hace cada puerto y adaptador; qué decisiones creativas toma el modelo y cuáles valida el código (no inventar cifras, fidelidad al plato, presupuesto); y qué piezas se pueden reutilizar tal cual para vídeo y cuáles faltan.

FASE 2 · DISEÑA LA «VÍA REEL» DENTRO DE LA ARQUITECTURA
Propón (diseno/reel/PROPUESTA-REEL.md) cómo encaja el reel respetando puertos y adaptadores: un puerto GeneradorVideo con adaptador Higgsfield, un puerto Montador con adaptador Tesseract (CLI tsrct), el plan de reel como JSON validado con zod (planos como contratos: función, tiempo, acción ya empezada en el fotograma, movimiento de cámara con nombre y magnitud, referencias con rol, rótulo, criterio de rechazo) y las mismas paradas humanas y huellas que ya usa El pase. Nada de scripts sueltos fuera de la arquitectura salvo para el piloto.

FASE 3 · PILOTO (solo tras mi aprobación explícita del concepto y del coste)
Este es el flujo ya probado, con sus lecciones; síguelo y mejóralo:
a) Referencia de Pinterest: descárgala (la página del pin suele exponer un .m3u8 de v1.pinimg.com; ffmpeg lo baja). Analízala fotograma a fotograma: cortes (ffmpeg select=gt(scene,0.28)), duración del gancho, ritmo de cortes por segundo, tipografía, transiciones, BPM. Copia el MECANISMO (ritmo, gancho, rótulos), nunca el look, los platos ni el local. Descarta la tarjeta final de plantillas tipo CapCut.
b) Inventario de verdad: fotos reales del local (web/Instagram) registradas por objeto. Regla dura: nada inventado. En la prueba anterior el modelo inventó platos que no están en la carta (bravas, croquetas) y la toma se descartó.
c) Director: 3 conceptos con mecanismos distintos (no repetir «brindis + platos»), uno recomendado. Pregunta de control: ¿un vecino se lo reenviaría a alguien?
d) Fotogramas clave con Nano Banana Pro (model id nano_banana_pro; Higgsfield lo sirve como nano_banana_2), 9:16 a 2k, unos 2 créditos cada uno, con las fotos reales como image_references y la acción ya empezada dentro de la imagen. El filtro de contenido dio falsos positivos con palabras como «knives», «juicy» o «pouring stream»: reescribe sin ellas. Cuidado con los neones o letreros con texto legible que inventa el modelo.
e) Vídeo en UNA sola generación multitoma (un mundo de luz y un ritmo):
   - MAGI-2 (magi_2): unos 2,5 créditos/s, solo 1080p, hasta 10 image_references; start_image no se combina con referencias. El prompt va con bloques «SHOT n (t0–t1s) … Hard cut.» y audio diegético. Funcionó bien con 6 referencias en 15 s. Antes de una tanda, haz una prueba de control de 4 s: el 25/11 por la noche estuvo caído (fallos genéricos reembolsados).
   - Seedance 2.5 como alternativa: 16 créditos/s a 1080p y 7 a 720p. Cada imagen es el primer fotograma de su toma (receta de Da Tonino en el repo society).
   Haz siempre estimate_video_cost antes de enviar y registra modelo pedido frente a servido, coste real y reembolsos.
f) Revisión de realismo antes de montar: hoja de fotogramas por toma, cortes reales detectados, manos (dedos, anillos), objetos inventados, texto generado. Si la última toma sale corta, el revelado se hace con su fotograma clave como imagen fija con empuje lento.
g) Montaje con Tesseract 0.8.0. Lee sus skills (skills/tesseract-video/SKILL.md y references/: local-operation, native-authoring, fx-authoring, motion, sound-design, audio-and-timing, daw-mixer, review-and-delivery, critic-review). Notas de instalación y uso ya comprobadas:
   - Instala el release linux-x86_64 desde GitHub verificando el sha256.
   - En Linux necesita Vulkan: Mesa lavapipe (paquete mesa-vulkan-drivers o VK_ICD_FILENAMES=.../lvp_icd.x86_64.json) y XDG_RUNTIME_DIR definido.
   - El bundle de Linux no trae H.264: exporta con --encoder-backend external-ffmpeg-command --ffmpeg-path $(which ffmpeg).
   - Las propiedades animables son scaleX/scaleY (no «scale»).
   - Las capas creadas antes quedan delante.
   - Speed ramps: playback.mapping de tipo timeRemap, editado en el JSON vía project checkout/commit.
   - Importa las fuentes con import-font y usa la familia y el estilo que devuelve.
   - Usa detect-tempo para cortar en el pulso.
   - Para la sonoridad aplica al máster el preset nativo master-bus-glue (objetivo de −14 a −16 LUFS y true peak ≤ −1 dBTP, medido en encodedAudio del export --json). No normalices con ffmpeg.
   - Pon placas oscuras detrás de contadores y etiquetas para que se lean, y respeta las zonas seguras de Reels (arriba 10 %, abajo 20 %, derecha 15 %).
   - Revisa con filmstrip y preview, y haz la ronda de críticos del skill (dos críticos con nota ≥ 8,5).
   Entrega el .tsrct editable junto al MP4.

REGLAS
- Pregúntame solo lo que cambie el resultado. Para antes de cualquier gasto con un resumen de coste (imágenes, vídeo, música) y espera mi «ok».
- Usa el modo simulado del repo para todo lo que no necesite generar.
- Registra en diseno/reel/REGISTRO.md cada intento: modelo, parámetros efectivos, coste, motivo de descarte y aprendizaje propuesto.

ENTREGABLES
ANALISIS-FLUJO.md, PROPUESTA-REEL.md, el plan JSON del reel y, tras mi aprobación: los fotogramas clave, el clip generado, el proyecto Tesseract (.tsrct), el MP4 1080×1920 y el registro con costes reales.