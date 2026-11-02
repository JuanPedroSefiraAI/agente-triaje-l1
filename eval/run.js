// Ejecuta la evaluación del agente de triaje L1 (siempre con dryRun).
//
//   npm run eval                          todos los casos con el modelo de producción
//   npm run eval -- --modelo claude-sonnet-5-5
//   npm run eval -- --filtro vpn_red      solo una categoría
//   npm run eval -- --calibrar            solo los casos de eval/revision.csv -> eval/calibracion.csv
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { runAgent } = require('../src/claudeAgent');
const { juzgar, MODELO_JUEZ } = require('./juez');
const { enManual, titulosManual } = require('./manual');
const { MODELO_PRODUCCION, costeEur } = require('./config');
const { generarInforme } = require('./informe');
const { escribirCsv, leerCsv } = require('./csv');

const DIR = __dirname;
const DIR_RESULTADOS = path.join(DIR, 'resultados');
const CONCURRENCIA = 3;
const MAX_INTENTOS = 6;

// pnpm reenvía el separador "--" literal; npm no.
const { values: args } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    modelo: { type: 'string' },
    filtro: { type: 'string' },
    calibrar: { type: 'boolean', default: false },
    forzar: { type: 'boolean', default: false },
  },
});

function marcaTemporal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// 429 = rate limit, 529 = API sobrecargada. El SDK ya reintenta 2 veces;
// esto cubre ráfagas largas sin perder casos de la ejecución.
async function conReintentos(fn, etiqueta) {
  for (let intento = 1; ; intento++) {
    try {
      return await fn();
    } catch (err) {
      const reintentable = err.status === 429 || err.status === 529;
      if (!reintentable || intento >= MAX_INTENTOS) throw err;
      const espera = Math.min(60000, 2000 * 2 ** (intento - 1)) + Math.random() * 1000;
      console.warn(`  ${etiqueta}: ${err.status}, reintento ${intento} en ${Math.round(espera / 1000)} s`);
      await esperar(espera);
    }
  }
}

async function enParalelo(items, limite, fn) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}

function cargarCasos() {
  const titulos = titulosManual();
  return fs
    .readFileSync(path.join(DIR, 'casos.jsonl'), 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((c) => ({ ...c, en_manual: enManual(c, titulos) }));
}

function seleccionarCasos(casos) {
  if (args.calibrar) {
    const ids = new Set(leerCsv(path.join(DIR, 'revision.csv')).map((f) => f.id));
    return casos.filter((c) => ids.has(c.id));
  }
  if (args.filtro) return casos.filter((c) => c.categoria === args.filtro || c.tipo === args.filtro);
  return casos;
}

async function evaluarCaso(caso, modelo) {
  const base = {
    id: caso.id,
    categoria: caso.categoria,
    tipo: caso.tipo,
    en_manual: caso.en_manual,
    decision_esperada: caso.decision_esperada,
    modelo,
  };
  try {
    const salida = await conReintentos(
      () => runAgent({ message: caso.mensaje, history: caso.historial, dryRun: true, model: modelo }),
      `${caso.id} agente`
    );
    const veredicto = await conReintentos(() => juzgar(caso, salida), `${caso.id} juez`);
    const { escalation, dryRun, ...resto } = salida;
    return {
      ...base,
      salida: { ...resto, escalado_resumen: escalation?.summary ?? null },
      coste_eur: costeEur(modelo, salida.tokens_entrada, salida.tokens_salida),
      veredicto,
    };
  } catch (err) {
    return { ...base, error: `${err.status ?? ''} ${err.message}`.trim() };
  }
}

function exportarCalibracion(casos, resultados) {
  const ruta = path.join(DIR, 'calibracion.csv');
  if (fs.existsSync(ruta) && !args.forzar) {
    const yaRellenas = leerCsv(ruta).filter((f) => f.mi_veredicto?.trim()).length;
    if (yaRellenas) {
      console.error(`eval/calibracion.csv ya tiene ${yaRellenas} veredictos tuyos; no lo sobrescribo. Usa --forzar si quieres regenerarlo.`);
      return;
    }
  }
  const porId = new Map(casos.map((c) => [c.id, c]));
  const filas = resultados.map((r) => {
    const c = porId.get(r.id);
    return {
      id: r.id,
      tipo: r.tipo,
      mensaje: c.mensaje,
      decision_esperada: r.decision_esperada,
      debe_mencionar: c.debe_mencionar,
      decision_agente: r.salida?.decision ?? 'ERROR',
      respuesta_agente: r.salida?.respuesta ?? r.error,
      juez_correcta: r.veredicto ? String(r.veredicto.correcta) : '',
      juez_invencion: r.veredicto ? String(r.veredicto.invencion) : '',
      juez_injection_superada: r.veredicto?.injection_superada == null ? '' : String(r.veredicto.injection_superada),
      juez_motivo: r.veredicto?.motivo ?? '',
      mi_veredicto: '',
      mi_comentario: '',
    };
  });
  escribirCsv(ruta, Object.keys(filas[0]), filas);
  console.log(`Calibración exportada a eval/calibracion.csv (${filas.length} casos). Rellena mi_veredicto con "sí" o "no" y ejecuta npm run eval:acuerdo.`);
}

async function main() {
  const modelo = args.modelo || MODELO_PRODUCCION;
  const casos = seleccionarCasos(cargarCasos());
  if (!casos.length) {
    console.error('No hay casos que ejecutar con ese filtro.');
    process.exit(1);
  }

  const inicio = new Date();
  const marca = `${marcaTemporal(inicio)}_${modelo.replace(/[^a-z0-9.-]/gi, '-')}${args.calibrar ? '_calibracion' : ''}`;
  console.log(`Evaluando ${casos.length} casos con ${modelo} (juez: ${MODELO_JUEZ}, concurrencia ${CONCURRENCIA})...`);

  let hechos = 0;
  const resultados = await enParalelo(casos, CONCURRENCIA, async (caso) => {
    const r = await evaluarCaso(caso, modelo);
    hechos++;
    const estado = r.error ? `ERROR ${r.error}` : `${r.salida.decision}${r.veredicto.correcta ? '' : ' ✗'}`;
    console.log(`[${hechos}/${casos.length}] ${caso.id}: ${estado}`);
    return r;
  });

  fs.mkdirSync(DIR_RESULTADOS, { recursive: true });
  const rutaCrudos = path.join(DIR_RESULTADOS, `${marca}.jsonl`);
  fs.writeFileSync(rutaCrudos, resultados.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');

  const informe = generarInforme(resultados, {
    fecha: inicio.toISOString(),
    etiquetaConfig: modelo,
    modeloJuez: MODELO_JUEZ,
    filtro: args.filtro,
    calibracion: args.calibrar,
  });
  const rutaInforme = path.join(DIR_RESULTADOS, `informe_${marca}.md`);
  fs.writeFileSync(rutaInforme, informe, 'utf-8');

  console.log(`\nResultados: ${path.relative(process.cwd(), rutaCrudos)}`);
  console.log(`Informe:    ${path.relative(process.cwd(), rutaInforme)}`);

  if (args.calibrar) exportarCalibracion(casos, resultados);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
