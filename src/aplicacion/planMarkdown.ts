import type { Marca, Pieza } from '../dominio/modelos.js';
import { exigirPlan, trabajoDelPlan } from './trabajoDeDiapositiva.js';

/**
 * plan.md: el plan en legible. Sirve también para la vía manual (Nano Banana Pro en la web de Higgsfield):
 * copias el prompt y adjuntas las imágenes en el orden indicado.
 */
export function renderizarPlan(pieza: Pieza, marca: Marca): string {
  const plan = exigirPlan(pieza);
  const concepto = pieza.conceptoElegido;
  const lineas: string[] = [
    `# ${marca.nombre} · ${pieza.formato.toLowerCase()} · ${pieza.id}`,
    '',
    `**Idea:** ${pieza.idea}`,
    '',
  ];

  if (concepto) {
    lineas.push(
      `## Concepto: ${concepto.titulo}`,
      '',
      `- **Mecanismo:** ${concepto.mecanismo}`,
      ...(concepto.tratamiento ? [`- **Familia visual:** ${concepto.tratamiento}`] : []),
      `- **Fotografía:** ${concepto.fotografia}`,
      `- **Tipografía:** ${concepto.tipografia}`,
      ...(concepto.paleta?.length ? [`- **Paleta:** ${concepto.paleta.join(' · ')}`] : []),
      `- **Por qué:** ${concepto.porQue}`,
      '',
    );
  }
  if (plan.hiloVisual) lineas.push(`**Hilo visual:** ${plan.hiloVisual}`, '');

  for (const diapositiva of plan.diapositivas) {
    const trabajo = trabajoDelPlan(pieza, diapositiva.posicion, { portadaPendiente: true });
    lineas.push(
      `## Diapositiva ${diapositiva.posicion} · ${diapositiva.funcion}`,
      '',
      ...(diapositiva.titular ? [`**Titular:** «${diapositiva.titular}»`, ''] : []),
      `**Textos en la imagen:** ${diapositiva.textos.map((texto) => `«${texto}»`).join(' · ') || '(ninguno)'}`,
      '',
      ...(diapositiva.transicion ? [`**Lleva a la siguiente:** ${diapositiva.transicion}`, ''] : []),
      '**Adjunta en este orden:**',
      '',
      ...trabajo.referencias.map((archivo, i) => `${i + 1}. ${enlace(archivo)}`),
      '',
      '```text',
      trabajo.prompt,
      '```',
      '',
    );
  }

  lineas.push(
    '## Pie de publicación',
    '',
    plan.pie,
    '',
    plan.hashtags.join(' '),
    '',
    `**Texto alternativo:** ${plan.textoAlt}`,
    '',
  );
  return lineas.join('\n');
}

/** Enlace relativo que se abre desde el editor; la portada pendiente no es un archivo todavía. */
function enlace(archivo: string): string {
  return archivo.includes(' ') ? archivo : `[${archivo}](${archivo})`;
}
