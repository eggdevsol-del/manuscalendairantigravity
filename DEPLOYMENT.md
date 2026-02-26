# Deployment Guide

## Deploy to Render

This application is configured for deployment to Render.com with the following setup:

### Prerequisites

- GitHub account
- Render account (free tier available)

### Deployment Steps

#### 1. Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit for deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/artist-booking-app.git
git branch -M main
git push -u origin main
```

#### 2. Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" and select "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and set up:
   - Web Service (Node.js app)
   - MySQL Database

#### 3. Environment Variables

The following environment variables are automatically configured via `render.yaml`:

- `NODE_ENV` - Set to "production"
- `DATABASE_URL` - Auto-configured from database
- `JWT_SECRET` - Auto-generated secure value
- `OAUTH_BASE_URL` - Pre-configured

#### 4. Database Setup

After deployment, the database will be automatically created. The migrations will run on first startup.

### Manual Deployment (Alternative)

If you prefer manual setup:

1. **Create Web Service**
   - Runtime: Node
   - Build Command: `pnpm install && pnpm build`
   - Start Command: `pnpm start`
   - Plan: Free

2. **Create MySQL Database**
   - Name: artist-booking-db
   - Plan: Free

3. **Link Database**
   - Add environment variable: `DATABASE_URL` = Internal Database URL

4. **Add Environment Variables**
   - `NODE_ENV` = production
   - `JWT_SECRET` = (generate a random string)
   - `OAUTH_BASE_URL` = https://vidabiz.butterfly-effect.dev

### Post-Deployment

After successful deployment:

1. Your app will be available at: `https://artist-booking-app.onrender.com`
2. Database migrations will run automatically on first start
3. Create your first user via the OAuth flow or database

### Database Migrations

Migrations are automatically applied on deployment. To manually run migrations:

```bash
pnpm drizzle-kit migrate
```

### Monitoring

- Check logs in Render Dashboard
- Monitor database usage
- Set up custom domain (optional, requires paid plan)

### Troubleshooting

**Build fails:**

- Check build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version compatibility

**Database connection fails:**

- Verify `DATABASE_URL` environment variable
- Check database is running
- Review connection string format

**App crashes on startup:**

- Check start command is correct
- Review application logs
- Verify all environment variables are set

### Free Tier Limitations

Render free tier includes:

- 750 hours/month of runtime
- App spins down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- 1GB RAM
- Shared CPU

For production use with no downtime, consider upgrading to a paid plan.

### Custom Domain

To use a custom domain:

1. Upgrade to a paid plan
2. Add custom domain in Render dashboard
3. Configure DNS settings with your domain provider

---

**Note:** This app is currently configured for Render, but can be adapted for other platforms like Railway, Fly.io, or Heroku with minor configuration changes.
