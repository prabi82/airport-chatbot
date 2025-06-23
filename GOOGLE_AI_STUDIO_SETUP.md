# Google AI Studio (Gemini API) Setup Guide

## 🚀 Quick Setup Instructions

### Step 1: Get Your FREE API Key

1. **Visit Google AI Studio**: https://aistudio.google.com/app/apikey
2. **Sign in** with your Google account (any Gmail account works)
3. **Click "Create API key"** button
4. **Copy the generated API key** (starts with "AIza...")

### Step 2: Add API Key to Environment

Add this line to your `.env.local` file:

```env
GEMINI_API_KEY="your_actual_api_key_here"
```

### Step 3: Test the Integration

Run the test script to verify everything works:

```bash
cd omanairports-chatbot
node test-gemini-api.js
```

## ✨ Google AI Studio Benefits

- **🆓 Completely FREE** - No credit card required
- **📊 Generous Limits**: 1,500 requests/day, 60 requests/minute  
- **🤖 Latest Models**: Gemini 2.0 Flash, Gemini Pro, and more
- **🚀 Fast Response**: Usually under 2 seconds
- **🔒 Secure**: Enterprise-grade Google infrastructure

## 🔧 Integration Details

The AI service has been updated to use Google AI Studio as the **primary provider**:

1. **Gemini API** (Primary) - Google AI Studio
2. **Hugging Face** (Fallback) - If Gemini fails
3. **Ollama** (Development) - Local AI for testing
4. **Intelligent Fallbacks** - Context-aware responses

## 📝 Current Configuration

Your `.env.local` should look like this:

```env
DATABASE_URL="postgresql://neondb_owner:npg_FX5ySurgUmt8@ep-flat-cell-a8edph3u-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"
JWT_SECRET="f8822c96a78217e9f8aa68ee0f635f01"
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3011"

# Google AI Studio (Gemini API) - FREE
GEMINI_API_KEY="your_actual_api_key_here"

# Hugging Face API Key (backup)
HUGGINGFACE_API_KEY="your_huggingface_api_key_here"
```

## 🧪 Testing Commands

### Test Gemini API Integration
```bash
node test-gemini-api.js
```

### Test Full AI Service
```bash
node test-ai-service.js
```

### Start Development Server
```bash
npm run dev -- --port 3011
```

## 🌟 Why Google AI Studio?

1. **No Hugging Face Issues**: Unlike HF which returned 404 errors
2. **Better Performance**: Faster and more reliable responses  
3. **Latest Technology**: Access to Google's newest AI models
4. **Production Ready**: Used by millions of developers worldwide
5. **Great Documentation**: Excellent API docs and community support

## 🔍 Troubleshooting

### API Key Issues
- Ensure the key starts with "AIza..."
- Check for extra spaces or quotes
- Try generating a new key if problems persist

### Rate Limiting
- Free tier: 60 requests/minute, 1,500/day
- Add delays between requests in production
- Monitor usage in Google AI Studio dashboard

### Network Issues
- Check internet connectivity
- Verify firewall settings
- Try from different network if needed

## 📊 Expected Test Results

When you run `node test-gemini-api.js`, you should see:

```
🚀 Testing Google AI Studio (Gemini API) Integration
============================================================
✅ API Key found, starting tests...

🔑 Validating API key...
✅ API key is valid and working
🔄 Running 5 test queries...

🧪 Testing: Flight Information
❓ Query: What are the operating hours of Muscat International Airport?
✅ Response (1247ms):
   Muscat International Airport operates 24 hours a day, 7 days a week. However, specific terminal facilities and services may have...

[Additional test results...]

============================================================
📊 Test Results: 5/5 successful
🎉 All tests passed! Gemini API is working perfectly.
✅ Your chatbot is ready to use Google AI Studio.
```

## 🎯 Next Steps

1. ✅ Get your API key from Google AI Studio
2. ✅ Add it to `.env.local`
3. ✅ Run the test script
4. ✅ Start your development server
5. ✅ Test the chatbot in your browser at http://localhost:3011
6. ✅ Deploy to Vercel when ready

Your Oman Airports AI Chatbot is now powered by Google's latest AI technology! 🚀 