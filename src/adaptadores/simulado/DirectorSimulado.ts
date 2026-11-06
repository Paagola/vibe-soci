import type { Concepto, Plan } from '../../dominio/modelos.js';
import { slugificar } from '../../dominio/reglas.js';
import type { ContextoCreativo, DirectorCreativo, PeticionCorreccion, PropuestaCorreccion } from '../../puertos/DirectorCreativo.js';

/**
 * Director falso y determinista: recorre el flujo entero sin claves ni gasto.
 * Sirve para --simular y para los tests. No intenta ser creativo.
 */
export class DirectorSimulado implements DirectorCreativo {
  async proponerConceptos(contexto: ContextoCreativo, descartados: Concepto[]): Promise<Concepto[]> {
    const palabra = palabraPrincipal(contexto.pieza.idea);
    const color = contexto.marca.colores[0]?.hex ?? '#EDE7DD';
    return [1, 2, 3].map((n) => ({
      titulo: `Concepto simulado ${descartados.length + n}`,
      mecanismo: 'La palabra principal queda detrás del plato y el plato tapa la parte baja de las letras.',
      fotografia: 'Cámara baja a 20 grados, una sola luz lateral dura y el fondo cayendo a negro.',
      tipografia: `Grotesca condensada muy pesada, en ${color}.`,
      textos: [palabra],
      porQue: 'Simulado: sirve para probar el flujo sin gastar.',
      tratamiento: 'Low-key con fondo casi negro.',
      paleta: [color, '#111111'],
    }));
  }

  async planificar(contexto: ContextoCreativo, concepto: Concepto): Promise<Plan> {
    const { pieza, marca } = contexto;
    const diapositivas = Array.from({ length: pieza.numDiapositivas }, (_, i) => {
      const foto = pieza.fotos[i % pieza.fotos.length]!;
      return {
        posicion: i + 1,
        funcion: i === 0 ? 'Portada' : `Diapositiva ${i + 1}`,
        titular: concepto.textos[0],
        transicion: i + 1 < pieza.numDiapositivas ? 'El plato se sale por el borde derecho y continúa en la siguiente.' : undefined,
        textos: concepto.textos.slice(0, 1),
        fotos: [foto.archivo],
        prompt: `SIMULATED PROMPT for ${marca.nombre}. ${concepto.titulo}. CAMERA: Image 1 is shot from above at table height. Use Image 1 only as the list of elements, not as a layout to copy. The new photograph is shot at table level from the side. PHOTO: new professional shot of Image 1. CREATIVE TYPOGRAPHY: "${concepto.textos[0]}". RULES: no boxes behind text.`,
      };
    });
    return {
      diapositivas,
      pie: pieza.idea,
      hashtags: [`#${slugificar(marca.nombre).replace(/-/g, '') || 'local'}`],
      textoAlt: `Imagen simulada de ${marca.nombre}.`,
      hiloVisual: pieza.numDiapositivas > 1 ? 'El mismo color y la misma tipografía en todas; el plato pasa de una a otra.' : undefined,
    };
  }

  /** Mantiene los textos de la diapositiva y los escribe tal cual, como se le pide al director real. */
  async corregir(_contexto: ContextoCreativo, peticion: PeticionCorreccion): Promise<PropuestaCorreccion> {
    const { textos } = peticion.diapositiva;
    const literales = textos.length ? `\nKeep these texts exactly: ${textos.map((t) => `"${t}"`).join(', ')}.` : '';
    return { prompt: `Keep image 1 almost exactly. Change only the following:\n1. ${peticion.comentario}${literales}`, textos };
  }
}

function palabraPrincipal(idea: string): string {
  const palabras = idea.split(/\s+/).filter((palabra) => palabra.length > 3);
  return (palabras.sort((a, b) => b.length - a.length)[0] ?? 'Hoy').replace(/[^\p{L}\p{N}]/gu, '');
}
