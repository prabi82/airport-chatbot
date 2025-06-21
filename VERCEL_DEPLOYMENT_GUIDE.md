# Oman Airports AI Chatbot - Vercel Deployment Guide

## Prerequisites

Before deploying to Vercel, ensure you have:
- ✅ Vercel account (you already have this)
- ✅ GitHub repository with your code
- ✅ Neon database configured and working
- ✅ Local development environment working

## Step 1: Prepare Your Project for Deployment

### 1.1 Create Environment Variables File Template
Create `.env.example` file in your project root:

```env
# Database Configuration
DATABASE_URL="your_neon_database_connection_string"

# Redis Configuration (Optional - can use Vercel KV)
REDIS_URL="redis://localhost:6379"

# Ollama Configuration (For local AI - won't work on Vercel)
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="llama2"

# Flight APIs (Optional - for real flight data)
AVIATIONSTACK_API_KEY="your_api_key_here"
AVIATIONSTACK_API_URL="http://api.aviationstack.com/v1"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-this"

# App Configuration
NEXT_PUBLIC_APP_URL="https://your-app-name.vercel.app"
NEXT_PUBLIC_WIDGET_URL="https://your-app-name.vercel.app/widget"

# Node Environment
NODE_ENV="production"
```

### 1.2 Update Next.js Configuration
Update your `next.config.ts` for Vercel deployment:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static exports for better performance
  output: 'standalone',
  
  // Optimize images
  images: {
    domains: ['localhost'],
    unoptimized: false,
  },
  
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['@prisma/client'],
  },
  
  // Environment variables
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/widget/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 1.3 Create Vercel Configuration
Create `vercel.json` in your project root:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 1.4 Update Package.json Scripts
Ensure your `package.json` has the correct build scripts:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "prisma generate"
  }
}
```

## Step 2: Push Code to GitHub

### 2.1 Initialize Git Repository (if not done)
```bash
cd omanairports-chatbot
git init
git add .
git commit -m "Initial commit - Oman Airports Chatbot"
```

### 2.2 Create GitHub Repository
1. Go to GitHub.com
2. Create new repository named `oman-airports-chatbot`
3. Don't initialize with README (since you already have files)

### 2.3 Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/oman-airports-chatbot.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

### 3.1 Import Project to Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in to your account

2. **Import Git Repository**
   - Click "New Project"
   - Choose "Import Git Repository"
   - Select your GitHub repository `oman-airports-chatbot`

3. **Configure Project Settings**
   - **Project Name**: `oman-airports-chatbot`
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### 3.2 Configure Environment Variables

In the Vercel project settings, add these environment variables:

**Required Variables:**
```
DATABASE_URL = postgresql://neondb_owner:npg_FX5ySurgUmt8@ep-flat-cell-a8edph3u-pooler.eastus2.azure.neon.tech/neondb?sslmode=require

JWT_SECRET = your-super-secret-jwt-key-make-it-long-and-random

NODE_ENV = production

NEXT_PUBLIC_APP_URL = https://your-app-name.vercel.app

NEXT_PUBLIC_WIDGET_URL = https://your-app-name.vercel.app/widget
```

**Optional Variables (for enhanced features):**
```
AVIATIONSTACK_API_KEY = your_flight_api_key_here
AVIATIONSTACK_API_URL = http://api.aviationstack.com/v1
```

### 3.3 Deploy the Project
1. Click "Deploy" button
2. Wait for the build process to complete
3. Your app will be available at `https://your-app-name.vercel.app`

## Step 4: Configure Database for Production

### 4.1 Update Prisma for Production
Your Prisma should already be configured, but ensure the schema is deployed:

```bash
# Run this locally to ensure schema is up to date
npx prisma generate
npx prisma db push
```

### 4.2 Seed Database (Optional)
If you want to add initial data:

```bash
# Create seed script in prisma/seed.ts
npx prisma db seed
```

