# Setup Checklist for Iran Dashboard

## Local Development Testing

- [ ] 1. Visit http://localhost:5175 - Check if homepage loads and shows markets
- [ ] 2. Visit http://localhost:5175/admin - Check if admin login page appears
- [ ] 3. Visit http://localhost:5175/debug-auth - Check authentication status

## Clerk Dashboard Setup

- [ ] 4. Sign in to https://dashboard.clerk.com
- [ ] 5. Verify you're in the correct Clerk application
- [ ] 6. Go to "Domains" section and check if these are added:
  - [ ] `localhost:5175` (should be automatic)
  - [ ] `globalriskodds.com`
  - [ ] `www.globalriskodds.com`
- [ ] 7. Go to "JWT Templates" and verify "Convex" template exists with:
  ```json
  {
    "aud": "convex"
  }
  ```

## Convex Dashboard Setup

- [ ] 8. Sign in to https://dashboard.convex.dev
- [ ] 9. Select your project (prestigious-okapi-667)
- [ ] 10. Go to Settings → Authentication
- [ ] 11. Verify Clerk is configured with correct domain

## Test Authentication Flow

- [ ] 12. Go to http://localhost:5175/admin
- [ ] 13. Click "Sign In"
- [ ] 14. Complete Clerk authentication
- [ ] 15. Check if you see:
  - [ ] Admin dashboard with markets list
  - [ ] OR "Access Denied" message
  - [ ] OR Loading spinner stuck

## Database Check

- [ ] 16. In Convex Dashboard, go to Data
- [ ] 17. Check "users" table - is your user there?
- [ ] 18. If yes, check if role is "admin"
- [ ] 19. Check "predictions" table - are markets there?

## Production Deployment

- [ ] 20. Push code to GitHub
- [ ] 21. Check Vercel deployment
- [ ] 22. Verify environment variables in Vercel
- [ ] 23. Test production site

## Troubleshooting Tools

- [ ] 24. Use /debug-auth to check authentication state
- [ ] 25. Check browser console for errors
- [ ] 26. Check Convex logs for function errors

---

Let's start with #1 - can you visit http://localhost:5175 and tell me what you see?