# Consolidación del 19/11/2026

Este documento junta en `pase-hydrogen` todo lo que tenían las carpetas hermanas antes de borrarlas:

- `pase-taller`
- `piloto-direccion-capas`
- `pase-espacial`
- `pase-editorial`
- `estudio-contenido`

También recoge las ideas de `repos/society-idea` que pueden mejorar el estudio.

## 1. Cómo estaban montadas las carpetas

Las seis carpetas eran **worktrees del mismo repositorio git**. El `.git` real estaba en `estudio-contenido/.git`, que además tenía nueve worktrees de agentes en `estudio-contenido/.claude/worktrees/`.

**Todas las ramas commiteadas son ancestros de `pase-hydrogen`.** Las comprobé con `git rev-list pase-hydrogen..<rama>`. Las ramas `main`, `productor`, `productor-arreglos`, `f3-2-arreglos`, `f3-3`, `diorama-procesos`, `rediseno-web-society`, `pase-taller`, `pase-espacial`, `pase-editorial`, `piloto-direccion-capas` y la de casi todos los agentes no tienen ningún commit fuera de hydrogen.

`git diff --diff-filter=D` frente a pase-espacial, pase-editorial y pase-taller no muestra ningún fichero borrado en `src`, `test` ni `diseno`. Hydrogen no perdió ninguna función por el camino.

## 2. Lo que no estaba en hydrogen y su veredicto

| Pieza | Qué es | Veredicto |
|---|---|---|
| Cambios sin commitear de `piloto-direccion-capas`, ahora commit `2aaa3ba` en la rama `piloto-direccion-capas` | **Serie de taller.** Desde la candidata aprobada maqueta un carrusel de 2 a 6 láminas (portada, detalles y cierre) con 7 tratamientos tipográficos. Mide el cuerpo a 360 px y el contraste, guarda la serie con huella y descarga un zip marcado PUBLICABLE o SOLO_PRUEBA. Incluye además la **escena de fuente** DOCUMENTAL o EDITORIAL y `escenaCotejada` al aprobar. El typecheck pasa y su test da 3/3. | **APORTA.** Parte del mismo commit que hydrogen (`fc64444`), así que se fusiona sin conflictos. |
| 3 commits F3.1 en la rama `worktree-agent-afd09eefea902c59e` (`3fb2040`, `31808bf`, `b94b939`) | Aire encima y debajo del plato, sangrado simétrico, tres voces y firma al borde | **NO APORTA.** F3.3 reescribió después `mecanismos.ts`, y `31808bf` se declara «fusionar solo si el usuario lo aprueba». Queda la rama por si acaso. |
| `rediseno-web-society`: `src/web/rutas/referencias.ts` sin trackear | Ruta para elegir una referencia de la biblioteca o subir una imagen desde la web | **DUDOSO.** Hydrogen ya elige la referencia desde el taller. Se guarda en `copias-estudio-contenido/`. |
| Resto de worktrees de agentes | Versiones anteriores de `promptFiel`/`explicaciones` y avisos de bloqueo | NO APORTA, porque hydrogen ya tiene una versión posterior. |
| `diorama-procesos`: `.env.ejemplo` con `GEMINI_FACTURACION=si` | — | NO APORTA y es peligroso: activaría el gasto por defecto. |

### Datos y documentos fuera de git

| Origen | Contenido | Decisión |
|---|---|---|
| `estudio-contenido/biblioteca/valoraciones.jsonl` | 4 votos reales del 03/11; el código la lee | RESCATAR |
| `estudio-contenido/datos/disenos` | 887 MB de renders y generaciones pagadas; 16 de 18 carpetas no estaban en hydrogen | RESCATAR |
| `estudio-contenido/datos/{piezas,copias,huellas,subidas}` y `duraciones.json` | Piezas del MVP del 03/11, copias de marca y valoraciones, huellas, subidas y duraciones reales para la estimación | RESCATAR |
| `estudio-contenido/datos/{gasto,locales}` | — | Ya estaban; hydrogen tiene todo lo de estudio-contenido y más |
| `estudio-contenido/proyectos/` sin commitear | Ensalada César, jamón con pata ×2, prueba-f3-meson y dos versiones de intención del entrecot | RESCATAR |
| `estudio-contenido/PROMPT-AGENTE-PRINCIPAL.md`, `revision-externa.zip` | Encargo para un agente nuevo y paquete de revisión externa del 09/11 | ARCHIVAR en `copias-estudio-contenido/` |
| `pase-taller/datos/ensayo-oficio` y `pase-editorial/datos/qa-editorial` | Ensayos de oficio y capturas de QA | ARCHIVAR en un tar en `copias-estudio-contenido/` |
| `datos-simulado/`, `ids*.json`, `biblioteca/*.zip`, `.env` | Salida del modo simulado, ids viejos, zips ya descomprimidos y un `.env` idéntico byte a byte | DESCARTABLE |

## 3. Estado de pase-hydrogen el 19/11

- **Qué es hoy.** El centro es **El pase** (`/`, una mesa web 3D). El flujo va así:
  1. Encargo.
  2. Productor: inventario, plan y ficha. Para en CONFIRMAR_ELEMENTOS.
  3. Foto candidata. Para en CONFIRMAR_FOTO.
  4. Máscara, intención, compositor, crítica y exportación.
  5. Taller de arte, con el cartel de foto y título.
