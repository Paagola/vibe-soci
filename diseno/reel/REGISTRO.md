# Registro del piloto · Torre de Vega

**26/11/2026 · preparación · 0 créditos consumidos.** La comanda espera aprobación explícita del concepto y de un máximo de 53 créditos.

| Operación | Parámetros de cotización | Estimado | Consumo | Resultado |
|---|---|---:|---:|---|
| `estimate_image_cost` | `nano_banana_pro`, 2K, 9:16, 1 imagen por solicitud, sin referencias efectivas en la cotización previa | 2 por imagen, 8 por 4 | 0 | Cotización recibida sin ajustes. |
| `estimate_video_cost` | `magi_2`, 4 s, 1080p, 9:16, audio activo, mejora de prompt desactivada | 10 | 0 | Cotización del control. |
| `estimate_video_cost` | `magi_2`, 14 s, 1080p, 9:16, audio activo, mejora de prompt desactivada | 35 | 0 | Cotización del clip multitoma. |
| `estimate_video_cost` | `seedance_2_5`, `omni_reference`, 14 s, 9:16, audio activo | 98 a 720p / 224 a 1080p | 0 | Alternativa fuera del techo. |

El catálogo del MCP confirmó que MAGI-2 admite 4–30 s a 1080p y hasta 10 imágenes de referencia. El catálogo lista Nano Banana Pro con 2K y 9:16. No hay modelo servido, trabajos, descartes ni reembolsos que registrar todavía.

**26/11/2026 · referencia de Pinterest · 0 créditos.** Se descargó la versión MP4 720 × 720 expuesta por el pin. Análisis local con FFmpeg, detección de escena a 0,28, hojas de fotogramas y estimación del pulso en la pista de audio. El pin de Channa Masala quedó como primera referencia explorada.

Por cada intento se añadirá el ID de trabajo, huella del plan aprobado, cotización, modelo pedido y devuelto, parámetros efectivos, créditos debitados, reembolso y motivo de aceptación o descarte con el aprendizaje asociado. El saldo de toda la cuenta y el coste de un trabajo se registrarán por separado si el servicio los expone.

