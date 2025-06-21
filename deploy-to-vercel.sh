#!/bin/bash

# Oman Airports AI Chatbot - Vercel Deployment Script
echo "🚀 Deploying Oman Airports AI Chatbot to Vercel..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Build the project locally to check for errors
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors before deploying."
    exit 1
fi

# Add all files to git
echo "📝 Adding files to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Prepare for Vercel deployment - $(date)"

# Check if remote origin exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Please add your GitHub repository URL:"
    read -p "Enter GitHub repository URL (e.g., https://github.com/username/oman-airports-chatbot.git): " repo_url
    git remote add origin "$repo_url"
fi

# Push to GitHub
echo "⬆️ Pushing to GitHub..."
git push -u origin main

echo "✅ Code pushed to GitHub successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Go to https://vercel.com/dashboard"
echo "2. Click 'New Project'"
echo "3. Import your GitHub repository"
echo "4. Add these environment variables in Vercel:"
echo "   - DATABASE_URL: your_neon_database_connection_string"
echo "   - JWT_SECRET: a-long-random-secret-key"
echo "   - NODE_ENV: production"
echo "   - NEXT_PUBLIC_APP_URL: https://your-app-name.vercel.app"
echo "   - NEXT_PUBLIC_WIDGET_URL: https://your-app-name.vercel.app/widget"
echo "5. Click 'Deploy'"
echo ""
echo "📖 For detailed instructions, see VERCEL_DEPLOYMENT_GUIDE.md" 