- **Uso real con Gemini:** `proyectos/2026-11-17-pulpo-a-la-gallega` y `2026-11-18-pulpo-2`.
- **Pruebas:** 435/435 en verde; typecheck limpio.
- **Debilidades:**
  - `CONTEXTO-PARA-IA.md` (09/11) y `diseno/f1_6/ESTADO.md` (14/11) están desfasados: no hablan de El pase, el taller, el Productor ni el cartel.
  - Hay tres caminos paralelos sin frontera clara: el generador antiguo, `post/ordenPost.ts` junto con `productor/`, y `taller/`.
  - Algunos ficheros son grandes: `ordenPost.ts` tiene 962 líneas y `consultasPost.ts` 543.
  - **Las compuertas no gobiernan.** En pulpo-2 se confirmó una foto que la comprobación automática daba como DESCARTA, y la crítica del render aprobó.
  - Los tres proyectos de pulpo están sin commitear, con nombres incoherentes.

## 4. Ideas de `repos/society-idea` para hydrogen

**Ya cubierto o superado en hydrogen:**

- inventario de verdad (`inventario.ts`);
- regla «otra toma»;
- comprobación de salida;
- referencia obligatoria con fichas;
- `perfil@2` con fuente de cada dato;
- compositor determinista;
- rúbrica;
- aprendizaje HIPÓTESIS → OBSERVADA → CONFIRMADA.

**Mejoras priorizadas** (S = pequeña, M = media):

1. **De-slop en la foto nueva (S).** Lista negra de términos de render (`4K`, `masterpiece`…), imperfecciones con ubicación («migas a la derecha del pan») y cada restricción escrita dos veces, en la descripción y al final.
   - Fuente: `skills/directoria/references/hosteleria/06-de-slop-y-revision.md`.
   - Dónde: `src/adaptadores/gemini/instruccionesFoto.ts` y `conocimiento/antipatrones.md`.
2. **Criterios de rechazo escritos antes de generar (S).** Cada foto guarda «esto la invalida», y `comprobacionSalida.ts` y `RevisorVisualGemini` juzgan contra esa lista. Ayuda a calibrar el revisor y a que sus compuertas gobiernen de verdad.
   - Fuente: `skills/director-reels/references/03-contrato-de-plano.md`.
3. **Ángulos distintos entre las láminas de un carrusel (S).** Hoy `esOtraToma` solo compara con la foto subida. Encaja con la serie de taller.
   - Dónde: `cotejo.ts` o `fotoNueva.ts`.
4. **Comprobar al exportar (S).**
   - máximo 5 hashtags;
   - etiqueta de IA;
   - alérgenos confirmados por el dueño;
   - sin logos de terceros.

   Fuente: `README.md` §11. Dónde: `exportarPieza.ts`.
5. **Portada que se entiende sin texto (S).** La crítica evalúa la primera lámina con el texto oculto.
   - Fuente: `skills/hooks-society/SKILL.md`, paso 4.
6. **Brief con objetivo e hipótesis, y la salida «no producir» (S-M).**
   - Fuente: `README.md` §6.4 e `informes/Society_cerebro_estrategico.md` §1.
   - Dónde: `src/dominio/brief.ts`.
7. **Datos comerciales con vigencia (M).** Un precio, una oferta o una fecha caducados bloquean la pieza.
   - Fuente: `informes/Society_cerebro_estrategico.md` §3.
   - Dónde: `perfil.json` y `propuesta.ts`.
8. **Biblia versionada con precedencia de reglas (M).** El orden es verdad, datos comerciales, excepción de pieza, regla del cliente, plantilla y sugerencia del modelo. Así una corrección puntual no se vuelve regla universal.
   - Fuente: `informes/Society_metodo_direccion_visual.md` §2.
   - Dónde: `marca/perfil.ts` y `aprendizaje.ts`.
9. **Métricas a +24 h, +72 h, +7 d y +28 d como evidencia del aprendizaje (M).** Solo sirve cuando haya publicación real.
   - Fuente: `README.md` §10.

**Desajustes de alcance.** La visión de SOCIETY pide cosas que hydrogen no tiene:

- estrategia y calendario (pilares y plan mensual);
- publicación y medición;
- historias y reels;
- las entradas «comunicar una novedad» e «inspirarme en un reel»;
- radar de nicho;
- Google Business Profile;
- multi-restaurante, con cuotas y aislamiento por cliente;
- cumplimiento: alérgenos y declaración de IA;
- la cuenta propia de Society como banco de pruebas.

Lo de vídeo (Kling, Seedance, Remotion, voz) no aplica a los posts.

## 5. Qué se hizo el 19/11

1. Copia del `.git` original en `../copias-estudio-contenido/git-repo-2026-11-19.tar.gz`.
2. Rescate a `pase-hydrogen` con `rsync --ignore-existing`, sin sobrescribir nada:
   - `datos/{disenos,piezas,copias,huellas,subidas}`, `datos/duraciones.json` y `biblioteca/valoraciones.jsonl`;
   - los proyectos sin commitear;
   - las dos versiones del entrecot, guardadas como `*.desde-estudio-contenido.json`.

   Comprobado: no queda ningún fichero solo en el origen. Los registros de gasto de hydrogen contienen todas las líneas del origen.
3. Archivado en `../copias-estudio-contenido/archivo-2026-11-19/`:
   - `PROMPT-AGENTE-PRINCIPAL.md`
   - `revision-externa.zip`
   - `referencias.ts` (de `rediseno-web-society`)
   - `diorama-procesos.zip`
   - `datos-taller-editorial.tar.gz`
   - el diff de `.env.ejemplo`, el que pone `GEMINI_FACTURACION=si`, que no se aplica
4. `git worktree remove` de los 13 worktrees secundarios. Las ramas siguen en el repo.
5. **`pase-hydrogen` pasa a ser el repositorio principal**: el `.git` se movió aquí. Se borraron las carpetas `estudio-contenido`, `pase-taller`, `pase-editorial`, `pase-espacial` y `piloto-direccion-capas`.
6. La serie de taller se fusionó por fast-forward (`2aaa3ba`). Typecheck limpio; `npm test` da 438/438.