## Step 5: Test Your Deployment

### 5.1 Test Basic Functionality
1. Visit your Vercel URL: `https://your-app-name.vercel.app`
2. Test the chat widget
3. Send a few messages
4. Check if responses work

### 5.2 Test API Endpoints
```bash
# Test session creation
curl -X POST https://your-app-name.vercel.app/api/chat/session \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}'

# Test message sending
curl -X POST https://your-app-name.vercel.app/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "sessionId": "your-session-id"}'
```

### 5.3 Test Widget Integration
Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Widget Test</title>
</head>
<body>
    <h1>Test Page</h1>
    
    <script>
        window.omanairportsChatConfig = {
            apiUrl: 'https://your-app-name.vercel.app/api',
            theme: 'light',
            language: 'en',
            position: 'bottom-right'
        };
    </script>
    <script src="https://your-app-name.vercel.app/widget/chat-widget.js"></script>
</body>
</html>
```

## Step 6: Configure Custom Domain (Optional)

### 6.1 Add Custom Domain
1. Go to Vercel project settings
2. Click "Domains"
3. Add your custom domain (e.g., `chatbot.omanairports.co.om`)
4. Configure DNS records as instructed

### 6.2 Update Environment Variables
Update the URLs in your environment variables:
```
NEXT_PUBLIC_APP_URL = https://chatbot.omanairports.co.om
NEXT_PUBLIC_WIDGET_URL = https://chatbot.omanairports.co.om/widget
```

## Step 7: Monitor and Maintain

### 7.1 Set Up Monitoring
1. **Vercel Analytics**: Enable in project settings
2. **Error Tracking**: Consider adding Sentry
3. **Uptime Monitoring**: Use services like UptimeRobot

### 7.2 Regular Updates
```bash
# Update dependencies
npm update

# Push updates
git add .
git commit -m "Update dependencies"
git push origin main
```

## Troubleshooting Common Issues

### Issue 1: Build Failures
```bash
# Check build logs in Vercel dashboard
# Common fixes:
npm install --legacy-peer-deps
npm run build
```

### Issue 2: Database Connection Issues
- Verify DATABASE_URL is correct
- Check Neon database is accessible
- Ensure connection pooling is configured

### Issue 3: Environment Variables Not Working
- Ensure variables are set in Vercel dashboard
- Check variable names match exactly
- Redeploy after adding variables

### Issue 4: CORS Issues
- Update next.config.ts headers
- Check API routes have proper CORS handling

## Performance Optimization

### 7.1 Enable Vercel Speed Insights
```bash
npm install @vercel/speed-insights
```

Add to your layout:
```typescript
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 7.2 Enable Vercel Analytics
```bash
npm install @vercel/analytics
```

## Security Considerations

1. **Environment Variables**: Never commit `.env.local` to Git
2. **API Keys**: Use Vercel's secure environment variables
3. **Database**: Ensure Neon database has proper access controls
4. **CORS**: Configure properly for your domains

## Cost Optimization

1. **Vercel Pro Plan**: Consider if you need more than hobby limits
2. **Database**: Monitor Neon usage
3. **API Calls**: Implement caching to reduce external API calls

## Next Steps After Deployment

1. **Add Analytics**: Track usage and performance
2. **Add Monitoring**: Set up alerts for downtime
3. **Add Backup**: Regular database backups
4. **Add CI/CD**: Automated testing and deployment
5. **Add Documentation**: User guides and API docs

## Support and Resources

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Documentation**: [nextjs.org/docs](https://nextjs.org/docs)
- **Prisma Documentation**: [prisma.io/docs](https://prisma.io/docs)
- **Neon Documentation**: [neon.tech/docs](https://neon.tech/docs)

---

Your Oman Airports AI Chatbot should now be successfully deployed to Vercel! 🚀

The deployed chatbot will be accessible at your Vercel URL and can be embedded into any website using the widget script. 