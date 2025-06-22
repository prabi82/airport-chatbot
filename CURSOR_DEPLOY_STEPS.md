# Deploy from Cursor.ai to Vercel - Step by Step

## Prerequisites
- Make sure you have the Vercel CLI installed: `npm install -g vercel`
- Make sure you're logged into Vercel: `vercel login`

## Deployment Steps

### Step 1: Stop Development Server
First, stop any running development servers:
```bash
# Press Ctrl+C in the terminal running npm run dev
# OR force kill Node.js processes:
taskkill /F /IM node.exe
```

### Step 2: Navigate to Project Directory
```bash
cd E:\OneDrive\airport-chatboat\omanairports-chatbot
```

### Step 3: Check Git Status
```bash
git status
```

### Step 4: Add and Commit Changes
```bash
git add .
git commit -m "Deploy: Public transportation query fix and improvements from Cursor"
```

### Step 5: Push to GitHub
```bash
git push origin main
```

### Step 6: Deploy to Vercel
```bash
vercel --prod --yes
```

## Alternative: One-Line Deployment
After stopping the dev server, you can run this one command:
```bash
cd E:\OneDrive\airport-chatboat\omanairports-chatbot && git add . && git commit -m "Deploy from Cursor" && git push origin main && vercel --prod --yes
```

## Quick Deploy Script
Run the deployment script we created:
```bash
cd E:\OneDrive\airport-chatboat\omanairports-chatbot
.\deploy-from-cursor.bat
```

## Troubleshooting
- If commands don't work, the dev server might still be running
- Open a new terminal window (Ctrl+Shift+`) in Cursor
- Make sure you're in the correct directory
- Check that Vercel CLI is installed and you're logged in

## Expected Output
After successful deployment, you should see:
- Git commit confirmation
- GitHub push confirmation  
- Vercel deployment URL
- "Deployment Complete!" message

The live chatbot will be available at your Vercel URL (usually something like `https://your-project-name.vercel.app`) 