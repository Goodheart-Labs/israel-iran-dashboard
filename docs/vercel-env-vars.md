# Required Environment Variables for Vercel

Copy these to your Vercel project settings:

## Essential Variables

```
CONVEX_DEPLOY_KEY=[Get from Convex Dashboard → Settings → Deploy Key]
VITE_CONVEX_URL=https://striped-gopher-860.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuZ2xvYmFscmlza29kZHMuY29tJA
```

## API Keys

```
ADJACENT_NEWS_API_KEY=38314d45-7899-4f51-a860-f6b898707a70
```

## Optional (PostHog Analytics)

```
VITE_POSTHOG_API_KEY=phc_8elF9dN4gr1gAGZ6C21bCINpHCpH65CXEeIFqPOlDCb
VITE_POSTHOG_API_HOST=https://eu.i.posthog.com
```

## How to Add to Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable above
5. Make sure they're enabled for Production
6. Redeploy after adding all variables

## Getting the Convex Deploy Key

1. Go to https://dashboard.convex.dev
2. Select your production project (striped-gopher-860)
3. Go to Settings → Deploy Key
4. Copy the deploy key (starts with `prod:`)
5. Add it as `CONVEX_DEPLOY_KEY` in Vercel