# Convex + Vercel Deployment Error: Authentication Failed

## The Error

When deploying to Vercel, you often see:
```
Failed to authenticate: "Your request couldn't be completed. Try again later.", check your server auth config
Error: [CONVEX Q(_system/cli/convexUrl:cloudUrl)] [Request ID: xxxxx] Server Error
```

## Why This Happens

This error occurs because:

1. **Convex deployment needs authentication** - The `convex deploy` command needs to authenticate with Convex servers
2. **Vercel's build environment is non-interactive** - Can't prompt for login during build
3. **Missing deployment token** - Vercel doesn't have the necessary auth token to deploy to Convex

## The Solution

### Step 1: Get Convex Deploy Key

You need to create a deploy key from the Convex dashboard:

1. Go to https://dashboard.convex.dev
2. Select your project
3. Go to Settings → Deploy Keys
4. Click "Generate a deploy key"
5. Copy the key (format: `prod:xxx|xxx`)

### Step 2: Add to Vercel Environment Variables

1. Go to your Vercel project settings
2. Navigate to Settings → Environment Variables
3. Add a new variable:
   - **Name**: `CONVEX_DEPLOY_KEY`
   - **Value**: The deploy key from step 1 (e.g., `prod:xxx|xxx`)
   - **Environment**: Production (and Preview if needed)

### Step 3: Update Build Command

In `vercel.json` or Vercel settings, ensure your build command uses the deploy key:

```json
{
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install"
}
```

### Step 4: Update package.json Scripts

Make sure your `package.json` has the correct build script:

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:prod": "pnpx convex deploy -y --cmd 'pnpm run build'"
  }
}
```

## Alternative: Separate Convex Deployment

If the above doesn't work, separate the deployments:

1. **Deploy Convex manually**:
   ```bash
   pnpx convex deploy
   ```

2. **Then deploy to Vercel** with a simpler build:
   ```json
   {
     "buildCommand": "vite build"
   }
   ```

## Common Mistakes to Avoid

1. **Don't use `-y` flag without deploy key** - It tries to skip prompts but still needs auth
2. **Don't forget to set CONVEX_DEPLOYMENT** - Vercel needs to know which Convex deployment to use
3. **Check your Convex project is initialized** - Run `pnpx convex dev` locally first

## Quick Fix Checklist

- [ ] Run `pnpx convex deploy --print-deploy-key` locally
- [ ] Add `CONVEX_DEPLOY_KEY` to Vercel env vars
- [ ] Ensure `CONVEX_DEPLOYMENT` is set in Vercel
- [ ] Verify `convex.json` exists in your repo
- [ ] Test deployment locally first with `pnpm run build`

## Environment Variables Needed

1. `CONVEX_DEPLOY_KEY` - For authentication
2. `CONVEX_DEPLOYMENT` - Usually auto-set, but verify it exists
3. Any API keys your Convex functions need (set in Convex dashboard)

## If Still Failing

1. Remove the Convex deploy from build:
   ```json
   {
     "buildCommand": "vite build"
   }
   ```

2. Deploy Convex separately using GitHub Actions or manually

3. Use Vercel's `postbuild` hook if needed:
   ```json
   {
     "buildCommand": "vite build",
     "functions": {
       "api/deploy-convex.js": {
         "includeFiles": "convex/**"
       }
     }
   }
   ```

## Remember

This error happens **every time** because:
- Vercel's build environment is isolated
- Convex needs authentication for deployment
- The `-y` flag alone doesn't provide authentication

Always set up the deploy key when creating a new Vercel project with Convex!