---
nombre: familias-de-referencia
resumen: Las 10 familias de los 29 posts de referencia del usuario, con su receta, sus mecanismos y lo que el compositor aún no sabe hacer.
fases: brief, concepto, composicion, revision
formatos: post, carrusel, historia
---

# Familias de referencia

Análisis hecho a mano post a post el 07/11/2026 (`diseno/f1_6/FASE-0.md` §2).
- **Fichas:** las fichas estructuradas están en `fichas/post-NN.json` (esquema `referencia/ficha@1`, `dominio/referencia.ts`).
- **Datos:** las familias, con los tonos de marca con los que encajan, están en `familias.json`.
- **Hoja de contacto:** `diseno/f1_6/img/familias-referencias.jpg`.

**Rasgos comunes de casi todas:**
- producto entero, grande y reconocible;
- color saturado o negro limpio;
- titular protagonista;
- un recurso con propósito;
- tres niveles de jerarquía.

**Cómo es el titular:** «una palabra gigante con relación espacial» está en 10 de 29 piezas (3, 9, 10, 12, 13, 16, 19, 25, 28 y 29). Las oscuras editoriales (F4) y las blancas (F6) usan en su lugar un **logotipo tipográfico** (script con serif o palo seco) y aire.

| Familia | Posts | Receta | Encaja con |
|---|---|---|---|
| F1 · Color plano + recorte + palabra detrás | 3, 12 | Fondo plano saturado o negro limpio → palabra ultracondensada a ancho completo, tapada abajo por el producto (30–45 %) → recorte grande en vista lateral con sombra de contacto → script que cruza → una fila pequeña | Locales canallas, urbanos |
| F2 · Palabra repetida como patrón | 9, 25, 28 | Fondo plano u oscuro → palabra corta repetida en filas o rejilla → producto o mano tapando el centro | Canallas, de humor |
| F3 · Color plano de oferta con recurso | 2, 5, 16, 17 | Fondo plano con textura → recorte → palabra girada o arcos → sello con dato real → tira, papel o mancha | Informales, ofertas |
| F4 · Oscuro editorial: serif o script | 7, 11, 14, 20, 21, 22 | Oscuro a sangre, luz lateral o flash → plato en ¾ abajo con aire arriba → logotipo tipográfico de script con didona → versalitas → acción opcional | Sobrios, elegantes, de fuego |
| F5 · Escena oscura con información o marco | 1, 6, 8 | Escena del local → información ordenada (tarjeta, columnas) o marco del que sale el producto | Horarios, eventos |
| F6 · Blanco o claro editorial | 4, 15, 29 | Blanco o piedra → plato cenital cortado por un borde → titular suizo o palabra girada que sangra → etiquetas o anotaciones | Sobrios, alta cocina |
| F7 · Macro a sangre + franja de papel | 24, 30 | Macro arriba y abajo → papel rasgado (blanco o negro) → logotipo tipográfico encima | Artesanos, rústicos |
| F8 · Salpicadura congelada sobre claro | 18, 19 | Fondo claro o partido → bebida con salpicadura → titular que pasa a contorno al cruzar | Bebidas, cafeterías |
| F9 · Ilustrado y pegatinas | 13, 26, 27 | Flash de día → pegatinas, sellos, flechas, trama → titular heavy o retro | Desenfadados, familiares |
| F10 · Cenital a sangre con texto que sigue la forma | 10 | Cenital a sangre → texto en arco por el borde del plato → una mano | Para compartir, luminosos |

**Mecanismos que atraviesan las familias** (ver `dominio/referencia.ts`, `Mecanismo`):
- palabra detrás (3, 12);
- contorno al cruzar (19);
- patrón (9, 25, 28);
- texto curvo (2, 10, 13);
- palabra girada (16, 29);
- logotipo tipográfico (7, 12, 14, 16, 17, 22, 24, 30);
- sale del marco (6);
- entra por los bordes (3, 15, 16, 28);
- plato cortado por el borde (4, 17, 29);
- mano en acción (1, 10, 20, 25);
- salpicadura (18, 19);
- sello (2, 5, 7, 13, 25–28);
- flechas a mano (4, 26–28);
- papel rasgado (16, 24, 27, 30);
- tira de cuadros (5, 25, 26).

**Lo que el compositor no sabe hacer todavía** (se construye solo cuando una familia elegida lo pide, FASE 3):
- texto sobre un arco o un trazo (hoy solo hay círculo completo);
- contorno dividido por la máscara;
- giro libre de un recorte;
- capa vectorial para sellos, flechas, manchas y tiras;
- papel rasgado;
- patrón repetido;
- tarjeta translúcida.

**Las fuentes de script y didona ya están en el catálogo:** Bodoni Moda, Ballet y Kaushan Script, todas OFL.
