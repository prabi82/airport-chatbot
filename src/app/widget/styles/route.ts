import { NextResponse } from 'next/server';

export async function GET() {
  const css = `
/* Base Widget Styles */
.chat-widget {
  position: fixed;
  z-index: 9999;
  width: 350px;
  height: 500px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.chat-widget--open {
  transform: translateY(0);
  opacity: 1;
}

/* Position Variants */
.chat-widget--bottom-right {
  bottom: 20px;
  right: 20px;
}

.chat-widget--bottom-left {
  bottom: 20px;
  left: 20px;
}

/* Header Styles */
.chat-widget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #1e3a8a, #3b82f6);
  color: white;
  border-radius: 12px 12px 0 0;
  min-height: 60px;
}

.chat-widget__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.chat-widget__close {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-widget__close:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Body Styles */
.chat-widget__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-widget__messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

/* Message Styles */
.chat-message {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  animation: messageSlideIn 0.3s ease-out;
}

.chat-message--user {
  align-self: flex-end;
}

.chat-message--bot {
  align-self: flex-start;
}

.chat-message__content {
  padding: 14px 18px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
  position: relative;
}

.chat-message--user .chat-message__content {
  background: #3b82f6;
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-message--bot .chat-message__content {
  background: #f8fafc;
  color: #1e293b;
  border-bottom-left-radius: 4px;
  border: 1px solid #e2e8f0;
}

.chat-message__time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  align-self: flex-end;
}

/* Formatted Content Styles */
.chat-message__content strong {
  font-weight: 600;
  color: #1e40af;
}

.chat-message--user .chat-message__content strong {
  color: #bfdbfe;
}

.section-header {
  font-weight: 600;
  color: #1e40af;
  margin: 8px 0 4px 0;
  font-size: 14px;
}

.chat-message--user .section-header {
  color: #bfdbfe;
}

.message-header {
  font-weight: 700;
  color: #0f172a;
  margin: 12px 0 8px 0;
  font-size: 16px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 4px;
}

.chat-message--user .message-header {
  color: #f1f5f9;
  border-bottom-color: rgba(255, 255, 255, 0.3);
}

.bullet-point {
  margin: 2px 0;
  padding-left: 8px;
  line-height: 1.4;
}

.chat-message__content br {
  line-height: 1.8;
}

/* Enhanced spacing for better readability */
.chat-message--bot .chat-message__content {
  line-height: 1.6;
}

.chat-message--bot .chat-message__content > div:not(:last-child) {
  margin-bottom: 4px;
}

/* Input Styles */
.chat-widget__input-container {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.chat-widget__input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 24px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.chat-widget__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.chat-widget__send {
  width: 40px;
  height: 40px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
  flex-shrink: 0;
}

.chat-widget__send:hover {
  background: #2563eb;
  transform: scale(1.05);
}

.chat-widget__send:active {
  transform: scale(0.95);
}

/* Chat Button */
.chat-button {
  position: fixed;
  z-index: 9998;
  width: 60px;
  height: 60px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: buttonPulse 2s infinite;
}

.chat-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(59, 130, 246, 0.4);
}

.chat-button--bottom-right {
  bottom: 20px;
  right: 20px;
}

.chat-button--bottom-left {
  bottom: 20px;
  left: 20px;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 12px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes buttonPulse {
  0% {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
  }
  100% {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  }
}

/* Dark Theme */
.chat-widget--dark {
  background: #1f2937;
  color: white;
}

.chat-widget--dark .chat-message--bot .chat-message__content {
  background: #374151;
  color: #f9fafb;
  border-color: #4b5563;
}

.chat-widget--dark .section-header {
  color: #93c5fd;
}

.chat-widget--dark .message-header {
  color: #f1f5f9;
  border-bottom-color: #4b5563;
}

.chat-widget--dark .chat-widget__input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.chat-widget--dark .chat-widget__input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
}

/* Responsive Design */
@media (max-width: 480px) {
  .chat-widget {
    width: calc(100vw - 40px);
    height: calc(100vh - 40px);
    max-width: 400px;
    max-height: 600px;
  }
  
  .chat-button {
    width: 50px;
    height: 50px;
  }
  
  .chat-message {
    max-width: 90%;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .chat-widget,
  .chat-button,
  .chat-message {
    animation: none;
    transition: none;
  }
}
  `;

  return new NextResponse(css, {
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
} 