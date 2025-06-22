@echo off
echo ========================================
echo   Deploying Public Transportation Fix
echo ========================================

echo.
echo 📝 Step 1: Committing changes to Git...
git add .
git commit -m "Fix public transportation query classification - Reordered detectQueryType method to prioritize transportation queries before directions - Fixed issue where public transportation queries were incorrectly classified as directions - Added comprehensive test page for verification - Query now correctly returns public transportation information"

echo.
echo 📤 Step 2: Pushing to GitHub...
git push origin main

echo.
echo 🚀 Step 3: Deploying to Vercel...
npx vercel --prod --yes

echo.
echo ✅ Deployment completed!
echo.
echo 🧪 Test the fix:
echo 1. Visit your Vercel app URL
echo 2. Ask: "Is public transportation available from Muscat Airport?"
echo 3. Should get public transportation info (not highway directions)
echo.
echo 📱 Test page available at: /final-test.html
echo.
pause 