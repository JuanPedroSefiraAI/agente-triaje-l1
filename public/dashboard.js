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

function renderSummaryBar(conversations) {
  const total = conversations.length;
  const urgentes = conversations.filter((c) => c.urgency === 'Alta').length;
  const resueltasIA = conversations.filter((c) => c.status === 'Resuelto por IA').length;
  const enCurso = conversations.filter((c) => c.status === 'En curso').length;

  const bar = document.getElementById('summary-bar');
  bar.innerHTML = `
    <span class="summary-item summary-total">${total} conversaciones</span>
    <span class="summary-sep">·</span>
    <span class="summary-item summary-urgent">${urgentes} urgentes</span>
    <span class="summary-sep">·</span>
    <span class="summary-item summary-resolved">${resueltasIA} resueltas por IA</span>
    <span class="summary-sep">·</span>
    <span class="summary-item summary-progress">${enCurso} en curso</span>
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
      <div class="conversation-main">
        <div class="conversation-top">
          <span class="conversation-user">${c.user}</span>
          <span class="conversation-time">${c.time}</span>
        </div>
        <p class="conversation-summary">${c.summary}</p>
      </div>
      <div class="conversation-tags">
        <span class="badge urgency-badge ${URGENCY_CLASS[c.urgency]}">${c.urgency}</span>
        <span class="badge status-badge ${STATUS_CLASS[c.status]}">${c.status}</span>
      </div>
    </article>
  `
    )
    .join('');
}

renderSummaryBar(MOCK_CONVERSATIONS);
renderConversations(MOCK_CONVERSATIONS);
