const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const history = document.getElementById('chat-history');

function appendMessage(text, role) {
  const el = document.createElement('div');
  el.className = `message ${role}`;
  el.textContent = text;
  history.appendChild(el);
  history.scrollTop = history.scrollHeight;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  appendMessage(message, 'user');
  input.value = '';
  input.disabled = true;

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
    appendMessage(data.reply, 'bot');
  } catch (err) {
    appendMessage('Ocurrio un error al contactar al agente. Intenta de nuevo.', 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
});
