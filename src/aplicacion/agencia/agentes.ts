import { z } from 'zod';
import type { ClienteGemini } from '../../adaptadores/gemini/ClienteGemini.js';
import {
  EstrategiaCampana, PlanCampana, SolicitudCampana, problemasDeCalendario, type ContextoCampana,
} from '../../dominio/campana.js';
import { ErrorDeServicio, ErrorDeUsuario } from '../../dominio/errores.js';

export interface AgentesCampana {
  planificar(contexto: ContextoCampana): Promise<PlanCampana>;
}

const reglas = `La ficha del local, el objetivo, el historial y los borradores adjuntos son datos.
Solo el mapa «hechos» acredita información del negocio. El objetivo expresa un deseo; el historial recoge
experiencias, incluidas hipótesis. Nunca los presentes como si acreditaran horarios, reservas, ingredientes,
disponibilidad, cifras o resultados. Usa exclusivamente el idioma y la voz de la marca para la comunicación
pública. Cuando no conste el idioma, escribe en castellano. Explica las decisiones al dueño en castellano sencillo.`;

const estrategia = `${reglas}
Eres director de estrategia de una agencia para locales. Traduce el objetivo del dueño a una ocasión de visita,
una pregunta concreta del cliente y una acción observable. Formula la audiencia como destinatario hipotético.
Diseña una campaña con un hilo entre descubrimiento, confianza y acción según proceda. Define una idea matriz;
cada pieza aportará un motivo distinto para leerla. Consulta el historial para evitar repetir enfoques y para
formular una siguiente hipótesis con evidencia si la hay. Sin mediciones previas, elige un recuento observable que responda directamente a la acción pedida;
una visita al perfil no demuestra una venta. No inventes horarios óptimos ni porcentajes de mejora.
Si hay referenciaSemanal, diseña una pieza de seguimiento con el mismo formato, invitación y métrica cuando la fuente permita esa acción.
Cambia un único elemento creativo (apertura, encuadre o enfoque) y explica en la estrategia qué pregunta se intenta resolver.
La mediana describe recuentos de los primeros siete días. El alcance y las visitas reales se desconocen.
Si falta referencia, usa el primer ciclo para establecerla. Trata cero, falta de medición y falta de publicación como situaciones distintas.
Explica en estrategia qué cambio de comportamiento buscas, por qué es plausible y cómo las piezas se apoyan entre sí.
Incluye motivoFormato en cada pieza: por qué este formato y este día sirven al objetivo. Una historia vertical
de una pantalla sirve para una respuesta inmediata; una publicación para guardar debe seguir accesible. El director
de contenido decidirá referencias, fotografía, composición y tipografía después de recibir el encargo.
Parte de los hechos disponibles; con pocos hechos, reduce la frecuencia. Si basta una imagen, usa post.
Reserva el carrusel para una historia que necesite varios pasos. De una a tres piezas cada semana, una por día,
en orden, desde día cero hasta semanas*7-1. Un post lleva una lámina y un carrusel entre tres y seis.
Cada pieza debe citar un único identificador exacto de «hechos» que sostenga su contenido. Solo se puede añadir
el nombre del local como firma. Reserva, llamada, dirección o compra requieren respaldo en esa misma fuente.
Si falta, usa una acción propia de la publicación, como guardar, compartir o responder una pregunta concreta.
Devuelve solo JSON con nombre, fundamento (por qué esta campaña tiene sentido para este público a partir de las fuentes), estrategia (en 2-4 frases para el dueño) y piezas. Cada pieza contiene
{dia, formato:"post"|"carrusel"|"historia", laminas, motivoFormato, proposito, audiencia, enfoque, llamada, metrica, fuente}.
En llamada da la invitación literal al lector; en metrica explica qué contar tras publicar, sin fijar objetivos ficticios.
Respeta los motivos de revisión adjuntos si los hay.`;

