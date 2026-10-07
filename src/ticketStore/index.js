// Interfaz común de almacenamiento de tickets: { saveTicket, listTickets }.
// El backend se elige automáticamente según el entorno:
// - Si hay SUPABASE_URL y SUPABASE_SERVICE_KEY -> Supabase (producción/Vercel,
//   donde el filesystem no es persistente entre invocaciones).
// - Si no -> fichero JSON local (desarrollo).
const { createJsonFileStore } = require('./jsonFileStore');
const { createSupabaseStore } = require('./supabaseStore');

function createTicketStore() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    return createSupabaseStore(supabaseUrl, supabaseServiceKey);
  }

  return createJsonFileStore();
}

module.exports = createTicketStore();
