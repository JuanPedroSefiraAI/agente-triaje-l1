// Backend de respaldo para desarrollo local: persiste los tickets en un
// fichero JSON. No sirve en Vercel (filesystem efímero/no persistente entre
// invocaciones), por eso en producción se usa supabaseStore en su lugar.

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'tickets.json');

// Serializa lecturas/escrituras: un fichero plano no tiene transacciones, así
// que sin esto dos escaladas casi simultáneas podrían pisarse una a otra.
let queue = Promise.resolve();
function serialize(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

async function readAll() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll(tickets) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
}

function createJsonFileStore() {
  return {
    async saveTicket(ticket) {
      return serialize(async () => {
        const tickets = await readAll();
        const saved = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...ticket,
        };
        tickets.push(saved);
        await writeAll(tickets);
        return saved;
      });
    },

    async listTickets() {
      const tickets = await readAll();
      return [...tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
  };
}

module.exports = { createJsonFileStore };
