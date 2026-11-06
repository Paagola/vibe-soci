"""Genera diseno/diagrama_flujo.drawio (3 páginas). Uso: python3 diseno/herramientas/generar_diagrama.py diseno/diagrama_flujo.drawio"""
import html
import sys

OUT = sys.argv[1]

S = {
    "lane": "swimlane;startSize=44;fontStyle=1;fontSize=16;html=1;whiteSpace=wrap;fillColor={c};strokeColor={s};swimlaneFillColor={f};",
    "usuario": "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=12;",
    "proceso": "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;",
    "director": "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=12;",
    "decision": "rhombus;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontSize=11;",
    "externo": "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=12;",
    "fichero": "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;fillColor=#f5f5f5;strokeColor=#666666;fontSize=11;size=0.15;",
    "inicio": "ellipse;whiteSpace=wrap;html=1;fillColor=#333333;fontColor=#ffffff;strokeColor=none;fontStyle=1;",
    "nota": "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#999999;align=left;verticalAlign=top;spacing=10;fontSize=12;",
    "titulo": "text;html=1;fontSize=24;fontStyle=1;align=left;verticalAlign=middle;",
    "subtitulo": "text;html=1;fontSize=13;align=left;verticalAlign=top;whiteSpace=wrap;fontColor=#555555;",
    "capa": "rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=12;fontSize=12;arcSize=4;",
}
EDGE = "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;fontSize=11;labelBackgroundColor=#ffffff;"
EDGE_LEE = EDGE + "dashed=1;strokeColor=#888888;"
EDGE_APRENDE = EDGE + "dashed=1;strokeColor=#9673a6;strokeWidth=2;fontColor=#9673a6;"


