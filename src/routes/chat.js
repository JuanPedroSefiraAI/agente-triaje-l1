const express = require('express');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgentReply } = require('../claudeAgent');
const { createFreshdeskTicket } = require('../freshdeskClient');
const ticketStore = require('../ticketStore');
const conversationStore = require('../conversationStore');
const { resolveSession, clearSessionCookie } = require('../session');

const router = express.Router();

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 20; // 10 turnos: suficiente para una ronda de triaje, acota coste/tokens.

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
  // Nótese: ya no se lee `history` del body. El cliente solo aporta el
  // mensaje nuevo; el historial real vive en el servidor, indexado por la
  // sesión de la cookie, para que no se pueda falsificar un turno "assistant".
  const { message, multipleIssues } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El campo "message" es requerido.' });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.` });
  }

  try {
    const conversationId = await resolveSession(req, res);
    const history = await conversationStore.getMessages(conversationId, { limit: MAX_HISTORY_MESSAGES });

    const { reply, escalation } = await getAgentReply(message, {
      multipleIssues: Boolean(multipleIssues),
      history,
    });

    await conversationStore.appendMessages(conversationId, [
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ]);

    if (escalation) {
      const ticketBase = {
        subject: escalation.subject,
        summary: escalation.summary,
        priority: escalation.priority ?? 2,
        status: 'Abierto',
      };

      try {
        const freshdeskTicket = await createFreshdeskTicket(
          escalation.subject,
          escalation.summary,
          escalation.priority
        );
        await ticketStore.saveTicket({ ...ticketBase, source: 'freshdesk', freshdeskId: freshdeskTicket.id });
      } catch (freshdeskErr) {
        // Un fallo en la integración externa (credenciales ausentes, Freshdesk caído, etc.)
        // nunca debe interrumpir la experiencia del usuario en el chat: el ticket se guarda
        // como respaldo local para que no se pierda, y se muestra igualmente en el dashboard.
        console.error('No se pudo crear el ticket en Freshdesk; se guarda como respaldo local.', freshdeskErr.message);
        try {
          await ticketStore.saveTicket({ ...ticketBase, source: 'local', freshdeskId: null });
        } catch (storeErr) {
          console.error('No se pudo guardar el ticket de respaldo local.', storeErr.message);
        }
      }
    }

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

// Usado por el botón "Nuevo chat": borra la cookie de sesión para que el
// siguiente mensaje arranque una conversación nueva en vez de seguir
// acumulando historial sobre la anterior.
router.post('/chat/new-session', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
