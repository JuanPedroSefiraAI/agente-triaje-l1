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

async function getAgentReply(message) {
  const system = `${systemPrompt}\n\n${buildRagContext(message)}`;

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
