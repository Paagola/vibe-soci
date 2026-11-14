# El estudio en vivo · hoja de diseño (kit Diorama 5.7.0)

> Rellenada a partir de `templates/DESIGN.md` del kit. Se mantiene al día con el código de esta carpeta.
> Lo que no aplica (UI educativa, combate, vehículos, mecanismos, agua) se ha quitado.

## Perfil y decisiones (14/11/2026)

- `sceneProfile`: **narrative**. Decisión del usuario: la escena cuenta cómo trabaja el estudio, no es una lección.
- `uiMode`: **minimal-controls**. Decisión del usuario: solo pausa, recolocar la cámara y la órbita libre. Sin tarjetas, lecciones, dock ni rótulos flotantes. El estado se cuenta dentro de la escena. Hay una línea de estado solo para lectores de pantalla (visualmente oculta).
- `representationMode`: explicativo. Es un estudio imaginado; cada puesto es un proceso real del código.
- Preset de render: **`stroked-toon`**, elegido por el usuario. Usa `createStrokedToon` del kit, sin cambios:
  - rampa de 4 escalones `[68, 122, 184, 246]`;
  - contorno `OutlineEffect` de tinta `#27231e` con grosor `0.0034`;
  - antialias, píxeles por punto con tope de 1,5 y `NoToneMapping`.
- `assetStrategy`: **`authored-only`**, decisión del usuario. Ningún modelo de internet. Ver `CREDITS.md`.
- Recibo: *stroked-toon · authored-only · narrative · minimal-controls*.

### Tema oscuro del panel (cambio pedido el 14/11)

El «papel blanco» del kit se sustituye por el fondo del hueco: el lienzo es transparente (`alpha: true`) sobre `#0b1020`.

La losa mantiene el tablero claro (`#f7f6f1`) y el canto azul de marca. Así:
- los contornos de tinta se leen sobre el tablero;
- la losa se recorta sobre el fondo oscuro sin necesidad de un contorno claro, como se ve en las capturas.

## Premisa

Un estudio pequeño donde el encargo de un post va de mano en mano: el corredor lleva el material de un puesto a otro.
- Los **agentes que deciden** (dos directores y el revisor) trabajan en sus mesas.
- Las **máquinas que ejecutan** (generador, recorte y compositor) trabajan solas.
- En las dos **paradas**, todo espera a la persona con una señal amarilla.

Lo que se ve sale de los datos reales: el paso, los intentos, el historial, los avisos de reintento y los errores. Sin datos, la escena queda en reposo.

## Puestos (plano.js)

| Puesto | Paso de la orden | Tipo | Qué hace en la escena | Dato real que lo mueve |
| --- | --- | --- | --- | --- |
| Tablero de la referencia | REFERENCIA | tablero | El corredor coge la ficha; si falta la referencia, espera ante él con la señal amarilla | `paso`, `recorrido` |
| Bandeja de entrada | FOTO_REAL | bandeja | Entra la foto subida; la pila muestra los otros encargos abiertos (hasta 4) | `recorrido`; los encargos sin terminar |
| Director de foto (Gemini) | PROPUESTA | agente | Alterna mirar por la cámara del trípode y anotar; la foto sale convertida en propuesta | `trabajo.estado = EN_CURSO` en ese paso |
| Parada 1 | CONFIRMAR_ELEMENTOS | parada | El suelo se pone amarillo, sube el letrero «TE TOCA» y el corredor enseña la propuesta | `paso` sin trabajo en curso; `bloqueo` (tras dos descartes vuelve aquí) |
| Generador | GENERAR | máquina | La propuesta entra por la ranura; ojo de buey encendido, manivela y flash; la foto nueva sale por la bandeja | `trabajo`; `avisos` → nube «503» |
| Revisor (comprobación automática) | COMPROBAR | agente | Pasa la lupa; al final marca con el sello: visto verde o cruz roja | `intentos[n].final`: DESCARTA → cruz y vuelta al generador |
| Parada 2 | CONFIRMAR_FOTO | parada | Igual que la parada 1, con la foto nueva | `paso`; el rechazo (`RECHAZADA` y recorrido hacia atrás) → cruz y vuelta al generador |
| Recorte (Apple Vision) | MASCARA | máquina | La cuchilla recorre el contorno del plato | `recorrido` |
| Director de diseño F3 (Gemini) | INTENCION | agente | Dibuja a lápiz y levanta la cabeza a pensar | `trabajo`; `diseno.propuestas = 2` → prueba en el compositor y vuelta UNA vez |
| Compositor (sharp/SVG) | COMPONER | máquina | Tres golpes de prensa y el volante girando: sale el post | `recorrido` |
| Bandeja de salida | HECHO | expositor | El post queda en el marco; el corredor vuelve a descansar | `paso = HECHO` |

Los fallos reales (`trabajo.estado = ERROR`) ponen una nube sobre el puesto: el código HTTP si lo hay, «…» si no contestó a tiempo y «!» en otro caso.

Los reintentos dentro de un trabajo en curso, del tipo «no responde, sigo con…», ponen la misma nube sin rojo.

## Reparto (cast)

| Papel | Silueta | Locomoción | Acción | Reacción | Salida | Accesorio |
| --- | --- | --- | --- | --- | --- | --- |
| Corredor (mascota) | Casco blanco, cara negra, sudadera azul | Paso del kit (`walkPose`, fase por distancia; zancada 0,56 m) | Dejar, coger, recoger; enseñar en alto en las paradas | Se gira hacia la cámara en las paradas | Vuelve a la bandeja de entrada al terminar | El material en las dos manos |
| Director de foto | Igual, detrás de su mesa | — (fijo) | Visor del trípode y anotar | Mira al pasillo en reposo | — | Cámara en trípode, portapapeles |
| Revisor | Igual | — | Lupa y sello | Ídem | — | Lupa (mano derecha), sello (izquierda) |
| Director de diseño | Igual | — | Lápiz y pensar | Ídem | — | Lápiz, papelera con propuestas arrugadas |

