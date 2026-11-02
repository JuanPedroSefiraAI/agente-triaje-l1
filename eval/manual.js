const fs = require('node:fs');
const path = require('node:path');

const DOC_PATH = path.join(__dirname, '..', 'docs', 'manual-procedimientos.txt');

function textoManual() {
  return fs.readFileSync(DOC_PATH, 'utf-8');
}

function titulosManual() {
  return textoManual()
    .split(/\r?\n/)
    .map((l) => l.match(/^##\s+(.+)/))
    .filter(Boolean)
    .map((m) => m[1].trim());
}

// en_manual se calcula contra el manual vigente: el caso está cubierto si
// declara secciones y todas existen ahora. Al ampliar el manual basta con
// rellenar `secciones_manual` de los casos afectados; no hay que regenerar el set.
function enManual(caso, titulos = titulosManual()) {
  const requeridas = caso.secciones_manual || [];
  return requeridas.length > 0 && requeridas.every((t) => titulos.includes(t));
}

module.exports = { textoManual, titulosManual, enManual };
