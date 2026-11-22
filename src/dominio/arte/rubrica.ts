/**
 * Estudio de arte · la rúbrica visual (diseno/INFORME-DIRECCION-DE-ARTE-AGENTICA.md §6.1), lo que devuelve la crítica y
 * la distancia estructural entre direcciones.
 *
 * Escala por dimensión, de 0 a 4: 0 ausente o roto · 1 genérico (plantilla reconocible) · 2 correcto pero previsible ·
 * 3 decidido, con una intención legible · 4 de agencia: se recuerda y no se confunde.
 *
 * Una pieza suelta se puntúa en seis dimensiones (la variedad se mide entre direcciones y la secuencia, en series). La
 * fidelidad es además compuerta: si el plato no es el real o hay un texto sin respaldo, la pieza no puntúa.
 */
import { z } from 'zod';
import { Receta, type Receta as TipoReceta } from './receta.js';

export const DIMENSIONES = {
  idea: { peso: 15, describe: 'Se dice en una frase y nace del plato, del mensaje o del local; no podría ser de otro local.' },
  composicion: { peso: 15, describe: 'Una primera lectura clara; la segunda y la tercera, ordenadas; el espacio tiene función.' },
  tipografia: { peso: 15, describe: 'Voces con papel, escala con tensión, cortes e interlineado cuidados, legible a 360 px.' },
  relacion: { peso: 15, describe: 'El texto y el producto se tocan con intención (oclusión, anotación, eje, cruce).' },
  identidad: { peso: 10, describe: 'Se reconoce el local sin leer el nombre: su color, su voz, su registro.' },
  acabado: { peso: 10, describe: 'Sin defectos de ejecución: recorte limpio, nada cortado por error, nada flotando sin motivo, márgenes con intención.' },
} as const;
export type Dimension = keyof typeof DIMENSIONES;

/** Con referencia, una dimensión más: el parentesco con la referencia y la mejora sobre ella. */
export const DIMENSION_REFERENCIA = {
  peso: 20,
  describe: 'Se reconoce hermana de la referencia (estructura, mecanismo, ritmo) y la mejora en algo concreto: ni la copia sin criterio ni la ignora.',
} as const;

const Nivel = z.number().int().min(0).max(4);

export const Puntuacion = z.object({
  nivel: Nivel,
  motivo: z.string().min(8).max(240).describe('Lo que se ve en la pieza que justifica el nivel, en concreto.'),
});

export const Critica = z.object({
  primeraLectura: z.string().min(4).max(160).describe('Lo primero que ve el ojo a tamaño de móvil, tal cual.'),
  puntuaciones: z.object({
    ...(Object.fromEntries(Object.keys(DIMENSIONES).map((d) => [d, Puntuacion])) as Record<Dimension, typeof Puntuacion>),
    referencia: Puntuacion.optional().describe('Solo si hay REFERENCIA: parentesco reconocible y mejora sobre ella.'),
  }),
  defectoPrincipal: z.string().min(8).max(240).describe('El único cambio que más subiría la pieza.'),
  parches: z
    .array(z.object({ cambio: z.string().min(6).max(200), mejora: z.enum(Object.keys(DIMENSIONES) as [Dimension, ...Dimension[]]) }))
    .max(3)
    .describe('De cero a tres cambios acotados (qué cambiar en la receta y qué dimensión sube). No toques lo que funciona.'),
  receta: Receta.optional().describe('La receta con los parches aplicados, entera. Solo si hay parches.'),
});
export type Critica = z.infer<typeof Critica>;

/** Nota sobre 100: la suma de peso × nivel / 4, reescalada (las seis dimensiones pesan 80 en la rúbrica completa). */
export function nota(p: Critica['puntuaciones'], fidelidadOk = true): number {
  if (!fidelidadOk) return 0;
  let suma = 0;
  let pesos = 0;
  for (const [d, { peso }] of Object.entries(DIMENSIONES) as Array<[Dimension, { peso: number }]>) {
    suma += (peso * p[d].nivel) / 4;
    pesos += peso;
  }
  if (p.referencia) {
    suma += (DIMENSION_REFERENCIA.peso * p.referencia.nivel) / 4;
    pesos += DIMENSION_REFERENCIA.peso;
  }
  return Math.round((suma / pesos) * 100);
}

/**
 * La huella estructural de una receta: lo que hace que dos piezas se vean como la misma plantilla aunque cambien el
 * color o la fuente. Dos direcciones con la misma huella son variaciones, no direcciones.
 */
export function huella(r: TipoReceta): Record<string, string> {
  return {
    esqueleto: r.esqueleto,
    relacion: r.titular.relacion,
    escalaProducto: r.producto.escala,
    escalaTitular: r.titular.escala,
    operaciones: r.operaciones.map((o) => o.tipo).sort().join('+') || 'ninguna',
    voz: r.titular.voz,
    fondo: r.fondo,
  };
}

/** Distancia de 0 (iguales) a 1 (nada en común): pesa más la estructura (esqueleto, relación, operaciones) que el color o la voz. */
export function distancia(a: TipoReceta, b: TipoReceta): number {
  const ha = huella(a);
  const hb = huella(b);
  const pesos: Record<string, number> = { esqueleto: 0.3, relacion: 0.15, escalaProducto: 0.1, escalaTitular: 0.05, operaciones: 0.2, voz: 0.1, fondo: 0.1 };
  let d = 0;
  for (const [k, w] of Object.entries(pesos)) {
    if (k === 'operaciones') {
      const sa = new Set(a.operaciones.map((o) => o.tipo));
      const sb = new Set(b.operaciones.map((o) => o.tipo));
      const union = new Set([...sa, ...sb]);
      const comun = [...sa].filter((x) => sb.has(x)).length;
      d += w * (union.size ? 1 - comun / union.size : 0);
    } else if (ha[k] !== hb[k]) d += w;
  }
  return Math.round(d * 100) / 100;
}

/** Problemas de variedad entre direcciones: las que comparten esqueleto, o están a menos de 0,45 de otra. */
export function problemasDeVariedad(recetas: TipoReceta[]): string[] {
  const problemas: string[] = [];
  for (let i = 0; i < recetas.length; i++) {
    for (let j = i + 1; j < recetas.length; j++) {
      const a = recetas[i]!;
      const b = recetas[j]!;
      if (a.esqueleto === b.esqueleto) problemas.push(`«${a.nombre}» y «${b.nombre}» usan el mismo esqueleto (${a.esqueleto}): cada dirección, uno distinto.`);
      else if (distancia(a, b) < 0.45) problemas.push(`«${a.nombre}» y «${b.nombre}» se parecen demasiado (distancia ${distancia(a, b)}): cambia la relación texto-producto, las operaciones o la voz.`);
    }
  }
  return problemas;
}