Las máquinas son autónomas: no tienen operario, a propósito. Ejecutan; no deciden.

## Guion y tiempo (guion.js)

- **Todo es función pura de `t`.** El guion es una lista de segmentos (`andar`, `dejar`, `procesar`, `recoger`, `coger`, `mostrar`, `espera`, `quieto`) con su `t0` y su `t1`. `escena.js` solo evalúa.
- **Recorrido:** el historial más el paso actual, sin repetidos. Los huecos hacia delante se rellenan y los pasos hacia atrás son retornos.
- **Al abrir,** el material aparece donde está, sin repetir el pasado.
- **Cada consulta nueva** (cada 2 s) añade solo las visitas nuevas detrás de lo que ya se ve. Se cuentan en orden y con duración de escena:
  - andar a 0,8 m/s;
  - dejar y recoger, 0,75 s cada uno;
  - trabajar: 2,8 s un agente, 2,6 s una máquina y 2,2 s la prueba.

  En simulado, la orden tarda milisegundos y la escena lo cuenta en segundos. En real, el puesto trabaja hasta que llega el siguiente dato.
- **Foco:** el encargo con trabajo en curso; si no hay, el último que espera; si no, el último terminado.
  - No salta a otro encargo mientras aún cuenta el actual.
  - Tampoco salta antes de dejar su post en la salida.
- **Pruebas:** `test/diorama-guion.test.ts` (10 casos) y `test/web-procesos.test.ts` (ruta de solo lectura).

## Cámara y encaje

- Cámara de héroe:
  - fov 26°, azimut 78°, elevación 48° y objetivo (0,1; 0,25; 0,2);
  - margen de ajuste: `fillX` 0,92 y `fillY` 0,9;
  - distancia resuelta por bisección del kit con las esquinas de la losa, la pared y lo más alto.

  Calibrada con capturas: con los 38° y 27,5° del preset, la losa larga se veía en diagonal y quedaba diminuta en un hueco vertical de 340 px.
- Órbita libre del kit (`orbit.js`):
  - sin auto-giro y sin desplazamiento lateral;
  - distancia entre 0,45 y 1,6 veces la de héroe, y ángulo polar entre 0,25 y π/2 − 0,06;
  - R o el botón la recolocan, y las flechas la giran.
- Losa de 4,9 × 13,2 × 0,34 m. Pasillo central de 1,3 m con flechas en el sentido del material. Pared del fondo con el rótulo «estudio» (el hito).

## Rendimiento (medido el 14/11/2026)

Medido en Chrome sin ventana, con Metal, en este Mac; hueco de 340 × 900 px.

| Medida | Valor |
| --- | --- |
| Fotogramas por segundo en marcha | 30, el tope de `fpsMax` (estable) |
| CPU por fotograma | 3,8 ms con dpr 1 y 4,1 ms con dpr 1,5 |
| Llamadas de dibujo por fotograma (sombras, color y contorno) | 585; eran 915 antes de fusionar lo fijo |
| Triángulos por fotograma (las tres pasadas) | ≈ 231 000 |
| Con el hueco fuera de la vista, la pestaña oculta o en pausa | 0 fotogramas |
| Con `prefers-reduced-motion` | 0 fotogramas: un solo fotograma fijo por cambio de estado |
| Descarga hasta que el hueco se ve | `index.js` y `montar.js`, ≈ 12 KB |
| Descarga al verse | three.js r170 y addons, 741 KB (188 KB con gzip; Express no comprime) + escena, 82 KB |

## Descartado y por qué

- **El aro (halo) de la mascota:** a escala de juguete se leía como el ala de un sombrero negro.
- **Operarios en las máquinas:** las máquinas trabajan solas. Así se distingue el agente que decide de la máquina que ejecuta, y hay menos figuras.
- **Repetir el pasado al abrir:** contaría como nuevo algo que ya pasó.
- **Un encargo por cada encargo abierto:** ensucia la escena. Se cuenta uno; los demás son la pila de la bandeja de entrada.
- **La sacudida del generador mientras trabaja:** 4 mm, no se veía.
- **Texto en el hueco** (tarjetas, una línea de estado visible): el estado se cuenta dentro de la escena (pedido del usuario).
- **Las hojas de la referencia que se despegan del tablero:** el corredor coge una copia y el tablero no cambia.

## QA (capturas fuera del repositorio)

- `diorama.html?qa=demo` aplica, en orden, estados con la forma exacta de `/api/procesos`. Expone `window.__diorama.freeze(t)` y las marcas de tiempo, que es el contrato del arnés del kit.
- `frames.mjs` del kit sobre el corredor andando: `ok`, sin congelarse ni teletransportarse.
- Recorrido en vivo con el servidor en simulado: un encargo pasó por todo el flujo y la escena lo contó, sin errores en la consola.
- Comprobados la órbita, la recolocación de la cámara y la pausa.

## Riesgos y límites

- En el hueco de 340 px, las figuras miden unos 20 px. Se leen las siluetas, la cara y el material; los detalles de las mesas, solo de cerca (con la órbita).
- El tiempo de escena no es el tiempo real: la escena cuenta lo que pasó, en orden, con su propio ritmo.
- `/api/panel` no tenía el historial ni los avisos, por eso existe `/api/procesos`. Si el hueco cambia su `obtenerEstado` para que devuelva `/api/procesos`, el diorama lo usa directamente y no pide nada más.
