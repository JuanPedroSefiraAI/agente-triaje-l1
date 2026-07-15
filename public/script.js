const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const history = document.getElementById('chat-history');
const newChatBtn = document.getElementById('new-chat-btn');

const STORAGE_KEY = 'sefira_chat_history';

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveStoredMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    // localStorage no disponible (modo privado, cuota, etc.): se ignora.
  }
}

let storedMessages = loadStoredMessages();

function scrollToBottom() {
  history.scrollTop = history.scrollHeight;
}

function appendMessage(text, role, options = {}) {
  const { persist = true } = options;
  const el = document.createElement('div');
  el.className = `message ${role}`;
  el.textContent = text;
  history.appendChild(el);

  if (persist) {
    storedMessages.push({ text, role });
    saveStoredMessages(storedMessages);
  }

  scrollToBottom();
}

function renderStoredMessages() {
  if (!storedMessages.length) return;
  for (const msg of storedMessages) {
    appendMessage(msg.text, msg.role, { persist: false });
  }
  scrollToBottom();
}

function startNewConversation() {
  storedMessages = [];
  saveStoredMessages(storedMessages);
  history.innerHTML = '';
}

renderStoredMessages();

newChatBtn.addEventListener('click', () => {
  startNewConversation();
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Simulación visual de auto-diagnóstico de conexión (solo demo, sin llamadas reales) ---

const CONNECTIVITY_TRIGGER_PATTERNS = [
  /\bno tengo internet\b/,
  /\bno tengo conexion\b/,
  /\bsin internet\b/,
  /\bsin conexion\b/,
];

function normalizeForMatch(str) {
  return str
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u');
}

function isConnectivityTrigger(message) {
  const normalized = normalizeForMatch(message);
  return CONNECTIVITY_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
}

// Palabras clave de otros temas frecuentes (contraseña, accesos) que, si
// aparecen junto al trigger de conexión, indican que el usuario reporta
// varias incidencias a la vez y no solo un problema de conexión.
const OTHER_ISSUE_PATTERNS = [
  /\bcontrasena/,
  /\bpassword\b/,
  /\bolvide\b/,
  /\bolvido\b/,
  /\bacceso a\b/,
  /\baccesos\b/,
  /\bpermiso[s]? (a|para|de)\b/,
  /\bcarpeta[s]?\b/,
];

// Conectores que suelen introducir un problema adicional en el mismo mensaje.
const MULTI_ISSUE_CONNECTORS = [/\bademas\b/, /\btambien\b/, /\by (encima|tampoco)\b/];

function hasOtherIssuesBesidesConnectivity(message) {
  const normalized = normalizeForMatch(message);
  return (
    OTHER_ISSUE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    MULTI_ISSUE_CONNECTORS.some((pattern) => pattern.test(normalized))
  );
}

const CONNECTIVITY_DIAGNOSTIC_STEPS = [
  { icon: '⏳', text: 'Comprobando estado de la red local...', status: 'pending' },
  { icon: '✅', text: 'Conexión local: OK', status: 'ok' },
  { icon: '⏳', text: 'Verificando resolución DNS...', status: 'pending' },
  { icon: '✅', text: 'DNS: OK', status: 'ok' },
  { icon: '⏳', text: 'Comprobando estado del proveedor de internet...', status: 'pending' },
  { icon: '⚠️', text: 'Incidencia detectada en el proveedor (zona: oficina central)', status: 'warn' },
];

const CONNECTIVITY_FINAL_MESSAGE =
  'El diagnóstico automático descarta un problema en tu equipo o red local: la incidencia está en el proveedor de internet. Esto ya se ha escalado como caída de proveedor, no como incidencia individual — no hace falta abrir ticket.';

async function runConnectivityDiagnostic() {
  const bubble = document.createElement('div');
  bubble.className = 'message bot diagnostic-bubble';
  history.appendChild(bubble);
  scrollToBottom();

  const renderedLines = [];

  for (const step of CONNECTIVITY_DIAGNOSTIC_STEPS) {
    await delay(650 + Math.random() * 150); // 650-800ms
    const lineEl = document.createElement('div');
    lineEl.className = `diag-line diag-${step.status}`;
    lineEl.textContent = `${step.icon} ${step.text}`;
    bubble.appendChild(lineEl);
    renderedLines.push(lineEl.textContent);
    scrollToBottom();
  }

  // Se persiste como texto plano para que sobreviva a un refresco de página.
  storedMessages.push({ text: renderedLines.join('\n'), role: 'bot' });
  saveStoredMessages(storedMessages);

  await delay(500);
  appendMessage(CONNECTIVITY_FINAL_MESSAGE, 'bot');
}

function showTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typing-indicator';
  el.innerHTML = '<span></span><span></span><span></span>';
  history.appendChild(el);
  scrollToBottom();
}

function hideTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  appendMessage(message, 'user');
  input.value = '';
  input.disabled = true;

  const connectivityIsMainIssue = isConnectivityTrigger(message) && !hasOtherIssuesBesidesConnectivity(message);

  if (connectivityIsMainIssue) {
    await runConnectivityDiagnostic();
    input.disabled = false;
    input.focus();
    return;
  }

  // Si el trigger de conexión saltó pero el mensaje trae más incidencias,
  // se avisa al backend para que el agente las reconozca todas en vez de
  // quedarse solo con la de conexión.
  const multipleIssues = isConnectivityTrigger(message) && hasOtherIssuesBesidesConnectivity(message);

  showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, multipleIssues }),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();
    hideTypingIndicator();
    appendMessage(data.reply, 'bot');
  } catch (err) {
    hideTypingIndicator();
    appendMessage('Ocurrio un error al contactar al agente. Intenta de nuevo.', 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
});
