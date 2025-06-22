@echo off
echo 🚀 Direct Deployment to Vercel...
echo.

REM Navigate to project directory
cd /d "%~dp0"

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ Error: package.json not found
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
call npm install

echo 🗄️ Generating Prisma client...
call npx prisma generate

echo 🔨 Building project...
call npm run build

if errorlevel 1 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo 🚀 Deploying to Vercel...
call npx vercel --prod --yes

echo ✅ Deployment completed!
echo.
echo 🧪 Test your deployment:
echo 1. Visit the URL provided by Vercel
echo 2. Test the public transportation query fix
echo 3. Check /final-test.html for comprehensive testing
echo.
pause 