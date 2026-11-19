# Sistema de tipografía especial: buscar o crear (diseño, 19/11/2026)

**Encargo:** un agente busca la tipografía que le corresponde a cada pieza según:
- la identidad del local;
- el material del plato;
- la referencia;
- lo que la letra puede editarse (espaciado, anchura, altura…).

Si nada de la biblioteca encaja, **crea un estilo nuevo** con el mismo método que se usó a mano el 19/11 (prototipo, render, mirar, corregir) y lo guarda como **reutilizable**.

## 1. La idea central: los estilos son recetas, no código

Los cuatro tratamientos de la Fase 1 están escritos a mano en TypeScript (`tratamientos.ts`). Un agente no puede ni debe escribir código que se ejecute. Por eso **un estilo pasa a ser una receta JSON**: un lenguaje pequeño y cerrado que el compositor interpreta.

- **Es seguro.** La receta solo puede usar piezas de una lista blanca, con rangos acotados y un número máximo de nodos. No hay código ni rutas, y nada sale fuera del SVG.
- **Es editable y versionado.** Es un fichero que se lee, se compara y se corrige como cualquier intención.
- **Es reutilizable.** Las recetas aprobadas viven en `recursos/tratamientos/` y cualquier pieza las usa por su id.
- **Es medible.** Todas las recetas pasan por las mismas comprobaciones: letra perdida, contraste por líneas, OCR y trazos finos.
- **Los cuatro estilos actuales se reescriben como recetas** y deben pintar lo mismo. Eso demuestra que el lenguaje da para lo que ya funciona.

### 1.1 Las piezas de una receta (`tipografia/receta@1`)

Todas las medidas van en **alturas de mayúscula** (`cap`), así el estilo es igual a cualquier tamaño.

| Pieza | Para qué | Ejemplo |
|---|---|---|
| `parametros` | Mandos que la pieza puede ajustar, con mínimo, máximo y valor por defecto. Se usan como `"$nombre"` en cualquier número | `largo` de las gotas, `desgaste` |
| `letras` | Variación por letra: giro, desplazamiento y escala al azar, con semilla | Los recortes de papel algo torcidos |
| `emisores` | Formas que salen de cada letra, ancladas a su base, techo o lados: gota, círculo, rect, chispa. Llevan probabilidad, tamaño y "no invadir la línea de abajo" | Las gotas de la derretida |
| `capas` | Pasadas que se pintan de abajo arriba. Cada una dice qué pinta (letras, letras + emisores, solo la franja baja), con qué pintura (relleno o trazo, en un color) y con qué filtro | Sombra, alma de papel y cara de la letra |
| `filtro` | Grafo de filtros con nodos de una lista blanca: `turbulencia`, `desplazar`, `desenfocar`, `umbral`, `dilatar`, `erosionar`, `inundar`, `componer`, `mover`, `brillo`, `fundir`. Cada nodo nombra su entrada y su resultado | El canto rasgado del papel, las motas de la antigua |
| `colores` | `@texto` (el color del estilo de la marca), `@alma`… o un hex | El alma clara del neón |

### 1.2 La ficha de cada estilo (lo que usa el buscador)

Cada receta lleva su ficha:

| Campo | Qué recoge |
|---|---|
| `materiales` | Queso, chocolate, caramelo, salsa, papel, madera, tinta, luz… |
| `identidades` | Tradicional, artesanal, urbano, nocturno, marinero, familiar, de autor… |
| `evitar` | Cuándo no usarlo (oro que gotea sobre sushi) |
| `fuentes` | Clasificaciones aptas y no aptas (alto contraste, script…) y cuerpo mínimo |
| `origen` | ESTUDIO o AGENTE, con el brief y las referencias de donde salió |
| `estado` | `BORRADOR` → `PRUEBA` → `APROBADO` → `RETIRADO`, con fecha y quién lo aprobó |
| `version` y `derivaDe` | Las variantes no pisan el original |
| `pruebas` | Las métricas de la última verificación y la hoja de muestras |

Las observaciones de la hoja del 19/11 se vuelcan aquí como datos de partida: derretida va con "material del plato que se funde", antigua con tradicional, etcétera. Siguen siendo observaciones, no reglas.

