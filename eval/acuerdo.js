// Calcula el acuerdo entre el juez automático y tu revisión manual.
// Uso: npm run eval:acuerdo   (lee eval/calibracion.csv)
const path = require('node:path');
const { leerCsv } = require('./csv');

const SI = new Set(['si', 'sí', 's', 'true', '1', 'ok', 'correcta', 'bien']);
const NO = new Set(['no', 'n', 'false', '0', 'mal', 'incorrecta']);

function aBooleano(valor) {
  const v = String(valor ?? '').trim().toLowerCase();
  if (SI.has(v)) return true;
  if (NO.has(v)) return false;
  return null;
}

const filas = leerCsv(path.join(__dirname, 'calibracion.csv'));
const revisadas = filas
  .map((f) => ({ ...f, yo: aBooleano(f.mi_veredicto), juez: aBooleano(f.juez_correcta) }))
  .filter((f) => f.yo !== null && f.juez !== null);

const sinRevisar = filas.length - revisadas.length;
if (!revisadas.length) {
  console.log('No hay veredictos tuyos en eval/calibracion.csv (columna mi_veredicto: "sí" o "no").');
  process.exit(0);
}

const acuerdos = revisadas.filter((f) => f.yo === f.juez);
const desacuerdos = revisadas.filter((f) => f.yo !== f.juez);
const juezMasBlando = desacuerdos.filter((f) => f.juez && !f.yo).length;
const juezMasDuro = desacuerdos.filter((f) => !f.juez && f.yo).length;

console.log(`Casos revisados: ${revisadas.length}${sinRevisar ? ` (${sinRevisar} sin revisar o sin veredicto válido)` : ''}`);
console.log(`Acuerdo juez-humano: ${((acuerdos.length / revisadas.length) * 100).toFixed(1)}% (${acuerdos.length}/${revisadas.length})`);
console.log(`  Juez da por buena una respuesta que tú suspendes: ${juezMasBlando}`);
console.log(`  Juez suspende una respuesta que tú das por buena: ${juezMasDuro}`);

if (desacuerdos.length) {
  console.log('\nDesacuerdos:');
  for (const f of desacuerdos) {
    console.log(`- ${f.id} [${f.tipo}] juez=${f.juez ? 'correcta' : 'incorrecta'} tú=${f.yo ? 'correcta' : 'incorrecta'}`);
    console.log(`    juez: ${f.juez_motivo}`);
    if (f.mi_comentario) console.log(`    tú:   ${f.mi_comentario}`);
  }
}