**26/11/2026 · cambio de referencia · 0 créditos.** El usuario eligió el pin [Restaurant social media ideas](https://es.pinterest.com/pin/765400899209087726/). El HLS solo produjo 2,16 s con un error al remultiplexar. Se descargó el MP4 completo de 9,15 s y se comprobaron los cambios de plato en la zona de interés con FFmpeg y hojas de fotogramas. Se revisó la propuesta y el guion para rodar la selección de tres platos con cámara fija. El presupuesto estimado conserva 4 fotogramas, el control y el clip largo.

**26/11/2026 · aprobación en conversación.** El usuario aprobó «¿Qué pedimos?» y el máximo de 53 créditos sobre el plan SHA-256 `4d880c21c9d2f454cef0c7c10545a6e500d6342441470af5c28cc72d623580eb`. Saldo inicial del espacio privado informado por el MCP: 10 créditos. La cotización real de la mesa con referencia confirmada es de 2 créditos.

- Mesa, preparación de la petición. El servidor rechazó `image_references: [UUID]` con HTTP 422 por tipo. La cotización con `medias.role: image_references` fue rechazada por el conector. Ambas peticiones quedaron sin trabajo. La forma válida es `medias: [{ role: image, value: UUID }]`. El conector lo convirtió al papel `image_references` del modelo.
- Mesa, envío `1cfb76aa-c75c-454d-9241-86429876b4a9`. Pedido y devuelto en el envío `nano_banana_pro`, 2K, 9:16, una foto del comedor, cotización 2 créditos. Estado inicial pendiente.

- Mesa completada. Modelo servido en el seguimiento `nano_banana_2`, salida 1536 × 2752, dos créditos reflejados en el saldo privado (10 → 8). Revisión interna: mesa despejada, mantel, silla y luz válidos como ancla visual.
- Tanda de platos enviada: jamón `3af85332-2725-4ca8-b62d-881166ea89d8`, entrecot `64174941-1821-42f0-9b08-47d24cf86ebf`, pil-pil `11f9ab24-091e-450b-af78-4c5341a605f0`. Nano Banana Pro, 2K / 9:16, 2 créditos por petición. Referencias efectivas: foto real de cada plato y el fotograma de mesa.
- Prueba local de Tesseract 0.8.0: release Linux verificado por SHA-256, preview 1080 × 1920 con lavapipe y exportación H.264 de tres fotogramas con FFmpeg externo.
- Tanda completada: los tres trabajos devolvieron `nano_banana_2` en seguimiento, 1536 × 2752. Revisión lado a lado: encuadre de mesa, silla, ventana y mantel consistentes. El entrecot arrastró el dominante azul de la fuente. Se creó `03-entrecot-color.png` con una corrección local limitada a ese dominante, sin cambiar la composición ni los elementos. Se mantiene el original del modelo. [Hoja de revisión](fotogramas/hoja-revision.jpg).
- Gasto comprobado por diferencia del saldo del espacio privado: 10 → 2 créditos, 8 consumidos por cuatro resultados completados. Sin reembolsos observados. Quedan la aprobación de fotogramas y 43 créditos para cubrir el control y el clip dentro del mismo techo total autorizado.
- MAGI-2 control (todavía sin enviar) recotizado con el fotograma de pil-pil completado como `image_references`: 4 s, 1080p, 9:16, audio activo, sin mejora de prompt, 10 créditos. Clip largo estimado en 35 créditos y pendiente de recotizar con los cuatro activos aprobados.

**26/11/2026 · fotogramas aprobados en conversación.** La aprobación corresponde a los cuatro fotogramas de la hoja de revisión y al plan `4d880c21c9d2f454cef0c7c10545a6e500d6342441470af5c28cc72d623580eb`.

| Fotograma aprobado | SHA-256 | Referencia de Higgsfield |
|---|---|---|
| `01-mesa.png` | `1619878b0eaebdf6a6a536f500ec4e216dadfaae41c1dcc02cfe5372d3ab4582` | Trabajo `1cfb76aa-c75c-454d-9241-86429876b4a9` |
| `02-jamon.png` | `af2eafbe4c8644846c8e06471bac3bb44394b894639a3f5e9dfbcd9303f2d702` | Trabajo `3af85332-2725-4ca8-b62d-881166ea89d8` |
| `03-entrecot-color.png` | `737c7d3b87d0891c000e4fbce7894ceb8e6d1b3e1335668b3120bcfc3787143d` | Medio confirmado `bdee0d38-8097-42a4-b6a4-7bdd1aa8e59a` |
| `04-pil-pil.png` | `f0b160c347529b2ac4e3e6f2ae641f9b38559b42eb1225b7d8ee561ec9a28819` | Trabajo `11f9ab24-091e-450b-af78-4c5341a605f0` |

Se cotizaron los dos envíos con sus referencias definitivas. El control de 4 s con pil-pil cuesta 10 créditos y el clip multitoma de 14 s con los cuatro fotogramas, 35. Ambos a 1080p y 9:16, con audio y mejora de prompt desactivada. El conector convirtió `medias.role=image` a `image_references`. Saldo comprobado de 2 créditos. Faltan 8 para el control o 43 para completar ambos envíos. Consumo nuevo: 0. Sin trabajos de vídeo enviados.

**26/11/2026 · reanudación tras la actualización de saldo indicada por el usuario.** El plugin figura instalado y habilitado, pero el MCP devolvió «Unknown tool» al consultar saldo, cotizar de nuevo, consultar MAGI-2 y resolver Katana. El saldo actualizado queda pendiente de verificación. No se envió la prueba ni se produjo ningún cargo nuevo durante esta reanudación. Se conserva la aprobación del plan, los cuatro fotogramas y el máximo de 53 créditos.

**26/11/2026 · MCP operativo y prueba enviada.** El espacio privado activo es distinto del usado para los fotogramas. Saldo antes del envío: 105,25 créditos. Se volvieron a subir los cuatro archivos aprobados sin modificar sus bytes. IDs en orden: `3c384c3a-1f33-48b4-b97b-466fb0d19d58`, `ce0f77d8-0548-48bf-9684-d10a181cc933`, `fee9d76c-a807-4bfe-ae6c-02e0c93ea7fb` y `cb40099b-cbcc-42ed-ba6b-fa29fd678050`.

- Control MAGI-2 `dd2caf8b-96b5-49bb-857d-6f94fa2bc78c`: solicitado y devuelto en el envío `magi_2`, 4 s, 9:16, 1080p, audio activo, mejora de prompt desactivada, referencia de pil-pil del espacio activo. Cotización 10 créditos. Estado inicial pendiente.

**26/11/2026 · verificación de la API directa de Higgsfield.** A petición del usuario se verificó `HF_KEY` sin imprimir la credencial. La API aceptó la subida del fotograma pil-pil aprobado y devolvió la tarifa para `sand/magi-2/reference-to-video`: 0,08 USD/s con audio incluido y una generación MAGI-2 concurrente por cuenta. Con 4 s, el control cuesta 0,32 USD. El clip de 14 s se estima en 1,12 USD a la misma tarifa, pendiente de cotizar con sus cuatro referencias. El endpoint de texto de la documentación adjunta carece de entrada de imagen. No se envió una generación por API ni se hizo un cargo nuevo. En la última consulta, el control del MCP seguía en cola y su saldo mostraba el débito de 10 créditos (105,25 → 95,25), sin reembolso observado.

**26/11/2026 · autorización API.** El usuario aprobó la prueba (0,32 USD) y el clip (hasta 1,12 USD). El trabajo anterior del MCP dejó de ser accesible al consultar su ID en el contexto activo. Su resultado y posible reembolso quedan sin verificar.

- Control por API directa `01a21722-0151-7eba-ac54-5bdae71af961`: `sand/magi-2/reference-to-video`, 4 s, 1080p, 9:16, audio activado, un fotograma aprobado. Estimate HTTP 200 a 0,32 USD y generación HTTP 200, en cola. Se guardó el identificador antes de consultar. Facturación efectiva pendiente de verificar.
- Control API completado a las 10:37. Archivo `video/control-magi-api.mp4`, SHA-256 `59189fc2ed791186d718dd16b81bbccb76893bf6f7bfd41d0cd545cf961ab915`. 4,24 s, 1080 × 1920, 25 fps y AAC estéreo. Revisados ocho fotogramas: mesa, silla y cazuela estables, leve brillo del aceite y sin texto ni manos. Control aceptado para enviar la multitoma. Importe cotizado 0,32 USD, débito no conciliado en el panel de facturación.
- Multitoma por API directa `01a21738-2d79-7121-b9bd-fbf4e66f11e9`: `sand/magi-2/reference-to-video`, 14 s, 1080p, 9:16, audio activado. Cuatro referencias, en orden mesa, jamón, entrecot con color corregido y pil-pil. Estimate HTTP 200 a 1,12 USD y generación HTTP 200, en cola. Facturación efectiva pendiente de verificar.

**26/11/2026 · revisión de Katana y conciliación del estado del clip.** La API devolvió HTTP 200 al consultar el trabajo multitoma `01a21738-2d79-7121-b9bd-fbf4e66f11e9`. Estado terminal `failed`, detalle `Generation failed`. Causa y facturación efectiva sin verificar. La nueva consulta de estimación con el cuerpo original respondió 0,08 USD/s, equivalente a 1,12 USD para otro envío de 14 s. Durante esta revisión se ejecutaron consultas de estado y estimación, sin enviar otra generación. La [maqueta de montaje](video/katana-maqueta-selector.mp4) reutiliza los fotogramas y el control previamente completado.
