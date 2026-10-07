// Identifica la sesión de chat mediante una cookie httpOnly. El servidor es
// la única fuente de verdad del historial de la conversación: el id de
// sesión solo sirve para encontrar esa conversación en conversationStore,
// nunca para que el cliente aporte contenido de la conversación en sí.
const cookie = require('cookie');
const conversationStore = require('./conversationStore');

const COOKIE_NAME = 'sid';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días: igual que la retención de datos en Supabase.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    // Secure exige HTTPS: en local dev (http) se desactiva para que la
    // cookie no se pierda; en producción (Vercel, siempre HTTPS) se activa.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

function setSessionCookie(res, conversationId) {
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, conversationId, cookieOptions(COOKIE_MAX_AGE_SECONDS)));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, '', cookieOptions(0)));
}

// Nunca confía en el valor de la cookie tal cual: si no tiene formato UUID
// o no corresponde a ninguna conversación real en el store, crea una
// sesión nueva en vez de fallar. Así, aunque alguien falsifique la cookie,
// como mucho obtiene una conversación vacía, nunca el historial de otra.
async function resolveSession(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const candidate = cookies[COOKIE_NAME];

  if (candidate && UUID_RE.test(candidate) && (await conversationStore.conversationExists(candidate))) {
    return candidate;
  }

  const conversationId = await conversationStore.createConversation();
  setSessionCookie(res, conversationId);
  return conversationId;
}

module.exports = { resolveSession, clearSessionCookie };