## 2. Edición total de la letra

La intención ya permite:
- fuente y ejes variables (anchura, peso, tamaño óptico);
- espaciado entre letras e interlineado;
- mayúsculas, rasgos OpenType y giro.

Se añade:
- **Escala horizontal y vertical** en fuentes no variables, como mucho ±15 %.
- **Inclinación.**
- **Espaciado por línea.**
- **Ajustes por letra:** kerning de un par, subir o bajar una letra, tamaño y giro.
- **Parámetros del estilo:** se ajustan pieza a pieza dentro de sus rangos.

El buscador devuelve el **estilo completo** (fuente, medidas, receta y parámetros), no solo un efecto.

## 3. El buscador

```
pieza (local + plato + referencia + rol del texto)
   │
   ├─ 1. Consulta: rasgos del local (perfil + tokens; se extraen una vez y quedan para que el dueño los confirme),
   │     material del plato (inventario de la pieza), tipografía de la ficha de referencia, fuentes de la marca.
   ├─ 2. Filtro duro (código): fuentes compatibles, cuerpo mínimo, «evitar», solo recetas APROBADO.
   ├─ 3. Puntuación (código): coincidencia de material e identidad, más lo aprendido de los votos.
   ├─ 4. Elige el director (LLM): entre los 3 mejores o «NINGUNO»; ajusta parámetros y medidas y lo justifica
   │     con el material o la identidad. Si no lo puede justificar, la pieza va sin tipografía especial.
   └─ 5. Si dice NINGUNO y explica qué buscaba (un brief): pasa al creador.
```

«Ninguno» es una respuesta válida y frecuente. La regla de la Fase 1 sigue en pie: si es adorno, sobra.

## 4. El creador: el mismo método que se usó a mano

Es un bucle de como mucho 4 rondas:

1. **Brief:** qué material, por qué, y para qué local y plato.
2. **El agente escribe una receta.** Parte de las recetas de la biblioteca como ejemplos y del manual del lenguaje.
3. **Se valida en código:** esquema, lista blanca, rangos y referencias del grafo. Si falla, vuelve al agente con el error.
4. **Se pinta la hoja de muestras:** la palabra del encargo y un pangrama corto, con tres fuentes (la de la marca, una grotesca y una serif) y dos fondos.
5. **Se mide en código:**
   - OCR local con Apple Vision: tiene que leer el texto exacto con las tres fuentes;
   - cuánto se conserva la letra frente a la limpia;
   - trazos finos;
   - tiempo de render menor de 2 s;
   - determinismo.
6. **Lo critica un revisor visual** (Gemini con visión, tier gratuito). Compara la hoja con el brief: «¿parece queso fundido o pintura?, ¿parece IA o plantilla?». Devuelve correcciones concretas.
7. **Si no pasa, vuelve al paso 2** con las métricas y la crítica.
8. **Si pasa, se guarda como `PRUEBA`** en `recursos/tratamientos/<id>/`, con su receta, ficha, hoja y métricas. Se puede usar en piezas de prueba y nunca en una publicable.
9. **Tú lo apruebas** viendo la hoja, en la web o con `npm run tratamiento -- aprobar <id>`. Pasa a `APROBADO` y queda en la biblioteca para todos los locales.

El paso 9 es una puerta humana a propósito: tu gusto es el criterio. Un estilo creado por el agente no se publica sin que lo hayas visto.

- **Coste:** sin IA de imagen y sin gasto. Gemini de texto y visión en el tier gratuito, con un tope de rondas.
- **Fallo:** si el tier gratuito responde 429, el creador se para y deja el brief guardado. También se puede lanzar desde una conversación conmigo con las mismas herramientas de línea de comandos.

## 5. Arquitectura (puertos y adaptadores)

- **Dominio:**
  - `src/dominio/tipografia/receta.ts`: esquema, validación y lista blanca;
  - `ficha.ts`;
  - `consulta.ts` (rasgos y puntuación).
