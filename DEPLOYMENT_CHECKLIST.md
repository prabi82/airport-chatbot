# Vercel Deployment Checklist ✅

## Pre-Deployment Checklist

- [ ] ✅ Project builds successfully locally (`npm run build`)
- [ ] ✅ Database is connected and working (Neon PostgreSQL)
- [ ] ✅ Environment variables are ready
- [ ] ✅ GitHub repository is created
- [ ] ✅ Vercel account is ready

## Quick Deployment Steps

### 1. Prepare and Push to GitHub
```bash
# Run the deployment script
deploy-to-vercel.bat

# Or manually:
git init
git add .
git commit -m "Initial deployment"
git remote add origin https://github.com/YOUR_USERNAME/oman-airports-chatbot.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository
4. Configure project settings:
   - **Project Name**: `oman-airports-chatbot`
   - **Framework**: Next.js (auto-detected)
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`

### 3. Add Environment Variables
In Vercel project settings, add:

```env
DATABASE_URL=postgresql://neondb_owner:npg_FX5ySurgUmt8@ep-flat-cell-a8edph3u-pooler.eastus2.azure.neon.tech/neondb?sslmode=require

JWT_SECRET=your-super-secret-jwt-key-make-it-long-and-random

NODE_ENV=production

NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app

NEXT_PUBLIC_WIDGET_URL=https://your-app-name.vercel.app/widget
```

### 4. Deploy
- Click **"Deploy"**
- Wait for build to complete
- Your app will be live at `https://your-app-name.vercel.app`

## Post-Deployment Testing

### Test Basic Functionality
- [ ] Main page loads: `https://your-app-name.vercel.app`
- [ ] Chat widget appears and works
- [ ] Can send messages and receive responses
- [ ] Database connections work

### Test API Endpoints
```bash
# Test session creation
curl -X POST https://your-app-name.vercel.app/api/chat/session \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}'

# Test message sending
curl -X POST https://your-app-name.vercel.app/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "sessionId": "test-session"}'
```

### Test Widget Integration
Create test HTML file:
```html
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
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

## Troubleshooting Common Issues

### Build Failures
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript errors are fixed

### Database Connection Issues
- Verify `DATABASE_URL` is correct in Vercel environment variables
- Check Neon database is accessible
- Ensure database schema is deployed

### Environment Variables Not Working
- Verify variables are set in Vercel dashboard
- Check variable names match exactly
- Redeploy after adding/changing variables

### Widget Not Loading
- Check CORS headers in `next.config.ts`
- Verify widget JavaScript file is accessible
- Check browser console for errors

## Performance Optimization

### After Successful Deployment
- [ ] Enable Vercel Analytics
- [ ] Set up error monitoring (Sentry)
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring alerts
- [ ] Test performance with multiple users

## Security Checklist

- [ ] Environment variables are secure
- [ ] Database has proper access controls
- [ ] API endpoints have rate limiting
- [ ] CORS is properly configured
- [ ] JWT secrets are strong and unique

## Maintenance

### Regular Tasks
- Monitor application performance
- Check error logs regularly
- Update dependencies monthly
- Backup database regularly
- Monitor usage and costs

---

## Quick Reference

**Your Vercel App URL**: `https://your-app-name.vercel.app`
**Widget Script**: `https://your-app-name.vercel.app/widget/chat-widget.js`
**API Base URL**: `https://your-app-name.vercel.app/api`

**Support Resources**:
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://prisma.io/docs)
- [Neon Documentation](https://neon.tech/docs) 