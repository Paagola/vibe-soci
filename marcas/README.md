# Marcas

Una carpeta por restaurante: `marcas/<slug>/`.

- **`perfil.json`** (`marca/perfil@2`, esquema en `src/dominio/marca/perfil.ts`). Contiene:
  - **constantes:** lo que hace reconocible al local;
  - **variables:** lo que puede cambiar según la pieza, como márgenes y no como plantilla;
  - **restricciones;**
  - **material real disponible;**
  - **pendientes:** lo que haría falta y no consta.

  Cada dato dice su fuente (DOCUMENTO, PROPIETARIO, FOTO o ESTUDIO), su referencia y si está confirmado. Lo que propone el estudio queda sin confirmar hasta que el dueño lo vea.
- **`tokens.json`:** colores y estilos tipográficos que usa el compositor (los `@token` de las intenciones).

De dónde sale hoy cada campo: `perfilDesdeMarca` saca del `datos/locales/<slug>/marca.json` (la web) el nombre, la ciudad, la descripción, los tonos, los colores, la descripción de las fuentes, Instagram y la web. Todo lo demás (logotipo, licencias, preferencias, grado de experimentación, recursos, datos de reserva) se pide al dueño poco a poco y, mientras, se queda en `pendientes`.

Las preferencias del dueño no se escriben aquí a mano. Salen de las observaciones (`conocimiento/observaciones/`, `src/dominio/aprendizaje.ts`).

- `asador-etxebarri/`: perfil y tokens (F1.5).
- `dak-burger/tokens.json`: copia de los tokens de la F1 (`diseno/f1/marcas/dak-burger.json`, que no se toca). El perfil completo de DAK queda pendiente.
