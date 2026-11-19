# Tipografía especial y controles de letra: Fase 1 (19/11/2026)

Esta fase se hace sin IA y sin gasto. No toca `datos/` existentes: las muestras van a carpetas nuevas de `datos/disenos/muestras-tipograficas/`. Queda **pendiente de tu revisión** antes de pasar a la Fase 2.

## 1. Qué se ha hecho

### 1.1 Tipografía especial (compositor)

Hay un campo nuevo, `tratamiento`, en la capa de texto de la intención (`src/dominio/diseno/intencion.ts`). Admite cuatro materiales:

| Tratamiento | Qué hace | Parámetros |
|---|---|---|
| `derretida` | Gotas que cuelgan de la base de las letras y se funden con ellas; brillo de líquido espeso | `gotas`, `largo`, `brillo`, `semilla` |
| `papel` | Cada letra es un recorte de papel algo girado, con canto rasgado, grano y sombra | `alma`, `giro`, `sombra`, `semilla` |
| `antigua` | Tipo de imprenta gastado: canto irregular, motas sin tinta, zonas gastadas | `desgaste`, `semilla` |
| `neon` | Tubo de luz por el contorno, con alma clara y halo | `halo`, `alma` |

Cómo se pinta:

- Se pinta con filtros SVG sobre los **contornos reales de la fuente** (`src/adaptadores/compositor/tratamientos.ts`). El texto no puede salir mal escrito, no cuesta nada y es determinista: misma semilla, mismos píxeles.
- `MotorTexto.glifos()` devuelve cada letra por separado, con su carácter y su caja. `trazar()` produce exactamente el mismo trazo que antes.

Reglas que se aplican solas (avisan y pintan el texto limpio):

- Solo en titulares: el mínimo son 56 px de mayúscula.
- Nunca junto con contorno, corte o tinta.
- Una sola por pieza.
- Derretida y antigua **no se aplican a fuentes de alto contraste**. A tamaño real, en Bodoni Moda itálica la derretida borra el trazo fino de la «M» y la antigua lo deja punteado.
- En titulares de varias líneas, las gotas no caen sobre la línea de debajo: su largo se limita al hueco que queda.
- El SVG «exacto» lleva el texto tratado como imagen, igual que ya se hacía con la tinta.

**Descartado por ahora: `tiza`.** Tras cuatro iteraciones seguía pareciendo erosión o ruido de televisor, no tiza. No se ha incluido.

### 1.2 Controles de letra (sirven para todas las piezas)

| Control | Gravedad | Caso real que lo justifica |
|---|---|---|
| `LETRA_PERDIDA`: se ve menos del 60 % de una letra porque se sale del lienzo | ERROR (no se exporta) | Entrecot v005 se lee «NTRECOT»; ensalada v002, «NSALADA CESA» |
| `LETRA_TAPADA`: el sujeto tapa más del 50 % de una letra | AVISO en el compositor; **obligatorio** para el director salvo `excepcion` | La palabra detrás del plato es un recurso aprobado, así que la excepción la lee una persona |
| `MARCADOR`: hueco de plantilla sin rellenar (`[…]`, `{{…}}`, TODO, lorem) | ERROR | Chiringuito: `[NOMBRE DEL CHIRINGUITO]` y `[playa]` salieron impresos |
| Textos girados que se montan | AVISO `SEPARACION` | Entrecot: «directo de Galicia» se monta sobre ENTRECOT; antes no se medía porque la separación ignoraba los textos con giro |
| Contraste por líneas | El ERROR `CONTRASTE` de siempre, medido mejor | El bloque entero escondía una línea mala. En la prueba, la medida antigua daba 13,96 a un titular con la segunda línea ilegible; la nueva da 1,06 |

### 1.3 Comprobado con los posts reales (sin escribir nada en sus carpetas)

- **Entrecot v005:** ERROR `LETRA_PERDIDA` («NTRECOT») y AVISO de solape del acento. Son los dos fallos que vimos a ojo.
- **Ensalada v002:** ERROR `LETRA_PERDIDA` («NSALADA CESA»).
- **Pulpo-2:**
  - El contraste del titular baja de 3,82 a 3,06 al medirlo por líneas. Sigue por encima del mínimo de 3 para titulares, así que no salta.
  - Sus problemas de fondo (franja con degradado de plantilla y letra genérica) son de criterio, no de medida.
  - Ningún control de esta fase los atrapa. Corresponden a la Fase 2 (crítico y director).

### 1.4 Ficheros y pruebas

- **Código nuevo:** `src/adaptadores/compositor/tratamientos.ts` y `src/herramientas/muestrasTipograficas.ts` (`npm run muestras-tipo`).
- **Cambiado:**
  - `MotorTexto.ts` (glifos);
  - `intencion.ts` (Tratamiento);
  - `resuelto.ts` (tipos y problemas);
  - `resolutor.ts` (controles);
  - `CompositorSharp.ts` (pintar, contraste por líneas, SVG exacto);
  - `tipografias.ts` (clasificación);
  - `proponerDiseno.ts` (`LETRA_TAPADA` obligatorio);
  - `src/tipos/fontkit.d.ts`.
