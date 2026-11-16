/**
 * Productor (fase 1): decoradores de los puertos de los especialistas. Brief como contexto, inventario confirmado para el
 * revisor, presupuesto de llamadas y el adaptador real de Gemini (con un fetch falso). Sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { DirectorFotoGemini } from '../src/adaptadores/gemini/DirectorFotoGemini.js';
import { ClienteGemini } from '../src/adaptadores/gemini/ClienteGemini.js';
import {
  analistaConPresupuesto,
  criticoConBrief,
  directorDisenoConBrief,
  directorFotoConBrief,
  revisorConInventario,
} from '../src/adaptadores/productor/decoradores.js';
import type { ChecklistVisual, ComparacionToma, ConteoAnatomia } from '../src/dominio/comprobacionSalida.js';
import { ErrorDeUsuario } from '../src/dominio/errores.js';
import type { PropuestaFotoNueva } from '../src/dominio/fotoNueva.js';
import type { PropuestaDeDiseno } from '../src/dominio/diseno/propuesta.js';
import type { ElementoComparable } from '../src/dominio/inventario.js';
import type { GuiaCreativa } from '../src/puertos/BibliotecaCreativa.js';
import type { AnalistaDeReferencias } from '../src/puertos/AnalistaDeReferencias.js';
import type { CriticoDeDiseno, DirectorDeDiseno, EncargoDeDiseno } from '../src/puertos/DirectorDeDiseno.js';
import type { DirectorDeFoto, EncargoDeFoto } from '../src/puertos/Foto.js';
import type { FuenteDelBrief, QuienLlama } from '../src/puertos/FuenteDelBrief.js';
import type { ParDeFotos, RevisorVisual } from '../src/puertos/RevisorVisual.js';
import { RAIZ } from '../src/config.js';

interface OpcionesFuente {
  contexto?: string;
  inventario?: readonly ElementoComparable[];
  lanzar?: boolean;
}

function fuente(opciones: OpcionesFuente = {}) {
  const llamadas: QuienLlama[] = [];
  const f: FuenteDelBrief = {
    async contexto() {
      return opciones.contexto;
    },
    async inventarioConfirmado() {
      return opciones.inventario;
    },
    async antesDeLlamar(quien) {
      llamadas.push(quien);
      if (opciones.lanzar) throw new ErrorDeUsuario('presupuesto agotado');
    },
  };
  return { f, llamadas };
}

// Dobles con `this`: si el decorador llamara al método suelto, fallaría.
class DobleFoto implements DirectorDeFoto {
  readonly nombre = 'doble-foto';
  recibidos: EncargoDeFoto[] = [];
  async proponer(e: EncargoDeFoto, _prev: string[]): Promise<PropuestaFotoNueva> {
    this.recibidos.push(e);
    return {} as PropuestaFotoNueva;
  }
}

class DobleDiseno implements DirectorDeDiseno {
  readonly nombre = 'doble-diseno';
  recibidos: EncargoDeDiseno[] = [];
  async proponer(e: EncargoDeDiseno, _prev: string[]): Promise<PropuestaDeDiseno> {
    this.recibidos.push(e);
    return {} as unknown as PropuestaDeDiseno;
  }
}

class DobleCritico implements CriticoDeDiseno {
  readonly nombre = 'doble-critico';
  recibidos: EncargoDeDiseno[] = [];
  async criticar(e: EncargoDeDiseno, _propuesta: PropuestaDeDiseno, _pieza: string) {
    this.recibidos.push(e);
    return { llega: true, motivos: [] };
  }
}

class DobleRevisor implements RevisorVisual {
  readonly nombre = 'doble-revisor';
  listas: string[] = [];
  llamadas: string[] = [];
  async comprobarElementos(_fotos: ParDeFotos, lista: string): Promise<ChecklistVisual> {
    this.listas.push(lista);
    this.llamadas.push('comprobarElementos');
    return {} as ChecklistVisual;
  }
  async compararToma(_fotos: ParDeFotos): Promise<ComparacionToma> {
    this.llamadas.push('compararToma');
    return {} as ComparacionToma;
  }
  async contarAnatomia(_generada: string, _piezas: Array<{ nombre: string; esperado: number }>): Promise<ConteoAnatomia> {
    this.llamadas.push('contarAnatomia');
    return {} as ConteoAnatomia;
  }
}

class DobleAnalista implements AnalistaDeReferencias {
  readonly nombre = 'doble-analista';
  llamadas = 0;
  async analizar(_ruta: string) {
    this.llamadas++;
    return {} as Awaited<ReturnType<AnalistaDeReferencias['analizar']>>;
  }
}

const encargoFoto: EncargoDeFoto = { foto: 'plato.jpg', plato: 'Gamba' };
const encargoDiseno = { foto: 'foto.jpg', hechos: {}, mapa: {} } as unknown as EncargoDeDiseno;
const propuesta = {} as unknown as PropuestaDeDiseno;
const pares: ParDeFotos = { real: 'real.jpg', generada: 'generada.jpg' };
const inventario: ElementoComparable[] = [{ nombre: 'gunkan de toro', estado: 'tartar de toro sobre arroz y alga', recuento: 2 }];

describe('decoradores del productor: brief como contexto', () => {
  it('el director de foto recibe el brief y el resto del encargo igual', async () => {
    const d = new DobleFoto();
    const { f } = fuente({ contexto: 'BRIEF X' });
    await directorFotoConBrief(d, f).proponer(encargoFoto, ['previo']);
    const recibido = d.recibidos[0]!;
    assert.equal(recibido.contexto, 'BRIEF X');
    assert.deepEqual({ ...recibido, contexto: undefined }, { ...encargoFoto, contexto: undefined });
  });

  it('sin brief el director de foto recibe el encargo sin la clave contexto', async () => {
    const d = new DobleFoto();
    const { f } = fuente();
    await directorFotoConBrief(d, f).proponer(encargoFoto, []);
    assert.equal('contexto' in d.recibidos[0]!, false);
  });

  it('el director de diseño recibe el brief, y sin brief no recibe la clave', async () => {
    const d = new DobleDiseno();
    await directorDisenoConBrief(d, fuente({ contexto: 'BRIEF X' }).f).proponer(encargoDiseno, []);
    assert.equal(d.recibidos[0]!.contexto, 'BRIEF X');
    assert.deepEqual({ ...d.recibidos[0], contexto: undefined }, { ...encargoDiseno, contexto: undefined });

    const sin = new DobleDiseno();
    await directorDisenoConBrief(sin, fuente().f).proponer(encargoDiseno, []);
    assert.equal('contexto' in sin.recibidos[0]!, false);
  });

  it('el crítico recibe el brief, y sin brief no recibe la clave', async () => {
    const c = new DobleCritico();
    await criticoConBrief(c, fuente({ contexto: 'BRIEF X' }).f).criticar(encargoDiseno, propuesta, 'pieza.png');
    assert.equal(c.recibidos[0]!.contexto, 'BRIEF X');
    assert.deepEqual({ ...c.recibidos[0], contexto: undefined }, { ...encargoDiseno, contexto: undefined });

    const sin = new DobleCritico();
    await criticoConBrief(sin, fuente().f).criticar(encargoDiseno, propuesta, 'pieza.png');
    assert.equal('contexto' in sin.recibidos[0]!, false);
  });
});

describe('decoradores del productor: revisor con inventario confirmado', () => {
  it('con inventario, la lista empieza por la original y añade el inventario confirmado', async () => {
    const r = new DobleRevisor();
    const lista = 'gunkan de toro ×2; salsa';
    await revisorConInventario(r, fuente({ inventario }).f).comprobarElementos(pares, lista);
    const recibida = r.listas[0]!;
    assert.ok(recibida.startsWith(lista));
    assert.ok(recibida.includes('INVENTARIO CONFIRMADO POR EL DUEÑO'));
    assert.ok(recibida.includes('gunkan de toro'));
  });

  it('sin inventario, la lista es la original exacta', async () => {
    const r = new DobleRevisor();
    const lista = 'gunkan de toro ×2; salsa';
    await revisorConInventario(r, fuente().f).comprobarElementos(pares, lista);
    assert.equal(r.listas[0], lista);
  });
});

describe('decoradores del productor: presupuesto de llamadas', () => {
  it('si antesDeLlamar lanza, todos los métodos rechazan y el envuelto no se llama', async () => {
    const { f } = fuente({ lanzar: true });
    const foto = new DobleFoto();
    const diseno = new DobleDiseno();
    const critico = new DobleCritico();
    const revisor = new DobleRevisor();
    const analista = new DobleAnalista();

    await assert.rejects(directorFotoConBrief(foto, f).proponer(encargoFoto, []), ErrorDeUsuario);
    await assert.rejects(directorDisenoConBrief(diseno, f).proponer(encargoDiseno, []), ErrorDeUsuario);
    await assert.rejects(criticoConBrief(critico, f).criticar(encargoDiseno, propuesta, 'p.png'), ErrorDeUsuario);
    await assert.rejects(revisorConInventario(revisor, f).comprobarElementos(pares, 'lista'), ErrorDeUsuario);
    await assert.rejects(revisorConInventario(revisor, f).compararToma(pares), ErrorDeUsuario);
    await assert.rejects(revisorConInventario(revisor, f).contarAnatomia('g.png', []), ErrorDeUsuario);
    await assert.rejects(analistaConPresupuesto(analista, f).analizar('ref.png'), ErrorDeUsuario);

    assert.equal(foto.recibidos.length, 0);
    assert.equal(diseno.recibidos.length, 0);
    assert.equal(critico.recibidos.length, 0);
    assert.deepEqual(revisor.llamadas, []);
    assert.equal(analista.llamadas, 0);
  });

  it('si no lanza, cuenta una llamada por método con el quien correcto', async () => {
    const { f, llamadas } = fuente();
    const revisor = new DobleRevisor();
    await directorFotoConBrief(new DobleFoto(), f).proponer(encargoFoto, []);
    await directorDisenoConBrief(new DobleDiseno(), f).proponer(encargoDiseno, []);
    await criticoConBrief(new DobleCritico(), f).criticar(encargoDiseno, propuesta, 'p.png');
    await revisorConInventario(revisor, f).comprobarElementos(pares, 'lista');
    await revisorConInventario(revisor, f).compararToma(pares);
    await revisorConInventario(revisor, f).contarAnatomia('g.png', []);
    await analistaConPresupuesto(new DobleAnalista(), f).analizar('ref.png');
    assert.deepEqual(llamadas, ['director-foto', 'director-diseno', 'critico', 'revisor', 'revisor', 'revisor', 'analista']);
    assert.deepEqual(revisor.llamadas, ['comprobarElementos', 'compararToma', 'contarAnatomia']);
  });
});

describe('decoradores del productor: nombre', () => {
  it('cada decorador conserva el nombre del envuelto', () => {
    const { f } = fuente();
    assert.equal(directorFotoConBrief(new DobleFoto(), f).nombre, 'doble-foto');
    assert.equal(directorDisenoConBrief(new DobleDiseno(), f).nombre, 'doble-diseno');
    assert.equal(criticoConBrief(new DobleCritico(), f).nombre, 'doble-critico');
    assert.equal(revisorConInventario(new DobleRevisor(), f).nombre, 'doble-revisor');
    assert.equal(analistaConPresupuesto(new DobleAnalista(), f).nombre, 'doble-analista');
  });
});

describe('adaptador real de Gemini con el brief', () => {
  // Guía mínima: el adaptador solo lee sus campos al montar el texto.
  const guiaVacia = { principios: '', ejemplos: [], valoraciones: [], referencias: [] } as unknown as GuiaCreativa;

  function directorConFetchFalso() {
    const cuerpos: string[] = [];
    const falso = async (_url: string | URL | Request, init?: RequestInit) => {
      cuerpos.push(String(init?.body ?? ''));
      return new Response('mal', { status: 400 });
    };
    const cliente = new ClienteGemini('k', ['m'], { fetch: falso, dormir: async () => {} });
    return { director: new DirectorFotoGemini(cliente, guiaVacia, ['m']), cuerpos };
  }

  it('añade el brief al cuerpo enviado a Gemini', async () => {
    const { director, cuerpos } = directorConFetchFalso();
    await assert.rejects(
      director.proponer({ foto: join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png'), plato: 'Gamba', contexto: 'BRIEF DE PRUEBA' }, []),
    );
    assert.equal(cuerpos.length, 1);
    assert.ok(cuerpos[0]!.includes('Brief del encargo'));
    assert.ok(cuerpos[0]!.includes('BRIEF DE PRUEBA'));
  });

  it('sin contexto, el cuerpo no contiene el brief', async () => {
    const { director, cuerpos } = directorConFetchFalso();
    await assert.rejects(director.proponer({ foto: join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png'), plato: 'Gamba' }, []));
    assert.equal(cuerpos.length, 1);
    assert.equal(cuerpos[0]!.includes('Brief del encargo'), false);
  });
});
