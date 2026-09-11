// Cliente mínimo para la API REST de Freshdesk (autenticación Basic Auth
// con la API key como usuario, ver https://developers.freshdesk.com/api/#authentication).
// Node 18+ trae `fetch` global, así que no hace falta ninguna dependencia extra.

const DEFAULT_PRIORITY = 2; // 1=Baja, 2=Media, 3=Alta, 4=Urgente
const DEFAULT_STATUS = 2; // 2=Abierto
const PLACEHOLDER_EMAIL = 'soporte@empresa-cliente.com';

async function createFreshdeskTicket(subject, description, priority = DEFAULT_PRIORITY) {
  const domain = process.env.FRESHDESK_DOMAIN;
  const apiKey = process.env.FRESHDESK_API_KEY;

  if (!domain || !apiKey) {
    throw new Error('Freshdesk no está configurado: faltan FRESHDESK_DOMAIN o FRESHDESK_API_KEY.');
  }

  const url = `https://${domain}.freshdesk.com/api/v2/tickets`;
  const auth = Buffer.from(`${apiKey}:X`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      subject,
      description,
      email: PLACEHOLDER_EMAIL,
      priority,
      status: DEFAULT_STATUS,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Freshdesk respondió ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

module.exports = { createFreshdeskTicket };
