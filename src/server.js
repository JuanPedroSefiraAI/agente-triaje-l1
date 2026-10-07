const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const chatRouter = require('./routes/chat');
const dashboardAuth = require('./middleware/dashboardAuth');
const ticketStore = require('./ticketStore');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', chatRouter);

app.get('/dashboard', dashboardAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Tickets reales escalados a Nivel 2 (Freshdesk o respaldo local), para el
// panel del dashboard. Protegido con la misma auth que el propio dashboard.
app.get('/api/tickets', dashboardAuth, async (req, res) => {
  try {
    const tickets = await ticketStore.listTickets();
    res.json({ tickets });
  } catch (err) {
    console.error('No se pudieron obtener los tickets.', err.message);
    res.status(500).json({ error: 'No se pudieron obtener los tickets.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
