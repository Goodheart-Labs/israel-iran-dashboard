# Claude session notes

## Quotes beneath clicked portraits (2026-09-15)

Nathan asked for a person's quote to float beneath their face when clicked.
The existing quote, estimate, source and two accuracy questions now appear in
one anchored popover rather than an extra section beneath the whole chart.

- QuotePopover.tsx anchors to the packed portrait coordinates and clamps the
  card horizontally. A pointer stays aimed at the selected face. Tall cards
  scroll internally on phones; opening brings the card into view.
- One popover and one active connector. Clicking another face switches it;
  Escape, close, outside click or clicking the active face dismisses it.
  Keyboard focus returns to the face before dismissal. Enter/Space open it.
- Sort and resize move the popover with the face. Outcome/audience changes
  close it. Qualitative statements retain their inline fallback.
- Both existing accuracy vote slots, source links and viewer forecasts remain.
  No new dependencies, API, data, password or permission changes.

Validation: production build and full lint pass. Chrome for Testing checks at
1200, 768 and 375 pixels verified anchoring/pointer alignment, no overflow or
quote duplication, all dismissal methods, focus return, both stored votes,
sorting/resizing, qualitative fallback, and lower controls on mobile. Test
votes removed. Live verification follows the production push.

Commit: feat: show AI risk quotes beneath clicked portraits
Live: https://www.globalriskodds.com/ai-risk
Share link format: /ai-risk-access#password=ENCODED_PASSWORD
Password and session secrets remain in server environment variables. See
/docs/ai-risk-access.md. Protected data remains in the ai-risk-* bundle.
Production: Vercel goodheart/israel-iran-dashboard; Convex striped-gopher-860.
Use pnpm --ignore-workspace. Never launch real Google Chrome; use Chrome for
Testing. Local gate on 4177 forwards built preview on 4176.
