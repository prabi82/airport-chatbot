@echo off
echo 🚀 Deploying Oman Airports AI Chatbot to Vercel...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Check if git is initialized
if not exist ".git" (
    echo 📁 Initializing Git repository...
    git init
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Generate Prisma client
echo 🗄️ Generating Prisma client...
npx prisma generate

REM Build the project locally to check for errors
echo 🔨 Building project...
npm run build

if errorlevel 1 (
    echo ❌ Build failed. Please fix the errors before deploying.
    pause
    exit /b 1
)

REM Add all files to git
echo 📝 Adding files to git...
git add .

REM Commit changes
echo 💾 Committing changes...
git commit -m "Prepare for Vercel deployment - %date% %time%"

REM Check if remote origin exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo 🔗 Please add your GitHub repository URL:
    set /p repo_url="Enter GitHub repository URL (e.g., https://github.com/username/oman-airports-chatbot.git): "
    git remote add origin %repo_url%
)

REM Push to GitHub
echo ⬆️ Pushing to GitHub...
git push -u origin main

echo.
echo ✅ Code pushed to GitHub successfully!
echo.
echo 🎯 Next steps:
echo 1. Go to https://vercel.com/dashboard
echo 2. Click 'New Project'
echo 3. Import your GitHub repository
echo 4. Add these environment variables in Vercel:
echo    - DATABASE_URL: postgresql://neondb_owner:npg_FX5ySurgUmt8@ep-flat-cell-a8edph3u-pooler.eastus2.azure.neon.tech/neondb?sslmode=require
echo    - JWT_SECRET: a-long-random-secret-key
echo    - NODE_ENV: production
echo    - NEXT_PUBLIC_APP_URL: https://your-app-name.vercel.app
echo    - NEXT_PUBLIC_WIDGET_URL: https://your-app-name.vercel.app/widget
echo 5. Click 'Deploy'
echo.
echo 📖 For detailed instructions, see VERCEL_DEPLOYMENT_GUIDE.md
echo.
pause 