class Pagina:
    def __init__(self, ident, nombre, ancho, alto):
        self.ident, self.nombre, self.ancho, self.alto = ident, nombre, ancho, alto
        self.celdas = []
        self.n = 0

    def _id(self):
        self.n += 1
        return f"{self.ident}-{self.n}"

    def nodo(self, x, y, w, h, texto, estilo, ident=None):
        ident = ident or self._id()
        self.celdas.append(
            f'<mxCell id="{ident}" value="{html.escape(texto, quote=True)}" style="{estilo}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        return ident

    def flecha(self, origen, destino, texto="", estilo=EDGE, puntos=None):
        geo = '<mxGeometry relative="1" as="geometry">'
        if puntos:
            geo += '<Array as="points">' + "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in puntos) + "</Array>"
        geo += "</mxGeometry>"
        self.celdas.append(
            f'<mxCell id="{self._id()}" value="{html.escape(texto, quote=True)}" style="{estilo}" edge="1" parent="1" '
            f'source="{origen}" target="{destino}">{geo}</mxCell>'
        )

    def xml(self):
        return (
            f'<diagram id="{self.ident}" name="{html.escape(self.nombre, quote=True)}">'
            f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
            f'fold="1" page="1" pageScale="1" pageWidth="{self.ancho}" pageHeight="{self.alto}" math="0" shadow="0">'
            f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>{"".join(self.celdas)}</root></mxGraphModel></diagram>'
        )


def b(texto):
    return f"<b>{texto}</b>"


# ---------------------------------------------------------------- Página 1 · Flujo
p1 = Pagina("flujo", "1 · Flujo para crear una pieza", 1700, 2500)
p1.nodo(40, 10, 1200, 40, "Estudio de contenido · flujo para crear una pieza (solo en local)", S["titulo"])
p1.nodo(40, 50, 1600, 40,
        "De una idea y una foto real del plato a una pieza creativa, fiel al plato y con la identidad del local. "
        "El sistema no rellena una plantilla: el director creativo recibe lo que ha gustado (biblioteca) y propone conceptos nuevos.",
        S["subtitulo"])

LANES = [  # (titulo, x, ancho, relleno)
    ("Tú (dueño o equipo)", 40, 380, ("#fff2cc", "#d6b656", "#fffdf5")),
    ("Estudio · web y casos de uso", 420, 560, ("#dae8fc", "#6c8ebf", "#f8fbff")),
    ("Servicios externos", 980, 320, ("#d5e8d4", "#82b366", "#f7fbf6")),
    ("Ficheros locales (datos/ y biblioteca/)", 1300, 360, ("#f5f5f5", "#666666", "#fcfcfc")),
]
TOP, ALTO = 100, 2290
for titulo, x, w, (c, s, f) in LANES:
    p1.nodo(x, TOP, w, ALTO, titulo, S["lane"].format(c=c, s=s, f=f))

UX, UW = 70, 320
EX, EW = 470, 460
XX, XW = 1000, 280
FX, FW = 1320, 320

ini = p1.nodo(185, 160, 90, 50, "Inicio", S["inicio"])

# 1 · Alta del local
u1 = p1.nodo(UX, 240, UW, 80, b("1 · Alta del local (una vez)") + "<br>nombre, ciudad, tono, colores en HEX y tipografías", S["usuario"])
e1 = p1.nodo(EX, 240, EW, 80, b("Nuevo local") + "<br>formulario · valida la marca con zod (HEX, 1–5 tonos, máx. 6 colores)", S["proceso"])
f1 = p1.nodo(FX, 240, FW, 80, "datos/locales/&lt;slug&gt;/marca.json", S["fichero"])
p1.flecha(ini, u1)
p1.flecha(u1, e1)
p1.flecha(e1, f1, "guarda")

# 2 · Brief
u2 = p1.nodo(UX, 370, UW, 100, b("2 · Nueva pieza") + "<br>idea (10–300) · formato POST, CARRUSEL (3–5) o HISTORIA (1–3) · tipo · condiciones si es OFERTA o EVENTO", S["usuario"])
u3 = p1.nodo(UX, 500, UW, 110, b("Fotos reales") + "<br>≥ 1 del plato (obligatoria) · opcionales: local, vajilla, personas, más platos<br>" + b("Referencia de estilo") + " opcional (pin): solo inspiración", S["usuario"])
e2 = p1.nodo(EX, 500, EW, 110, b("Nueva pieza") + "<br>sube las fotos, las copia a la pieza y valida el brief con las reglas del dominio (JPG, PNG o WEBP · máx. 10 MB)", S["proceso"])
d1 = p1.nodo(EX + 120, 640, 220, 110, "¿≥ 1 foto de plato, diapositivas en rango y condiciones si OFERTA o EVENTO?", S["decision"])
f2 = p1.nodo(FX, 650, FW, 90, "datos/piezas/&lt;id&gt;/pieza.json<br>datos/piezas/&lt;id&gt;/fotos/", S["fichero"])
p1.flecha(u2, u3)
p1.flecha(u3, e2)
p1.flecha(e2, d1)
p1.flecha(d1, u2, "No: error en el campo", puntos=[(440, 695), (440, 420)])
p1.flecha(d1, f2, "Sí: guarda")

# 3 · Conceptos
e3 = p1.nodo(EX, 800, EW, 130, b("3 · Proponer conceptos · Director creativo") + "<br>trabajo en segundo plano con panel de progreso · mira las fotos y propone 3 conceptos con mecanismos distintos: composición, luz, recurso tipográfico, textos y por qué encaja", S["director"])
x1 = p1.nodo(XX, 815, XW, 80, b("Gemini") + "<br>visión + salida JSON<br>capa gratuita · respaldo si está saturado", S["externo"])
fb = p1.nodo(FX, 790, FW, 130, b("biblioteca/") + "<br>principios.md · lo que ha gustado y lo que no<br>ejemplos/*.md · prompts que funcionaron<br>valoraciones.jsonl · tus votos", S["fichero"])
p1.flecha(d1, e3, "Sí")
p1.flecha(e3, x1, "pide")
p1.flecha(fb, e3, "lee", EDGE_LEE, puntos=[(1300, 915), (940, 915)])
p1.flecha(f1, e3, "lee la marca", EDGE_LEE, puntos=[(1295, 300), (1295, 775), (850, 775)])

d2 = p1.nodo(UX + 50, 950, 220, 110, "¿Te convence alguno?", S["decision"])
p1.flecha(e3, d2, "muestra los 3")
p1.flecha(d2, e3, "No: pide otros 3", puntos=[(UX + 20, 1005), (UX + 20, 880), (EX, 880)])

# 4 · Plan
e4 = p1.nodo(EX, 1090, EW, 110, b("4 · Director escribe el plan") + "<br>por diapositiva: función, textos exactos en español, fotos que usa y prompt en inglés · pie, hashtags y texto alternativo", S["director"])
x2 = p1.nodo(XX, 1105, XW, 80, b("Gemini") + "<br>salida JSON", S["externo"])
p1.flecha(d2, e4, "Sí: elige uno")
p1.flecha(e4, x2, "pide")
d3 = p1.nodo(EX + 120, 1230, 220, 120, "¿Plan válido? (zod + ninguna cifra que no esté en la idea o las condiciones)", S["decision"])
f4 = p1.nodo(FX, 1245, FW, 90, "pieza.json (plan)<br>plan.md · legible, con las fotos en orden", S["fichero"])
p1.flecha(e4, d3)
p1.flecha(d3, e4, "No: reintenta con el error (máx. 2)", puntos=[(955, 1290), (955, 1145)])
p1.flecha(d3, f4, "Sí: guarda")

# 5 · Generar
d4 = p1.nodo(UX + 50, 1380, 220, 110, "¿Cómo generas?", S["decision"])
p1.flecha(d3, d4, "Sí")
um = p1.nodo(UX, 1520, UW, 100, b("A mano") + "<br>en la web de Higgsfield con Nano Banana Pro: copias el prompt de plan.md y adjuntas las fotos en ese orden", S["usuario"])
eimp = p1.nodo(EX, 1530, EW, 80, b("Importar imagen") + "<br>sube la imagen y la registra como una versión más", S["proceso"])
p1.flecha(d4, um, "A mano")
p1.flecha(um, eimp)

e5 = p1.nodo(EX, 1390, EW, 90, b("5 · Generar") + "<br>modal: nº de imágenes, modelo y límite del día; sin confirmar no se envía nada (modo simulado: no gasta)", S["proceso"])
p1.flecha(d4, e5, "Por la API")
e6 = p1.nodo(EX, 1650, EW, 120, "Sube fotos y referencias · envía con Idempotency-Key · guarda el requestId " + b("antes") + " de esperar · consulta el estado · descarga<br>Primero la portada; las demás la llevan como referencia de coherencia", S["proceso"])
x3 = p1.nodo(XX, 1640, XW, 140, b("Higgsfield API") + "<br>POST /files/generate-upload-url + PUT<br>POST /&lt;modelo&gt;<br>GET status_url (2 s × 1,5, máx. 10 s)<br>Modelo intercambiable: marketing-studio/image, ideogram, grok", S["externo"])
f5 = p1.nodo(FX, 1665, FW, 90, "piezas/&lt;id&gt;/generadas/d&lt;n&gt;_v&lt;k&gt;.png<br>+ generación en pieza.json", S["fichero"])
p1.flecha(e5, e6, "confirmas")
p1.flecha(e6, x3)
p1.flecha(e6, f5, "guarda", EDGE, puntos=[(700, 1800), (1295, 1800), (1295, 1735)])
p1.flecha(eimp, f5, "copia", EDGE, puntos=[(1305, 1570), (1305, 1685)])

# 6 · Revisar
u6 = p1.nodo(UX, 1810, UW, 100, b("6 · Revisas") + "<br>texto letra a letra · nada inventado · física · sin cajas detrás del texto · coherencia del carrusel", S["usuario"])
p1.flecha(f5, u6, "abres la imagen", EDGE, puntos=[(FX + 160, 1860)])
d6 = p1.nodo(UX + 50, 1940, 220, 100, "¿Te gusta?", S["decision"])
p1.flecha(u6, d6)
e7 = p1.nodo(EX, 1945, EW, 90, b("Me gusta / No me gusta + motivo") + "<br>también al pedir un cambio · el motivo es lo que aprende el sistema", S["proceso"])
fv = p1.nodo(FX, 1945, FW, 80, "biblioteca/valoraciones.jsonl", S["fichero"])
p1.flecha(d6, e7, "Sí: valora gusta")
p1.flecha(e7, fv, "añade")
p1.flecha(fv, fb, "aprende: el director lo lee la próxima vez", EDGE_APRENDE, puntos=[(FX + FW + 20, 1985), (FX + FW + 20, 855)])

e9 = p1.nodo(EX, 2070, EW, 80, b("7 · Exportar") + "<br>descarga en la web · 1080 × 1350 (post y carrusel) o 1080 × 1920 (historia) + pie.txt", S["proceso"])
f9 = p1.nodo(FX, 2070, FW, 80, "piezas/&lt;id&gt;/exportadas/", S["fichero"])
fin = p1.nodo(UX, 2300, UW, 60, b("Publicas a mano en Instagram"), S["usuario"])
p1.flecha(e7, e9, "todas aprobadas")
p1.flecha(e9, f9)
p1.flecha(e9, fin, "", EDGE, puntos=[(440, 2110), (440, 2330)])

e8 = p1.nodo(EX, 2190, EW, 100, b("Pedir cambio «comentario»") + "<br>el director reescribe el prompt con la imagen fallida como referencia («keep image 1 almost exactly» + cambios numerados) · máx. 3 por diapositiva", S["director"])
p1.flecha(d6, e8, "No: pide un cambio", puntos=[(230, 2240)])
p1.flecha(e8, e6, "nueva versión", EDGE, puntos=[(955, 2240), (955, 1710)])

# Leyenda
ley = ("<b>Leyenda</b><br>"
       "<span style='background:#fff2cc'>&nbsp;amarillo&nbsp;</span> lo haces tú · "
       "<span style='background:#dae8fc'>&nbsp;azul&nbsp;</span> acción de la web · "
       "<span style='background:#e1d5e7'>&nbsp;morado&nbsp;</span> director creativo (IA) · "
       "<span style='background:#d5e8d4'>&nbsp;verde&nbsp;</span> servicio externo · "
       "<span style='background:#ffe6cc'>&nbsp;naranja&nbsp;</span> decisión<br>"
       "Línea discontinua gris: lectura · morada: aprendizaje")
p1.nodo(40, 2410, 900, 60, ley, S["nota"])

# ---------------------------------------------------------------- Página 2 · Reglas creativas
p2 = Pagina("reglas", "2 · Qué decide el director creativo", 1700, 1100)
p2.nodo(40, 10, 1400, 40, "Qué recibe el director creativo y qué reglas no se rompen nunca", S["titulo"])
p2.nodo(40, 50, 1600, 40,
        "El sistema no construye prompts cerrados. Le da al director el material real, la identidad del local y lo que ha gustado; "
        "el director propone. Las reglas fijas de abajo sí se comprueban siempre.",
        S["subtitulo"])

entrada = [
    ("Foto real del plato (obligatoria)", "Es la lista de elementos, no el encuadre: mismos ingredientes, vajilla y mantel, nada añadido. El ángulo y la luz son nuevos."),
    ("Fotos opcionales", "Local, vajilla, personas, más platos. Para fondos compartidos o si el local lo pide."),
    ("Referencia de estilo (pin)", "Solo inspiración de luz, composición y recurso tipográfico. Nunca se publica."),
    ("Marca del local", "Colores en HEX, tipografías y tono. Nada de colores genéricos."),
    ("Idea, tipo y condiciones", "Precios, fechas y límites solo los escribe el dueño: la IA no inventa cifras."),
    ("Biblioteca", "principios.md + ejemplos que gustaron + tus valoraciones recientes."),
]
y = 120
ids = []
for t, d in entrada:
    ids.append(p2.nodo(40, y, 420, 90, b(t) + "<br>" + d, S["usuario"]))
    y += 105
dc = p2.nodo(560, 330, 360, 200,
             b("Director creativo") + "<br><br>1. Propone 3 conceptos con mecanismos distintos<br>2. Escribe el plan del concepto elegido<br>3. Reescribe un prompt cuando pides un cambio",
             S["director"])
for i in ids:
    p2.flecha(i, dc)

sal = p2.nodo(1020, 330, 380, 200,
              b("Estructura que ha funcionado") + " (guía, no plantilla)<br><br>Cabecera: qué pieza, para quién, formato, «one single finished image»<br>PHOTO: nueva toma profesional, cámara, luz, foco y textura<br>CREATIVE TYPOGRAPHY: textos entre comillas y qué hacen con el plato<br>RULES: los negativos",
              S["capa"] + "fillColor=#f8fbff;strokeColor=#6c8ebf;")
p2.flecha(dc, sal, "prompt en inglés, textos en español")

reglas = ("<b>Reglas fijas (el código las comprueba o el prompt las lleva siempre)</b><br>"
          "• Foto y texto en una sola generación<br>"
          "• Sin cajas, paneles, bandas, pegatinas ni formas detrás del texto<br>"
          "• Sin números de diapositiva, puntos, iconos ni interfaz de Instagram<br>"
          "• Ninguna cifra o fecha que no esté en la idea o en las condiciones (validación del plan)<br>"
          "• Cada texto una vez, en español de España exacto, con tildes<br>"
          "• Máx. 3 cambios por diapositiva y límite de imágenes al día (coste)<br>"
          "• Confirmación antes de gastar; un trabajo enviado nunca se reenvía a ciegas (Idempotency-Key + requestId guardado)")
p2.nodo(560, 600, 840, 190, reglas, S["nota"])

mec = ("<b>Mecanismos que han gustado</b> (inspiran, no se repiten)<br>"
       "• Palabra enorme detrás del plato, tapada por él (FUEGO, «negro»)<br>"
       "• Letras que se enroscan en el borde del plato, por delante y por detrás («Esta noche»)<br>"
       "• Un elemento del plato firma el texto (la antena de la gamba escribe «Palamós»)<br>"
       "• El texto se transforma con el concepto: burbujas («Salud»), letras aplastadas y goteando («NO VENGAS A DIETA»), rascacielos, órbita<br><br>"
       "<b>Lo que no ha gustado</b><br>"
       "• La misma foto con más calidad y el mismo ángulo: cero creatividad")
p2.nodo(40, 790, 1360, 170, mec, S["nota"])

# ---------------------------------------------------------------- Página 3 · Arquitectura
p3 = Pagina("arquitectura", "3 · Arquitectura del MVP", 1700, 1200)
p3.nodo(40, 10, 1400, 40, "Arquitectura del MVP: capas y puertos", S["titulo"])
p3.nodo(40, 50, 1600, 40,
        "Las dependencias apuntan hacia dentro. El dominio y los casos de uso no saben si detrás hay Gemini, Higgsfield o un simulador; "
        "contenedor.ts elige los adaptadores según la configuración (.env).",
        S["subtitulo"])

web = p3.nodo(40, 120, 900, 110,
              b("src/web · entrada") + "<br>Express en 127.0.0.1 · rutas/ (API JSON y archivos) · trabajos.ts (segundo plano + progreso) · estimacion.ts (quedan X s)<br>"
              "publico/: frontend sin build · nuevo local · nueva pieza · conceptos · plan · generar · pedir cambio · votar · importar · exportar",
              S["capa"] + "fillColor=#fff2cc;strokeColor=#d6b656;")
app = p3.nodo(40, 270, 900, 130,
              b("src/aplicacion · casos de uso") + " (uno por archivo, reciben sus dependencias)<br>"
              "crearLocal · crearPieza · proponerConceptos · planificarPieza · generarDiapositivas · importarImagen · corregirDiapositiva · valorarDiapositiva · exportarPieza<br>"
              "contextoCreativo.ts junta marca + pieza + fotos + biblioteca",
              S["capa"] + "fillColor=#dae8fc;strokeColor=#6c8ebf;")
dom = p3.nodo(40, 440, 420, 150,
              b("src/dominio") + "<br>modelos.ts: esquemas zod y tipos (Marca, Pieza, Concepto, Plan, Generacion, Valoracion)<br>"
              "reglas.ts: brief válido, cifras no autorizadas, límite de cambios, nombres de archivo<br>errores.ts",
              S["capa"] + "fillColor=#ffffff;strokeColor=#333333;strokeWidth=2;")
pue = p3.nodo(520, 440, 420, 150,
              b("src/puertos · interfaces") + "<br>DirectorCreativo · GeneradorImagen · AlmacenPiezas · AlmacenLocales · BibliotecaCreativa · ProcesadorImagen",
              S["capa"] + "fillColor=#ffffff;strokeColor=#333333;dashed=1;")
p3.flecha(web, app, "llama")
p3.flecha(app, dom, "usa")
p3.flecha(app, pue, "depende de")
p3.flecha(pue, dom, "usa tipos")

ad = [
    ("adaptadores/gemini", "DirectorGemini · ClienteGemini (REST, JSON validado con zod, modelo de respaldo si el principal está saturado) · instrucciones.ts", "#e1d5e7", "#9673a6"),
    ("adaptadores/higgsfield", "GeneradorHiggsfield · ClienteHiggsfield (subida, envío, sondeo) · modelos.ts: una estrategia por modelo", "#d5e8d4", "#82b366"),
    ("adaptadores/simulado", "DirectorSimulado · GeneradorSimulado: flujo completo sin claves ni gasto (pruebas e interruptor «Modo simulado»)", "#f5f5f5", "#666666"),
    ("adaptadores/ficheros", "AlmacenPiezasFicheros · AlmacenLocalesFicheros · BibliotecaFicheros (JSON y Markdown)", "#f5f5f5", "#666666"),
    ("adaptadores/imagen", "ProcesadorSharp: reduce para la visión, exporta 1080 px, crea marcadores simulados", "#f5f5f5", "#666666"),
]
y = 640
for t, d, c, s in ad:
    n = p3.nodo(520, y, 420, 80, b(t) + "<br>" + d, S["capa"] + f"fillColor={c};strokeColor={s};")
    p3.flecha(n, pue, "implementa", EDGE + "dashed=1;endArrow=block;endFill=0;", puntos=[(980, y + 40), (980, 515)])
    y += 95
p3.nodo(40, 640, 420, 110,
        b("src/contenedor.ts · raíz de composición") + "<br>Lee la config y crea los adaptadores. En modo simulado usa los simulados. Es el único sitio que conoce las clases concretas.",
        S["capa"] + "fillColor=#fff;strokeColor=#d79b00;")
p3.nodo(40, 780, 420, 90,
        b("src/config.ts") + "<br>.env validado con zod: GEMINI_API_KEY, GEMINI_MODELO (+ _RESPALDO), HF_KEY, HF_MODELO, HF_RESOLUCION, LIMITE_IMAGENES_DIA",
        S["capa"] + "fillColor=#fff;strokeColor=#d79b00;")

eq = ("<b>Equivalencia con la app SOCIETY</b> (diagrama_pantallas_detalle.drawio)<br>"
      "• Nueva pieza ↔ S06 Idea + S07 Estética + S08 Fotos (mismo brief: formato, idea, tipo, condiciones, referencia, fotos)<br>"
      "• Proponer conceptos + elegir (plan) ↔ trabajo PLAN_PIEZA (Gemini, JSON, sin cifras inventadas)<br>"
      "• Generar ↔ trabajo IMAGEN_DIAPOSITIVA (enviar · esperar · guardar)<br>"
      "• Pedir cambio ↔ S09 regenerar(posicion, comentario), máx. 3<br>"
      "• Panel «quedan unos X s» ↔ S09 tiempo restante (D-19)<br>"
      "• Exportar ↔ sharp 1080 × 1350 / 1080 × 1920<br>"
      "• Nuevo aquí: elegir entre 3 conceptos y la biblioteca que aprende de tus votos (candidato para la app)<br>"
      "Mismo stack que Society-TypeScript (Node 24, TypeScript estricto, ESM, zod): los casos de uso se pueden llevar al worker.")
p3.nodo(1020, 120, 620, 260, eq, S["nota"])

doc = f'<mxfile host="app.diagrams.net" type="device">{p1.xml()}{p2.xml()}{p3.xml()}</mxfile>'
open(OUT, "w", encoding="utf-8").write(doc)
print("ok", OUT)
