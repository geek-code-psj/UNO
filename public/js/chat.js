// public/js/chat.js — In-game chat module

function sendChat() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || !socket) return;

    socket.emit('chat:send', { message });
    input.value = '';
}

function sendEmoji(emoji) {
    if (!socket) return;
    socket.emit('chat:emoji', { emoji });
}

function addChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
    <span class="msg-author">${msg.username}</span>
    <span class="msg-text">${escapeHtml(msg.message)}</span>
  `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addSystemMessage(text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'chat-msg system-msg';
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
