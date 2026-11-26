# Vía reel · Torre de Vega «El Mora»

**Propuesta para aprobar** · «¿Qué pedimos?» · 14 s · 1080 × 1920 · Torre de Vega «El Mora», Plaza Santa Ana 8, La Alquería, Alhaurín de la Torre. Una mesa invita a elegir. Cada toque cambia lo que hay sobre ella: jamón ibérico, entrecot y langostinos al pil-pil. La cámara permanece fija y el selector editorial convierte cada corte en una elección. El nombre del local firma sobre la cazuela. [Restaurante y comedor](https://www.restaurantetorredevega.com/) · [Carta](https://www.restaurantetorredevega.com/carta-torre-de-vega/)

## Tres conceptos

| Concepto | Mecanismo | Prueba de reenvío |
|---|---|---|
| **¿Qué pedimos?** | Tres elecciones sobre una única mesa. Cambia el plato con cada toque del selector. Se reconoce la interacción del pin con el mobiliario, mantelería y platos de Torre de Vega. | «Tú eliges, ¿jamón o pil-pil?». **Recomendado** tras el cambio de referencia. |
| **¿Qué hay en la cazuela?** | Adivinanza visual: textura del aceite, guindilla y revelado del plato. | «¿Has probado estos del Mora?». Mantiene el interés en un solo plato. |
| **¿Reconoces esta mesa?** | Del detalle a la ubicación: trama del mantel, respaldo y ventana. El plano amplio revela el comedor. | «Mira, la mesa donde estuvimos». Funciona por reconocimiento del espacio. |

## Referencia elegida

«Restaurant social media ideas» muestra una mesa en vertical, un teléfono y un selector que se activa con el dedo. Cada toque hace aparecer un plato en el mismo sitio y la luz, el encuadre y los objetos del fondo dan continuidad. Para Torre de Vega, el selector se resuelve con rótulos y tres marcas discretas con respuesta sonora. La mesa, los platos y la tipografía pertenecen al reel. [Pin de Pinterest](https://es.pinterest.com/pin/765400899209087726/)

| Rasgo | Observación del pin | Aplicación al reel |
|---|---|---|
| Apertura | Vídeo de 9,15 s, 704 × 1254, 25 fps. La mano entra en el primer medio segundo; el selector aparece cerca de 1 s y el primer plato hacia 2 s. | La pregunta se lee con la mesa ya encuadrada. El selector entra durante el primer segundo y anticipa el primer cambio. |
| Cámara y cortes | Encuadre fijo en tres cuartos altos. El detector sobre la imagen completa a 0,28 solo marcó el final. Al medir sobre la zona del plato, aparecieron siete cambios a 3,28 / 3,96 / 4,56 / 5,20 / 5,80 / 6,48 / 7,16 s, coherentes con la hoja de fotogramas. Entre esos cambios hay unos 0,65 s de media. | La mesa y la silla permanecen fijas. Los cortes a 3,2 / 6 / 8,8 s dejan leer los tres nombres y mantienen el vínculo inmediato entre pulsación y plato. |
| Tipografía | Firma compacta en dos líneas mayúsculas y controles pequeños sobre la superficie. | Pregunta y nombre de opción en el aire inferior izquierdo, dentro de la zona segura. Tres marcas de selección. El nombre del local entra con el plato final. |
| Cierre | El último plato permanece casi dos segundos. El detector marca el cambio final en 9,04 s. | Se sostiene la cazuela de pil-pil hasta 14 s con la firma sobre el mismo plano. |
| Audio | Hay pista sonora. La autocorrelación en 9 s produjo picos débiles y dispersos, así que el BPM queda sin confirmar. | Tres toques propios del montaje, alineados con los cortes, sobre ambiente de sala. |

## Inventario y plan

- **Mesa y encuadre**. La [foto oficial del comedor](fuentes/comedor.webp) fija mesa con mantel claro, silla de madera, ventana y luz. Se aprueba primero el fotograma de mesa como ancla de encuadre y se añade a las tres peticiones de plato con papel de composición.
- **Jamón ibérico**. La [foto oficial de jamón](fuentes/jamon.webp) fija el abanico de lonchas, vetas y plato blanco.
- **Entrecot**. La [foto real del repositorio](fuentes/entrecot.webp) fija carne cortada, guarnición, sal y vajilla. Se lleva el plato servido a la mesa del reel. La procedencia queda registrada en la [comanda original](../../proyectos/2026-11-14-entrecot-de-vaca-curado-directo/post.json).
- **Langostinos al pil-pil**. La [foto oficial del pil-pil](fuentes/langostinos.webp) fija ración, disposición, cazuela, plato blanco de base, aceite y guindilla. Se encuadra para excluir los otros platos de la foto.

El [plan de cuatro planos](plan-reel.json) incluye las fotos con SHA-256 y los prompts en inglés. [PlanReel](../../src/dominio/reel/planReel.ts) valida tiempos, apertura y cierre, compatibilidad de fuentes, rótulos y desplazamiento cero para cámara fija. El inventario y el respaldo de las afirmaciones se revisan con la comanda antes de generar.

## Encaje en puertos y adaptadores

| Capa | Contrato propuesto |
|---|---|
| Dominio | `PlanReel` valida el contrato de cada plano. La aplicación coteja el texto y los roles de referencia contra la versión confirmada del brief y comprueba las huellas de los archivos antes de preparar el envío. Los intervalos se expresan en ms. La magnitud de cámara se expresa como porcentaje del ancho del encuadre y sirve como intención para el modelo y criterio de revisión del resultado. |
| Aplicación | Un flujo `aplicacion/reel` crea la comanda, propone conceptos y acepta la elección, fija inventario y coste, solicita fotogramas, revisa el clip y pide montaje. El contenedor inyecta los puertos y decide el modo. El resultado conserva el MP4 y el proyecto editable con las dependencias necesarias para reabrirlo. |
| `GeneradorVideo` | `estimar(peticion)`, `enviar(peticion, aprobacion)` y `consultar(id)`. Devuelve parámetros efectivos, identificador, estado y procedencia, incluyendo créditos estimados, debitados y reembolsados cuando se conozcan. `GeneradorVideoHiggsfield` resuelve los papeles por modelo, valida sus límites y mantiene el registro de cotización e identificador. El piloto usa el MCP y registra/importa sus resultados. La integración del producto depende de un transporte Higgsfield que exponga catálogo y operaciones compatibles. |
| `Montador` | `crear(plan, activos)`, `previsualizar(proyecto)` y `exportar(proyecto)`. El adaptador Tesseract invoca `tsrct` con argumentos, controla salidas y empaqueta `.tsrct` con sus fuentes y medios. La ejecución local del piloto seguirá el flujo de edición de Katana sobre el clip generado y materializará el máster editable en Tesseract. |
| Simulado | Directores y validación del repositorio actuales para el tramo de imagen. Futuros `GeneradorVideoSimulado` y `MontadorSimulado` entregarán estados y medios de prueba deterministas en datos simulados, incluyendo una salida fallida, una reanudación y una aprobación caducada. |

### Paradas humanas y reanudación

1. **Concepto, inventario y gasto.** La comanda muestra el plan, las pruebas visuales y el presupuesto por componente. Registra fecha, vía y huella asentada sobre brief, plan y fuentes. Una edición material requiere revisar la comanda nueva.
2. **Fotogramas y clip.** Se aprueban los fotogramas clave contra las fuentes. El control MAGI-2 de 4 s se revisa antes del envío largo. El resultado de vídeo pasa por hoja de fotogramas, revisión de cortes y fidelidad. Aprobación sobre huellas del clip y los fotogramas, antes de montar.
3. **Entrega.** Se aprueba el máster con sus rótulos, mezcla, revisión crítica y especificaciones de salida. La huella incluye activos, proyecto y MP4. La bitácora conserva correcciones localizadas y motivo de rechazo.

Cada envío reserva presupuesto antes de despachar y conserva identificador remoto al recibirlo. La reanudación consulta el trabajo registrado. Una respuesta ambigua queda pendiente de conciliación antes de autorizar otro envío. Una cotización superior al techo vuelve a la parada de gasto. El estado de las aprobaciones y el gasto efectivo queda en el [registro](REGISTRO.md).

## Producción tras aprobación

- Montar los cambios de plato sobre un encuadre fijo. Si MAGI-2 desplaza la mesa o une los platos mediante una transformación, comprobar los tramos limpios y ensamblar los cortes secos con los fotogramas aprobados donde haga falta. El material del pin se usa como referencia de análisis.
- Generar cuatro fotogramas Nano Banana Pro `nano_banana_pro`, 9:16, 2K. Primero la mesa a partir del comedor real. Después un fotograma por plato con su foto real y la mesa aprobada como ancla. Revisar composición, realismo, ración, mobiliario y texto inventado. Registrar el modelo solicitado y el devuelto por el trabajo.
- Cotizar y ejecutar el control MAGI-2 de 4 s con un fotograma aprobado. Tras superar ese control, cotizar un único clip MAGI-2 1080p, 14 s, cuatro `image_references`, audio diegético, `enhance_prompt: false`. Compilar los planos en orden en bloques `SHOT n (t0–t1s)` con su corte. Si falla el control, registrar estado y reembolso y detener el envío largo. Seedance 2.5 se cotizó como alternativa para una decisión posterior.
- Revisar continuidad y cortes del clip, identidad del plato y de la sala, manos, objetos y texto. Generar una hoja con inicio, centro y final de cada plano más los cortes detectados. Si falta tiempo de revelado, sostener el fotograma aprobado con la cámara fija en edición.
- Aplicar el flujo de edición de [Katana](https://higgsfield.ai/mcp/katana?tab=chatgpt) al material propio del piloto y usar [Tesseract 0.8.0](https://github.com/mirage-hq/Tesseract/releases/tag/v0.8.0) para la entrega editable. El flujo `/katana` de edición de material disponible está resuelto. La interfaz local separada de Higgsfield Video Editor no aparece conectada en esta sesión.
- En Tesseract comprobar release y SHA-256, leer la skill de la versión, validar Vulkan/lavapipe, `XDG_RUNTIME_DIR` y FFmpeg externo para H.264. Montar rótulos, marcas del selector y toques en capas editables. Usar la familia y el estilo devueltos por `import-font` y una placa oscura discreta si hace falta para el contraste. Dejar libres 192 px arriba, 384 px abajo y 162 px a la derecha. Verificar el registro de la mesa en cada corte y usar `playback.mapping` si se requiere remapeo de tiempo.
- Editar por cortes y acentos del sonido diegético. Aplicar `master-bus-glue` y verificar el máster a −14 a −16 LUFS, ≤ −1 dBTP en `encodedAudio`. Revisar filmstrip, preview y dos críticas con nota mínima de 8,5. Verificar 1080 × 1920, 14 s, audio y lectura móvil. Entregar fotogramas, vídeo base, proyecto editable y MP4 final. Mostrar el resultado de Katana cuando el render esté verificado.

## Presupuesto del piloto

| Partida | Créditos Higgsfield |
|---|---:|
| Cuatro fotogramas Nano Banana Pro a 2 créditos | 8 |
| Control MAGI-2 1080p de 4 s | 10 |
| Una generación MAGI-2 1080p multitoma de 14 s | 35 |
| Música, con audio diegético incluido en el vídeo | 0 |
| **Total solicitado** | **53** |

Cotizaciones del MCP del 26/11/2026, antes de incorporar las referencias efectivas. Se recotiza con los medios y parámetros definitivos antes de cada envío. El total cubre el control y un intento de cada activo. Seedance 2.5 queda fuera del total, con estimaciones de 98 créditos a 720p y 224 a 1080p para 14 s. [Registro](REGISTRO.md)
