const express = require('express');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgentReply } = require('../claudeAgent');

const router = express.Router();

const MAX_MESSAGE_LENGTH = 4000;

// TODO(auth): endpoint en fase demo/pruebas, sin autenticación por API key.
// Cuando haya clientes reales en producción, cada despliegue necesitará su
// propia API key validada server-side (una key por cliente, no por usuario
// final) antes de llegar a este handler.
const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has superado el límite de mensajes permitidos. Intenta de nuevo en unos minutos.' },
});

router.post('/chat', chatRateLimiter, async (req, res) => {
  const { message, multipleIssues } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El campo "message" es requerido.' });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.` });
  }

  try {
    const reply = await getAgentReply(message, { multipleIssues: Boolean(multipleIssues) });
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
