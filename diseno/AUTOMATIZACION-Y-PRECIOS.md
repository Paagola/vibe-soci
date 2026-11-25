# Automatización total y precios (pendiente)

Decidido el 24/11/2026 y aparcado para otro día. Objetivo: un sistema que funcione **solo, con agentes**. El cliente
hace 3 o 4 clics y tiene su contenido listo; el dueño del estudio no interviene. Por eso los precios no incluyen tiempo
humano: salen del coste de la IA, la infraestructura y el margen.

## 1. Modo ahorro (primero: hace posibles los precios)

**Dónde se va el gasto hoy.** Carrusel de 5 de Torre de Vega con Argon (23/11), medido: 50 llamadas de texto (433 mil
tokens de entrada y 32 mil de salida) y 7 fotos de Nano Banana Pro.

- Unas 14 llamadas deciden la pieza: referencias, concepto, plan y la revisión de cada foto.
- Unas 36 son el bucle de maquetación: crítica, parche, comparación, reparación y segunda pasada, unas 9 por lámina,
  cada una con 3 o 4 imágenes.
- Lo que dejó las láminas bien salió de los arreglos del código, no de ese bucle: titular en el aire real de la foto,
  titular aparte, foto a sangre y producto mínimo.

**Cambios previstos:**

| Cambio | Ahorro estimado | Riesgo para el resultado |
|---|---|---|
| Arreglos del código **antes** que la reparación del modelo | 2–4 llamadas por lámina | Ninguno: son los retoques que gustaron |
| Una sola pasada de crítica, sin comparación si no hay parche | 3–4 llamadas por lámina | Verificar con la prueba a ciegas |
| Acabado de Nano Banana 2 solo en «máximo» | 3 llamadas y 0,07 USD por pieza | Bajo: perdió a ciegas en las 3 últimas pruebas |
| Respuesta con esquema JSON obligatorio (`responseSchema`) | Los reintentos por JSON roto (1–2 por plan) | Ninguno |
| Reutilizar la búsqueda de Pinterest y el análisis de la referencia del local durante el mes | 1–2 llamadas grandes por pieza | Ninguno |
| API por lotes de Gemini para el contenido de suscripción (no para el chat en vivo) | Suele ser −50 % (confirmar con estos modelos) | Ninguno; tarda más |
| Imágenes más pequeñas al crítico y al revisor (640 px en vez de 900) | Tokens de entrada | Verificar |

**Objetivo:** que el carrusel baje de ~3,4 USD (Argon con precio de diciembre) a ~1,8 USD, y a ~1 USD con lotes. Un
post, a ~0,5 USD. Son estimaciones: hay que medirlas.

**Cómo comprobar que el resultado no empeora.** Recomponer el carrusel de la entrega (conversación
`2026-11-23-62773130`, láminas en `datos/pruebas/torre-de-vega-chuleton/entrega/`) en modo ahorro y con las mismas
fotos (unos 0,3 USD). Compararlo a ciegas con el comparador y después a ojo. Un recorte que empeore alguna lámina no se
aplica.

## 2. Flujo de 4 clics

Hoy son cinco decisiones: subir la foto, confirmar la ficha, elegir la estética, elegir el concepto y aprobar el plan.
Quedaría así:

1. **Subir la foto y decir qué quieres.**
2. **Confirmar la ficha del plato.** Se queda: es la garantía de que los textos no inventan datos.
3. **Elegir uno de los tres conceptos.** Cada concepto trae ya su estética (el director elige la referencia) y su coste
   en créditos. Elegirlo equivale a aprobar: desaparece la tarjeta del plan, que pasa a ser informativa.
4. **Descargar o programar.**

## 3. Varios clientes, sin el dueño

- **Cuentas y datos por local, aislados.** Hoy hay una sola carpeta `datos/` y un solo usuario.
- **Créditos y tope de gasto por cliente.** Hoy hay un único tope global: `GEMINI_TOPE_USD` en `.env`.
- **Cobro** (por ejemplo, Stripe), con renovación mensual de créditos.
- **Alta del local en autoservicio.** El formulario «Dar de alta un local» ya existe en el catálogo de herramientas;
  falta integrarlo en el registro.
- **Fallos sin intervención.** Reintento automático; si sigue fallando, se devuelve el crédito y llega un aviso al
  dueño.
- **Entrega.** Un zip para descargar y, opcionalmente, programación en Instagram.
- **Aviso de IA.** El cliente aprueba cada foto generada antes de publicarla. Hoy el sistema guarda las fotos
  generadas como «solo prueba de composición».

## 4. Precios

### Coste medido por carrusel de 5 (23/11)

| Director | Texto | Imágenes | Total |
|---|---|---|---|
| Hydrogen | 1,52 USD | 0,99 USD | 2,52 USD |
| Argon (hasta el 30/11: 2/10 USD por millón de tokens) | 1,19 USD | 0,99 USD | 2,18 USD |
| Argon (desde el 1/12: 4/20), calculado | 2,38 USD | 0,99 USD | 3,37 USD |
| GPT‑6.2 Astra (8/40 USD por millón, según fuentes secundarias; confirmar), calculado | 4,75–8,1 USD | 0,99 USD | 5,7–9,1 USD |

Astra no está integrado: el chat solo habla con Gemini. Haría falta un adaptador de OpenAI con visión.

### Planes propuestos (sin tiempo humano; requieren el modo ahorro)

Coste por pieza en modo ahorro, con un 30 % de colchón para repeticiones y cambios: post ~0,65 USD; carrusel ~2,35 USD;
campaña (1 carrusel + 3 posts con su concepto) ~4,3 USD. Conversión: 1 USD ≈ 0,92 €.

| | Inicio | Local | Grupo |
|---|---|---|---|
| Precio (sin IVA) | 29 €/mes | 59 €/mes | 119 €/mes |
| Contenido | 8 posts + 2 carruseles | 14 posts + 4 carruseles + 1 campaña | 30 posts + 8 carruseles + 2 campañas |
| Coste de IA | ~9 € | ~21 € | ~43 € |
| Margen bruto (descontado el cobro por tarjeta) | ~65 % | ~62 % | ~62 % |

**Extras:** post 2 €, carrusel 6 €, campaña 12 €. Sin modo ahorro, el plan Local bajaría a ~40 % de margen.

## Orden para retomarlo

1. Modo ahorro y su prueba a ciegas.
2. Flujo de 4 clics.
3. Créditos y tope por cliente.
4. Cuentas y alta en autoservicio.
5. Cobro.
6. Entrega y programación.
