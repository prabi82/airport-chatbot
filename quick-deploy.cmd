@echo off
cd /d "%~dp0"
echo Deploying to Vercel...
npx vercel --prod --yes
echo Deployment completed!
pause 