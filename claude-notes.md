# Claude Notes - Iran Dashboard Refocus

## Current Session: Transitioning from US Democratic Health to Iran Geopolitical Dashboard

**Note for future sessions**: If starting from a fresh Claude Code session, please review the full transition from US Democratic Health Dashboard to Iran Geopolitical Dashboard.

### Major Changes Completed
1. ✅ Updated CLAUDE.md project description to Iran Geopolitical Dashboard
2. ✅ Changed schema categories from US democratic topics to Iran-focused categories:
   - military_action (Military strikes/conflicts)
   - nuclear_program (Nuclear development)
   - sanctions (Economic sanctions)
   - regional_conflict (Proxy conflicts)
   - israel_relations (Iran-Israel tensions)
   - protests (Internal unrest)
   - regime_stability (Government stability)
3. ✅ Updated categorization keywords for Iran focus
4. ✅ Fixed Adjacent News API endpoint and added API key (38314d45-7899-4f51-a860-f6b898707a70)
5. ✅ Fixed Polymarket GraphQL to REST API
6. ✅ Updated all search terms to Iran-focused keywords
7. ✅ Renamed getDemocraticHealthScore to getGeopoliticalRiskScore
8. ✅ Updated UI text, branding, and category displays
9. ✅ Added subscription link to nathanpmyoung.substack.com

### Schema Migration Issue
- Changed category schema significantly
- Existing predictions in database use old categories
- Need to clear database through Convex dashboard due to schema incompatibility

### API Integration Updates
- Adjacent News: Using correct endpoint with API key
- Manifold: Updated search terms for Iran markets
- Metaculus: Updated search terms for Iran questions
- Polymarket: Fixed from GraphQL to REST API, filtering for Iran markets

### Commits Made This Session
- (pending): refocus: transition dashboard from US democratic health to Iran geopolitical tracking

### Next Steps
1. Clear database through Convex dashboard
2. Restart servers and fetch Iran-focused predictions
3. Test all API integrations
4. Verify UI displays correct Iran content