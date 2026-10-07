// Interfaz común: { createConversation, conversationExists, getMessages,
// appendMessages }. Mismo criterio de selección de backend que ticketStore:
// Supabase si hay credenciales (producción/Vercel), fichero JSON si no
// (desarrollo).
const { createJsonFileConversationStore } = require('./jsonFileStore');
const { createSupabaseConversationStore } = require('./supabaseStore');

function createConversationStore() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    return createSupabaseConversationStore(supabaseUrl, supabaseServiceKey);
  }

  return createJsonFileConversationStore();
}

module.exports = createConversationStore();
