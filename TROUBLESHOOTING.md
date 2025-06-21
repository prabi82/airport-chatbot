# 🔧 Troubleshooting Guide - Oman Airports AI Chatbot Demo

## 🚨 Common Issues and Solutions

### **1. "Sorry, I encountered an error" Message**

#### **Cause**: Port mismatch between demo page and development server

#### **Solution**:
1. **Check your development server port** in the terminal output:
   ```
   ▲ Next.js 15.3.4 (Turbopack)
   - Local:        http://localhost:3002  ← This is your port
   ```

2. **Visit the correct URL**:
   - If server is on port 3002: `http://localhost:3002/demo.html`
   - If server is on port 3001: `http://localhost:3001/demo.html`
   - If server is on port 3000: `http://localhost:3000/demo.html`

3. **The demo pages now auto-detect the port**, but ensure you're visiting the demo on the same port as the server.

### **2. Chat Widget Not Appearing**

#### **Possible Causes & Solutions**:

- **JavaScript Disabled**: Enable JavaScript in your browser
- **Server Not Running**: Start the development server:
  ```bash
  cd omanairports-chatbot
  npm run dev
  ```
- **Port Conflict**: Check if another application is using port 3000-3002
- **Cache Issues**: Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)

### **3. API Connection Errors**

#### **Check Connection Status**:
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for error messages like:
   ```
   Failed to fetch
   Connection refused
   CORS error
   ```

#### **Solutions**:
- **Server not running**: Restart the development server
- **Wrong port**: Use the correct port shown in terminal
- **CORS issues**: The demo should work on localhost, but ensure you're not accessing from a different domain

### **4. No Responses from Chatbot**

#### **Debug Steps**:
1. **Open Browser Console** (F12 → Console)
2. **Look for API logs**:
   ```
   Chat widget initialized with API URL: http://localhost:3002/api
   Creating session with API URL: http://localhost:3002/api/chat/session
   Session created successfully: abc123...
   ```

3. **Check Network Tab**:
   - Go to Network tab in Developer Tools
   - Send a message
   - Look for API calls to `/api/chat/send`
   - Check if they return 200 status

#### **Common Fixes**:
- **Restart the server**: Sometimes the API routes need a fresh start
- **Clear browser cache**: Hard refresh the page
- **Check terminal for errors**: Look for any error messages in the server terminal

### **5. Styling Issues**

#### **Symptoms**: Widget appears but looks broken or unstyled

#### **Solutions**:
- **Clear browser cache**: Hard refresh (Ctrl+F5)
- **Check CSS loading**: In Network tab, ensure `/widget/styles` loads successfully
- **Disable browser extensions**: Some ad blockers might interfere

### **6. Test Buttons Not Working**

#### **Check**:
1. **Widget is loaded**: Ensure the blue chat button appears
2. **Console errors**: Check for JavaScript errors in console
3. **Manual testing**: Try typing messages directly in the chat

#### **Fix**:
- **Refresh the page**: Sometimes the widget needs to reinitialize
- **Wait for full load**: Ensure the page is completely loaded before clicking test buttons

## 🔍 Debugging Tools

### **Browser Console Commands**
```javascript
// Check if widget is loaded
console.log(window.OmanAirportsChatWidget);

// Check configuration
console.log(window.omanairportsChatConfig);

// Test API manually
fetch('http://localhost:3002/api/chat/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ language: 'en' })
}).then(r => r.json()).then(console.log);
```

### **Network Tab Checks**
Look for these successful requests:
- ✅ `GET /widget/chat-widget.js` (200)
- ✅ `GET /widget/styles` (200)
- ✅ `POST /api/chat/session` (200)
- ✅ `POST /api/chat/send` (200)

## 🚀 Quick Reset Steps

If nothing works, try this complete reset:

1. **Stop the server**: Ctrl+C in terminal
2. **Clear browser cache**: Hard refresh or clear all data
3. **Restart server**:
   ```bash
   cd omanairports-chatbot
   npm run dev
   ```
4. **Wait for "Ready"** message in terminal
5. **Visit the correct URL**: Use the port shown in terminal
6. **Test with a simple message**: Try typing "Hello"

## 📞 Getting Help

### **Check These First**:
- ✅ Development server is running
- ✅ Using the correct port (check terminal)
- ✅ JavaScript is enabled
- ✅ No console errors
- ✅ Network requests are successful

### **Provide This Information**:
- Browser and version
- Port number from terminal
- Console error messages
- Network tab status codes
- What you were trying to do when the error occurred

## 🎯 Expected Behavior

### **Normal Flow**:
1. Page loads with status indicator
2. Blue chat button appears in bottom-right
3. Clicking opens the widget with welcome message
4. Typing messages gets immediate responses
5. Test buttons automatically send messages

### **Demo Features Working**:
- ⚡ Real-time typing indicators
- 🎯 Flight number recognition (WY123, OV456, etc.)
- 📱 Responsive design on mobile
- 🎨 Smooth animations
- ⌨️ Keyboard shortcuts (Enter to send)

---

**💡 Tip**: The demo is designed to work without any external dependencies. If you're still having issues, the problem is likely with the development server setup or browser configuration. 