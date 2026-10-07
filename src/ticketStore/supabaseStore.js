// Backend de producción (Vercel): persiste los tickets en Supabase.
// Usa siempre la service role key, que solo debe vivir en variables de
// entorno del servidor y nunca llegar al frontend.

const { createClient } = require('@supabase/supabase-js');

function mapRow(row) {
  return {
    id: row.id,
    subject: row.subject,
    summary: row.summary,
    priority: row.priority,
    status: row.status,
    source: row.source,
    freshdeskId: row.freshdesk_id,
    createdAt: row.created_at,
  };
}

function createSupabaseStore(url, serviceKey) {
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return {
    async saveTicket(ticket) {
      const { data, error } = await client
        .from('tickets')
        .insert({
          subject: ticket.subject,
          summary: ticket.summary,
          priority: ticket.priority,
          status: ticket.status,
          source: ticket.source,
          freshdesk_id: ticket.freshdeskId ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(`Supabase: no se pudo guardar el ticket (${error.message}).`);
      return mapRow(data);
    },

    async listTickets() {
      const { data, error } = await client
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Supabase: no se pudieron listar los tickets (${error.message}).`);
      return data.map(mapRow);
    },
  };
}

module.exports = { createSupabaseStore };
