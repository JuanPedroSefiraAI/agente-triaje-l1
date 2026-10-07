// Backend de desarrollo local: persiste las conversaciones en un fichero
// JSON. No sirve en Vercel (filesystem efímero), por eso en producción se
// usa supabaseStore en su lugar.

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'conversations.json');

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
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeAll(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function createJsonFileConversationStore() {
  return {
    async createConversation() {
      return serialize(async () => {
        const data = await readAll();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        data[id] = { createdAt: now, lastMessageAt: now, messages: [] };
        await writeAll(data);
        return id;
      });
    },

    async conversationExists(id) {
      const data = await readAll();
      return Boolean(data[id]);
    },

    // Devuelve los últimos `limit` mensajes en orden cronológico (más
    // antiguo primero), como los espera la API de Claude.
    async getMessages(id, { limit = 20 } = {}) {
      const data = await readAll();
      const conversation = data[id];
      if (!conversation) return [];
      return conversation.messages.slice(-limit).map(({ role, content }) => ({ role, content }));
    },

    // Sesión desconocida (cookie manipulada que esquivó la validación de
    // resolveSession, etc.): no crea nada implícito, simplemente no persiste.
    async appendMessages(id, messages) {
      return serialize(async () => {
        const data = await readAll();
        if (!data[id]) return;
        const now = new Date().toISOString();
        for (const m of messages) {
          data[id].messages.push({ role: m.role, content: m.content, createdAt: now });
        }
        data[id].lastMessageAt = now;
        await writeAll(data);
      });
    },
  };
}

module.exports = { createJsonFileConversationStore };
