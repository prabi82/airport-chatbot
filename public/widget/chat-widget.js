// Oman Airports Chat Widget v2.1.0 - With Source Links Support
// Last updated: 2025-01-27
console.log('🔧 Loading Oman Airports Chat Widget v2.1.0 with Source Links Support');

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
    
    // Check if we're in iframe mode
    const isIframe = this.config.iframeMode || window !== window.top;
    
    if (isIframe) {
      // Full screen mode for iframe
      widget.className = `chat-widget chat-widget--${this.config.theme} chat-widget--iframe`;
      widget.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        transform: none !important;
        opacity: 1 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        z-index: 9999 !important;
      `;
    } else {
      // Normal widget mode
      widget.className = `chat-widget chat-widget--${this.config.theme} chat-widget--${this.config.position}`;
    }
    
    widget.innerHTML = `
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
    
    // Auto-open in iframe mode
    if (isIframe) {
      this.isOpen = true;
      widget.classList.add('chat-widget--open');
    }
  }

  createChatButton() {
    // Don't create chat button in iframe mode
    const isIframe = this.config.iframeMode || window !== window.top;
    if (isIframe) {
      return;
    }
    
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
    // Toggle chat (only for chat button, no close button)
    document.getElementById('omanairports-chat-button')?.addEventListener('click', () => {
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
        
        // Always use enhanced processing approach (bulletproof solution)
        console.log('🔧 Using enhanced processing approach');
        this.addMessage('bot', data.response);
        
        // Add source links if available
        if (data.sources && data.sources.length > 0) {
          console.log('📚 Sources detected:', data.sources);
          this.addSourceLinks(data.sources);
        }
        
        console.log('Message sent successfully, response time:', data.responseTime + 'ms');
        if (data.links && data.links.length > 0) {
          console.log('📊 Links detected in response:', data.links.length);
        }
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
    
    // Create content div first
    const contentDiv = document.createElement('div');
    contentDiv.className = 'chat-message__content';
    
    // Format and set the content using innerHTML (bulletproof approach)
    const formattedContent = this.formatMessageContent(content);
    contentDiv.innerHTML = formattedContent;
    
    // Create time div
    const timeDiv = document.createElement('div');
    timeDiv.className = 'chat-message__time';
    timeDiv.textContent = time;
    
    // Append both to message div
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    // Append to messages container
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Add thumbs up/down for bot messages
    if (type === 'bot') {
      const actions = document.createElement('div');
      actions.style.marginTop = '6px';
      actions.innerHTML = `
        <button class="thumb-btn" data-feedback="up" title="Helpful" style="margin-right:8px">👍</button>
        <button class="thumb-btn" data-feedback="down" title="Not helpful">👎</button>
      `;
      contentDiv.appendChild(actions);
      actions.querySelectorAll('.thumb-btn').forEach(btn=>{
        btn.addEventListener('click', async () => {
          const isHelpful = btn.getAttribute('data-feedback') === 'up';
          try {
            await fetch(`${this.config.apiUrl}/chat/send`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: this.sessionId, isHelpful })
            });
            actions.innerHTML = isHelpful ? 'Thanks for your feedback!' : 'Feedback noted.';
          } catch (e) {
            console.error('Feedback error', e);
          }
        });
      });
      
      // Add disclaimer after bot messages
      this.addDisclaimer();
    }

    // Log for debugging
    console.log('✅ Message added:', {
      type,
      originalContent: content,
      formattedContent,
      htmlContent: contentDiv.innerHTML
    });
  }

  formatMessageContent(content) {
    if (!content) return '';
    
    console.log('🔧 Formatting input:', content);
    
    let result = String(content);
    
    // Step 1: Convert [text](url) to clickable links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, text, url) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${text}</a>`;
    });
    
    // Step 2: Split into lines for processing
    const lines = result.split('\n');
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Empty line = spacing
      if (!trimmed) {
        processedLines.push('<div style="margin: 8px 0;"></div>');
        continue;
      }
      
      // Check if line is a section header (entire line is bold text like **📍 Location:**)
      const boldMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        // This is a section header
        const headerText = boldMatch[1];
        processedLines.push(`<div style="margin-top: 16px; margin-bottom: 8px; font-weight: 600; font-size: 1.05em; color: #1e40af;">${headerText}</div>`);
        continue;
      }
      
      // Check if line starts with bullet point
      if (trimmed.match(/^[•\-]\s+/)) {
        const content = trimmed.replace(/^[•\-]\s+/, '');
        // Convert any remaining bold text in the bullet point
        const formattedContent = content.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #1e40af;">$1</strong>');
        processedLines.push(`<div style="margin: 4px 0; padding-left: 24px; position: relative; line-height: 1.6;">• ${formattedContent}</div>`);
        continue;
      }
      
      // Regular line - convert bold text and preserve
      const formattedLine = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #1e40af;">$1</strong>');
      processedLines.push(`<div style="margin: 4px 0; line-height: 1.6;">${formattedLine}</div>`);
    }
    
    // Join all processed lines
    result = processedLines.join('');
    
    console.log('🔧 Formatting output:', result);
    
    return result;
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

  // Alternative approach: Add a separate message for links
  addLinkMessage(links) {
    if (!links || links.length === 0) return;
    
    const messagesContainer = document.getElementById('chat-widget-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message chat-message--bot chat-message--links';
    
    const time = new Date().toLocaleTimeString();
    
    const linksHtml = links.map(link => 
      `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="chat-link">🔗 ${link.text}</a>`
    ).join('<br>');
    
    messageDiv.innerHTML = `
      <div class="chat-message__content">
        <div class="source-link-container">
          <strong>📚 Useful Links:</strong><br>
          ${linksHtml}
        </div>
      </div>
      <div class="chat-message__time">${time}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Enhanced addMessage that can handle content with separate links
  addMessageWithLinks(type, content, links = null) {
    // Add main message
    this.addMessage(type, content);
    
    // Add links as separate message if provided
    if (links && links.length > 0) {
      setTimeout(() => {
        this.addLinkMessage(links);
      }, 500); // Small delay for better UX
    }
  }

  // Add source links as a separate message
  addSourceLinks(sources) {
    console.log('🔗 addSourceLinks called with:', sources);
    
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      console.log('❌ No valid sources to display');
      return;
    }

    const messagesContainer = document.getElementById('chat-widget-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message chat-message--bot chat-message--sources';
    
    const time = new Date().toLocaleTimeString();
    
    // Create source links HTML
    const sourceLinksHtml = sources.map(sourceUrl => {
      const displayName = this.getSourceDisplayName(sourceUrl);
      console.log(`🔗 Creating source link: ${sourceUrl} -> ${displayName}`);
      return `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: #059669; text-decoration: none; display: block; margin: 4px 0; padding: 4px 8px; background: #f0fdf4; border-radius: 4px; border-left: 3px solid #059669;">🔗 ${displayName}</a>`;
    }).join('');
    
    messageDiv.innerHTML = `
      <div class="chat-message__content">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-top: 8px;">
          <div style="color: #059669; font-weight: 600; margin-bottom: 8px;">📚 Official Sources</div>
          ${sourceLinksHtml}
        </div>
      </div>
      <div class="chat-message__time">${time}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    console.log('✅ Source links added successfully');
  }

  // Convert source URLs to friendly display names
  getSourceDisplayName(url) {
    if (!url) return 'Source';
    
    try {
      // Remove protocol and domain
      const path = url.replace(/^https?:\/\/[^\/]+/, '');
      
      // Common patterns for Oman Airports website
      if (path.includes('restaurants')) return 'Restaurants & Quick Bites';
      if (path.includes('shopping')) return 'Shopping';
      if (path.includes('services')) return 'Airport Services';
      if (path.includes('transport')) return 'Transportation';
      if (path.includes('parking')) return 'Parking Information';
      if (path.includes('flights')) return 'Flight Information';
      if (path.includes('arrivals')) return 'Arrivals';
      if (path.includes('departures')) return 'Departures';
      if (path.includes('facilities')) return 'Airport Facilities';
      if (path.includes('contact')) return 'Contact Information';
      
      // Extract from path if possible
      const segments = path.split('/').filter(s => s.length > 0);
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        // Convert kebab-case to Title Case
        return lastSegment
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
      
      return 'Official Source';
    } catch (error) {
      console.error('Error processing source URL:', error);
      return 'Official Source';
    }
  }

  // Add disclaimer after bot messages
  addDisclaimer() {
    const messagesContainer = document.getElementById('chat-widget-messages');
    const disclaimerDiv = document.createElement('div');
    disclaimerDiv.className = 'chat-message chat-message--bot chat-message--disclaimer';
    
    const time = new Date().toLocaleTimeString();
    
    disclaimerDiv.innerHTML = `
      <div class="chat-message__content">
        <div class="disclaimer-container">
          <div class="disclaimer-text">
            <strong>⚠️ Disclaimer:</strong> This is AI generated content, to ensure accuracy and get the latest information please visit the website . For further inquiries, please contact Customer Service at <a href="tel:+96824351234" class="disclaimer-phone">+968 24351234</a>
          </div>
        </div>
      </div>
      <div class="chat-message__time">${time}</div>
    `;

    messagesContainer.appendChild(disclaimerDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    console.log('✅ Disclaimer added successfully');
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
