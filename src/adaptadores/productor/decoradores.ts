/**
 * Productor (fase 1): decoradores de los puertos de los especialistas. Dan el brief del encargo a los directores y al
 * crítico, comparan la foto nueva también contra el inventario confirmado y cortan las llamadas cuando se acaba el
 * presupuesto. Cada llamada de texto o visión pasa antes por `antesDeLlamar`.
 */
import { listaConInventario } from '../../dominio/cotejo.js';
import type { AnalistaDeReferencias } from '../../puertos/AnalistaDeReferencias.js';
import type { CriticoDeDiseno, DirectorDeDiseno, EncargoDeDiseno } from '../../puertos/DirectorDeDiseno.js';
import type { DirectorDeFoto, EncargoDeFoto } from '../../puertos/Foto.js';
import type { FuenteDelBrief } from '../../puertos/FuenteDelBrief.js';
import type { ParDeFotos, RevisorVisual } from '../../puertos/RevisorVisual.js';

export function directorFotoConBrief(d: DirectorDeFoto, f: FuenteDelBrief): DirectorDeFoto {
  return {
    nombre: d.nombre,
    async proponer(e: EncargoDeFoto, prev: string[]) {
      await f.antesDeLlamar('director-foto');
      const c = await f.contexto();
      return d.proponer(c ? { ...e, contexto: c } : e, prev);
    },
  };
}

export function directorDisenoConBrief(d: DirectorDeDiseno, f: FuenteDelBrief): DirectorDeDiseno {
  return {
    nombre: d.nombre,
    async proponer(e: EncargoDeDiseno, prev: string[]) {
      await f.antesDeLlamar('director-diseno');
      const c = await f.contexto();
      return d.proponer(c ? { ...e, contexto: c } : e, prev);
    },
  };
}

export function criticoConBrief(c: CriticoDeDiseno, f: FuenteDelBrief): CriticoDeDiseno {
  return {
    nombre: c.nombre,
    async criticar(e: EncargoDeDiseno, propuesta: Parameters<CriticoDeDiseno['criticar']>[1], pieza: string) {
      await f.antesDeLlamar('critico');
      const contexto = await f.contexto();
      return c.criticar(contexto ? { ...e, contexto } : e, propuesta, pieza);
    },
  };
}

export function revisorConInventario(r: RevisorVisual, f: FuenteDelBrief): RevisorVisual {
  return {
    nombre: r.nombre,
    async comprobarElementos(fotos: ParDeFotos, lista: string) {
      await f.antesDeLlamar('revisor');
      const inv = await f.inventarioConfirmado();
      return r.comprobarElementos(fotos, inv ? listaConInventario(lista, inv) : lista);
    },
    async compararToma(fotos: ParDeFotos) {
      await f.antesDeLlamar('revisor');
      return r.compararToma(fotos);
    },
    async contarAnatomia(generada: string, piezas: Array<{ nombre: string; esperado: number }>) {
      await f.antesDeLlamar('revisor');
      return r.contarAnatomia(generada, piezas);
    },
  };
}

export function analistaConPresupuesto(a: AnalistaDeReferencias, f: FuenteDelBrief): AnalistaDeReferencias {
  return {
    nombre: a.nombre,
    async analizar(ruta: string) {
      await f.antesDeLlamar('analista');
      return a.analizar(ruta);
    },
  };
}