- **Compositor:** `src/adaptadores/compositor/interpreteRecetas.ts` traduce de receta a SVG. Sustituye a `tratamientos.ts`.
- **Puertos:**
  - `BibliotecaDeTratamientos`: buscar, leer, guardar, cambiar estado;
  - `DisenadorDeTratamientos`: escribir y corregir una receta a partir de un brief;
  - `LectorDeTexto`: el OCR, que ya existe como `leerCartel.swift`;
  - `RevisorVisual`: el que ya hay, con una pregunta nueva.
- **Adaptadores:**
  - biblioteca en ficheros (`recursos/tratamientos/`);
  - diseñador con Gemini y uno simulado para las pruebas;
  - OCR con Apple Vision.
- **Aplicación:** `buscarTipografia.ts` y `crearTratamiento.ts`.
- **Herramientas:** `npm run tratamiento -- buscar|crear|muestras|aprobar|retirar`.

## 6. Fases

| Fase | Qué | Cómo se comprueba |
|---|---|---|
| **A** | Lenguaje de recetas e intérprete. Los 4 estilos pasan a ser recetas en `recursos/tratamientos/`. La intención pasa a `tratamiento: { receta, parametros }` | Las recetas pintan lo mismo que el código de la Fase 1 (diferencia de píxeles mínima). Se miran las hojas |
| B | Ficha y buscador determinista, más la elección del director (Gemini). Edición total de la letra en la intención | Casos de prueba por local. La hoja de lo que elegiría para los 10 locales, revisada por ti |
| C | Creador: bucle receta → muestras → OCR → crítica, con estados y aprobación | Un estilo nuevo creado de punta a punta en simulado y otro real (tier gratuito). Tú decides si entra |
| D | Integración en el flujo del post y del taller, y en la web | Un post real |

Pendiente de tu decisión, desde la Fase 1: la excepción a la regla 9 («sin efectos en el texto»).

## 7. Fase A: hecha (19/11/2026)

- **Lenguaje de recetas:** `src/dominio/tipografia/receta.ts`.
  - Esquema estricto y lista blanca de 11 nodos de filtro.
  - Emisores (gota, círculo) y variación por letra.
  - Parámetros con tipo y rango.
  - Validación del grafo: entradas, parámetros, filtros y emisores citados, y un máximo de 40 nodos.
- **Intérprete:** `src/adaptadores/compositor/interpreteRecetas.ts`. Sustituye a `tratamientos.ts`, que se ha borrado.
- **Biblioteca:**
  - en ficheros: `recursos/tratamientos/<id>/receta.json`;
  - puerto: `BibliotecaDeTratamientos`;
  - adaptador: `BibliotecaTratamientosFicheros`, que valida cada receta al leerla.
- **Intención:** `tratamiento: { receta: "<id>" | <receta en línea>, parametros, semilla }`.
  - Los parámetros se comprueban contra su receta.
  - Los colores pueden ser `@token`.
  - Las restricciones de fuente y de cuerpo salen de la **ficha** de cada receta, no del código.
  - Un estilo en `BORRADOR` o `PRUEBA` se puede pintar, pero da ERROR: no se publica sin tu aprobación.
- **Equivalencia:** los 4 estilos de la Fase 1, reescritos como recetas, pintan **exactamente los mismos píxeles** (diferencia 0 en 4 estilos × 2 fuentes, una de ellas con dos líneas). Medido antes de borrar el código antiguo.
- **Un estilo nuevo solo en JSON:** `diseno/tipografia-especial/ejemplos/brasa.json` (carbón con grietas encendidas, para asadores). Se ha pintado con `npm run muestras-tipo -- --receta …` sin tocar código.
- **OCR local (Apple Vision) como medida para el creador:**
  - lee bien papel («TORRE DE VEGA»), derretida («CASA ARANDA») y neón («MESÓN LO GÜENO»);
  - en el borrador de brasa lee «TURRE DE VGE» y «ARANI»: el creador lo habría rechazado y corregido, que es lo que debe pasar.
- **Pruebas:** `test/recetas-tipograficas.test.ts` (11 casos) y `test/tipografia-especial.test.ts`, adaptado. `npm test` da **462/462**.

Siguiente: Fase B (ficha, buscador y edición total de la letra). Antes, que revises esta fase.
