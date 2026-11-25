/**
 * Tipografía especial con Gemini: el diseñador que escribe recetas (tipografia/receta@1) a partir de un brief, y el
 * crítico visual que compara la hoja de muestras con el brief (SISTEMA.md §4, pasos 2 y 6).
 */
import { z } from 'zod';
import { CriticaDeTratamiento, type BriefDeTratamiento, type ContextoDeDiseno, type InformeParaCorregir } from '../../dominio/tipografia/creacion.js';
import type { CriticoDeTratamientos, DisenadorDeTratamientos } from '../../aplicacion/tipografia/crearTratamiento.js';
import type { ClienteGemini } from './ClienteGemini.js';

const DISENADOR = `Eres un diseñador tipográfico que crea ESTILOS de tipografía especial para el titular de un post de un
restaurante: letra de papel, de neón, derretida, de tiza… Cada estilo es una RECETA (un grafo de filtros) que pinta el
compositor del estudio sobre la letra real; no dibujas tú.

Devuelve SOLO el JSON de la receta, siguiendo el manual. El estudio pondrá él mismo el esquema, el id, la versión, el
estado y el origen: no los inventes.

Reglas de oficio:
- La palabra se tiene que leer a tamaño de móvil con las tres fuentes de la hoja (la de la marca, una grotesca y una
  serif) y en fondo claro y oscuro. Un efecto que se come la letra no vale.
- El material tiene que parecer el del brief (queso fundido no es pintura amarilla). Pocas piezas y bien elegidas.
- Si te devuelven métricas o una crítica, corrige exactamente eso sin cambiar la idea.`;

const CRITICO = `Eres un director de arte que revisa una hoja de muestras de un estilo de tipografía especial. Compara lo
que ves con el BRIEF: ¿parece el material pedido o parece otra cosa (pintura, plástico, un filtro de IA, una
plantilla)? ¿Se lee la palabra? ¿Lo usaría una agencia buena en un post?

Devuelve SOLO un JSON: {"veredicto":"PASA"|"NO_PASA","parece":"en una frase, qué parece de verdad","correcciones":["…"]}.
Correcciones concretas sobre la receta (más rugosidad, menos brillo, el borde más irregular…); vacío si pasa.`;

export class TipografiaGemini implements DisenadorDeTratamientos, CriticoDeTratamientos {
  constructor(private readonly cliente: ClienteGemini) {}

  async escribir(brief: BriefDeTratamiento, contexto: ContextoDeDiseno, informe?: InformeParaCorregir & { anterior?: unknown }): Promise<unknown> {
    const partes = [
      { text: `${contexto.manual}\n\nEJEMPLOS (recetas aprobadas de la biblioteca):\n${contexto.ejemplos}` },
      { text: `BRIEF: ${brief.texto}\nPalabra de la hoja: «${brief.palabra}».${brief.local ? `\nLocal: ${brief.local.nombre} (fuente ${brief.local.fuente}, ${brief.local.clasificacion.join(', ')}; colores claro ${brief.local.colores.claro}, oscuro ${brief.local.colores.oscuro}, acento ${brief.local.colores.acento}).` : ''}` },
    ];
    if (informe) {
      partes.push({
        text: [
          `RONDA ${informe.ronda}: tu receta anterior no pasó.`,
          informe.anterior ? `LA RECETA: ${JSON.stringify(informe.anterior)}` : '',
          informe.problemasDeValidacion.length ? `PROBLEMAS DE VALIDACIÓN (esquema y grafo):\n${informe.problemasDeValidacion.map((p) => `- ${p}`).join('\n')}` : '',
          informe.verificacion ? `MEDIDAS: ${JSON.stringify(informe.verificacion)}` : '',
          informe.critica ? `CRÍTICA VISUAL: parece «${informe.critica.parece}». Correcciones:\n${informe.critica.correcciones.map((c) => `- ${c}`).join('\n')}` : '',
          'Corrígela y devuelve la receta entera.',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
    return this.cliente.generarJson(DISENADOR, partes, z.record(z.string(), z.unknown()));
  }

  async criticar(hoja: Buffer, brief: BriefDeTratamiento): Promise<CriticaDeTratamiento> {
    return this.cliente.generarJson(CRITICO, [{ text: `BRIEF: ${brief.texto}\nPalabra: «${brief.palabra}».` }, { inlineData: { mimeType: 'image/png', data: hoja.toString('base64') } }], CriticaDeTratamiento);
  }
}
