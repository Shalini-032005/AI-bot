// Chat Session Management
let currentChatId = null;
let messages = {
  history: []
};

const MAX_CHATS = 5;
const STORAGE_KEY = 'electroshop_chats';

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get all chats from localStorage
function getChats() {
  try {
    const chats = localStorage.getItem(STORAGE_KEY);
    return chats ? JSON.parse(chats) : [];
  } catch (error) {
    console.error('Error reading chats:', error);
    return [];
  }
}

// Save chats to localStorage (keep only MAX_CHATS most recent)
function saveChats(chats) {
  try {
    const sorted = chats.sort((a, b) => b.lastUpdated - a.lastUpdated);
    const limited = sorted.slice(0, MAX_CHATS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
    return limited;
  } catch (error) {
    console.error('Error saving chats:', error);
    return chats;
  }
}

// Save current chat
function saveCurrentChat() {
  if (messages.history.length === 0) return;
  
  const chats = getChats();
  const chatData = {
    id: currentChatId || Date.now().toString(),
    title: getChatTitle(),
    messages: [...messages.history],
    lastUpdated: Date.now()
  };
  
  // Remove existing chat if updating
  const filtered = chats.filter(c => c.id !== currentChatId);
  filtered.push(chatData);
  
  const saved = saveChats(filtered);
  currentChatId = chatData.id;
  renderChatHistory();
}

// Get chat title (first user message or default)
function getChatTitle() {
  const firstUserMsg = messages.history.find(m => m.role === 'user');
  if (firstUserMsg) {
    const text = firstUserMsg.parts?.[0]?.text || firstUserMsg.content || '';
    return text.substring(0, 40) + (text.length > 40 ? '...' : '');
  }
  return 'New Chat';
}

// Load a chat by ID
function loadChat(chatId) {
  const chats = getChats();
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  
  // Save current chat before loading new one
  if (currentChatId && currentChatId !== chatId && messages.history.length > 0) {
    saveCurrentChat();
  }
  
  currentChatId = chat.id;
  messages.history = [...chat.messages];
  
  // Render messages
  renderMessages();
  renderChatHistory();
  
  // Close history sidebar
  document.querySelector('.chat-history-sidebar').classList.remove('active');
}

// Start new chat
function startNewChat() {
  // Save current chat before starting new one
  if (messages.history.length > 0) {
    saveCurrentChat();
  }
  
  currentChatId = null;
  messages.history = [];
  
  const chatBox = document.getElementById('chatBox');
  chatBox.innerHTML = `
    <div class="model">
      <p>Hi! How can I help you with electronics today?</p>
    </div>
  `;
  
  renderChatHistory();
  document.querySelector('.chat-history-sidebar').classList.remove('active');
}

// Delete a chat
function deleteChat(chatId, event) {
  event.stopPropagation();
  if (confirm('Delete this chat?')) {
    const chats = getChats();
    const filtered = chats.filter(c => c.id !== chatId);
    saveChats(filtered);
    
    // If deleting current chat, start new one
    if (chatId === currentChatId) {
      startNewChat();
    } else {
      renderChatHistory();
    }
  }
}

// Render messages in chat box
function renderMessages() {
  const chatBox = document.getElementById('chatBox');
  chatBox.innerHTML = '';
  
  if (messages.history.length === 0) {
    chatBox.innerHTML = `
      <div class="model">
        <p>Hi! How can I help you with electronics today?</p>
      </div>
    `;
    return;
  }
  
  messages.history.forEach(msg => {
    if (msg.role === 'user') {
      const text = msg.parts?.[0]?.text || msg.content || '';
      chatBox.insertAdjacentHTML('beforeend', `
        <div class="user">
          <p>${escapeHtml(text)}</p>
        </div>
      `);
    } else if (msg.role === 'model' || msg.role === 'assistant') {
      const text = msg.parts?.[0]?.text || msg.content || '';
      chatBox.insertAdjacentHTML('beforeend', `
        <div class="model">
          <p>${escapeHtml(text)}</p>
        </div>
      `);
    }
  });
  
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Render chat history sidebar
function renderChatHistory() {
  const historyList = document.getElementById('historyList');
  const chats = getChats();
  
  if (chats.length === 0) {
    historyList.innerHTML = '<div class="no-chats">No chat history yet</div>';
    return;
  }
  
  const sorted = [...chats].sort((a, b) => b.lastUpdated - a.lastUpdated);
  
  historyList.innerHTML = sorted.map(chat => {
    const date = new Date(chat.lastUpdated);
    const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isActive = chat.id === currentChatId ? 'active' : '';
    
    return `
      <div class="history-item ${isActive}" data-chat-id="${chat.id}">
        <div class="history-item-content">
          <div class="history-title">${escapeHtml(chat.title)}</div>
          <div class="history-time">${timeStr}</div>
        </div>
        <button class="delete-chat" onclick="deleteChat('${chat.id}', event)">🗑️</button>
      </div>
    `;
  }).join('');
  
  // Add click listeners
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-chat')) {
        loadChat(item.dataset.chatId);
      }
    });
  });
}