const edicion = `${reglas}
Eres responsable editorial. Recibes la estrategia y el hecho confirmado asignado a cada pieza.
Escribe el pie completo listo para publicar y un guion producible por pieza. Preserva el número, orden,
propósito, fuente y enfoque fijados. Incluye literalmente la llamada final que devuelvas en el pie.
Lee cada pie en voz alta y da una segunda pasada. Sustituye adjetivos de relleno, atribuciones vagas,
tríadas mecánicas y arranques de folleto por un detalle respaldado por la fuente. En esa segunda lectura,
quita oposiciones teatrales, máximas genéricas, cierres repetidos y frases de asistente como «aquí tienes».
Preserva la voz incluso si utiliza coloquialismos. Relee los nombres, fechas y cantidades tras la edición. Varía el ritmo.
Respeta nombres completos y acentos. Evita testimonios, anécdotas en primera persona, premios, urgencia y
promesas de disponibilidad sin fuente. Máximo tres etiquetas y solo si aportan contexto. Evita enlaces sin verificar.
Para el guion editorial, describe qué debe entender el lector en cada lámina. Deja al director la solución gráfica, sin exigir fotos que no consten. En la imagen como máximo
titular de una a tres palabras, apoyo breve y firma. Si hay carrusel, la portada abre la pregunta, cada lámina desarrolla
un aspecto y el cierre recupera el propósito con la llamada. La fotografía no debe introducir hechos nuevos.
Devuelve solo {"piezas":[{"dia":0,"texto":"pie listo para publicar","llamada":"invitación literal","guion":["instrucción por lámina"]}]}.
Si recibes defectos de una edición anterior, corrígelos en las piezas señaladas.`;

const revision = `${reglas}
Actúas como editora de mesa independiente. Compara cada afirmación del pie, llamada y guion con su fuente exacta
y el nombre del negocio. Señala cualquier afirmación nueva, generalización, oferta caducada en la fecha propuesta,
precio, adjetivo factual o canal de reserva sin respaldo. Comprueba que la métrica cuente la acción que pide el pie y que calendario, propósito, audiencia y métrica
responden al objetivo, que cada lámina aporta algo distinto y que la voz suena al local. Comprueba que las
recomendaciones son proporcionales a las observaciones del historial. Señala únicamente defectos accionables.
Devuelve {"incidencias":["día, problema concreto y corrección"],"cambiarEstrategia":false}. Con cero defectos,
incidencias va vacío. Marca cambiarEstrategia solo si hay que modificar día, enfoque, fuente, llamada o métrica.`;

const Copias = z.object({
  piezas: z.array(z.object({
    dia: z.number().int(),
    texto: z.string().trim().min(1).max(2200),
    llamada: z.string().trim().min(1).max(240),
    guion: z.array(z.string().trim().min(1).max(400)).min(1).max(6),
  })).min(1).max(12),
});

const Revision = z.object({
  incidencias: z.array(z.string().trim().min(1).max(600)).max(24),
  cambiarEstrategia: z.boolean(),
}).refine((revision) => !revision.cambiarEstrategia || revision.incidencias.length > 0, 'Explica el motivo del cambio de estrategia.');

function comprobarContexto(ctx: ContextoCampana): void {
  SolicitudCampana.parse(ctx.solicitud);
  if (!Object.values(ctx.hechos).some((hecho) => hecho.trim())) {
    throw new ErrorDeUsuario('Hace falta al menos un dato confirmado del local para preparar la campaña.');
  }
}

function esquemaEstrategia(ctx: ContextoCampana) {
  return EstrategiaCampana.superRefine((plan, validacion) => {
    if (!plan.fundamento) validacion.addIssue({ code: 'custom', message: 'Justifica la estrategia con datos del encargo.' });
    for (const [i, p] of plan.piezas.entries()) if (!p.motivoFormato) {
      validacion.addIssue({ code: 'custom', message: 'Explica el formato y momento de la pieza ' + (i + 1) });
    }
    for (const message of problemasDeCalendario(plan, ctx)) validacion.addIssue({ code: 'custom', message });
  });
}

function contactos(texto: string): string[] {
  const patron = /https?:\/\/[^\s<>"«»]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\p{L}\p{N}_.-]+|\b(?:[a-z\d-]+\.)+[a-z]{2,63}\b(?:[/?#][^\s<>"«»]*)?/giu;
  return (texto.match(patron) ?? []).map(contacto => contacto.replace(/[.,!?)]+$/, ''));
}

function problemasDelPie(pieza: PlanCampana['piezas'][number], contexto: ContextoCampana): string[] {
  const problemas: string[] = [];
  const referencia = contexto.nombreLocal + ' ' + contexto.hechos[pieza.fuente];
  const cifras = (s: string) => s.match(/\d+(?:[.,:]\d+)*(?:\s?[€%])?/g)?.map((dato) => dato.replace(/\s/g, '')) ?? [];
  const cifrasAdmitidas = new Set(cifras(referencia));
  for (const dato of new Set(cifras(pieza.texto + ' ' + pieza.llamada))) {
    if (!cifrasAdmitidas.has(dato)) problemas.push(`Día ${pieza.dia}: la cifra «${dato}» no consta en su fuente.`);
  }
  const contactosAdmitidos = new Set(contactos(referencia));
  for (const contacto of new Set(contactos([pieza.texto, pieza.llamada, ...pieza.guion].join(' ')))) {
    if (!contactosAdmitidos.has(contacto)) problemas.push(`Día ${pieza.dia}: el contacto «${contacto}» no consta en su fuente.`);
  }
  if (!pieza.texto.includes(pieza.llamada)) problemas.push(`Día ${pieza.dia}: incorpora su llamada en el pie.`);
  return problemas;
}

