# 🔄 Data Synchronization Guide

## Overview
This guide explains how to manage and sync trained data between your local Railway database and production Neon database.

## 🏗️ **Setup Process**

### 1. Environment Variables Setup

Create/update your `.env` file with both database URLs:

```env
# Local Development (Railway)
DATABASE_URL="postgresql://username:password@railway-host:5432/railway_db"
RAILWAY_DATABASE_URL="postgresql://username:password@railway-host:5432/railway_db"

# Production (Neon)
NEON_DATABASE_URL="postgresql://neondb_owner:password@ep-flat-cell-a8edph3u-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

# Other environment variables...
GOOGLE_AI_API_KEY="your_api_key"
```

### 2. Railway Database Setup (First Time)

```bash
# Set up Railway database for local development
node setup-railway-db.js

# Run initial migration
npx prisma migrate deploy

# Seed with initial data
node seed-db.js
```

## 📊 **Data Synchronization Workflows**

### **Workflow 1: Train Data Locally → Deploy to Production**

This is the **recommended workflow** for maintaining data consistency:

```bash
# 1. Train/update data locally using Railway
npm run dev
# Use admin dashboard to train data, add knowledge, etc.

# 2. Deploy trained data to production
node deploy-trained-data.js
```

### **Workflow 2: Sync Production Data to Local**

When you need to pull production data to local:

```bash
# Interactive sync tool
node sync-data.js
# Choose option 2: Export from Neon → Import to Railway
```

### **Workflow 3: Backup & Restore**

```bash
# Create backup
node sync-data.js
# Choose option 3: Export data to JSON file

# Restore from backup
node sync-data.js  
# Choose option 4: Import data from JSON file
```

## 🚀 **Deployment Process**

### Quick Deploy Script (`deploy-trained-data.js`)

```bash
# Automatically syncs Railway → Neon
node deploy-trained-data.js
```

**What it does:**
- ✅ Tests both database connections
- 📤 Exports all trained data from Railway
- 💾 Creates automatic backup of production data
- 📥 Imports new trained data to Neon
- 🎉 Updates production chatbot with latest training

### Manual Sync Tool (`sync-data.js`)

```bash
# Interactive tool with multiple options
node sync-data.js
```

**Features:**
- 🔄 Bidirectional sync (Railway ↔ Neon)
- 💾 Export to JSON backup files
- 📁 Import from JSON backup files
- 🛡️ Safe with automatic backups

## 📋 **Data Types Synchronized**

| Data Type | Description | Impact |
|-----------|-------------|---------|
| **Knowledge Base** | FAQ entries, airport info | Direct chatbot responses |
| **Quick Responses** | Pre-defined answer templates | Response speed & consistency |
| **Scraping Cache** | Web-scraped content | Real-time data accuracy |
| **Support Agents** | Agent configurations | Handoff capabilities |

## 🔧 **Environment Configuration**

### Local Development (.env)
```env
# Primary database (Railway for local dev)
DATABASE_URL="postgresql://railway-url"

# Production database (for syncing)
NEON_DATABASE_URL="postgresql://neon-url"
```

### Production (Vercel)
```env
# Primary database (Neon for production)
DATABASE_URL="postgresql://neon-url"

# No need for RAILWAY_DATABASE_URL in production
```

## ⚡ **Quick Commands**

```bash
# Setup Railway database (first time)
node setup-railway-db.js

# Train data locally
npm run dev
# → Use admin dashboard at http://localhost:3000/admin/dashboard

# Deploy trained data to production
node deploy-trained-data.js

# Sync data between databases
node sync-data.js

# Test database connections
node test-db-connection.js
```

## 🛡️ **Safety Features**

### Automatic Backups
- Every deployment creates a timestamped backup
- Backups stored as JSON files locally
- Easy rollback if needed

### Connection Testing
- Scripts test connections before sync
- Clear error messages for troubleshooting
- Graceful failure handling

### Data Validation
- Preserves data relationships
- Handles date/time conversions
- Maintains data integrity

## 📈 **Best Practices**

### 1. **Development Workflow**
```
Local Training (Railway) → Test → Deploy (Neon) → Production
```

### 2. **Data Training**
- Train on Railway database locally
- Test thoroughly before deployment
- Use admin dashboard for training
- Deploy only tested data

### 3. **Backup Strategy**
- Automatic backups before each deployment
- Manual backups before major changes
- Keep recent backups for rollback

### 4. **Environment Separation**
- Railway = Local development & training
- Neon = Production & live chatbot
- Clear separation prevents accidents

## 🚨 **Troubleshooting**

### Connection Issues
```bash
# Test Railway connection
node -e "console.log(process.env.RAILWAY_DATABASE_URL)"

# Test Neon connection  
node -e "console.log(process.env.NEON_DATABASE_URL)"

# Test both connections
node test-db-connection.js
```

### Sync Failures
1. **Check environment variables** - Ensure both URLs are correct
2. **Test connections** - Both databases must be accessible
3. **Check permissions** - Verify database user permissions
4. **Review logs** - Check error messages for specific issues

### Data Inconsistencies
1. **Use backup files** - Restore from recent backup
2. **Manual verification** - Check data through admin dashboard
3. **Re-sync if needed** - Use sync tools to fix inconsistencies

## 📞 **Support**

If you encounter issues:

1. **Check this guide** - Most common issues covered
2. **Review error logs** - Scripts provide detailed error messages
3. **Test connections** - Use provided test scripts
4. **Check environment** - Verify all environment variables

## 🎯 **Summary**

**For Regular Development:**
1. Use Railway database locally
2. Train data through admin dashboard
3. Deploy to production with `node deploy-trained-data.js`
4. Production chatbot uses updated data immediately

**Key Benefits:**
- 🚀 Fast local development
- 🔄 Easy data synchronization  
- 🛡️ Automatic backups
- 📊 Production-ready deployment
- 🎯 Consistent data across environments 