- **Pruebas:** `test/tipografia-especial.test.ts` (13 casos). He comprobado que los de contraste por líneas y gotas entre líneas **fallan con el código anterior**. `npm test` da **451/451**.
- **Test existente afectado:** «la propuesta rica…» (`test/director-diseno.test.ts`). Con su máscara simulada el plato tapaba entre el 92 % y el 100 % de la O, la J y la A. Por eso `LETRA_TAPADA` es aviso en el compositor y obligatorio en el director: esa propuesta declara `excepcion` y pasa.

## 2. Lo que dice la hoja de muestras (observaciones, no reglas)

Hojas: `datos/disenos/muestras-tipograficas/2026-11-19/hoja.png` (10 locales × 4) y `2026-11-19-2/hoja.png` (con la regla de trazos finos).

- **Derretida:** encaja donde el material existe en la carta. Casa Aranda (chocolate de churros), DAK Burger (salsa o queso) y Candamil: 3 de 10 locales.
  - Queda raro en Sushita (oro que gotea sobre sushi) y en Café Albor (pintura blanca).
  - **El material tiene que ser del plato.**
- **Papel:** funciona en todas las fuentes de trazo medio o grueso (10 de 10 se leen). Es el más «de marca» en Etxebarri, Café Albor y Torre de Vega (parece pan de oro).
- **Antigua:** sutil y creíble en Etxebarri, Lo Güeno y Café Albor. Pega con lo tradicional (asador, mesón).
- **Neón:**
  - En fuentes muy gruesas (Casa Aranda, Lo Güeno) queda como un contorno doble, más rótulo que tubo.
  - Lo correcto es una fuente monolineal; el catálogo solo tiene Sacramento.
  - Encaja con bar nocturno, coctelería y burger urbana.

## 3. Fase 2 (propuesta, sin empezar): el director tipográfico

Lo pediste el 19/11: **el agente que elige la tipografía debe poder editarlo todo**, no solo elegir un efecto.

### 3.1 Qué puede editar hoy la intención y qué falta

| Ya se puede (por texto o por estilo) | Falta y propongo añadir |
|---|---|
| Fuente del catálogo (28, todas OFL) | Escala horizontal y vertical en fuentes **no** variables, acotada a ±15 % para no deformar el dibujo |
| Ejes variables: anchura `wdth`, peso `wght`, tamaño óptico `opsz`, `SOFT`, `WONK` | Inclinación (oblicua) cuando la fuente no tiene itálica |
| Espaciado entre letras (`tracking`) e interlineado | **Ajustes por letra**: kerning de un par, subir o bajar una letra, otro tamaño o un giro (letras que «bailan») |
| Mayúsculas o tal cual, rasgos OpenType (versalitas, swash, ss01…) | Espaciado por línea, distinto en cada línea de un titular |
| Giro, rotación 90°, texto en círculo o arco, contorno, corte, tinta | Texto sobre una curva libre, no solo un círculo |
| Tratamiento (derretida, papel, antigua, neón) con sus parámetros | Parámetros de tratamiento por letra (más gotas en la última, por ejemplo) |

Todo seguiría siendo JSON en la intención: editable a mano, versionado y medido después por el compositor (letras perdidas, contraste, móvil a 360 px).

### 3.2 Cómo elegiría

1. **Candidatos deterministas.** Se puntúa cada tratamiento con:
   - la identidad del local: `perfil.json`, tokens, tono, gama y si es tradicional o urbano;
   - el material del plato, según el inventario: queso, chocolate, caramelo o salsa para derretida, por ejemplo;
   - la referencia elegida;
   - la compatibilidad de la fuente, con metadatos nuevos en `catalogo.json`: `tratamientosAptos` y grosor mínimo de trazo.
2. **El LLM decide** entre los tres mejores, o «ninguno». Ajusta los parámetros tipográficos del punto 3.1 y justifica la elección con el material o la identidad. Si no la justifica, sobra.
3. **El crítico lo juzga** con una pregunta explícita: ¿la letra encaja con este local?
4. **Antes de dar nada por bueno,** se renderiza y se mira.

### 3.3 Decisión tuya pendiente

`conocimiento/oficios/composicion-y-tipografia.md`, regla 9: **«Sin efectos: ni contorno ni sombra en el texto»**. La tipografía especial choca con ella. Propongo esta excepción:

> «… salvo una tipografía especial en el titular, cuando el material es del plato o del local».

No la he cambiado.

### 3.4 Fase 3 (de pago, solo con tu permiso)

Lettering con IA de imagen para materiales que el filtro no consigue, como letras hechas del propio alimento:

1. Se envía la palabra ya trazada con la fuente como guía, para que no haya faltas.
2. Se recorta el resultado.
3. Se verifica con OCR que pone lo que tiene que poner.

## 4. Mejoras de posts y carruseles que siguen pendientes

Salen del análisis del 19/11 (ver `diseno/CONSOLIDACION-2026-11-19.md`). Las propongo para la Fase 2:

- **El crítico tiene que poder pedir rehacer el mecanismo, la tipografía o la jerarquía.** Hoy solo corrige recorte, contraste, tamaño y margen, y aprobó pulpo-1 y pulpo-2 sin incidencias.
- **Degradado o franja «gratuita»:** aviso cuando un degradado solo sirve para apoyar el texto.
- **Carrusel con narrativa:**
  - portada, desarrollo y cierre con funciones distintas;
  - contador;
  - variedad de plano: hoy las láminas son recortes ampliados de una sola foto.
