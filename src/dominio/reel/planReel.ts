import { z } from 'zod';

const Texto = z.string().trim().min(1);
const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const FuenteReal = z.strictObject({
  id: Id,
  papel: z.enum(['PLATO', 'LOCAL']),
  origen: z.union([z.url({ protocol: /^https$/ }), z.string().regex(/^proyectos\/[a-z0-9-]+\/post\.json$/)]),
  archivo: z.string().regex(/^fuentes\/[a-z0-9-]+\.webp$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  elementos: z.array(Texto).min(1),
  fueraDeEncuadre: z.array(Texto),
});

const Plano = z.strictObject({
  id: Id,
  funcion: z.enum(['GANCHO', 'PISTA', 'CONTEXTO', 'ELECCION', 'REVELADO']),
  desdeMs: z.number().int().nonnegative(),
  hastaMs: z.number().int().positive(),
  accionEnFotograma: Texto,
  camara: z.union([
    z.strictObject({ movimiento: z.literal('FIJA'), desplazamientoPctEncuadre: z.literal(0) }),
    z.strictObject({
      movimiento: z.enum(['EMPUJE', 'DESLIZAMIENTO', 'RETROCESO']),
      desplazamientoPctEncuadre: z.number().positive().max(100),
    }),
  ]),
  referencias: z.array(z.strictObject({ fuenteId: Id, papel: z.enum(['IDENTIDAD_PLATO', 'IDENTIDAD_LOCAL']) })).min(1).max(2),
  rotulo: z.strictObject({ texto: Texto, desdeMs: z.number().int().nonnegative(), hastaMs: z.number().int().positive() }),
  criterioDeRechazo: Texto,
  promptFotograma: Texto,
  promptMovimiento: Texto,
});

export const PlanReel = z.strictObject({
  version: z.literal(1),
  conceptoId: Id,
  local: Texto,
  formato: z.literal('9:16'),
  ancho: z.literal(1080),
  alto: z.literal(1920),
  duracionMs: z.number().int().min(12_000).max(15_000),
  referenciaDeMontaje: z.strictObject({ url: z.url({ protocol: /^https$/ }), mecanismo: Texto }),
  inventarioPropuesto: z.array(FuenteReal).min(1),
  textosPropuestos: z.array(z.strictObject({ texto: Texto, respaldo: Texto })).min(1),
  promptContinuidad: Texto,
  planos: z.array(Plano).min(2).max(10),
}).superRefine((plan, ctx) => {
  const fuentes = new Map(plan.inventarioPropuesto.map(fuente => [fuente.id, fuente.papel]));
  const textos = new Set(plan.textosPropuestos.map(entrada => entrada.texto));
  const informar = (path: Array<string | number>, message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (fuentes.size !== plan.inventarioPropuesto.length) informar(['inventarioPropuesto'], 'Los identificadores de fuente deben ser únicos.');
  if (new Set(plan.planos.map(plano => plano.id)).size !== plan.planos.length) informar(['planos'], 'Los identificadores de plano deben ser únicos.');
  if (plan.planos[0]?.funcion !== 'GANCHO' || plan.planos.at(-1)?.funcion !== 'REVELADO') {
    informar(['planos'], 'El reel empieza con el gancho y termina con el revelado.');
  }
  let finalAnterior = 0;
  for (const [i, plano] of plan.planos.entries()) {
    if (plano.desdeMs !== finalAnterior || plano.hastaMs <= plano.desdeMs) {
      informar(['planos', i, 'desdeMs'], 'El plano debe continuar el anterior y durar más de cero.');
    }
    finalAnterior = plano.hastaMs;
    for (const [j, referencia] of plano.referencias.entries()) {
      const papel = referencia.papel === 'IDENTIDAD_PLATO' ? 'PLATO' : 'LOCAL';
      if (fuentes.get(referencia.fuenteId) !== papel) {
        informar(['planos', i, 'referencias', j], 'La referencia debe existir en el inventario con el papel indicado.');
      }
    }
    const { rotulo } = plano;
    if (rotulo.desdeMs < plano.desdeMs || rotulo.hastaMs > plano.hastaMs || rotulo.desdeMs >= rotulo.hastaMs) {
      informar(['planos', i, 'rotulo'], 'El rótulo debe tener duración positiva dentro del plano.');
    }
    if (!textos.has(rotulo.texto)) informar(['planos', i, 'rotulo', 'texto'], 'El rótulo debe constar en el registro de textos.');
  }
  if (finalAnterior !== plan.duracionMs) informar(['duracionMs'], 'El último plano debe terminar al final del reel.');
});

export type PlanReel = z.infer<typeof PlanReel>;
