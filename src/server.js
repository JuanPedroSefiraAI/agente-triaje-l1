const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const chatRouter = require('./routes/chat');
const dashboardAuth = require('./middleware/dashboardAuth');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', chatRouter);

app.get('/dashboard', dashboardAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