// Send message function
async function sendMessage() {
  const inputEl = document.getElementById('chatInput');
  const chatBox = document.getElementById('chatBox');
  const userMessage = inputEl.value.trim();

  if (!userMessage) return;

  // Start new chat if no current chat
  if (!currentChatId && messages.history.length === 0) {
    currentChatId = Date.now().toString();
  }

  // clear input
  inputEl.value = "";

  // show user message
  chatBox.insertAdjacentHTML("beforeend", `
    <div class="user">
      <p>${escapeHtml(userMessage)}</p>
    </div>
  `);

  // Auto scroll
  chatBox.scrollTop = chatBox.scrollHeight;

  // loader
  chatBox.insertAdjacentHTML("beforeend", `
    <div class="loader"></div>
  `);

  try {
    // Send to backend
    const response = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        history: messages.history
      })
    });

    const data = await response.json();

    // remove loader
    document.querySelector(".loader")?.remove();

    // show model response
    const reply = data.reply || "Sorry, something went wrong.";
    chatBox.insertAdjacentHTML("beforeend", `
      <div class="model">
        <p>${escapeHtml(reply)}</p>
      </div>
    `);

    // update history
    messages.history.push({
      role: "user",
      parts: [{ text: userMessage }]
    });

    messages.history.push({
      role: "model",
      parts: [{ text: reply }]
    });

    // Save chat after each message
    saveCurrentChat();

    // Auto scroll after response
    chatBox.scrollTop = chatBox.scrollHeight;

  } catch (error) {
    document.querySelector(".loader")?.remove();
    chatBox.insertAdjacentHTML("beforeend", `
      <div class="error">
        <p>Network error. Please try again.</p>
      </div>
    `);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// Make deleteChat available globally for onclick
window.deleteChat = deleteChat;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  renderChatHistory();
  
  // send button
  document.getElementById('sendButton').addEventListener("click", sendMessage);

  // Enter key support
  document.getElementById('chatInput').addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // open chat
  document.querySelector(".chat-button").addEventListener("click", () => {
    document.querySelector("body").classList.add("chat-open");
  });

  // close chat
  document.querySelector(".chat-window button.close").addEventListener("click", () => {
    document.querySelector("body").classList.remove("chat-open");
  });

  // Toggle history sidebar
  document.querySelector(".history-toggle").addEventListener("click", () => {
    document.querySelector('.chat-history-sidebar').classList.toggle('active');
  });

  // Close history sidebar
  document.querySelector(".close-history").addEventListener("click", () => {
    document.querySelector('.chat-history-sidebar').classList.remove('active');
  });

  // New chat button
  document.querySelector(".new-chat").addEventListener("click", (e) => {
    e.stopPropagation();
    startNewChat();
  });
});