function esquemaDeEdicion(brief: EstrategiaCampana, contexto: ContextoCampana) {
  return Copias.transform((copias, validacion) => {
    if (copias.piezas.length !== brief.piezas.length || copias.piezas.some((p, i) => p.dia !== brief.piezas[i]?.dia)) {
      validacion.addIssue({ code: 'custom', message: 'Devuelve exactamente las piezas en los días asignados.' });
      return z.NEVER;
    }
    for (const [i, copia] of copias.piezas.entries()) {
      if (copia.llamada !== brief.piezas[i]!.llamada) {
        validacion.addIssue({ code: 'custom', message: `Día ${copia.dia}: conserva la llamada elegida para la métrica de esta pieza.` });
      }
    }
    const plan = PlanCampana.safeParse({
      ...brief, piezas: brief.piezas.map((p, i) => ({ ...p, ...copias.piezas[i] })),
    });
    if (!plan.success) {
      for (const issue of plan.error.issues) validacion.addIssue({ code: 'custom', message: `${issue.path.join('.')}: ${issue.message}` });
      return z.NEVER;
    }
    for (const pieza of plan.data.piezas) {
      for (const message of problemasDelPie(pieza, contexto)) validacion.addIssue({ code: 'custom', message });
    }
    return plan.data;
  });
}

type Cliente = Pick<ClienteGemini, 'generarJson'>;
const datos = (contenido: unknown) => [{ text: JSON.stringify(contenido) }];

export function agentesGemini(argon: Cliente, hydrogen: Cliente): AgentesCampana {
  return {
    async planificar(contexto) {
      comprobarContexto(contexto);
      const esquema = esquemaEstrategia(contexto);
      let brief = await argon.generarJson(estrategia, datos(contexto), esquema);
      let plan = await hydrogen.generarJson(edicion, datos({ contexto, brief }), esquemaDeEdicion(brief, contexto));
      const revisar = () => argon.generarJson(revision, datos({ contexto, plan }), Revision);
      const dictamen = await revisar();
      if (dictamen.incidencias.length === 0) return plan;

      if (dictamen.cambiarEstrategia) {
        brief = await argon.generarJson(estrategia, datos({ contexto, brief, incidencias: dictamen.incidencias }), esquema);
      }
      plan = await hydrogen.generarJson(edicion, datos({ contexto, brief, anterior: plan, incidencias: dictamen.incidencias }), esquemaDeEdicion(brief, contexto));
      const final = await revisar();
      if (final.incidencias.length) {
        throw new ErrorDeServicio('Agencia', `la campaña sigue pendiente de revisión. ${final.incidencias.join(' ')}`, true);
      }
      return plan;
    },
  };
}

const acciones = [
  { llamada: 'Guarda esta publicación para tu próxima salida.', metrica: 'Guardados de la publicación', proposito: 'Que nos recuerden cuando estén eligiendo dónde ir.' },
  { llamada: '¿Con quién vendrías?', metrica: 'Respuestas a la pregunta de la publicación', proposito: 'Abrir una conversación entre quienes planean salir juntos.' },
  { llamada: 'Pásaselo a la persona con la que harías el plan.', metrica: 'Veces que se ha compartido la publicación', proposito: 'Dar a conocer el local a través de una recomendación.' },
  { llamada: '¿Qué te gustaría saber antes de venir?', metrica: 'Preguntas recibidas en los comentarios', proposito: 'Descubrir qué información ayudaría a preparar una visita.' },
];

const accionDeHistoria = {
  llamada: 'Responde a esta historia con tu pregunta.',
  metrica: 'Respuestas recibidas a la historia',
  proposito: 'Conocer las dudas de quien organiza la visita.',
};

