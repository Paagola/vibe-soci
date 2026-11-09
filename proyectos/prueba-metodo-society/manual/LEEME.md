# Paquete para generar S1, S2 y S3 a mano en la app de Gemini

Preparado el 07/11/2026. Lo hago así porque tu clave de la API no admite Nano Banana Pro en el tier gratuito.
- **La llamada de prueba** a `gemini-3-pro-image` devolvió **HTTP 429** («You exceeded your current quota, please check your plan and billing details»). No se reintentó.
- **Ningún modelo de imagen de Gemini tiene tier gratuito en la API**, según la página oficial de precios.

## Orden (puedes repartirlo en varios días)

| Día | Carpeta | Qué es | Imágenes que adjuntas |
|---|---|---|---|
| 1 | `S1/` | El método completo, con brief JSON | 3 |
| 2 | `S2/` | Igual, sin la referencia de encuadre | 2 |
| 3 | `S3/` | Igual que S1, con el párrafo en lugar del JSON | 3 |

**Empieza por S1.** Si al final las diferencias no están claras, me quedo con S1.

En cada carpeta:
- **las imágenes,** numeradas en el orden de adjunto;
- **`prompt.txt`,** para pegar tal cual;
- **`LEEME.md`,** con el rol de cada imagen.

## Qué necesito que me digas al subir cada imagen

1. El archivo, con su nombre: `S1-intento-1.png`. Súbelas **todas**, también las que no te gusten.
2. El modelo que mostraba la app.
3. El día en que la generaste.
4. Si salió en vertical o no, y si lleva marca de agua visible.

Con eso la importo con su procedencia: vía manual, prompt exacto, huella de cada referencia y coste de API 0.

```bash
npx tsx src/herramientas/importarManual.ts --receta proyectos/prueba-metodo-society/recetas/s1.json \
  --imagen <archivo> --intento 1 --modelo "<lo que mostraba la app>" --fecha <día>
```

## En qué se diferencia de hacerlo por la API (lo apunto en la procedencia)

- **Las etiquetas:** en la API cada imagen va precedida de su etiqueta (`@image1:`). En la app, el orden de adjunto hace de etiqueta y el prompt lo dice en la cabecera.
- **El tamaño y la proporción:** en la app no se pueden fijar como parámetro (2K, 3:4). Se piden en el texto, y puede que salgan otros.
- **La marca de agua y el modelo:** puede que la app añada una marca de agua visible. Tampoco puedo comprobar qué modelo usó de verdad; anoto el que tú me digas.

**Medidas del prompt:** el plato de unos 26 cm y las gambas de unos 18 cm son **estimaciones** hechas a partir de la foto. No las ha confirmado el restaurante y no son datos para nada que se publique.
