// Backend de producción (Vercel): persiste las conversaciones en Supabase.
// El servidor es la única fuente de verdad del historial: el cliente nunca
// escribe mensajes `assistant` directamente, solo los lee de vuelta.

const { createClient } = require('@supabase/supabase-js');

function createSupabaseConversationStore(url, serviceKey) {
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return {
    async createConversation() {
      const { data, error } = await client.from('conversations').insert({}).select('id').single();
      if (error) throw new Error(`Supabase: no se pudo crear la conversación (${error.message}).`);
      return data.id;
    },

    async conversationExists(id) {
      const { data, error } = await client.from('conversations').select('id').eq('id', id).maybeSingle();
      if (error) throw new Error(`Supabase: no se pudo comprobar la conversación (${error.message}).`);
      return Boolean(data);
    },

    async getMessages(id, { limit = 20 } = {}) {
      const { data, error } = await client
        .from('conversation_messages')
        .select('role, content, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(`Supabase: no se pudieron leer los mensajes (${error.message}).`);
      return data.reverse().map(({ role, content }) => ({ role, content }));
    },

    async appendMessages(id, messages) {
      const { error } = await client
        .from('conversation_messages')
        .insert(messages.map((m) => ({ conversation_id: id, role: m.role, content: m.content })));

      if (error) throw new Error(`Supabase: no se pudieron guardar los mensajes (${error.message}).`);
    },
  };
}

module.exports = { createSupabaseConversationStore };
