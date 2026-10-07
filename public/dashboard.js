const URGENCY_WEIGHT = { Alta: 3, Media: 2, Baja: 1 };

const STATUS_CLASS = {
  'Resuelto por IA': 'status-resuelto',
  'Escalado a Nivel 2': 'status-escalado',
  'En curso': 'status-en-curso',
};

const URGENCY_CLASS = {
  Alta: 'urgency-alta',
  Media: 'urgency-media',
  Baja: 'urgency-baja',
};

// Iconos mínimos (forma + color) para que la urgencia no dependa solo del color.
// Son constantes fijas del propio código (no datos de conversación), por eso
// es seguro parsearlas como HTML: nunca contienen texto proveniente de terceros.
const URGENCY_ICON_MARKUP = {
  Alta: '<svg class="urgency-icon" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0L8 8H0Z" fill="currentColor"/></svg>',
  Media: '<svg class="urgency-icon" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><rect x="0.5" y="0.5" width="7" height="7" fill="currentColor"/></svg>',
  Baja: '<svg class="urgency-icon" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>',
};

const RESPUESTA_MEDIA_MOCK = '2.4 min';

const PRIORITY_LABEL = { 1: 'Baja', 2: 'Media', 3: 'Alta', 4: 'Urgente' };
const PRIORITY_URGENCY_CLASS = {
  1: 'urgency-baja',
  2: 'urgency-media',
  3: 'urgency-alta',
  4: 'urgency-urgente',
};

function el(tag, { className, text } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Construye el icono de urgencia a partir de markup fijo y confiable (ver
// URGENCY_ICON_MARKUP), nunca a partir de datos de la conversación.
function buildUrgencyIcon(urgency) {
  const template = document.createElement('template');
  template.innerHTML = URGENCY_ICON_MARKUP[urgency] || '';
  return template.content.firstChild;
}

function kpiCard(className, value, label) {
  const card = el('div', { className: `kpi-card ${className}` });
  card.appendChild(el('span', { className: 'kpi-value', text: value }));
  card.appendChild(el('span', { className: 'kpi-label', text: label }));
  return card;
}

function renderSummaryBar(conversations) {
  const total = conversations.length;
  const resueltasIA = conversations.filter((c) => c.status === 'Resuelto por IA').length;
  const resueltoPct = total ? Math.round((resueltasIA / total) * 100) : 0;
  const urgentesActivas = conversations.filter(
    (c) => c.urgency === 'Alta' && c.status !== 'Resuelto por IA'
  ).length;

  const bar = document.getElementById('summary-bar');
  bar.textContent = '';

  const grid = el('div', { className: 'kpi-grid' });
  grid.appendChild(kpiCard('kpi-total', String(total), 'Conversaciones totales'));
  grid.appendChild(kpiCard('kpi-resolved', `${resueltoPct}%`, 'Resuelto por IA'));
  grid.appendChild(kpiCard('kpi-urgent', String(urgentesActivas), 'Urgentes activas'));
  grid.appendChild(kpiCard('kpi-time', RESPUESTA_MEDIA_MOCK, 'Tiempo medio de respuesta'));
  bar.appendChild(grid);
}

// Todo el texto proveniente de `c` (user, summary, urgency, status, time) se
// inserta vía textContent: si en el futuro estos campos llegan a venir de
// conversaciones reales de usuarios, siguen sin poder inyectar HTML/JS.
function conversationRow(c) {
  const article = el('article', { className: 'conversation-row' });

  article.appendChild(el('span', { className: 'conversation-user', text: c.user }));
  article.appendChild(el('p', { className: 'conversation-summary', text: c.summary }));

  const urgencyBadge = el('span', { className: `badge urgency-badge ${URGENCY_CLASS[c.urgency]}` });
  const icon = buildUrgencyIcon(c.urgency);
  if (icon) urgencyBadge.appendChild(icon);
  urgencyBadge.appendChild(document.createTextNode(c.urgency));
  article.appendChild(urgencyBadge);

  article.appendChild(
    el('span', { className: `badge status-badge ${STATUS_CLASS[c.status]}`, text: c.status })
  );
  article.appendChild(el('span', { className: 'conversation-time', text: c.time }));

  return article;
}

// Los tickets reales traen `createdAt` en ISO (a diferencia del campo `time`
// ya formateado de las conversaciones mock), así que necesitan su propio
// formateo relativo.
function formatRelativeTime(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60000));

  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;

  const diffDays = Math.round(diffHours / 24);
  return `hace ${diffDays} d`;
}

// Todo el texto proveniente de `t` (subject, summary, status) se inserta vía
// textContent, igual que en conversationRow: son datos reales de tickets
// escalados, nunca HTML/JS de confianza.
function ticketRow(t) {
  const article = el('article', { className: 'ticket-row' });

  article.appendChild(el('span', { className: 'ticket-subject', text: t.subject }));
  article.appendChild(el('p', { className: 'ticket-summary', text: t.summary }));

  const priorityLabel = PRIORITY_LABEL[t.priority] || 'Media';
  const priorityBadge = el('span', {
    className: `badge urgency-badge ${PRIORITY_URGENCY_CLASS[t.priority] || 'urgency-media'}`,
    text: priorityLabel,
  });
  article.appendChild(priorityBadge);

  article.appendChild(el('span', { className: 'badge status-badge status-escalado', text: t.status }));

  const isLocal = t.source === 'local';
  article.appendChild(
    el('span', {
      className: `source-tag ${isLocal ? 'source-local' : 'source-freshdesk'}`,
      text: isLocal ? 'Local (respaldo)' : 'Freshdesk',
    })
  );

  article.appendChild(el('span', { className: 'ticket-time', text: formatRelativeTime(t.createdAt) }));

  return article;
}

function renderTickets(tickets) {
  const list = document.getElementById('tickets-list');
  list.textContent = '';

  if (!tickets.length) {
    list.appendChild(
      el('div', { className: 'tickets-empty', text: 'No hay tickets escalados por el momento.' })
    );
    return;
  }

  for (const t of tickets) {
    list.appendChild(ticketRow(t));
  }
}

async function loadTickets() {
  try {
    const response = await fetch('/api/tickets');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { tickets } = await response.json();
    renderTickets(tickets);
  } catch (err) {
    const list = document.getElementById('tickets-list');
    list.textContent = '';
    list.appendChild(
      el('div', { className: 'tickets-empty', text: 'No se pudieron cargar los tickets reales.' })
    );
    console.error('No se pudieron cargar los tickets.', err);
  }
}

function renderConversations(conversations) {
  const list = document.getElementById('conversations-list');
  const sorted = [...conversations].sort(
    (a, b) => URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency]
  );

  list.textContent = '';
  for (const c of sorted) {
    list.appendChild(conversationRow(c));
  }
}

renderSummaryBar(MOCK_CONVERSATIONS);
renderConversations(MOCK_CONVERSATIONS);
loadTickets();
