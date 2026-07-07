const Anthropic = require('@anthropic-ai/sdk');
const systemPrompt = require('./systemPrompt');

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

async function getAgentReply(message) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('La consulta fue rechazada por los filtros de seguridad del modelo.');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock ? textBlock.text : '';
}

module.exports = { getAgentReply };
