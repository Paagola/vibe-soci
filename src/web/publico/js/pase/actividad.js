const OFICIOS = {
  productor: { figura: 'productor', nombre: 'Producción editorial', tarea: 'Prepara el plan con la foto, la referencia y el inventario.' },
  analista: { figura: 'analista', nombre: 'Análisis de referencias', tarea: 'Estudia el encuadre, el estilo y la composición de la referencia.' },
  'director-foto': { figura: 'fotografia', nombre: 'Dirección de fotografía', tarea: 'Examina la foto original y propone una nueva toma.' },
  revisor: { figura: 'revision', nombre: 'Revisión fotográfica', tarea: 'Comprueba la candidata frente al inventario y la toma acordada.' },
  'director-diseno': { figura: 'diseno', nombre: 'Dirección de diseño', tarea: 'Prepara el encuadre y la jerarquía de la pieza.' },
  critico: { figura: 'critico', nombre: 'Crítica editorial', tarea: 'Revisa la composición frente a la comanda.' },
};

const PASOS = {
  REFERENCIA: { figura: 'analista', nombre: 'Referencia' },
  FOTO_REAL: { figura: 'fotografia', nombre: 'Foto original' },
  PROPUESTA: { figura: 'fotografia', nombre: 'Dirección de fotografía' },
  CONFIRMAR_ELEMENTOS: { figura: 'mesa', nombre: 'Inventario de la toma' },
  GENERAR: { figura: 'imagen', nombre: 'Preparación de la imagen' },
  COMPROBAR: { figura: 'revision', nombre: 'Revisión fotográfica' },
  MASCARA: { figura: 'imagen', nombre: 'Preparación de la imagen' },
  INTENCION: { figura: 'diseno', nombre: 'Composición' },
  COMPONER: { figura: 'diseno', nombre: 'Composición' },
};

const PETICIONES = {
  alta: 'Registra la foto y los datos del encargo.',
  avance: 'Prepara el siguiente paso del encargo.',
  propuesta: 'Actualiza la comanda con tus cambios.',
  referencia: 'Guarda la referencia del encargo.',
};

export function actividadDe(trabajo, peticion) {
  if (trabajo?.estado !== 'EN_CURSO' && !PETICIONES[peticion]) return null;

  const enCurso = trabajo?.estado === 'EN_CURSO';
  const intervencion = enCurso ? trabajo.intervencion : null;
  const oficio = OFICIOS[intervencion?.especialista];
  const paso = enCurso ? PASOS[trabajo.paso] : null;
  const modelo = intervencion?.modelo;
  return {
    figura: oficio?.figura ?? paso?.figura ?? 'mesa',
    nombre: oficio?.nombre ?? paso?.nombre ?? 'Mesa de control',
    tarea: oficio?.tarea ?? (enCurso ? trabajo.mensaje : PETICIONES[peticion]),
    modelo: modelo === 'gemini-4-hydrogen' ? 'Gemini 4 Hydrogen' : modelo,
  };
}

export function intervencionesDe(trabajo) {
  return (trabajo.intervenciones ?? []).flatMap(({ especialista, modelo }) => {
    const oficio = OFICIOS[especialista];
    return oficio ? [modelo ? `${oficio.nombre} · ${modelo}` : oficio.nombre] : [];
  });
}