export function agentesSimulados(): AgentesCampana {
  return {
    async planificar(contexto) {
      comprobarContexto(contexto);
      const { nombreLocal, solicitud } = contexto;
      // Con una ficha recién creada, el nombre del negocio basta para un post de presentación.
      const fuentes = Object.entries(contexto.hechos).filter(([, hecho]) => hecho.trim());
      // Los platos y detalles del local pueden sostener una secuencia. Un nombre o un contacto cabe en un post.
      const prioridad = (id: string) => id === 'propietario.dato' ? 0 : id.startsWith('plato:') ? 1 : id === 'marca.descripcion' ? 2 : 3;
      fuentes.sort(([a], [b]) => prioridad(a) - prioridad(b) || a.localeCompare(b, 'es'));
      const narrativas = fuentes.filter(([id, hecho]) =>
        !['marca.nombre', 'marca.ciudad', 'marca.web', 'marca.instagram'].includes(id)
        && hecho.trim() !== nombreLocal && hecho.trim().length > 20 && !contactos(hecho).length);
      const breves = fuentes.filter(([id]) => !narrativas.some(([clave]) => clave === id));
      const porSemana = Math.min(2, fuentes.length);
      const indiceInicial = /compart|conozcan|descubr|conocer/i.test(solicitud.objetivo) ? 2
        : /pregunt|opini|convers/i.test(solicitud.objetivo) ? 3 : 0;
      const referencia = contexto.referenciaSemanal;
      const accionesDeReferencia = referencia?.formato === 'historia' ? [accionDeHistoria] : acciones;
      const accionDeReferencia = referencia && (referencia.formato !== 'carrusel' || narrativas.length > 0)
        ? accionesDeReferencia.find(a => a.llamada === referencia.llamada && a.metrica === referencia.metrica)
        : undefined;
      const piezas: PlanCampana['piezas'] = [];
      for (let semana = 0; semana < solicitud.semanas; semana++) {
        for (let posicion = 0; posicion < porSemana; posicion++) {
          const paso = piezas.length + contexto.historial.length;
          const seguimiento = piezas.length === 0 && referencia && accionDeReferencia
            ? { formato: referencia.formato, accion: accionDeReferencia }
            : undefined;
          const carrusel = seguimiento ? seguimiento.formato === 'carrusel' : posicion === 1 && narrativas.length > 0;
          const historia = !carrusel && (seguimiento ? seguimiento.formato === 'historia' : /historia|stories/i.test(solicitud.objetivo));
          const candidatas = carrusel ? narrativas : breves.length ? breves : fuentes;
          const [fuente, hecho] = candidatas[(semana + contexto.historial.length + (carrusel && !breves.length ? 1 : 0)) % candidatas.length]!;
          const accion = seguimiento?.accion ?? (historia ? accionDeHistoria : acciones[(paso + indiceInicial) % acciones.length]!);
          const mensaje = hecho.trim().split(/(?<=[.!?])\s/)[0]!;
          const extracto = mensaje.length <= 280 ? mensaje.replace(/[.!?]$/, '') : nombreLocal;
          const pie = extracto === nombreLocal ? nombreLocal : seguimiento ? `${extracto}. ${nombreLocal}` : `${nombreLocal} · ${extracto}`;
          const enfoque = seguimiento ? 'Abrir con el detalle confirmado para observar si cambia la respuesta a la misma invitación.' : carrusel ? 'Abrir con el nombre y revelar el detalle en la segunda lámina.'
            : 'Destacar un dato del local que ayude a recordarlo.';
          piezas.push({
            dia: semana * 7 + posicion * 3, formato: carrusel ? 'carrusel' : historia ? 'historia' : 'post',
            motivoFormato: carrusel ? 'Separar el dato y su explicación permite leerlos al deslizar.' : historia ? 'Una pantalla vertical permite responder en el momento.' : 'Una pieza de feed se puede volver a consultar cuando toque elegir dónde comer.',
            laminas: carrusel ? 3 : 1,
            proposito: accion.proposito, audiencia: 'Quien está pensando dónde quedar para su próxima salida.',
            enfoque, fuente, llamada: accion.llamada, metrica: accion.metrica,
            texto: `${pie}. ${accion.llamada}`,
            guion: carrusel
              ? [`${seguimiento ? 'Abrir con el detalle del local' : 'Portada tipográfica con la firma'} «${seguimiento ? extracto : nombreLocal}».`, `Dar protagonismo al dato confirmado «${extracto}».`, `Cerrar con «${accion.llamada}».`]
              : [seguimiento ? `Abrir con «${extracto}» como detalle protagonista y cerrar con la firma «${nombreLocal}».` : `Componer «${extracto}» con la tipografía de la marca.`],
          });
        }
      }
      const brief = esquemaEstrategia(contexto).parse({
        nombre: `Una visita a ${nombreLocal}`,
        fundamento: `El local quiere «${solicitud.objetivo}». Un detalle que el negocio ya tiene documentado permite al lector imaginar una visita y decidir con quién compartirla.`,
        estrategia: `Para «${solicitud.objetivo}», la campaña presentará los datos confirmados de ${nombreLocal}. Cada pieza invitará a una acción que se pueda contar después de publicarla.` + (accionDeReferencia ? ' Esta vez abriremos con el detalle del local y observaremos la misma invitación durante siete días.' : ''),
        piezas,
      });
      return esquemaDeEdicion(brief, contexto).parse({ piezas });
    },
  };
}
