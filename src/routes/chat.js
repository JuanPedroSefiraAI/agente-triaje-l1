const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgentReply } = require('../claudeAgent');

const router = express.Router();

router.post('/chat', async (req, res) => {
  const { message } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El campo "message" es requerido.' });
  }

  try {
    const reply = await getAgentReply(message);
    res.json({ reply });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Claude API: credenciales inválidas o ausentes.', err.message);
      return res.status(500).json({ error: 'El agente no está configurado correctamente.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error('Claude API: rate limit alcanzado.', err.message);
      return res.status(503).json({ error: 'El agente está saturado, intenta de nuevo en unos segundos.' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Claude API: error de la API.', err.status, err.message);
      return res.status(502).json({ error: 'El agente no pudo procesar la consulta.' });
    }
    console.error('Error inesperado al llamar al agente.', err);
    res.status(500).json({ error: 'Ocurrió un error inesperado.' });
  }
});

module.exports = router;
