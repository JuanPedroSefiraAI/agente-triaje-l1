// CSV mínimo (RFC 4180) compatible con Excel en español: UTF-8 con BOM.
const fs = require('node:fs');

function celda(valor) {
  const texto = Array.isArray(valor) ? valor.join(' | ') : String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

function escribirCsv(ruta, columnas, filas) {
  const lineas = [columnas.join(','), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(','))];
  fs.writeFileSync(ruta, '﻿' + lineas.join('\r\n') + '\r\n', 'utf-8');
}

function leerCsv(ruta) {
  let texto = fs.readFileSync(ruta, 'utf-8').replace(/^﻿/, '');
  // Excel en configuración española guarda con ';' como separador.
  const primeraLinea = texto.split(/\r?\n/, 1)[0];
  const sep = primeraLinea.split(';').length > primeraLinea.split(',').length ? ';' : ',';

  const registros = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (entreComillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') entreComillas = false;
      else campo += ch;
    } else if (ch === '"') entreComillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((v) => v !== '')) registros.push(fila);
      fila = [];
    } else campo += ch;
  }
  if (campo !== '' || fila.length) { fila.push(campo); if (fila.some((v) => v !== '')) registros.push(fila); }

  const [cabecera, ...resto] = registros;
  return resto.map((r) => Object.fromEntries(cabecera.map((c, i) => [c.trim(), r[i] ?? ''])));
}

module.exports = { escribirCsv, leerCsv };
