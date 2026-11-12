# Reliability review — 12 November 2026

The reported disappearing-trip bug is fixed. Cloud trips are now remembered independently of the active trip, merged with the signed-in account's saved list, and available from one Trip selector on every screen.

## Changes

- Retain cloud references when switching to a device trip, creating a trip, importing a backup, reloading, or signing out. A separate bookmark registry also survives damaged session data or an older tab overwriting the main session.
- Label choices as cloud, device, or sample. Remove the duplicate sidebar/settings switchers and redundant person selector.
- Correct the URL when creating or importing a device trip. Restore the last chosen cloud trip when reopening the app.
- Cancel old cloud loads and ignore late snapshots after a trip switch. Disconnect old subscriptions and clear old identity/receipt data.
- Keep failed cloud opens in a recovery screen rather than displaying an unrelated editable device trip under a cloud URL.
- Protect both cloud and device forms from stale saves. Keep rejected drafts available as downloads.
- Remember a newly allocated cloud ID before its network write. Optional account-index failures do not hide an otherwise saved trip.
- Load repayment history before allowing cloud edits. Invalid incoming shared data disables the stale snapshot.
- Preserve exact/percentage split inputs when participants change. Validate new plan/activity/workspace links, financial precision bounds, and time-zone date defaults.
- Preserve other readable device trips if one stored trip is damaged, with a recovery copy of the original data.
- Disable editing controls for archived/view-only trips, including rename/delete/receipt controls.
- Remove the large decorative overview banner, repeated setup shortcuts on established trips, empty guest management panels, and database-configuration controls from ordinary sharing flows.
- Repair offline app-shell fallback for trip URLs containing query parameters. Cache upgrades preserve unrelated applications' caches.

## Automated verification

- `npm run check` — passed.
- `npm run build` — passed.
- `npm test` — 69 passed: 42 calculation/import/export/date tests, 12 session/registry/device-conflict tests, 12 asynchronous cloud-adapter tests, and 3 service-worker tests.
- Firestore emulator suite — 28 passed. Production access rules are unchanged.

## Browser verification

| Flow | Observed result |
| --- | --- |
| Testing → Vienna sample → Testing | Both options remain present; the shared trip reopens. |
| New device trip from a shared trip | Cloud URL cleared; existing cloud choice retained. |
| Reload and backup import | Selection/data restored; imported trip separate; cloud choice retained. |
| Friends and personal spaces | Add a late friend, rename an existing traveler, preserve old shares. |
| Itinerary and directions | Activity saved; map/directions URLs contain the correct encoded location. |
| Joint plan, partial payment, exact split | 60 plan, 30 payment, 20/10 shares; custom inputs survive toggling a participant. |
| Refund | 6 refund reduces spending and shares without erasing the purchase. |
| Personal costs and plans | No group debt; linked activity retained; deposits do not double-count the forecast. |
| Repayment | Pending does not settle debt; confirmation settles it; reversal restores the debt. |
| Backups and CSV | Actual downloaded JSON validates; CSV includes joint and personal records. |
| Archive/reopen | Editing controls disabled while archived; reopening restores editing. |
| Checklist and undo | Completion survives reload; deletion can be undone in the same trip. |
| Cloud conflict | A second tab saves the unchanged budget; the stale form is rejected with a downloadable draft. Trip amounts remain unchanged. |
| Device conflict | A fixture's newer budget survives another tab's stale save; draft recovery is offered. |
| Bad/unavailable link | Visible recovery/error message; no unrelated trip editor shown. |
| Responsive layout | 320-pixel phone and 1280-pixel desktop checks show no document overflow. |
| Browser exceptions | No unexpected application TypeError, ReferenceError, or SyntaxError observed. |

## Operating boundaries

Cloud editing needs a working connection; failed saves preserve a device draft where storage is available. Device trips stay in that browser until backed up or uploaded. Named personal spaces keep the existing shared-link visibility; they are separate ledgers, not private authentication accounts.

The first upload of a device trip that already contains repayment records remains unsupported. Start cloud sharing before recording repayments, or retain/export that existing device trip. Existing cloud trips support repayments normally. A physical print job and a new Google-account consent flow were not performed during this review; the print template and existing sign-in integration were reviewed.
