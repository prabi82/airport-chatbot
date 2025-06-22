Write-Host "========================================" -ForegroundColor Green
Write-Host "Oman Airports Chatbot - Cursor Deployment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Step 1: Stop Node.js processes
Write-Host "Step 1: Stopping Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Step 2: Navigate to project directory
Set-Location -Path "E:\OneDrive\airport-chatboat\omanairports-chatbot"

# Step 3: Check Git status
Write-Host "Step 2: Checking Git status..." -ForegroundColor Yellow
git status

# Step 4: Add all changes
Write-Host "Step 3: Adding all changes..." -ForegroundColor Yellow
git add .

# Step 5: Commit changes
Write-Host "Step 4: Committing changes..." -ForegroundColor Yellow
git commit -m "Deploy: Public transportation query fix and improvements from Cursor"

# Step 6: Push to GitHub
Write-Host "Step 5: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

# Step 7: Deploy to Vercel
Write-Host "Step 6: Deploying to Vercel..." -ForegroundColor Yellow
npx vercel --prod --yes

Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green 