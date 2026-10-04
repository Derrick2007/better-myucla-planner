# Control audit — 0.17.7

## Follow-up correction — 0.17.9

The earlier local-panel autoscroll assertion was a false positive: opening Class
actions had already scrolled the list past its absolute threshold. A before/after
comparison showed neither the old nor redesigned layout scrolled during drag.
The controller targeted the outer workspace pane instead of its #panelPlan body.
The correction selects that known direct child, and the browser check now requires
additional scrolling down and back up while dragging, with zero native commands
and no document scrolling. This corrects the earlier coverage claim for edge
autoscroll; ordinary pointer/keyboard reorder checks were separate.

This audit follows a live report that Final exam week was unusable. It records
actual interactions, not a claim that preserving a handler guarantees UCLA's
server response. All automated plan-changing operations use fictional data with
intercepted requests. No live plan, enrollment or annotation was changed.

## Defects reproduced and corrected

- Finals inserted a minimum-640px table into a roughly 200px course column,
  used document scrolling and left focus on the body. It now uses one owned,
  nonmodal dialog outside the list, with local scrolling and explicit dismissal.
- The More dropdown could be clipped by workspace ancestors. It now uses an
  owned top-layer popover; its controls are pointer hit-tested.
- Study list and Personal entries lost native disclosure icons; a collapsed
  module stayed closed when its navigation was selected. Icons remain native;
  explicit navigation forwards only the exact validated native expand control.
- Live Study/Personal Help popovers extended behind the navigation. Their
  existing nodes are bounded inside their module, retaining native dismissal.
- Section grid styling overrode native inline `display:none`, including print.
  Native inline, `hidden` and `.hidden` visibility now wins.
- Search labels failed to follow native `hidden`/`.hidden` field changes.
- Existing draft recovery unhid its inner offer but not its action-bar parent.
  The parent now updates too, making restore/discard reachable after reload.
- Returning from Original layout with a natively collapsed calendar could show
  an expanded but blank workspace pane. Native closed state is retained; an
  explicit Expand now invokes the exact native heading once, with pending
  feedback. The same protection covers natively closed Class Plan/Search.

## Coverage

| Control family | Live page | Fictional production-browser verification |
| --- | --- | --- |
| Final exam week / More | Reproduced narrow layout and lost focus before fix | Open/toggle, Close, Escape, outside click, focus, stale redraw, empty plan, tidy-off, disposal, printing |
| Plan Actions | All seven native handlers/form owners and hit targets; Rename, Save a Copy, Load, About opened/dismissed without submitting | All seven options, native submitters, New, Delete cancel/confirm, Load selection, Print, response panels and focus |
| Calendar | Grid size +/− and Agenda on/off, workspace remount, original setting restored | Native paired buttons for Study/Plan/Alternates, Grid/Agenda combinations, size redraw, meeting interactions and folding |
| Navigation / native modules | All module destinations; Study/Personal Help clipping reproduced; Original layout and return | Explicit native disclosure forwarding, pending guard, changed-contract fallback, native fields/submitters, help, full partial redraw |
| Search / results | Original control identities and disabled Search appearance previously checked in 0.17.6 | Every fixture-native mode; required and hidden fields; Go by mouse/keyboard; selected sections; single/multiple/long results |
| Course tools | No live reorder/save/notes/delete performed | Pointer and keyboard reorder, position menu, move to top, Undo, notes/persistence/delete confirmation, recovery, Save/cancel/Stop and reload |
| Details / layout | Prior live metadata and native status verification retained | Dismissal/focus, local scrolling, long titles, original statuses/controls, native hidden rows, dividers, narrow schedule switch, print and full restore |
| Information & help | Native header help checked structurally and by pointer hit testing | All fictional sidebar widgets accessible; long help locally scrollable |
| Links outside Class Planner / UCLA masthead | Not opened | Original anchors remain intact; no extension handler added |

New functional harnesses are `test:finals-controls`, `test:module-controls`, and
`test:course-controls`. Existing search, details, results, plan-actions, optimizer,
empty-plan, broad workspace and preview suites remain part of verification.
Browser cases span wide desktop through 390px, including short 600/650px screens.
Fictional native handlers model the recorded DOM contract; they cannot establish
UCLA's backend behavior or enrollment success.

## Live limitation requiring follow-up

During this audit on installed 0.17.6, the native Optimizer stayed collapsed after
its heading was clicked both in workspace and Original layout. The explicit
navigation request reached its pending state; the later native DOM was still
closed. It must not be marked as a live pass from a fixture result. Recheck after
the updated extension and a fresh Class Planner load. Do not force a conditional
native panel visible or repeatedly submit its action to conceal this result.

Updated-build live verification is pending the user's extension reload.

Final local verification: typecheck, all 315 unit tests, production build, core
harness, all listed browser suites and matching preview passed. All 17 installed
files match the tested build by SHA-256. Code commit `4ebd7b5` is on the fork;
CI `37169130903` and Release `37169153266` passed. Published v0.17.7 ZIP digest:
`9f3251e1be64abe9bf2b607cff36054b9dd48c12eb21e4754882078fa32a5697`.
