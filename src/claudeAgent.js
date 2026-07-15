const Anthropic = require('@anthropic-ai/sdk');
const systemPrompt = require('./systemPrompt');
const { findRelevantSections } = require('./retrieval');

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

// Construye el bloque de contexto que se antepone al system prompt.
// Si no hay secciones relevantes, se lo dice explícitamente a Claude
// para que no rellene el hueco con conocimiento general.
function buildRagContext(message) {
  const { sections, found } = findRelevantSections(message);

  const contextBody = found
    ? sections.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')
    : 'No se encontró ninguna sección del manual de procedimientos relacionada con esta consulta.';

  return `## CONTEXTO OFICIAL (extraído del manual interno de procedimientos)
${contextBody}

## INSTRUCCIONES SOBRE EL USO DEL CONTEXTO OFICIAL
- Responde ÚNICAMENTE con base en el CONTEXTO OFICIAL de arriba. No completes huecos con conocimiento general ni supongas procedimientos, URLs o plazos que no estén ahí.
- Si el contexto indica que no se encontró información relevante, o si no cubre lo que pregunta el usuario, dilo con claridad y escala a soporte Nivel 2 en vez de inventar una respuesta.
- No mezcles el contexto oficial con suposiciones "razonables": si no está en el contexto, no lo afirmes.`;
}

// Se antepone cuando el front-end detecta que el mensaje dispara el trigger
// de conexión PERO además trae otras incidencias: evita que el agente se
// quede solo con el problema de conexión al construir su respuesta.
const MULTIPLE_ISSUES_NOTE = `## AVISO: MENSAJE CON VARIAS INCIDENCIAS
El usuario ha reportado en este mismo mensaje un posible problema de
conexión junto con, al menos, otra incidencia distinta. Reconoce
explícitamente TODAS las incidencias mencionadas (aunque sea en una
lista breve) antes de resolver o escalar cada una por separado.`;

async function getAgentReply(message, { multipleIssues = false } = {}) {
  const system = [systemPrompt, multipleIssues ? MULTIPLE_ISSUES_NOTE : null, buildRagContext(message)]
    .filter(Boolean)
    .join('\n\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: message }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('La consulta fue rechazada por los filtros de seguridad del modelo.');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock ? textBlock.text : '';
}

module.exports = { getAgentReply };
