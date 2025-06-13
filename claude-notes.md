# Claude Notes - App Initialization

## Current Step: Requirements Gathering

**Note for future sessions**: If starting from a fresh Claude Code session, reread the project:init-app command to understand the initialization workflow.

### App Description
US Democratic Health Dashboard - A dashboard tracking prediction markets and forecasts related to democratic health indicators.

### Key Categories to Track
1. Free and fair elections
2. Riots/civil unrest
3. Voting rights suppression
4. Press freedom/journalism
5. Civil liberties
6. Democratic norms
7. Institutional stability metrics

### Session Progress
- Started app initialization process
- Created todo list to track progress
- Gathered requirements from user
- Ready to document in CLAUDE.md and plan implementation

### Commits Made
- fc29987: init: document US democratic health dashboard requirements

### Progress Update
- ✅ Created Convex schema for predictions with 7 categories
- ✅ Built dashboard UI with category cards and overall health score
- ✅ Implemented API fetching actions for Manifold, Metaculus, and Polymarket
- ✅ Added automatic categorization based on keywords
- ✅ Backend compiling successfully
- ✅ Successfully fetched 92 predictions from Manifold Markets
- ✅ Added admin interface (/admin route) for curating predictions

### Current State (commit 6ff64a1)
- Dashboard shows predictions from Manifold Markets
- Admin interface available at /admin for approving/rejecting predictions
- Adjacent API integration ready (need to test with API key: 38314d45-7899-4f51-a860-f6b898707a70)

### API Status
- ✅ Manifold: 230 fetched, 92 saved successfully
- ❌ Metaculus: 50 fetched, 0 saved (categorization too strict)
- ❌ Polymarket: GraphQL syntax error
- ❌ Adjacent: Wrong endpoint (should be https://api.data.adj.news/api/markets)

### Known Issues to Fix
1. Metaculus categorization needs broader keyword matching
2. Polymarket GraphQL query format incorrect
3. Adjacent API endpoint was wrong in initial implementation

### Recent Updates
- ✅ Implemented fantasy-based light and dark themes using daisyUI
- Themes automatically switch based on user system preference
- Custom color scheme with vibrant purple/magenta primaries

### Key Functions
- `quickFetch` in Convex dashboard to fetch all predictions
- `debugCategoryCounts` to see data breakdown
- Admin interface to curate which predictions show on dashboard

### Latest Commits
- f069306: theme: update to custom fantasy light theme with matching dark variant
- d37c360: theme: implement fantasy-based light and dark themes with daisyUI

### Research Session: Adjacent News API Analysis
- ✅ Analyzed Goodheart-Labs/metaculus-bot repository structure
- ✅ Found Adjacent News API integration patterns
- ✅ Documented API authentication and endpoints
- ✅ Identified data structure and rate limiting
- Note: Adjacent News API requires API key authentication for full access