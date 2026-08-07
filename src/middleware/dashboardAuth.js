const crypto = require('node:crypto');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compara igualmente contra sí mismo para no filtrar la longitud por timing.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function unauthorized(res) {
  res.set('WWW-Authenticate', 'Basic realm="Dashboard Administrador"');
  return res.status(401).send('Autenticación requerida.');
}

// Basic Auth respaldada por variables de entorno. Falla cerrado: si las
// credenciales no están configuradas, la ruta queda bloqueada en vez de
// quedar abierta por defecto.
function dashboardAuth(req, res, next) {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    console.error('DASHBOARD_USER / DASHBOARD_PASSWORD no configuradas: acceso a /dashboard bloqueado.');
    return res.status(503).send('El dashboard no está disponible: faltan credenciales de configuración.');
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return unauthorized(res);
  }

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return unauthorized(res);
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return unauthorized(res);
  }

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(password, expectedPassword)) {
    return unauthorized(res);
  }

  next();
}

module.exports = dashboardAuth;
