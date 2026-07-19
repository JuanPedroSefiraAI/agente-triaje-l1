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
const URGENCY_ICON = {
  Alta: '<svg class="urgency-icon" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0L8 8H0Z" fill="currentColor"/></svg>',
  Media: '<svg class="urgency-icon" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><rect x="0.5" y="0.5" width="7" height="7" fill="currentColor"/></svg>',
  Baja: '<svg class="urgency-icon" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>',
};

const RESPUESTA_MEDIA_MOCK = '2.4 min';

function renderSummaryBar(conversations) {
  const total = conversations.length;
  const resueltasIA = conversations.filter((c) => c.status === 'Resuelto por IA').length;
  const resueltoPct = total ? Math.round((resueltasIA / total) * 100) : 0;
  const urgentesActivas = conversations.filter(
    (c) => c.urgency === 'Alta' && c.status !== 'Resuelto por IA'
  ).length;

  const bar = document.getElementById('summary-bar');
  bar.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card kpi-total">
        <span class="kpi-value">${total}</span>
        <span class="kpi-label">Conversaciones totales</span>
      </div>
      <div class="kpi-card kpi-resolved">
        <span class="kpi-value">${resueltoPct}%</span>
        <span class="kpi-label">Resuelto por IA</span>
      </div>
      <div class="kpi-card kpi-urgent">
        <span class="kpi-value">${urgentesActivas}</span>
        <span class="kpi-label">Urgentes activas</span>
      </div>
      <div class="kpi-card kpi-time">
        <span class="kpi-value">${RESPUESTA_MEDIA_MOCK}</span>
        <span class="kpi-label">Tiempo medio de respuesta</span>
      </div>
    </div>
  `;
}

function renderConversations(conversations) {
  const list = document.getElementById('conversations-list');
  const sorted = [...conversations].sort(
    (a, b) => URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency]
  );

  list.innerHTML = sorted
    .map(
      (c) => `
    <article class="conversation-row">
      <span class="conversation-user">${c.user}</span>
      <p class="conversation-summary">${c.summary}</p>
      <span class="badge urgency-badge ${URGENCY_CLASS[c.urgency]}">${URGENCY_ICON[c.urgency]}${c.urgency}</span>
      <span class="badge status-badge ${STATUS_CLASS[c.status]}">${c.status}</span>
      <span class="conversation-time">${c.time}</span>
    </article>
  `
    )
    .join('');
}

renderSummaryBar(MOCK_CONVERSATIONS);
renderConversations(MOCK_CONVERSATIONS);
