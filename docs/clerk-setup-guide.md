# Clerk Authentication Setup Guide

## Prerequisites
- Clerk account (https://clerk.com)
- Convex account with a deployed project

## Step 1: Configure Clerk Dashboard

1. **Sign in to Clerk Dashboard**
   - Go to https://dashboard.clerk.com

2. **Select or Create Application**
   - Choose your existing application or create a new one

3. **Configure Domains**
   - Go to **Settings → Domains**
   - Add your production domain: `www.globalriskodds.com`
   - Add your root domain: `globalriskodds.com`
   - For development, localhost is automatically allowed

4. **Get API Keys**
   - Go to **API Keys** in the dashboard
   - Copy the **Publishable key** (starts with `pk_`)
   - Keep this page open, you'll need it for Convex setup

## Step 2: Configure Convex Integration

1. **In Clerk Dashboard**
   - Go to **JWT Templates**
   - Click **New template** or edit existing "Convex" template
   - Use these settings:
     ```
     Name: Convex
     Claims:
     {
       "aud": "convex"
     }
     ```
   - Save the template

2. **In Convex Dashboard**
   - Go to your project settings
   - Navigate to **Authentication**
   - Add Clerk as a provider
   - Use the JWT template URL from Clerk (format: `https://YOUR_FRONTEND_API.clerk.accounts.dev/.well-known/jwks.json`)
   - The domain should match your Clerk instance (e.g., `charming-penguin-73.clerk.accounts.dev`)

## Step 3: Environment Variables

### Local Development (.env.local)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_Y2hhcm1pbmctcGVuZ3Vpbi03My5jbGVyay5hY2NvdW50cy5kZXYk
```

### Production (Vercel/Deployment)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
```

## Step 4: Verify Setup

1. **Check Clerk JWT Issuer**
   - In local dev, it should be something like: `https://charming-penguin-73.clerk.accounts.dev`
   - In production with custom domain: `https://clerk.globalriskodds.com`

2. **Update Convex if Using Custom Domain**
   - If you set up a custom Clerk domain, update the JWT issuer in Convex dashboard
   - The JWKS URL becomes: `https://clerk.globalriskodds.com/.well-known/jwks.json`

## Step 5: Making a User Admin

Since Clerk is working, to make yourself admin:

1. **Sign in to the application**
2. **Get your Clerk user ID**:
   - Check Clerk dashboard → Users
   - Or check browser DevTools → Application → Cookies → __session
3. **Update database directly** via Convex dashboard:
   - Find your user in the `users` table
   - Change `role` from `"user"` to `"admin"`

Or use the temporary admin setup function we created:
```typescript
// In Convex functions, run once:
await ctx.db.patch(userId, { role: "admin" });
```

## Troubleshooting

### "Invalid token" or Auth Errors
- Verify JWT template has `"aud": "convex"`
- Check that Convex JWT issuer matches Clerk domain
- Ensure environment variables are set correctly

### Domain Mismatch Errors
- Clerk domain in JWT must match what's configured in Convex
- If using custom domain, update both Clerk and Convex

### User Not Created
- The `storeUser` mutation should run automatically
- Check that it's not being called before auth is ready
- Verify the mutation has proper error handling

## Security Notes
- Never commit `.env.local` files
- Use different Clerk instances for dev/prod
- Regularly rotate API keys
- Set up proper CORS and domain restrictions