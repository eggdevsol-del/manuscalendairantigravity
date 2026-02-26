# Quick Deployment Instructions

## Step 1: Create GitHub Repository (2 minutes)

1. Go to https://github.com/new
2. Repository name: `artist-booking-app` (or any name you prefer)
3. Set to **Public** or **Private** (your choice)
4. **DO NOT** initialize with README, .gitignore, or license
5. Click "Create repository"

## Step 2: Push Code to GitHub

After creating the repository, GitHub will show you a page with setup instructions. Copy the repository URL (it will look like `https://github.com/YOUR_USERNAME/artist-booking-app.git`).

Then run these commands in Manus:

```bash
cd /home/ubuntu/artist-booking-app

# Set your GitHub repository URL (replace with your actual URL)
git remote add origin https://github.com/YOUR_USERNAME/artist-booking-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note:** You'll be prompted for your GitHub username and password. For the password, you need to use a **Personal Access Token** (not your GitHub password).

### Creating a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "Artist Booking App Deploy"
4. Select scopes: `repo` (full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)
7. Use this token as your password when pushing to GitHub

## Step 3: Deploy to Render

1. Go to https://dashboard.render.com/
2. Sign up or log in (can use GitHub to sign in)
3. Click "New +" → "Blueprint"
4. Click "Connect account" to connect your GitHub
5. Select your `artist-booking-app` repository
6. Render will automatically detect the `render.yaml` file
7. Click "Apply" to start deployment

Render will automatically:

- Create a web service for your app
- Create a MySQL database
- Set up environment variables
- Deploy your app

## Step 4: Wait for Deployment

- First deployment takes 5-10 minutes
- You can watch the build logs in Render dashboard
- Once complete, you'll get a URL like: `https://artist-booking-app.onrender.com`

## Updating Your App from Manus

After initial setup, updating is simple:

```bash
cd /home/ubuntu/artist-booking-app

# Make your changes to the code...

# Commit and push
git add .
git commit -m "Description of your changes"
git push
```

Render will automatically detect the push and redeploy your app!

## Alternative: Manual Render Setup (No Blueprint)

If you prefer not to use the Blueprint:

### Create Web Service

1. In Render dashboard, click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name:** artist-booking-app
   - **Runtime:** Node
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `pnpm start`
   - **Plan:** Free

### Create Database

1. Click "New +" → "PostgreSQL" or "MySQL"
2. **Name:** artist-booking-db
3. **Plan:** Free
4. Click "Create Database"

### Link Database to Web Service

1. Go to your web service settings
2. Add environment variable:
   - **Key:** `DATABASE_URL`
   - **Value:** Copy the "Internal Database URL" from your database page

### Add Other Environment Variables

In your web service environment variables:

- `NODE_ENV` = `production`
- `JWT_SECRET` = (generate a random string, e.g., use https://randomkeygen.com/)
- `OAUTH_BASE_URL` = `https://vidabiz.butterfly-effect.dev`

### Deploy

Click "Manual Deploy" → "Deploy latest commit"

## Troubleshooting

**Authentication failed when pushing:**

- Make sure you're using a Personal Access Token, not your password
- Token needs `repo` scope

**Render build fails:**

- Check build logs in Render dashboard
- Ensure `package.json` has correct build scripts

**App crashes on Render:**

- Check application logs
- Verify all environment variables are set
- Ensure DATABASE_URL is correct

**Database connection fails:**

- Verify DATABASE_URL format
- Check database is running in Render dashboard

## Free Tier Limits

**Render Free Tier:**

- 750 hours/month runtime
- App sleeps after 15 min inactivity
- First request after sleep: 30-60 seconds
- 1GB RAM

For production with no downtime, upgrade to paid plan ($7/month).

## Need Help?

- Render Docs: https://render.com/docs
- GitHub Docs: https://docs.github.com
- Contact me through Manus for assistance!
