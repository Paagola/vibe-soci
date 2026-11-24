# La interfaz del estudio: el pase y la mesa de luz

Plan de diseño del 24/11/2026, hecho con el método de la skill `frontend-design` de Anthropic (dos pasadas: un plan
revisado contra los clichés de las interfaces hechas con IA y, después, el código).

## El tema

**El pase** es el mostrador donde se revisa cada plato antes de que salga de la cocina. Quien usa el estudio es el
dueño de un restaurante, desde el móvil o un portátil. Lo que quiere es pasar de la foto de un plato a un post o
carrusel terminado y **ver cómo se hace**.

La sala está a media luz: acero, pizarra y la comanda. Lo único que brilla es la **mesa de luz**, la superficie donde el
fotógrafo revisa las diapositivas. Ahí se compone cada lámina, capa a capa.

## Tokens

| Nombre | Hex | Papel |
|---|---|---|
| Sala | `#141716` | Fondo: pizarra con un punto de verde, como el acero del pase |
| Barra | `#101312` | Barra lateral |
| Ficha | `#1C201F` | Superficie de las tarjetas |
| Línea | `#2C3230` | Bordes y divisores |
| Tinta | `#E8ECE9` | Texto principal; secundario al 62 % |
| Laurel | `#8DB9A0` | La acción, la selección y el foco (verde salvia apagado) |
| Mesa de luz | `#E6EAE6` | La única superficie clara: donde se compone la pieza |

**Tipografía.** Work Sans para la interfaz (14–16 px; pesos 400, 500 y 600). Fraunces, con óptica alta y el eje SOFT a
la mitad, solo para los títulos de las tarjetas y el nombre de cada pieza. Escala: 12, 14, 16, 20, 28 y 40. Líneas de
menos de 75 caracteres.

## Composición

```
┌ barra ─┐┌──────────────── sala ────────────────────────┐
│ conver ││ título de la conversación        recorrido   │
│ saciones│├─────────────────────────────────────────────┤
│        ││   mensaje del director (720 px)              │
│        ││   ┌ ficha ──────────────────────────┐        │
│        ││   │ título en Fraunces              │        │
│        ││   │ contenido                       │        │
│        ││   └─────────────────────────────────┘        │
│        ││ ┌ mesa de luz (más ancha: 880 px) ─────────┐ │
│        ││ │ [▢] [▢] [▣ componiéndose] [▢] [▢]          │ │
│        ││ │  1    2      3 · capas    4    5        │ │
│        ││ └──────────────────────────────────────────┘ │
│        ││   campo del director + acciones              │
└────────┘└──────────────────────────────────────────────┘
```

## Principios

1. **Taller callado, mesa de luz protagonista.** Fichas planas con una línea fina y sin sombra. La mesa de luz es lo
   único claro y con profundidad.
2. **Un solo momento orquestado: la composición.** Las fotos llegan desenfocadas y se enfocan. Cada lámina se monta
   capa a capa (el fondo, la foto que se enfoca, el plato que se posa con su sombra, el titular que se revela, los
   filetes que se trazan, la firma) y termina con un barrido de luz. Se puede repetir con «Ver cómo se compuso». El
   resto solo se mueve cuando la persona hace algo. Con «reducir movimiento», todo aparece sin animación.
3. **Palabras llanas.** Frases en minúscula inicial, sin etiquetas en mayúsculas ni metadatos unidos con puntos, y el
   verbo de cada botón dice lo que pasa.

## Revisión contra los clichés

| Cliché | Cómo se evita |
|---|---|
| Fondo crema, serif de alto contraste y acento terracota | Sala de pizarra verdosa; Fraunces suave solo en títulos; acento verde laurel apagado |
| Casi negro con un acento ácido | Laurel desaturado; la luz la pone la mesa clara, no un acento |
| Tarjetas idénticas con la misma sombra | Fichas planas sin sombra (radio 10); mesa de luz con profundidad (radio 16); imágenes con radio 6 |
| Etiquetas en mayúsculas, puntos medios y flechas | Se eliminan de la interfaz |
| Aparecer deslizando en cada mensaje y tarjeta | Se elimina: solo la composición se anima por sí sola |

**Cambios tras la revisión:** había previsto mantener la aparición deslizada de los mensajes y las etiquetas en
mayúsculas de las fichas. Se quitan las dos porque son exactamente esos clichés. El acento azul de antes se sustituye
por el laurel, porque el azul era el de cualquier SaaS.

## La mesa en vivo: los agentes con su cursor (25/11/2026)

La producción y la edición eran una espera muda: una cuadrícula de marcos y, al editar capas, nada. Ahora la mesa de luz
funciona como un lienzo multijugador (`web/src/components/chat/mesa.tsx`):

- **Cada agente tiene su cursor**, con su nombre y su color: Director (cobalto), Fotógrafo (mostaza), Maquetador (coral)
  y Revisor (verde). Si trabajan dos a la vez, se numeran («Fotógrafo 2»): son puestos reales del servidor, que hace
  hasta tres fotos y tres maquetas en paralelo.
- El cursor **va a la lámina en la que trabaja** y deambula por su zona. Un bocadillo dice lo que hace; al cambiar de
  tarea «hace clic» (una onda) y el bocadillo se lee entero unos segundos antes de encogerse a una línea.
- **El Maquetador selecciona** la zona que compone, con los tiradores de un editor de diseño. En una edición de capas,
  la selección es la caja real de la capa que cambia («Mueve «titular»»), calculada a partir de su intención.
- **El Fotógrafo dispara**: un destello sobre el marco mientras se hace la toma.
- Arriba, las caras de quién está en la mesa; abajo, la bitácora con lo último que han hecho.
- **Mesa de edición**: mientras se retocan las capas de una pieza terminada aparece «Retocando la N» con la lámina
  grande, la petición del cliente y los cursores encima.

**De dónde salen los datos.** El servidor publica `pieza.agentes` (quién, en qué lámina, en qué zona y haciendo qué),
`pieza.bitacora` (los últimos 14 apuntes) y `pieza.edicion` (las láminas que se retocan). Lo emiten
`ServicioChat.agente()` en la producción y el callback `avisar` del editor de capas. No es teatro: cada mensaje
corresponde a un paso real (la toma, la revisión del director, la medida de luz, la lectura del texto a tamaño móvil, el
paso a sangre…). La única pausa añadida son 650 ms en cada capa que toca una edición, para que se vea dónde trabaja. Las
piezas antiguas, sin estos datos, deducen los cursores de su progreso.

**Cambia el principio 2.** Ya no se mueve solo la composición: mientras trabajan, también se mueven los cursores. Con
«reducir movimiento», los cursores aparecen en su sitio sin desplazarse ni deambular, y no hay destellos ni ondas.
