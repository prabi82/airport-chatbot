@echo off
echo ========================================
echo Oman Airports Chatbot - Cursor Deployment
echo ========================================

echo Step 1: Stopping any running Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

echo Step 2: Checking Git status...
git status

echo Step 3: Adding all changes...
git add .

echo Step 4: Committing changes...
git commit -m "Deploy: Public transportation query fix and improvements"

echo Step 5: Pushing to GitHub...
git push origin main

echo Step 6: Installing Vercel CLI (if not already installed)...
npm install -g vercel

echo Step 7: Deploying to Vercel...
vercel --prod --yes

echo ========================================
echo Deployment Complete!
echo ========================================
pause 