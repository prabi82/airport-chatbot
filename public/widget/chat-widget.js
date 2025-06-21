class OmanAirportsChatWidget {
  constructor(config = {}) {
    // Auto-detect port if not provided
    const currentPort = window.location.port || '3000';
    const defaultApiUrl = `http://localhost:${currentPort}/api`;
    
    this.config = {
      apiUrl: config.apiUrl || defaultApiUrl,
      theme: config.theme || 'light',
      language: config.language || 'en',
      position: config.position || 'bottom-right',
      ...config
    };
    
    console.log('Chat widget initialized with API URL:', this.config.apiUrl);
    
    this.sessionId = null;
    this.isOpen = false;
    this.isTyping = false;
    
    this.init();
  }

  async init() {
    await this.loadStyles();
    this.createWidget();
    this.createChatButton();
    this.bindEvents();
    await this.createSession();
  }

  async loadStyles() {
    if (document.getElementById('chat-widget-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'chat-widget-styles';
    link.rel = 'stylesheet';
    link.href = `${this.config.apiUrl.replace('/api', '')}/widget/styles`;
    document.head.appendChild(link);
  }

  createWidget() {
    const widget = document.createElement('div');
    widget.id = 'omanairports-chat-widget';
    widget.className = `chat-widget chat-widget--${this.config.theme} chat-widget--${this.config.position}`;
    
    widget.innerHTML = `
      <div class="chat-widget__header">
        <div class="chat-widget__title">
          <span>✈️ Oman Airports Assistant</span>
        </div>
        <button class="chat-widget__close" id="chat-widget-close">×</button>
      </div>
      
      <div class="chat-widget__body">
        <div class="chat-widget__messages" id="chat-widget-messages">
          <div class="chat-message chat-message--bot">
            <div class="chat-message__content">
              Welcome to Oman Airports! How can I help you today?
            </div>
            <div class="chat-message__time">${new Date().toLocaleTimeString()}</div>
          </div>
        </div>
        
        <div class="chat-widget__input-container">
          <input type="text" 
                 class="chat-widget__input" 
                 id="chat-widget-input" 
                 placeholder="Type your message...">
          <button class="chat-widget__send" id="chat-widget-send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
  }

  createChatButton() {
    const button = document.createElement('div');
    button.id = 'omanairports-chat-button';
    button.className = `chat-button chat-button--${this.config.position}`;
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    
    document.body.appendChild(button);
  }

  bindEvents() {
    // Toggle chat
    document.getElementById('omanairports-chat-button')?.addEventListener('click', () => {
      this.toggleChat();
    });

    document.getElementById('chat-widget-close')?.addEventListener('click', () => {
      this.toggleChat();
    });

    // Send message
    document.getElementById('chat-widget-send')?.addEventListener('click', () => {
      this.sendMessage();
    });

    document.getElementById('chat-widget-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  async createSession() {
    try {
      console.log('Creating session with API URL:', `${this.config.apiUrl}/chat/session`);
      
      const response = await fetch(`${this.config.apiUrl}/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: this.config.language,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.sessionId = data.sessionId;
        console.log('Session created successfully:', this.sessionId);
      } else {
        throw new Error(data.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      this.addMessage('bot', `Connection error: ${error.message}. Please check if the server is running.`);
    }
  }

  async sendMessage() {
    const input = document.getElementById('chat-widget-input');
    const message = input.value.trim();
    
    if (!message) return;

    // Add user message
    this.addMessage('user', message);
    input.value = '';

    // Show typing
    this.showTyping();

    try {
      console.log('Sending message to:', `${this.config.apiUrl}/chat/send`);
      
      const response = await fetch(`${this.config.apiUrl}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        this.hideTyping();
        this.addMessage('bot', data.response);
        console.log('Message sent successfully, response time:', data.responseTime + 'ms');
      } else {
        throw new Error(data.error || 'Failed to send message');
      }

    } catch (error) {
      console.error('Chat error:', error);
      this.hideTyping();
      this.addMessage('bot', `Sorry, I encountered an error: ${error.message}. Please check your connection and try again.`);
    }
  }

  addMessage(type, content) {
    const messagesContainer = document.getElementById('chat-widget-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-message--${type}`;
    
    const time = new Date().toLocaleTimeString();
    
    // Format the content to preserve line breaks and handle markdown-style formatting
    const formattedContent = this.formatMessageContent(content);
    
    messageDiv.innerHTML = `
      <div class="chat-message__content">${formattedContent}</div>
      <div class="chat-message__time">${time}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  formatMessageContent(content) {
    // Escape HTML first
    const div = document.createElement('div');
    div.textContent = content;
    let escaped = div.innerHTML;
    
    // Convert line breaks to <br> tags
    escaped = escaped.replace(/\n/g, '<br>');
    
    // Convert **text** to bold
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points (•) to proper list items
    escaped = escaped.replace(/^• (.+)$/gm, '<div class="bullet-point">• $1</div>');
    
    // Convert markdown-style headers (## text) to styled headers
    escaped = escaped.replace(/^## (.+)$/gm, '<div class="message-header">$1</div>');
    
    // Convert sections with **Section:** pattern
    escaped = escaped.replace(/\*\*([^:]+):\*\*/g, '<div class="section-header">$1:</div>');
    
    return escaped;
  }

  showTyping() {
    if (this.isTyping) return;
    
    this.isTyping = true;
    const messagesContainer = document.getElementById('chat-widget-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message chat-message--bot chat-message--typing';
    typingDiv.id = 'chat-typing-indicator';
    
    typingDiv.innerHTML = `
      <div class="chat-message__content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;

    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTyping() {
    this.isTyping = false;
    const typingIndicator = document.getElementById('chat-typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  toggleChat() {
    const widget = document.getElementById('omanairports-chat-widget');
    const button = document.getElementById('omanairports-chat-button');
    
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      widget.classList.add('chat-widget--open');
      button.style.display = 'none';
      // Focus on input when opened
      setTimeout(() => {
        const input = document.getElementById('chat-widget-input');
        if (input) input.focus();
      }, 300);
    } else {
      widget.classList.remove('chat-widget--open');
      button.style.display = 'block';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Auto-initialize widget
if (typeof window !== 'undefined') {
  window.OmanAirportsChatWidget = OmanAirportsChatWidget;
  
  // Auto-initialize if config is present
  if (window.omanairportsChatConfig) {
    new OmanAirportsChatWidget(window.omanairportsChatConfig);
  }
} 