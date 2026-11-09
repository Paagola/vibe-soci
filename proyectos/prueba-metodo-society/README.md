# Prueba del método Society (DirectorIA) con la gamba de Etxebarri

Informe: [`diseno/f1_6/METODO-SOCIETY.md`](../../diseno/f1_6/METODO-SOCIETY.md). Preparado el 07/11/2026. **S1–S3 generadas el 07/11 por el MCP de Higgsfield** (6 créditos; pedido Nano Banana Pro, servido `nano_banana_2`). Resultados en el informe. La API de Gemini no admite Nano Banana Pro sin facturación (HTTP 429); el paquete de `manual/` queda por si se repiten en la app de Gemini.

| Carpeta | Qué hay |
|---|---|
| `decodificado/` | post-11 y post-20 descompuestos a mano con el formato de Society: la **foto** campo a campo (cámara, luz con fuente, entorno con distancias, composición, imperfecciones, paleta), la medición de luz, qué se toma y qué no se copia |
| `refs/` | `ficha-texturas-gamba.jpg`: 9 recortes al 100 % de la foto real, sin rótulos ni mantel. `post-11-sin-texto.jpg`: la referencia sin sus textos, para usarla solo como cámara, encuadre y luz |
| `prompts/` | `mcp/`: el texto exacto que se envió por el MCP. `s1.json.txt`: brief JSON con las tres referencias y sus roles. `s2.json.txt`: igual, sin la referencia de encuadre. `s1.nl.txt`: el párrafo en lenguaje natural que incorpora cada campo |
| `recetas/` | S1, S2 y S3 (las usan la API, el paquete manual y la importación) |
| `director/` | Ensayo sin gasto: el prompt de foto nueva que escribe el director solo con la foto y la biblioteca (`src/herramientas/ensayoDirectorFoto.ts`) |
| `manual/` | Paquete para la app de Gemini: imágenes numeradas en orden de adjunto, `prompt.txt`, rol de cada imagen y manifiesto con huellas |

Contar tokens y estimar (gratis):

```bash
npx tsx --env-file=.env src/herramientas/generarGeminiImagen.ts proyectos/prueba-metodo-society/recetas/s1.json --solo-contar
```

Generar, solo con autorización (tope por defecto: 1 USD acumulado en `datos/gasto/gemini.jsonl`):

```bash
npx tsx --env-file=.env src/herramientas/generarGeminiImagen.ts proyectos/prueba-metodo-society/recetas/s1.json --tope 1
```
