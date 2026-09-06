# Mobile responsive design QA

## Scope

- Public booking flow and service/master selection.
- Login and customer-account layouts.
- Master workspace, schedule, filters, breaks, and dialogs.
- Admin overview, appointments, catalog, analytics, settings, and creation dialogs.
- Viewports: 320 × 700, 375 × 812, 390 × 844, and 430 × 932 CSS pixels.

## Reference captures

- `/Users/asanali/Downloads/BarberShop - Онлайн запись.png`
- `/Users/asanali/Downloads/IMG_8754.PNG`
- `/Users/asanali/Downloads/IMG_8755.PNG`
- `/var/folders/by/hmh8q6650_lckr20ybnfjvnh0000gn/T/codex-clipboard-6890d85b-307c-4021-b38c-fcec38e6c725.png`
- `/Users/asanali/Downloads/IMG_8759.PNG`
- `/Users/asanali/Downloads/IMG_8760.PNG`
- `/Users/asanali/Downloads/IMG_8761.PNG`
- `/Users/asanali/Downloads/IMG_8762.PNG`
- `/Users/asanali/Downloads/IMG_8763.PNG`

## Implementation reviewed

- Local prototype: `http://localhost:5176/`
- Implementation captures were reviewed inline in the Codex in-app browser at 390 × 844 alongside the supplied reference capture.

## Visible comparison and fixes

| Priority | Reference issue | Implementation result |
| --- | --- | --- |
| P0 | Public page occupied only part of the screen and exposed a black strip on the right. | Root, page, booking, service, master, slot, and form containers are constrained to the viewport; document overflow is eliminated. |
| P0 | Header controls collided and the account action disappeared unless the page was zoomed out. | Mobile gets a dedicated 58 px top bar with a compact brand/account action and a separate persistent bottom navigation. |
| P0 | Admin sidebar permanently consumed horizontal space and clipped workspace content. | On mobile and touch devices the sidebar becomes a fixed bottom navigation and the workspace receives the full viewport width. |
| P0 | Appointment tables and filters extended beyond the screen. | Rows become labelled mobile cards; controls stack or use contained horizontal scrolling without widening the document. |
| P1 | Add-service and add-master dialogs were clipped and offset inside the tab content. | Completed tab animations no longer retain a transformed containing block; dialogs cover the viewport and open as scrollable bottom sheets. |
| P1 | Client/master actions and scheduling controls were crowded or off-screen. | Cards stack, action groups use responsive grids, datetime controls remain touch-friendly, and page bottoms reserve space for fixed navigation. |
| P1 | The floating assistant covered mobile actions. | The assistant is positioned above the persistent bottom navigation. |
| P2 | Toasts and account dialogs could sit behind navigation or retain desktop dimensions. | Toasts clear the bottom bar; cancellation, rescheduling, login, and review dialogs use mobile-safe widths and bottom-sheet behavior. |
| P0 | Master names in the service dialog were pushed outside the viewport by full-width checkboxes. | Each option now uses a fixed 20 px checkbox column and a wrapping name column; all names remain visible. |
| P1 | Admin bottom-navigation labels and icons sat too close to the Safari toolbar. | Navigation height and bottom padding were increased; every action retains at least 9 px of measured space below it. |
| P1 | Master sorting was exposed as a manual technical field. | Sorting is automatic; the admin-only field now records a readable master specialization. |
| P1 | The master logout label overflowed its undersized icon button. | The mobile logout action is now a single 104 px minimum-width control with aligned icon and label. |
| P1 | Login and password inputs triggered iOS focus zoom. | Touch layouts enforce a 16 px minimum input, textarea, and select font size, preventing Safari focus zoom. |
| P0 | Selecting all seven working days caused the settings request to fail. | Sunday now uses the same `0–6` weekday convention across the client and server; all days are serialized in calendar order. |
| P1 | Working-hour controls could extend beyond the settings card on narrow screens. | Grid children and controls can shrink to the viewport, and the mobile settings card uses contained padding. |
| P2 | Service prices showed both a dollar icon and the tenge symbol. | Prices now display only the correct `₸` currency symbol. |
| P2 | Admin forms contained implementation-oriented hints and jargon. | Master fields and dashboard/export labels now use concise business-facing language. |
| P1 | The date inside the first quick-booking chip was clipped on a narrow phone. | Quick slots are grouped under a separate full date label; time buttons remain compact and evenly sized. |
| P0 | Safari's native time fields could ignore the grid width and extend beyond the settings card. | Mobile time controls use a contained WebKit width and appearance while retaining their native picker behavior. |
| P0 | The overview calendar compressed or clipped the final master column. | Mobile shows one complete schedule column with a master selector; desktop still shows the full multi-master grid. |
| P1 | Long calendar dates and the Today control competed for one row. | Mobile uses a short date and a compact two-part navigation layout with 40 px touch targets. |

## Verification

- `document.documentElement.scrollWidth <= window.innerWidth` passed at 320, 375, 390, and 430 px for the public flow.
- The same overflow check passed for admin overview, appointments, services, and service creation at 390 px.
- Admin service dialog measured exactly 390 px wide and 844 px high at the overlay level, with its card contained inside the viewport.
- Client production build passed with Vite.
- Server suite passed: 25/25 tests.
- The all-days schedule payload `1,2,3,4,5,6,0` is covered by the authenticated settings regression scenario.
- Docker API is healthy after rebuilding; Telegram runs in webhook mode without a polling conflict.
- The Docker database contains the new `specialty` column and no longer requires manual sort order from the admin form.
- ESLint was not runnable because the repository currently declares an `eslint` script without installing ESLint; the production build remains clean.
- Remaining horizontal scrolling is intentional and locally contained inside tab strips, calendars, and the admin bottom navigation.

Final result: passed
