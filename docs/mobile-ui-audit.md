# JanSetu mobile usability review

## Scope and evidence

Reviewed the Expo mobile app, not the separate website. Browser checks used
320×812 and 375×812 viewports and an additional 125% browser-zoom check.
Browser zoom is not equivalent to native Dynamic Type or Android font scaling.

No existing citizen records, issues, family links, invitations, preferences,
passwords, or office accounts were changed during browser testing. Issue-form
validation was exercised without submitting a report.

## Browser-tested citizen coverage

| Screen / journey | Result |
| --- | --- |
| Office selection and citizen OTP sign-in | Development-mode sign-in passed. |
| Home | Greeting, representative, readable issue action, statistics, shortcuts, and scrolling checked. |
| Issues | List and existing issue details, status, and timeline checked read-only. |
| Raise an issue | Category and title validation checked; no report submitted. |
| Services | Household, visits, and development-work links checked. |
| Household | Navigation worked, but the linked record returned 404. Details and member/service history remain blocked. |
| Family | Form, relationship choices, and empty state inspected. No invitations or removals performed. |
| Visits and development works | Empty states and return navigation checked. |
| Updates | Empty alert/announcement states and navigation checked. |
| Profile | Account actions, disabled web push settings, guidance, footer, and scroll reachability checked. |
| Change password | Blank form and Cancel checked; no password changed. |

All lower page content observed during this pass was reachable by scrolling
above the tab bar. No blanket reduction of native bottom padding was justified.

## Repairs from this review

- Keep heading text and right-side actions in separate, non-competing columns.
- Add keyboard-aware scrolling to forms that previously lacked it.
- Separate campaign creation from its Back navigation.
- Allow campaign detail tabs to wrap with accessible touch targets.
- Make office tool tiles readable at narrow widths and remove fixed empty height.
- Provide an escape from the office access-unavailable state.
- Use a history-neutral label for household Back navigation.
- Increase family relationship/action touch targets and shorten the issue-title example.
- Group profile account actions separately from notification settings and sign-out.
- Make web confirmation controls functional while preserving native confirmation
  dialogs and cancellation behavior.

Repairs on office screens are based on source review, not signed-in visual proof.
Simple layout and label repairs were checked by source and TypeScript checks;
browser coverage above describes the observed journey before the final repairs.

## Targeted checks after repairs

- At 320×812, the grouped Profile account actions and separate Sign out action
  were readable and reachable above the tab bar.
- Canceling Sign out kept the citizen signed in with its stored session intact.
- Sampled family relationship chips measured 44px high.
- A browser-only synthetic family entry exercised the removal confirmation.
  Canceling produced zero DELETE attempts. The DELETE endpoint was blocked
  during this check; all temporary browser interceptions were removed, and a
  reload showed the real empty family list. No synthetic record was saved.

## Blockers and limits

- The seeded admin, PA, representative, and worker accounts returned HTTP 401.
  No credentials were reset and no authorization was bypassed. Their dashboards,
  protected tools, and role-specific detail screens still require an authorized
  signed-in browser pass.
- The citizen account's linked household record returned HTTP 404. Do not
  manufacture a household or repoint the account simply to make a test pass.
  The association must be checked through the office's authorized data workflow.
- Browser testing cannot prove native keyboard avoidance, Dynamic Island/safe
  areas, iOS liquid-glass tabs, Android system navigation, push delivery, camera,
  location permissions, or native sharing.
- No live create/edit/delete operation, report export, family-link removal, push
  preference change, or native-device release certification is claimed.

## Automated baseline

The isolated authentication/citizen API suite passed 33 tests. It uses an
in-memory database rather than the application's connected development data.
The issue-queue and screen-inset Node suites passed 10 tests, and the mobile
TypeScript check passed after the repairs.
