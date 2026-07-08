const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const history = document.getElementById('chat-history');

function scrollToBottom() {
  history.scrollTop = history.scrollHeight;
}

function appendMessage(text, role) {
  const el = document.createElement('div');
  el.className = `message ${role}`;
  el.textContent = text;
  history.appendChild(el);
  scrollToBottom();
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

  showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
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
