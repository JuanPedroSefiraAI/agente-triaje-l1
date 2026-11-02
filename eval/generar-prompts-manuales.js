// Genera eval/prompts-manuales.md: prompts completos para validar el agente a mano
// (p. ej. pegándolos en claude.ai). Solo lectura y formateo: no llama a la API.
// Uso: node eval/generar-prompts-manuales.js
const fs = require('node:fs');
const path = require('node:path');

// Guard: cualquier intento de llamar a la API aborta. La clave ficticia solo existe
// para que el SDK pueda construir su cliente al cargar claudeAgent.js.
process.env.ANTHROPIC_API_KEY ||= 'sin-llamadas-a-la-api';
const Anthropic = require('@anthropic-ai/sdk');
Object.getPrototypeOf(new Anthropic().messages).create = () => {
  throw new Error('Este script no puede llamar a la API de Anthropic.');
};

const { buildSystem } = require('../src/claudeAgent');
const systemPrompt = require('../src/systemPrompt');
const { enManual } = require('./manual');

const IDS = [
  'pwd-003', // contraseñas: resolver
  'pwd-006', // contraseñas: pedir_datos
  'vpn-001', // red: resolver (no reiniciar el router)
  'vpn-006', // red: trae datos y ya probó lo del manual -> escalar directo
  'hw-007', // hardware: COMPROBACIONES BÁSICAS
  'imp-004', // impresoras: COMPROBACIONES BÁSICAS
  'inj-005', // injection
  'inj-006', // injection
];

const casos = new Map(
  fs.readFileSync(path.join(__dirname, 'casos.jsonl'), 'utf-8')
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).map((c) => [c.id, c])
);

const lista = (items) => (items && items.length ? items.map((i) => `  - ${i}`).join('\n') : '  - (ninguno)');

function bloquePegable(system, mensaje) {
  return `Actúa como el agente descrito en las INSTRUCCIONES DEL SISTEMA y responde al MENSAJE DEL USUARIO exactamente como lo haría ese agente: escribe solo la respuesta que vería el usuario, sin comentarios tuyos. No dispones de la herramienta "escalar_a_nivel2": si decides escalar, dilo en la respuesta como indican las instrucciones.

=== INSTRUCCIONES DEL SISTEMA ===
${system}

=== MENSAJE DEL USUARIO ===
${mensaje}`;
}

const out = [];
out.push('# Prompts para validar el agente a mano (sin API)');
out.push('');
out.push('Generado con `node eval/generar-prompts-manuales.js`. No llama a la API de Anthropic: reutiliza `buildSystem()` de `src/claudeAgent.js` (el mismo código que construye el prompt real) y `retrieval.js`.');
out.push('');
out.push('**Cómo usarlo:** abre un chat nuevo en claude.ai por cada caso, pega el bloque de la sección 5 y compara la respuesta con lo esperado de la sección 1.');
out.push('');
out.push('**Diferencias con el agente real** (tenlas en cuenta al valorar):');
out.push('- Es el prompt de **producción** (`dryRun: false`): sin la herramienta de clasificación de evaluación.');
out.push('- claude.ai no tiene la herramienta `escalar_a_nivel2`; por eso el bloque pegable pide decir la escalada en el texto. Para valorar la decisión: "escalar" = la respuesta anuncia pasar a soporte Nivel 2.');
out.push('- El modelo y el system prompt propio de claude.ai difieren de `claude-opus-4-8` por API; es una validación orientativa del prompt y el RAG, no una medición.');
out.push('- Todos los casos tienen historial vacío (una sola vuelta).');
out.push('');
out.push('| id | decision_esperada | secciones del manual recuperadas |');
out.push('|---|---|---|');

const secciones = [];
for (const id of IDS) {
  const caso = casos.get(id);
  if (!caso) throw new Error(`Caso no encontrado: ${id}`);
  const { system, ragContext, sectionTitles } = buildSystem({ message: caso.mensaje, dryRun: false });
  secciones.push({ caso, system, ragContext, sectionTitles });
  out.push(`| ${id} | ${caso.decision_esperada} | ${sectionTitles.join(' + ') || '(ninguna)'} |`);
}
out.push('');

out.push('---');
out.push('');
out.push('## 2. System prompt (parte común a los 8 casos)');
out.push('');
out.push('Es el contenido actual de `src/systemPrompt.js`. El system prompt completo de cada caso es esto + la nota de la herramienta de escalado + el contexto RAG de ese caso (sección 3); aparece ensamblado, tal cual se enviaría, en el bloque de la sección 5.');
out.push('');
out.push('````text');
out.push(systemPrompt);
out.push('````');
out.push('');

for (const { caso, system, ragContext, sectionTitles } of secciones) {
  const cubierto = enManual(caso);
  out.push('---');
  out.push('');
  out.push(`## ${caso.id}`);
  out.push('');
  out.push('### 1. Caso y resultado esperado');
  out.push('');
  out.push(`- **id:** ${caso.id}`);
  out.push(`- **decision_esperada:** ${caso.decision_esperada}`);
  out.push(`- **categoría / tipo:** ${caso.categoria} / ${caso.tipo}`);
  out.push(`- **cubierto por el manual (en_manual):** ${cubierto ? 'sí' : 'no'}`);
  out.push('- **debe mencionar (conceptos):**');
  out.push(lista(caso.debe_mencionar));
  out.push('- **no debe contener:**');
  out.push(lista(caso.no_debe));
  out.push('- **datos que debería pedir (si pide datos):**');
  out.push(lista(caso.datos_faltantes));
  out.push('');
  out.push('### 3. Contexto RAG recuperado por `retrieval.js`');
  out.push('');
  out.push(`Secciones recuperadas: ${sectionTitles.length ? sectionTitles.map((t) => `**${t}**`).join(', ') : '**ninguna**'}`);
  out.push('');
  out.push('````text');
  out.push(ragContext);
  out.push('````');
  out.push('');
  out.push('### 4. Mensaje del usuario (tal cual en `casos.jsonl`)');
  out.push('');
  out.push('````text');
  out.push(caso.mensaje);
  out.push('````');
  out.push('');
  out.push('### 5. Bloque completo para copiar y pegar en claude.ai');
  out.push('');
  out.push('````text');
  out.push(bloquePegable(system, caso.mensaje));
  out.push('````');
  out.push('');
}

const destino = path.join(__dirname, 'prompts-manuales.md');
fs.writeFileSync(destino, out.join('\n'), 'utf-8');
console.log(`${IDS.length} casos escritos en ${path.relative(process.cwd(), destino)}`);
