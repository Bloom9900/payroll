# Vercel Deployment Guide

This project is configured to deploy on Vercel as a serverless application.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Vercel CLI installed (optional): `npm i -g vercel`

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Go to https://vercel.com/new
3. Import your repository
4. Vercel will automatically detect the configuration
5. Add environment variables if needed (see below)
6. Click "Deploy"

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel

# For production deployment
vercel --prod
```

## Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

- `PORT` (optional, defaults to 3000 - not used on Vercel)
- `COMPANY_IBAN` (optional, defaults to empty string)
- `COMPANY_BIC` (optional, defaults to empty string)
- `COMPANY_NAME` (optional, defaults to "Company BV")
- `DEFAULT_CURRENCY` (optional, defaults to "EUR")

## Important Notes

### Scheduler Behavior

- **Local Development**: The scheduler runs automatically and checks every hour for the 25th at 9 AM
- **Vercel Deployment**: The scheduler is disabled. Instead, Vercel Cron Jobs are used:
  - Cron job runs on the 25th of each month at 9 AM
  - Endpoint: `/api/cron/payroll`
  - Configured in `vercel.json`

### Build Process

Vercel will automatically:
1. Install dependencies (`npm install`)
2. Build TypeScript (`npm run build`)
3. Deploy the serverless function from `api/index.ts`

### File Structure

- `api/index.ts` - Serverless function handler for Vercel
- `src/index.ts` - Original Express server (for local development)
- `vercel.json` - Vercel configuration
- `public/` - Static files served by the app

## Testing Locally

To test the Vercel setup locally:

```bash
# Install Vercel CLI
npm i -g vercel

# Run Vercel dev server
vercel dev
```

This will simulate the Vercel environment locally.

## Troubleshooting

### Build Errors

If you encounter build errors:
1. Ensure all TypeScript files compile: `npm run build`
2. Check that all dependencies are in `package.json`
3. Verify `tsconfig.json` includes both `src/` and `api/` folders

### Runtime Errors

1. Check Vercel function logs in the dashboard
2. Ensure environment variables are set correctly
3. Verify that the cron job is configured (check `vercel.json`)

### Static Files Not Loading

The `public/` folder is served statically. If files aren't loading:
1. Check file paths in your HTML/JS
2. Ensure files are committed to git
3. Verify the static file middleware in `api/index.ts`

