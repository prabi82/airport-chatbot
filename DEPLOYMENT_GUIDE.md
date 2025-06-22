# Oman Airports Chatbot - Complete Deployment Guide

This guide provides step-by-step instructions for deploying the Oman Airports AI Chatbot from local development to production on Vercel via GitHub.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Step-by-Step Deployment Process](#step-by-step-deployment-process)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedures](#rollback-procedures)

## Prerequisites

### Required Tools
- **Node.js** (v18 or later)
- **npm** (comes with Node.js)
- **Git** (for version control)
- **Vercel CLI** (install with `npm install -g vercel`)

### Required Accounts
- **GitHub Account** (for code repository)
- **Vercel Account** (for hosting, can sign up with GitHub)

### Environment Setup
- **Database**: PostgreSQL database URL (DATABASE_URL)
- **APIs**: Any required API keys (if using external services)

## Pre-Deployment Checklist

### 1. Code Quality Checks
```bash
# Ensure you're in the project directory
cd omanairports-chatbot

# Install dependencies
npm install

# Run TypeScript compilation check
npm run build

# Run linting (if configured)
npm run lint
```

### 2. Database Schema Verification
Ensure your `prisma/schema.prisma` file is complete and includes all required models:
- ChatSession
- ChatMessage
- KnowledgeBase
- FlightCache
- FeedbackForm
- SupportAgent
- ScrapingCache
- ChatAnalytics

### 3. Environment Variables
Create/verify your `.env.production` file contains:
```env
DATABASE_URL="your-production-database-url"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="your-production-url"
# Add other required environment variables
```

## Step-by-Step Deployment Process

### Step 1: Stop Development Server
If you have a development server running, stop it first:
```bash
# Press Ctrl+C in the terminal running npm run dev
# OR force kill Node.js processes:
taskkill /F /IM node.exe  # Windows
# killall node            # macOS/Linux
```

### Step 2: Final Code Review and Testing
```bash
# Ensure all changes are working locally
npm run build

# Test the build locally (optional)
npm start
```

### Step 3: Commit Changes to Git
```bash
# Check current status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Deploy: [Brief description of changes]"

# Example:
git commit -m "Deploy: Fix public transportation query detection and TypeScript errors"
```

### Step 4: Push to GitHub
```bash
# Push to main branch
git push origin main

# If you encounter conflicts, resolve them:
# git pull origin main
# [Resolve conflicts]
# git add .
# git commit -m "Merge: Resolve conflicts"
# git push origin main
```

### Step 5: Deploy to Vercel
```bash
# Deploy to production
npx vercel --prod --yes

# Alternative: If you want to review before deploying
npx vercel --prod
```

### Step 6: Monitor Deployment
The Vercel CLI will provide:
- **Inspect URL**: For monitoring the deployment process
- **Production URL**: Your live application URL

Example output:
```
🔍  Inspect: https://vercel.com/username/project/deployment-id
✅  Production: https://your-app.vercel.app
```

## Troubleshooting Common Issues

### Issue 1: TypeScript Compilation Errors
**Symptoms**: Build fails with TypeScript errors
**Solution**:
```bash
# Check specific errors
npm run build

# Common fixes:
# - Ensure Prisma schema matches your code
# - Check interface definitions
# - Verify import statements
# - Run: npx prisma generate
```

### Issue 2: Missing Prisma Schema
**Symptoms**: "You don't have any datasource defined in your schema.prisma"
**Solution**:
```bash
# Verify schema.prisma has datasource block:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

# Regenerate Prisma client
npx prisma generate
```

### Issue 3: Git Push Conflicts
**Symptoms**: "Updates were rejected because the tip of your current branch is behind"
**Solution**:
```bash
# Pull latest changes
git pull origin main

# If conflicts exist, resolve them manually
# Then commit and push
git add .
git commit -m "Merge: Resolve conflicts"
git push origin main
```

### Issue 4: Vercel Deployment Fails
**Symptoms**: Build or deployment errors on Vercel
**Solution**:
```bash
# Check deployment logs
vercel logs [deployment-url]

# Common fixes:
# - Verify environment variables in Vercel dashboard
# - Check build settings
# - Ensure all dependencies are in package.json
```

### Issue 5: Database Connection Issues
**Symptoms**: Database connection errors in production
**Solution**:
1. Verify `DATABASE_URL` in Vercel environment variables
2. Ensure database is accessible from Vercel's servers
3. Check database connection limits
4. Verify SSL settings if required

## Post-Deployment Verification

### 1. Basic Functionality Test
```bash
# Visit your production URL
# Test basic chatbot functionality
# Verify API endpoints are working
```

### 2. Specific Feature Testing
Test the specific features that were deployed:
- Public transportation queries
- Flight information requests
- General airport information
- Database operations

### 3. Performance Monitoring
- Check response times
- Monitor error rates
- Verify caching is working

### 4. Database Health Check
```bash
# If you have admin endpoints, test them
# Verify database connections
# Check data persistence
```

## Rollback Procedures

### Option 1: Revert Git Commit
```bash
# Find the commit hash to revert to
git log --oneline

# Revert to previous commit
git revert [commit-hash]
git push origin main

# Deploy the reverted version
npx vercel --prod --yes
```

### Option 2: Vercel Dashboard Rollback
1. Go to Vercel dashboard
2. Select your project
3. Go to "Deployments" tab
4. Find the previous working deployment
5. Click "Promote to Production"

### Option 3: Quick Fix Deployment
```bash
# Make quick fixes
# Test locally
npm run build

# Quick deploy
git add .
git commit -m "Hotfix: [Description]"
git push origin main
npx vercel --prod --yes
```

## Best Practices

### 1. Always Test Locally First
```bash
npm run build
npm start  # Test the production build
```

### 2. Use Descriptive Commit Messages
```bash
git commit -m "Deploy: Add public transportation query fix and resolve TypeScript errors"
```

### 3. Deploy During Low Traffic Hours
- Plan deployments during off-peak hours
- Monitor for issues after deployment

### 4. Keep Environment Variables Secure
- Never commit `.env` files
- Use Vercel dashboard for production environment variables
- Rotate secrets regularly

### 5. Monitor After Deployment
- Check application logs
- Monitor error rates
- Test critical functionality

## Quick Reference Commands

### Complete Deployment (One-liner)
```bash
cd omanairports-chatbot && npm run build && git add . && git commit -m "Deploy: Latest updates" && git push origin main && npx vercel --prod --yes
```

### Emergency Rollback
```bash
git revert HEAD && git push origin main && npx vercel --prod --yes
```

### Check Deployment Status
```bash
vercel ls
vercel logs [deployment-url]
```

## Support and Contacts

- **Project Repository**: [GitHub Repository URL]
- **Production URL**: https://airport-chatbot-ej54r0t3v-prabikrishna-gmailcoms-projects.vercel.app
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## Recent Successful Deployment Example

**Date**: June 22, 2025
**Changes**: Fixed public transportation query detection and resolved TypeScript compilation errors
**Process**:
1. Fixed Prisma schema issues
2. Resolved field name mismatches (`sourceUrl` → `url`, `userIp` → `ipAddress`)
3. Removed non-existent `language` field from KnowledgeBase
4. Fixed TypeScript interface mismatches
5. Successfully built and deployed to production

**Result**: ✅ Successful deployment with all functionality working correctly

This deployment guide is based on real, tested procedures that have been successfully executed. 