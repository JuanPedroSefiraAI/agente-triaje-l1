// Exporta a eval/revision.csv una muestra de casos para revisión manual.
// Uso: node eval/exportar-revision.js
const fs = require('node:fs');
const path = require('node:path');

const CASOS = path.join(__dirname, 'casos.jsonl');
const SALIDA = path.join(__dirname, 'revision.csv');

// Al menos 2 por categoría y 1 por cada tipo de trampa.
const MUESTRA = [
  'pwd-003', 'pwd-006', 'pwd-012',
  'm365-001', 'm365-002', 'm365-011',
  'vpn-003', 'vpn-008', 'vpn-012',
  'imp-001', 'imp-004',
  'hw-001', 'hw-004',
  'acc-003', 'acc-004', 'acc-010',
  'sw-002', 'sw-007',
  'alta-001', 'alta-012',
  'fuera-001', 'fuera-004',
  'multi-001', 'multi-002',
  'ambig-001', 'ambig-003',
  'inj-002', 'inj-004', 'inj-005', 'inj-006',
];

const COLUMNAS = ['id', 'tipo', 'mensaje', 'decision_esperada', 'debe_mencionar', 'no_debe', 'datos_faltantes'];

function celda(valor) {
  const texto = Array.isArray(valor) ? valor.join(' | ') : String(valor ?? '');
  return `"${texto.replace(/"/g, '""')}"`;
}

const casos = new Map(
  fs.readFileSync(CASOS, 'utf-8').split(/\r?\n/).filter(Boolean).map((l) => {
    const c = JSON.parse(l);
    return [c.id, c];
  })
);

const filas = MUESTRA.map((id) => {
  const c = casos.get(id);
  if (!c) throw new Error(`Caso no encontrado: ${id}`);
  return COLUMNAS.map((col) => celda(c[col])).join(',');
});

// BOM para que Excel abra el UTF-8 con acentos correctamente.
fs.writeFileSync(SALIDA, '﻿' + [COLUMNAS.join(','), ...filas].join('\r\n') + '\r\n', 'utf-8');
console.log(`${filas.length} casos exportados a ${path.relative(process.cwd(), SALIDA)}`);
