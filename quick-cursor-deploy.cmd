@echo off
title Oman Airports Chatbot - Cursor Deployment
color 0A

echo.
echo ==========================================
echo  OMAN AIRPORTS CHATBOT - CURSOR DEPLOY
echo ==========================================
echo.

echo [1/6] Stopping development server...
taskkill /F /IM node.exe >nul 2>&1
ping 127.0.0.1 -n 3 >nul

echo [2/6] Navigating to project directory...
cd /d "E:\OneDrive\airport-chatboat\omanairports-chatbot"

echo [3/6] Adding changes to Git...
git add .

echo [4/6] Committing changes...
git commit -m "Deploy: Public transportation fix from Cursor.ai"

echo [5/6] Pushing to GitHub...
git push origin main

echo [6/6] Deploying to Vercel...
npx vercel --prod --yes

echo.
echo ==========================================
echo  DEPLOYMENT COMPLETED SUCCESSFULLY!
echo ==========================================
echo.
echo Your chatbot is now live on Vercel!
echo.
pause 