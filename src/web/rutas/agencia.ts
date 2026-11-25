import { Router } from 'express';
import { z } from 'zod';
import { PedidoAgencia, ResultadoCampana } from '../../aplicacion/agencia/servicio.js';
import { validar } from '../../dominio/validacion.js';
import { ErrorHttp } from '../errores.js';
import type { AgenciaWeb } from '../agencia.js';

export function rutasDeAgencia(agencia: AgenciaWeb) {
  const rutas = Router();
  rutas.use((req, _res, next) => {
    const modo = req.get('X-Agencia-Modo');
    if (modo && modo !== (agencia.simulado() ? 'simulado' : 'real')) {
      throw new ErrorHttp(409, 'MODO_CAMBIADO', 'Ha cambiado el modo del estudio. Vuelve a abrir el calendario.');
    }
    next();
  });
  rutas.get('/panel/actividad', async (_req, res) => {
    const simulado = agencia.simulado();
    const servicio = agencia.actual();
    const locales = await agencia.locales();
    res.json({ simulado, locales: await Promise.all(locales.map(async ({ slug, nombre }) =>
      ({ slug, nombre, ...await servicio.actividad(slug) }))) });
  });
  rutas.get('/locales', async (_req, res) => {
    const simulado = agencia.simulado();
    const locales = (await agencia.locales()).map(({ slug, nombre }) => ({ slug, nombre }));
    res.json({ locales, simulado });
  });
  rutas.get('/:local', async (req, res) => {
    res.json(await agencia.actual().listar(req.params.local));
  });
  rutas.post('/:local', async (req, res) => {
    const clave = validar(z.uuid(), req.body?.clave, 'Falta el identificador de la petición.');
    const pedido = validar(PedidoAgencia, { solicitud: req.body, hecho: req.body.hecho, renovar: req.body.renovar, anticipar: req.body.anticipar }, 'Revisa el objetivo, la fecha y la duración de la campaña.');
    res.json({ campana: await agencia.actual().crear(req.params.local, clave, pedido) });
  });
  rutas.delete('/:local/renovacion', async (req, res) => {
    await agencia.actual().cancelarRenovacion(req.params.local);
    res.json({ renovacion: null });
  });
  const indice = (valor: string) => Number(validar(z.string().regex(/^(0|[1-9]\d?)$/), valor, 'La posición de la pieza no es válida.'));
  rutas.get('/:local/:id/piezas/:indice/entrega/:archivo', async (req, res) => {
    const p = req.params;
    res.download(await agencia.actual().archivoDeEntrega(p.local, p.id, indice(p.indice), p.archivo));
  });
  rutas.post('/:local/:id/piezas/:indice/abrir', async (req, res) => {
    const p = req.params;
    res.json({ conversacion: await agencia.actual().abrir(p.local, p.id, indice(p.indice)) });
  });
  rutas.put('/:local/:id/piezas/:indice/resultado', async (req, res) => {
    const p = req.params;
    const resultado = validar(ResultadoCampana, req.body, 'Anota un número entero positivo o cero.');
    res.json({ campana: await agencia.actual().resultado(p.local, p.id, indice(p.indice), resultado) });
  });
  return rutas;
}
