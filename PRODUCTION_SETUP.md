# Production Database Setup Guide

## Issue
The admin user credentials work locally but not in production. This is because the production database needs to be set up separately.

## Solution

### Step 1: Run Database Migration on Production

The production database needs the `admin_users` table without the `username` column.

**Option A: Using the migration script (if you have database access)**

1. Set your production DATABASE_URL:
   ```bash
   set DATABASE_URL=your_production_database_url
   ```

2. Run the migration:
   ```bash
   node migrate-remove-username.js
   ```

**Option B: Manual SQL (if using database management tool)**

Run this SQL on your production database:

```sql
-- Remove username column if it exists
ALTER TABLE admin_users DROP COLUMN IF EXISTS username;
DROP INDEX IF EXISTS admin_users_username_key;
```

### Step 2: Create Admin User on Production

1. Set your production DATABASE_URL:
   ```bash
   set DATABASE_URL=your_production_database_url
   ```

2. Run the setup script:
   ```bash
   node setup-production-admin.js
   ```

   Or set a custom password:
   ```bash
   set ADMIN_PASSWORD=your_secure_password
   node setup-production-admin.js
   ```

### Step 3: Verify Login

After setup, login with:
- **Email:** `admin@omanairports.co.om`
- **Password:** `admin123` (or your custom password)

## Alternative: Using Vercel Environment Variables

If your production database is accessible via environment variables in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Ensure `DATABASE_URL` is set to your production database
3. You can run the setup script locally with the production DATABASE_URL, or
4. Use Vercel's CLI to run a one-time script

## Quick Check

To verify if the admin user exists in production:

```bash
# Set production DATABASE_URL
set DATABASE_URL=your_production_database_url

# Check admin user
node check-admin-user.js
```

## Troubleshooting

### "Table does not exist"
- Run the migration script first: `node migrate-remove-username.js`

### "Username column exists"
- The migration hasn't been run. Run: `node migrate-remove-username.js`

### "Invalid credentials" after setup
- Clear browser cookies
- Try incognito/private browsing mode
- Verify the password was set correctly

### Connection errors
- Check DATABASE_URL is correct
- Verify database is accessible from your network
- Check firewall/security group settings

