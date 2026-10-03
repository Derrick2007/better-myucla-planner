# Better MyUCLA — Agent handoff

Last updated: 2026-10-03

Current version: `0.17.5` (Optimizer access and compact section details).

Live inspection reproduced the blank Optimizer pane: navigation selected the
module while UCLA's `#panelOptimizer.hidden` remained collapsed. One explicit
click on the original heading loaded its controls through a native partial
postback. No optimizer calculation or plan/course mutation was invoked.

Explicit workspace navigation now forwards that verified native expansion once;
mount, redraw and implicit module restoration do not. Pending feedback keeps
the original heading available for retry. Validation, loading deduplication and
restoration retain native control/form/handler identity. The original disclosure
icon is visible again, and the opened native panel has consistent outer padding.

Live Details geometry measured a 919px-wide section row at 161px tall, with
gray native cell backgrounds, centered days and a three-line floated status icon.
Plan Details now reuse the original table headings for compact aligned columns
in wide panes and two labeled bands in narrower panes. Native background/icon
resets apply only to validated marked plan/result cells, keeping Study list
opaque. Optional fields, statuses, native hidden choices and controls stay intact.

Dedicated Details browser checks pass at 2048/1440/1366/1280/960/390; the fictional
wide one-line row shrinks from 161px to 55px. All twelve search-result cases pass
with the stronger native-style fixture. Typecheck, 255 unit tests, production
build, the four-width Optimizer suite, broad workspace suite and preview checks
pass. The Original-layout return at 390px is keyboard-tested because the fictional
native fixture restores a fixed-width sidebar; desktop returns are pointer-tested.

The installed unpacked extension is v0.17.5; all 17 files match the production
build by SHA-256. The previous installed v0.17.4 is backed up under
`outputs/installed-backup-v0.17.4`. The live tab timed out before reload verification;
the user has been asked to reload the extension and sign back into Class Planner.
Do not claim the new build passed live verification until that is completed.

Code commit `489e548` is pushed to fork branch `planner-redesign`; CI
`37162949600` and Release `37162951331` passed. The v0.17.5 prerelease is published.
After the release workflow completed, its asset was replaced with the tested
installed build. GitHub reports ZIP SHA-256
`32437122adb3ac6f87017829a9cc80f8e7c313fe32dd416da295bc0799c65e7c`, matching local.

## v0.17.4 historical record

Live recheck of v0.17.3 after the user signed in found the workspace still absent.
The exact recorded empty `#panelPlan` was present, but Study list `#panelNotplan`
also contained `#div_landing > table` with native course rows. The empty validator
incorrectly rejected those unrelated rows. All other native shape checks passed.
Only structural booleans, element types/classes/IDs and geometry were read; no
course names, values, account text or real-page screenshots were captured.

The absence check now scopes to `#panelPlan`. The editable adapter was already
scoped correctly and stays unchanged. Native Study content remains opaque, with
no course-context activation or extension course tools. Disposal now clears
drag styles only from the current plan rows, preserving Study row inline styles.

Typecheck, 239 unit tests and production build pass. The shared empty fixture
now includes a populated fictional Study list; tests cover native identity/form,
style preservation, no editable context/storage reads, stable reconciliation,
full/empty transitions and malformed-marker fallback/recovery.
Populated-Study browser checks pass at 2048/1440/1280/390, including initial empty
and native New Plan transitions, all modules/search/calendar, no remount loop,
native control/markup/styles preservation, Original/Tidy/dispose restoration,
no extra requests or course-context activation. Desktop/phone fictional views
reviewed; native Study tables retain local scrolling. The matching website
visualization also passes at 1440/1280/960/390.

Installed in Downloads/better-myucla-v0.10.3/dist; all 17 files SHA-256 match the
tested production build. Backup: outputs/installed-backup-v0.17.3. Earlier
rollback backups remain intact. After the user reloaded and refreshed, bounded
checks on the actual Class Planner verified the empty workspace alongside the
populated Study list. All six navigation destinations and Original layout are
visible; the calendar is 640px wide at a 2048px viewport. The empty plan has no
course tools, its duplicate details slot is hidden, and the page fits its width.
Study list and Find classes both open beside the calendar with original controls
in aspnetForm. Study has local scrolling and no extension course-editing tools.
Plan actions opens and closes with Escape; UCLA's native Load/About visibility
is preserved. Returned to My classes with the menu closed. Only local navigation
and disclosure controls were clicked; no native plan/course action was run.

Published prerelease: https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.17.4
Implementation commit: 88ab790; release target with live verification: c76c418.
CI 37161310321 and Release 37161312911 succeeded on that target.
The published ZIP matches the installed build after the automated release job:
SHA-256 cef4c82bf5915415a6c99bf218d6f296d8186f179f738866b3a4e1f4d9136352.

## v0.17.3 historical record

The user explicitly requested trying Plan actions > New Plan. One live native
click on the exact Class Planner page rendered an empty working plan without a
dialog. All six native modules remained, but the course table disappeared and
v0.17.2 incorrectly dropped the workspace into the long native layout.

Empty-plan presentation now has a separate strict structural contract, recorded
in docs/MYUCLA_CONTRACT.md. It preserves search, calendar, module navigation and
native plan-menu visibility while leaving the editable/reorder adapter unchanged.
No course context, annotation/view/draft storage or reorder tools activate for
an empty plan. My classes displays one full-width native empty message. Unknown
structures stay native. Returning from Original layout validates current nodes,
rejecting detached course snapshots after a malformed native redraw.

Typecheck, all 238 unit tests and production build pass. The new
`npm run test:empty-plan` browser regression reproduces the v0.17.2 failure and
passes with v0.17.3 at 2048/1440/1280/390. It covers initial empty loads, New Plan,
all modules, search handlers, empty/full transitions, malformed states, native
identity/forms/visibility, Original/Tidy/dispose restoration and no empty course
storage or extra native actions/requests. Desktop/phone fictional visuals reviewed.
The broader workspace suite and exact-build website preview checks also pass.

Installed at Downloads/better-myucla-v0.10.3/dist; all 17 files SHA-256 match the
tested production build. v0.17.2 is backed up at outputs/installed-backup-v0.17.2;
the v0.16.0 rollback remains intact. The reload question has been sent; final
live v0.17.3 verification is pending. The tab subsequently reached UCLA's timeout
sign-out URL; the user must sign in again. No sign-out page text or field values
were read. The last planner state was the empty plan produced by the single
authorized New Plan click. Do not create another plan or select/save/enroll
courses for verification. After sign-in and reload,
check only bounded structure/geometry and local module navigation; do not read
field values or capture real account/course content.

Published source: 0888fae on the user's planner-redesign branch.
Release: https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.17.3
CI passed: https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37158574178
Release passed: https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37158590195
The final published ZIP matches the installed build after the automated job:
SHA-256 a5400a3b05293c43030973a8793b56584f327cda17be88ae06660dfa23b15d90.

## v0.17.2 historical record

The user's next screenshot exposed legacy result styles that the fixtures had
not reproduced. Optional room/instructor data stayed visible even with Rooms &
instructors closed. Header help stacked at the right. Native clearfix boxes,
30px minimum cell heights and a three-line floated lock icon enlarged rows.

The fix scopes resets to marked, validated result rows. Optional data and its
native header help now share the Rooms & instructors disclosure. Open headings
align with the optional fields; labels/values align left. Status text, icons,
colors, nested widgets, native controls and form ancestry remain unchanged.
No runtime JavaScript, permission, request or storage behavior changed.

The shared fictional fixture now includes observed native result constraints.
Typecheck, 228 unit tests and production build pass. The broader browser suite
passes at 2048/1440/1280/390 and its additional long-result, print/restoration,
compact-header and lifecycle scenarios. Focused result verification passes all
12 single/multiple-course cases at 2048/1440/1366/1280/960/390, including strict
column alignment, native hidden states, print/Tidy restoration, unchanged native
status/control/widget identity and zero native actions or extra requests.
The regression fixture reproduces a 118px one-line row in v0.17.1, reduced to
46px in v0.17.2. Closed/open desktop and scrolled phone screenshots reviewed.
Website preview checks also pass at 1440/1280/960/390, and the preview is rebuilt
from the final production CSS.

Installed in Downloads/better-myucla-v0.10.3/dist; all 17 files hash-match the
production build. v0.17.1 is backed up at outputs/installed-backup-v0.17.1 and
v0.16.0 remains intact. User reload and live results verification are pending.
The existing browser tab subsequently reached MyUCLA's sign-out page; only its
URL was checked, and no other page contents were inspected. The user needs to
sign in, reload the extension/refresh and reopen results. Do not claim a live
v0.17.2 pass until that check is complete. Prior live v0.17.1 geometry exposed
the reported issue: Rooms aria-expanded=false while optional fields were visible,
result row height 119.4px and header height 79.2px.

Published prerelease source: c33e60f on the user's planner-redesign branch.
Release: https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.17.2
Both CI and release build passed for that commit:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37157366361
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37157367868
The final ZIP is the exact installed build (after the automated release build):
SHA-256 36719fb10c4df4c1f5aa342e5ba3cd408873c5920372b16324b900da6401a52b.

## v0.17.1 historical record

The user's live screenshot exposed a layout regression missed by the original
fixtures: native `.row` clearfix pseudo-elements became grid items, percentage
panel widths shrank again inside grid columns, and native inline `display:block`
defeated the field panel's flex layout. Inputs could shrink to about 70px on the
actual desktop page while Search By occupied the wrong column.

Scoped CSS now removes only the validated search row's clearfix, resets its
native panel/input widths, and overrides only the observed visible inline block
state. Native `display:none`, hidden attributes/classes, original controls and
form associations remain intact. The native label and colon stay together;
the original enrollment link follows the section heading visually.

Shared fictional fixtures now reproduce those native styles. The new
`harness/verify-native-search-layout.mjs` reproduces the old failure and verifies
the fix at 2048/1440/1366/1280/1100/960/390px, exact 599/600/699/700px container
boundaries, three-field modes, hidden states, control identity and zero search
events/extra requests. At 1440px inputs increased from 42px to 196px, and the
search controls decreased from 267px to 66px high. Fictional screenshots reviewed.

Typecheck, all 228 tests and production build pass. The broader production
workspace suite also passes at 2048/1440/1280/390px and its additional lifecycle,
long-result, print/restoration, future-term and compact-header cases.

Installed v0.17.1 into Downloads/better-myucla-v0.10.3/dist; all 17 files hash-match
production dist. The prior build is backed up at outputs/installed-backup-v0.17.0;
the original v0.16.0 rollback remains untouched.

After the user reloaded, bounded read-only checks on the actual Class Planner at
2048x927 verified 347.5px-wide inputs (previously 69.1px), a 66.2px-high search
band (previously 272.4px), aligned mode/inputs/submit and one-line field labels.
The native link follows the heading, the unused field stays hidden, all fields
remain associated with aspnetForm, and no horizontal page overflow occurs.
Switching My classes → Find classes preserves the fix and the adjacent calendar.
Only local navigation was clicked; no search, plan or enrollment action was run.
No real course contents or search values were read, captured or stored.

Published prerelease source: c3c3053 (planner-redesign on the user's fork).
Release: https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.17.1
CI passed: https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37155540081
The attached ZIP is the hash-verified installed build. The regenerated website
preview passes at 1440/1280/960/390px with zero requests and inert account actions.

## v0.17.0 historical record

Current-build visualization added: `src/preview/index.ts` imports the production
presentation modules; `npm run preview:build` creates the offline fictional
`site/workspace-preview.html`. Exact CSS and production content hashes are
embedded. Shared modules must match dist/content.js.map before generation, so
stale JavaScript cannot silently produce a different preview. Live origin guards,
permissions and runtime code are unchanged. All 17 rebuilt dist files still
hash-match the installed extension; no user reload is needed for preview changes.

Preview-only native search is a local simulation; account actions are blocked.
Fixtures approximate native calendar/module content. Navigation, Details,
resizing, loaded result filtering and section selections use production code.
Standalone checks pass at 1440/1280/960/390. The inline wrapper also passes at
1440/1024/736/390; its bounded 800px scroll surface maps document scrolling so
Compact header/Show header work without host auto-height feedback. The old
course-browser visualization has been replaced. Source scripts are
`scripts/build-inline-preview.mjs` and `scripts/preview-fragment.html`.
Only fictional content was captured. The website hero now shows the current
workspace; public/demo.html remains explicitly documented as the legacy reorder
fixture. Pages deployment from main is separate from this branch's preview.

The approved design replaces the Plan/Find switch with named navigation, a main
workspace and a persistent weekly schedule. My classes details are visually
docked beside the list; native controls remain in their original course row.
Find keeps the original Search by selector and fields visible, with a local
index only for courses UCLA has already loaded. Optimizer, Study list and
Personal entries remain complete native modules. Information & help visually
places the original sidebar in the workspace without reparenting. Plan actions
wraps the complete original menu; its buttons retain their immediate parent.

Desktop navigation is 168px; the schedule defaults to 38%, bounded at 420–640px,
with a keyboard/pointer divider. Below 1280px navigation is horizontal; below
1100px a Schedule/workspace switch preserves local state. Narrow Find panels
below 600px allow local panel scrolling with usable index/preview heights;
desktop results scroll independently while search fields stay in view.

Native statuses, control identity/form association and UCLA navigation are
preserved. Per-section summaries update when native text changes in place.
Unknown native modules restore the complete original layout. Unknown result
widget siblings retain scrollable fallback. Native Go replacements survive
cleanup of the Search classes wrapper. No permission, request, server or new
persistent storage was added. Only fictional fixtures are screenshotted.

Typecheck, production build and 228 tests across 20 files pass. Production Chrome
fixtures pass at 2048, 1440, 1366, 1536 (735px tall), 1280, 1200, 1100, 960 and
390px. Coverage includes every module's native fields/handlers, control/status
identity, keyboard/mouse/touch, Details docking/focus, native calendar geometry,
print, Original layout/Tidy restoration, selections and local panel positions.
Additional checks pass for long results (2048/1536/390), single-course results
(1440/960/390), unknown module fallback, tall headers, five introduction widths,
quarter/redraw/reload/tab header persistence, empty/future quarters and local drag.
Desktop and phone screenshots were reviewed visually with fictional data.

Installed v0.17.0 in Downloads/better-myucla-v0.10.3/dist. All 17 files SHA-256
match the production dist. v0.16.0 is backed up and hash-verified at
outputs/installed-backup-v0.16.0 outside Git. ZIP and fictional screenshots are
also under outputs outside Git; v0.16.0 remains the published rollback release.

After the user reloaded, live verification passed on the exact Class Planner page
at 2048x927. All seven navigation destinations were reachable; the schedule stayed
visible beside every module. Native search-mode changes and one explicit public
instructor/course search loaded a single course into the bounded preview with
native controls still associated with aspnetForm. No course names or account
content were recorded. Details retained its native row ancestry, and Escape
closed it with focus returning to its trigger. Information & help returned to
the previous module. All original plan-menu controls were visible. Original
layout restored all six native modules and the original menu/sidebar, and the
workspace reopened successfully. Keyboard resizing changed the schedule from
640 to 624px and back. No horizontal page clipping occurred. Find is left open.
No Add, Enroll, Drop, Remove, Exchange, Waitlist, reorder or Save action was run.
Quarter transitions and print were verified in fixtures, not on the real account.

Published source/tag: 9a229e85c9a11ca272848f596a20067f2582606f.
Release: https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.17.0
CI: https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37151668605
Release build: https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37151670022
Both workflows passed for the exact release SHA. ZIP: 361854 bytes; SHA-256
8a05ff14356ae27b743cae238d7b574c4495236425ded52a793803417db71be5.

## v0.16.0 historical record

Last updated: 2026-10-03

Current version: `0.16.0` (redesign beta)

The user rejected the visual design of v0.15.1 and pointed to GitHub's UI-design
topic. The new presentation uses a consistent light visual system, readable
14px body text, a flat workspace, restrained blue accents and larger controls.
The Find content is bounded at 1280px (1080px for a single course), with a 260px
course index. Classes defaults to 360px and can resize from 300 to 480px.

Each class initially presents its code/title, Details and Class actions. Class
actions reveals native ordering/color controls and owned order/note tools in
their original parent. Only one disclosure opens at once. Escape dismisses an
inner More menu before Class actions, and closing restores focus. Details,
Find, pane folding and restoration close actions. Explicit opening near the
bottom reveals the controls within the Plan pane only.

UCLA masthead/navigation, native status content, form controls/handlers and
calendar geometry/state borders remain unchanged. No framework, remote font,
network request, permission or storage feature was added. Public inspiration:
https://oat.ink/ and https://daisyui.com/components/list/ (principles only).

Typecheck, production build and all 220 tests across 20 files passed. The full
production fixture suite passed at seven workspace widths, three single-course
widths and five compact-introduction widths, including print, calendar geometry,
note editing, mouse/keyboard/touch actions, foreground Tools Escape priority,
native control/status identity, quarter transitions and local dragging. Desktop
and narrow screenshots were visually reviewed with fictional data only.

Browser testing caught note blur moving Class actions between mouse down/up.
Primary mouse-down now defers focus until click dispatch; the original blur/save
still runs normally. Foreground Tools dismisses before background class controls.

Installed v0.16.0 in the existing Downloads/better-myucla-v0.10.3/dist folder;
all 17 files SHA-256 match dist. The prior v0.15.1 build is backed up outside Git.
ZIP and fictional screenshots are under outputs outside Git. User reload and
live verification of v0.16.0 are pending; v0.15.1's live record below is historical.
The connected browser tab was no longer on ClassPlan.aspx at the final check;
do not inspect the other page. Reopen only the authorized Class Planner page.

Source and ZIP are published to the user's fork as the v0.16.0 prerelease:
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.16.0
Exact source 5ad38b3d05a70b8b012cdf0561ed8ce1dcdc7ee5 passed both workflows:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37146547615
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37146569348
Published ZIP: 355993 bytes, draft=false, prerelease=true, SHA-256
80b727faa42fcf70f5f987065b41449026e389f12eec5fa946833be443193bef.

## v0.15.1 verification record

This is a visual refinement of the Plan / Find classes design. Details is first
in each class's control host and keyboard order, with a 34px minimum target and
aria-expanded state. Adjacent owned order tools are quieter but remain visible.
Native order/color controls keep their original parents and handlers.

Wide result previews (actual content width >=640px) use each group's original
native column headings, aligned with rows and sticky within the preview. Repeated
row captions are visually clipped but accessible; narrow cards retain labels.
Optional location/instructor fields keep their own captions when revealed, and
their native header help remains available even while the fields are folded.
No native header content, status text, form control, request or permission changes.

Typecheck, all 213 tests across 20 files and production build passed. The full
production fixture suite passed at seven widths, including the three single-course
widths, five introduction widths, print, redraws, compact-header persistence,
future-quarter transitions and local dragging. New checks cover Details-first
Tab order/size, shared-header alignment/stickiness, native header content/help,
control parents and narrow labels. At 960px both wide single-course and narrow
multi-course previews passed. No browser errors or extra requests. Fictional
desktop/narrow screenshots were visually reviewed.

Installed v0.15.1 in the same Downloads/better-myucla-v0.10.3/dist folder; all 17
file hashes match dist. Prior v0.15.0 is backed up outside Git. A ZIP and fictional
screenshots are under outputs outside Git. Source and ZIP are published to the
user's fork as the v0.15.1 prerelease. Exact source commit
098bf0f795d85cd7fce2182cded3b9dcd9969491 passed both workflows:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37143916639
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37143938987
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.15.1
The published ZIP is 349909 bytes; release is non-draft and prerelease=true.
Authorized live verification passed on October 3 at 2048x983 after reload.
All six Details buttons show the new first-action placement, expanded state and
minimum size. First and last class Details keep the native row inline, schedule
visible and close control in bounds. Escape and Close return focus correctly.
A native subject/course/search sequence retains Find through redraws; the loaded
1911px preview has aligned shared headings, sticky positioning, clipped accessible
captions and visible native help. All inspected result controls retain their
original form. Rooms/instructors reveal with labels and no overflow; the result
survives Plan/Find switching. Tools exposes both pane controls, all three extra
module controls and Original layout. Compact mode remains active, BODY scroll
is zero and there is no horizontal overflow. Final view is Plan, compact.
No live plan or enrollment action was taken, and no private page contents were
retained. Installed files still match all 17 dist hashes. No new defect found.

## v0.15.0 verification record

The user approved replacing three competing panes with two task views within
the same extension/page. Plan shows a resizable 320px class list beside Schedule;
Find classes fills the workspace with native search and loaded course previews.
The segmented task control keeps the chosen view through partial remounts.
Original fields, selections, statuses and native handlers remain unchanged.
Escape in Find returns to Plan and focuses Find classes; native autocomplete
gets first Escape. No new storage, permission, network request or separate page.

Details now stays inline inside its original class card at every width. Only
the owned heading/disclosures move. Find closes Details before hiding its card.
Tools contains the two plan-pane reopen controls, three additional modules and
Original layout. One divider resizes Classes from 260 to 440px while reserving
Schedule room. Two columns remain at 900px and above; narrower windows stack.
UCLA navigation, native term and plan menus remain untouched. Header compaction
keeps its existing saved choice. Type/spacing are calmer; preview rows size
against their actual available width rather than the entire search area.

Typecheck, production build and all 211 tests across 20 files passed, as did the
full production fixture suite at seven widths, including intro/header lifecycle,
future-quarter transitions and local dragging. Final focused checks passed at
1440, 960 and 390px after narrow class-control wrapping, printing all six modules
from Tools initially open/closed, and revealing inline Details at the pane's
lower edge. No browser errors or additional requests. Final desktop/mobile
screenshots were visually reviewed using fictional data only.

Installed v0.15.0 in the existing Downloads/better-myucla-v0.10.3/dist folder;
all 17 files SHA-256 verified. v0.14.7 is backed up outside Git. Source and ZIP
are published to the fork as the v0.15.0 prerelease. Exact code commit
837b02b4b0182808a9598b3b6dbd9016b6129ab4 passed CI and release packaging:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37108200960
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37108220893
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.15.0

After reload/sign-in, authorized live verification passed on October 3 at
2048x983. Plan shows Classes and Schedule; Find classes uses the full width.
Opening the last class's Details keeps its close control visible/focused and
the schedule visible; Escape closes it and returns focus. Find survives native
subject/course/search redraws, showing a single loaded preview without the
duplicate index; native inputs retain their original form association. Loaded
results survive Plan/Find switching. Tools exposes both pane controls, all three
secondary modules and Original layout; Escape closes Tools before returning
Find to Plan. Compact choice remains active; Show header restores root scroll
zero and Compact header returns the title to 12px with the term visible.
Final view is Plan, compact; BODY scroll is zero and no horizontal overflow.
All 17 installed files still match dist SHA-256. No live plan/enrollment action
was taken. Only structural facts were retained. Do not inspect credentials or
other MyUCLA pages; screenshots/fixtures must use invented course/account content.

## v0.14.7 verification record

The user asked for another hands-on review. Live inspection of v0.14.6 reproduced
an empty inspector after Details followed by Expand Browse: Classes was hidden
with the native details row still inside it. The expand action now closes that
inspector before revealing results. Single-course searches show only their
preview, without duplicate course index/filter/count. Known native planner
notice spacing is reduced; content and navigation remain unchanged.

Independent fictional-browser review found checked sections hidden in other
course previews and preview scroll resetting on section-row redraw. A normally
hidden count/disclosure now offers review buttons for off-preview selections;
these reveal/focus existing checked controls without changing their state.
Only checked booleans from validated selection cells are read, never values.
Both index and preview scroll survive same-result redraw. Unknown extra course
heading controls trigger native fallback instead of being hidden. Partially
loaded result sets still use MyUCLA's native loading flow; no prefetch added.

Typecheck, 201 tests across 20 files and build passed. Production fixtures passed
at seven widths, including Details-to-Browse, checked selection review, native
identity and print; single-result presentation passed at 1440, 960 and 390px.
Five-width intro/root scrolling, persistent header, future/current transitions
and local dragging also passed. Single-result and selection-reminder screenshots
were visually inspected using fictional courses only.

The installed build is v0.14.7; all 17 files are SHA-256 verified. v0.14.6 is
backed up outside Git. After user reload, authorized live verification passed
Details to Expand Browse both before and after a native search. A single loaded
result hides the duplicate index/filter/count and fills the preview width.
Escape restores all three panes and button focus. All three additional modules
remain accessible; original search controls retain their form association.
There is no horizontal overflow, BODY scroll remains zero, and the saved compact
choice remains active. Checked-selection review was tested only on fictional
fixtures. No live plan/enrollment action was taken; retain structural facts only.
Preserve all original UCLA navigation. Use only the authorized Class Planner tab.

Source and ZIP are published to the user's fork, explicitly marked prerelease.
Code SHA 660024d09ed7aaa92807ede07e416695d5d69650 passed CI and release packaging:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37041125966
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37041133579
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.14.7

## v0.14.6 verification record

This review adds Expand Browse / Restore panes and a responsive list-and-preview
view inside the existing native search section. The loaded-course filter is
owned, unnamed and memory-only; Enter never submits. The selected heading is
shown above its native sections, with arrow/Home/End index navigation. Local
filter/disclosure/focus/list-scroll choices survive a section-row redraw, and
new result sets reset them. Widening Browse preserves previous pane choices;
Escape or named pane buttons restore them. Native controls/statuses/handlers
and original UCLA navigation remain unchanged. Incomplete result sets remain
native; no background load or request is added.

The review also fixes controller disposal/startup races and wrong-plan local
notes/view/draft state after partial context changes. Stale async responses are
ignored; prior plans' persisted drafts survive. Invalid/future quarters remove
obsolete save controls while retaining independently validated introduction UI.
Original layout reattaches its return button after redraw. Print reveals all
loaded courses and optional room/instructor fields without viewport clipping.

Automatic workspace remounts now preserve root scroll across the temporary
document-height clamp caused by removing the old spacer. This does not change
explicit Original layout or disable behavior. Saved compaction still supplies
its minimum scroll after the new layout is positioned.

Typecheck, 196 tests across 20 files and the production build passed. Final
workspace/browser fixtures passed at seven widths, including print, a five-width
introduction/root-scroll series, compact preference across redraw/reload/tab
return, both future/current transitions and local dragging. Independent native
search and calendar/layout regressions passed. Screenshots were visually reviewed
at 1440, 960 and 390px. No new requests were observed in isolated fixtures.
The existing unpacked build is updated to v0.14.6; all 17 files SHA-256 verified.
Prior v0.14.5 is backed up outside Git. After user reload, authorized live QA
passed full-width Browse and persistence through native subject/course/search
updates. Loaded index and preview were side by side, selected heading matched,
native controls retained their form, and there was no horizontal overflow.
Local no-match filtering and Enter kept Browse open; clearing restored the
preview. Escape restored all three panes and button focus. Switching Fall to
Winter future plan removed obsolete save controls and retained Show header;
returning to Fall restored all six modules with BODY scroll zero. Show header
then Compact header left Fall's title and term at 12px. Retain only structural
facts, not actual course names/account contents. No live plan or enrollment
action was taken. Source and ZIP are published to the user's fork, with v0.14.6
explicitly marked prerelease. Code SHA c4e49940c76caeb255bf2f624d2a87cb2851afc9
passed CI and release packaging:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37039114974
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/37039176249
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.14.6
Only fictional fixtures/screenshots may be retained. No live course, plan or
enrollment change is authorized for verification. Use the existing Class Planner
tab only. Keep dist untracked and publish only to the user's fork.

## v0.14.5 verification record

Status: persistent Compact header / Show header is built and verified on fictional
production fixtures. Typecheck, 182 tests across 19 files and build passed.
Seven-width workspace and five-width introduction QA passed. A saved one-boolean
preference survives native quarter redraws, fresh controllers and browser-tab
return. Show header and native-menu keyboard focus release compaction. No new
requests, polling, permissions or account/course storage were introduced.

Authorized live inspection found future quarters have no editable class table.
The exact-page bootstrap now permits independently validated introduction
presentation there, while the adapter/reorder contract stays unchanged. Fictional
QA covers starting on a future quarter, current/future redraws both directions,
normal course tools only after validation, native identity and Tidy restoration.
The control scrolls the document only, never styles, hides or moves UCLA's menu.
The existing unpacked build is updated to v0.14.5, all 17 files SHA-256 verified.
The old v0.14.4 build is backed up outside Git. After the user reloaded/refreshed,
authorized live QA passed: Fall to Winter future plan retained Show header and
title/native term at 12px; a fresh Winter reload retained that choice. Show header
restored root scroll zero and its off choice survived returning to Fall. A new
compact choice survived Fall reload. Native header class/style remained unchanged,
BODY scroll remained zero, there was no horizontal overflow, and all six modules
returned. Only structural checks and a public heading crop outside Git were saved.
No class/plan/enrollment action was automated. Final page is Fall, compact.
Source and ZIP are published on the user's fork under v0.14.5, redesign beta.
Code SHA: db1acee521ee6b855719e4ab459f4cef9882f1f3. Exact-commit CI and release
packaging passed; the release is explicitly marked prerelease:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/36980554461
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/36980556043
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.14.5
Never automate plan/enrollment actions.

## v0.14.4 verification record

The prior build was installed with all 17 files SHA-256 verified; v0.14.3 was
backed up outside Git. Source and ZIP were published under v0.14.4, code SHA
8e9ad669d827273278107e61d5097da0a1b8b18f. CI/release packaging passed:
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/36977363593
https://github.com/comet-ctrl/better-myucla-planner/actions/runs/36977366150
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.14.4
Live clicks verified one-time compaction and Show header restoring the menu.
The user reported that changing quarters resets it, motivating v0.14.5.
The browser screenshot clip uses document coordinates and can return root scroll
to zero: inspect fresh bounds and use the owned control to restore the intended
view afterwards. Retain only public heading crops outside Git, never account
or course content. The planner is left compacted for the user.
Screenshots and the versioned ZIP belong outside Git under outputs.

## v0.14.3 verification record

The preceding compact introduction and intentional page scrolling were built, tested,
installed and verified on the authorized live Class Planner tab. Source and ZIP
are published to the user's fork; GitHub CI and release build passed for db9f48e.

The pre-redesign source at aa992da is saved on the user's fork's
planner-improvements branch and GitHub release v0.13.0, with a complete ZIP:
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.13.0
Do not rewrite that snapshot or push to upstream.

The redesign lives on the separate planner-redesign branch. The presentation has been
rebuilt around Classes (left), Schedule (center) and Browse (right). Side panes
resize with pointer/keyboard dividers. All three remain independently foldable
and reopenable. Widths/choices are in memory only. UCLA navigation and plan menus
retain their original nodes and placement. The term selector keeps its native
parent/form but appears beside the compact title. All three secondary
modules remain native under Tools (3); Original layout restores all six sections.

The user explicitly wants UCLA's untouched banner/menu to scroll away normally.
PlannerIntroduction compacts only the known lower introduction, wraps existing
text/links in About this planner, leaves term notices/alerts visible and exposes
all original sidebar widgets through Links & help. Sidebar/term parents, controls
and handlers remain native; its contents are never copied or logged. Unknown
introduction shapes remain native. ×/Escape closes info with focus return.
Root document scrolling replaces the old clipped BODY rule; BODY has visible
overflow and cannot scroll independently. A full-height owned flow spacer gives
the page room to scroll the banner away. Marker viewport bounds position/expand
the fixed workspace; a passive root-scroll listener updates Details and tools.
Narrow/short-window fallbacks remain normal flow. Restoration removes the spacer,
listener, compact classes and controls and unwraps native replacement text safely.

CourseBrowserPresentation indexes only complete, already-rendered public result
headings and shows one native course body locally. Bodies can be direct siblings
of their headings or the older nested shape; duplicates fail closed. SectionCards
recognizes the exact native header labels including Day(s), Time in Pacific Time
and Instructor(s). Native help buttons stay accessible. SectionCards formats exact
nine-column section rows into labelled cards, appending owned text after native
children. Native controls/status innerHTML/action rows remain unchanged. Edit
search reveals original fields. Rooms/instructors expand locally. Unknown or
incomplete results retain native controls; no prefetching, input-value reads,
polling, storage or extra query is introduced. Last selected heading/id is memory
only. Row/cell replacement triggers reconciliation without reviving stale nodes.

Details dock in Browse instead of opening a blocking overlay. The native third
row remains under its original course tbody; CSS positions it in the reserved
inspector area. Other planner controls remain interactive. ×/Escape closes with
focus return; narrow windows move only the owned heading inline. There is no
backdrop or outside-click capture. Header identity and status wording remain
native. Never mark containers holding native descendants as extension-owned.
The exam note is a separate disclosure; the inspector heading is bounded and
content height is clamped to its pane and viewport. Native refresh-row inline
margins are compacted by scoped CSS, restored by removing workspace classes.

Typecheck, 179 tests across 18 files and the production build passed for the patch. Production
Chrome QA used isolated fictional fixtures at seven widths (including 1536x735
and 390px), covering pointer/keyboard resizing, pane folding/reopening, all six
modules, local course previews, no extra requests, native control/status/nav
identity, calendar geometry, docked/inline Details, focus, partial redraws,
restoration and long-list local dragging. Independent search and layout
regressions passed against v0.14.3. The sibling-result, native header-help,
tall-header/long-exam and constrained-BODY/long-sidebar scrolling checks also
passed. The scrolling fixture confirms hidden overflow permits the old behavior
before checking that non-scrollable BODY prevents it. Five introduction widths
(2048, 1440, 1280, 960 and 390px) also passed compact headings, term/notice
visibility, sidebar reopening/close/Escape/focus and restoration. Desktop checks
passed header scrolling away/back, full-height planner bounds, scrolled native
redraw position and Details tracking without any new requests. Fictional QA pictures and
versioned build ZIP live outside Git under outputs. Keep dist untracked.

Live inspection works after explicit human authorization for the browser
connector's required MyUCLA origin permission. Inspect only the existing exact
Class Planner tab. Do not navigate to other MyUCLA pages or inspect private
account data. Resizing, pane reopening, Details dismissal and all three secondary
modules passed on v0.14.0. Live native search exposed sibling result bodies and
an inspector overflow below a tall header; both fixes passed live on v0.14.1.
Live v0.14.1 confirmed real course previews, nested section expansion, native
help visibility, local field toggles, original-form controls and Details bounds,
exam expansion, ×/Escape and focus return. Native search redraw can scroll BODY
behind the fixed workspace despite window.scrollY remaining zero. That hides
navigation and makes the position marker negative. Desktop overflow:clip fixes
the BODY scroll; panes/narrow/flow layouts retain their own scrolling. Live
v0.14.2 confirmed clipped overflow is loaded, BODY scrollTop stays zero through
native subject/course selection, search and section expansion, and the workspace
marker and original header/term chooser remain on screen. Loaded course previews
and two section cards retain native form controls without horizontal overflow.
Details stays within Browse and the viewport; Escape returns focus and restores
the loaded results. All six native modules remain present. Record only these
structural checks, never account contents or actual course names.
v0.14.3 deliberately allows document scrolling of the unchanged header at the
user's request. Do not interpret its intentional offscreen position after a user
scroll as the old BODY bug. After the user reloaded v0.14.3, live checks confirmed
the smaller heading and native term selector, visible notices, explanatory
disclosure spacing, all four sidebar widgets, close/Escape/focus, all six modules,
document scrolling away/back and Details bounds when fully scrolled. A native
subject/course selection and search preserved the document's scrolled position
and compact presentation, with a loaded course preview, native-form controls and
no horizontal overflow. BODY scrollTop remained zero. Only structural facts were
retained; no account contents, course names or real-page screenshots were saved.
Never automate enrollment or plan-changing actions during live QA. Extension
manifest permissions remain the exact Class Planner path.

The source is published to the user's fork's planner-redesign branch and tag
v0.14.3 (code SHA db9f48ec1e5cc6ad99594fe812227a14c06eb627). GitHub CI and
release packaging passed. The current beta release is:
https://github.com/comet-ctrl/better-myucla-planner/releases/tag/v0.14.3
The local versioned folder and ZIP are in outputs. Earlier releases are preserved.
The existing unpacked extension folder is the installation target. All 17
installed v0.14.3 files are SHA-256 verified against dist. The preceding v0.14.2
build is backed up alongside earlier versions in outputs. The user reloaded and
refreshed; live v0.14.3 verification passed.
Tidy remains opt-in.

## Archived v0.13.0 handoff

v0.13.0 restores native status text/icons and removes aggregate course badges.
Known title + one DIV body modules now fold locally with consistent chevrons;
primary panes reclaim their column and reopen from persistent named buttons.
Secondary shortcuts unfold their content before locating it. Native header
toggle clicks are captured only in the validated workspace, with original
handlers restored in Original layout. Body inline styles/hidden attributes and
native controls are unchanged. Pane choices survive redraws in memory only.

Latest user constraint: UCLA's original top navigation must remain visible and
unchanged. The term chooser and original plan menus now keep their native
placements. An in-flow marker reserves original space above the wrapper; short
available heights use a flow fallback. Other sections is positioned below its
own summary, fixing a browser-test failure where it covered its close control.
Short windows may require local class-pane scrolling to retain the header.

Typecheck, 165 tests and production build passed. Fictional Chrome checks cover
native navigation/status identity, keyboard folding/reopening, empty-pane
recovery, all six modules, Details, redraws and restoration at seven widths,
including 1536x735; existing search/layout regressions passed. Live inspection
is unverified: automatic approval review rejected the exact Class Planner
URL repeatedly, including after fresh exact-page user authorization. Do not
retry through alternate browser surfaces or broad MyUCLA permission. Complete
isolated checks and request manual verification of the installed update.
`docs/UI_DIRECTION.md` distinguishes implemented fixes from recommended
adjustable panes and contextual course results; those larger changes are not
implemented. Keep work in the existing extension, never a separate app.

The final v0.13.0 build is installed in the existing unpacked extension's dist,
with all 17 files SHA-256 verified. The prior v0.12.2 build is backed up outside
Git. Release folder/ZIP and fictional QA images are in outputs. The user has
been asked to reload the extension, refresh the planner and manually check
navigation and module controls, because live access remains blocked.

Source publication uses the existing `planner-improvements` branch on the
user's `comet-ctrl/better-myucla-planner` fork, not the upstream remote. The
preceding v0.12.2 commit was pushed successfully and CI passed. Build outputs
and fictional screenshots remain outside Git.

v0.12.2 adds outside-click dismissal, an accessible 44px × close button and
an Escape hint to course details. Outside clicks are captured before they can
activate page actions, while the original third-row contents remain interactive.
Focus returns without scrolling. The owned backdrop and document listener are
removed on restore/redraw. Typecheck, all 165 tests and build passed. Isolated
production Chrome checks passed dismissal, focus, native controls, restoration,
redraw and responsive geometry at six widths; search/layout regressions passed.
The installed v0.12.2 build was hash-verified across all 17 files. After the
user reloaded, live QA passed outside-click dismissal, Escape, the × button,
focus return, native section-table interaction/form ancestry and zero page
scroll. All six original sections remain present. No enrollment or plan change
was performed. The planner is left open with details closed. The prior installed
build and fictional QA images are retained locally outside the repository.
The working Git branch is `planner-improvements`. Publish reviewed source to
the user's `comet-ctrl/better-myucla-planner` fork, whose main currently matches
the local base. Do not push to the upstream `Astro-wen` repository. Build files
and local QA screenshots remain untracked. CI runs on main and
planner-improvements. Future live updates require the user to reload the
unpacked extension and refresh the planner; Chrome's internal extensions page
cannot be operated by the browser-control tool.

v0.12.1 widens desktop search to at least 520px and adds Expand search /
Restore columns (Escape also returns) on the existing MyUCLA page. Only the
known `.ClassSearchList .row-fluid.class-info.table-width2` rows get a 940px
minimum width; the narrow column scrolls locally, expanded results use the full
workspace width. No native nodes/controls are replaced or cloned. The three
other panels now have named shortcuts in Other sections (3) & actions:
Plan Optimizer, study list outside this plan, and Personal Entries. Original
layout restores all six native sections; Escape closes the tools disclosure.
Typecheck, 163 tests and build passed. Production-bundle isolated Chrome QA
passed at 1920/1440/1536/1280/960/390px, including fictional nine-column results,
native disclosure/controls, expansion/focus, all six sections, restoration,
partial redraw and local dragging. Search/layout regression harnesses passed.
Live pre-change testing confirmed search was 395px wide at 1536px; native result
rows became ~196px tall from wrapping. First native query returned a MyUCLA
error; a clean page and second query produced section results. Only public
search and course disclosure were used, never Add/Enroll or other plan actions.
The build is installed in `<existing unpacked extension folder>/dist`,
with all 17 build files hash-verified. Prior installed v0.12.0 is backed up in
`outputs/installed-backup-v0.12.0`; release folder/ZIP and fictional QA pictures
are in `outputs/`. User reload and live verification are still pending.

v0.12.0 has been copied into the user's existing
`<existing unpacked extension folder>/dist` and all 17 build files
hash-verified. The prior v0.11.1 files are backed up at
`outputs/installed-backup-v0.11.1`; release folder/ZIP and fictional screenshots
are in `outputs/`. Typecheck, 161 tests and build passed. Isolated Chrome checks
passed workspace bounds at 1920/1440/1536/1280/960/390px, native control identity,
Details/Escape/focus, exact restoration, panel redraw and long-list dragging;
existing search/layout regression checks also passed. Live inspection confirmed
the current native section structure, tidy enabled and no unsaved order before
the update. The user's first reload showed all three panels at 1536x735px,
but Details was missing: MyUCLA's coursetable has a header tbody plus one tbody
per section, so the original first-child selector counted 27 cells. The final
check uses only the first actual header row (nine cells), and the fictional
fixture now reproduces these groups. Corrected Details was verified live: six
buttons, original course-row/form ancestry preserved, headings visible, drawer
within viewport, Escape/focus return, and no unsaved order. Live CSS exposed
native title-cell margins (20px top/5px bottom) and landing margins (30px), which
made cards taller than the original fixture. These are now reset within the
workspace and reproduced in the fixture; six compact test cards fit at the
actual 1536x735 viewport. Final spacing build is installed and hash-verified;
live QA completed after the user's reload. Card heights shrank from roughly
116/96px to 77/57px. All three primary panels fit the viewport, with internal
scrolling for the weekly grid and longer content. First/last class Details,
native column headings/form ancestry, Escape/focus return and Original layout
restoration/return passed live. The main page stayed at scrollY=0. Workspace is
left open, with six Details buttons and no unsaved order. Native search loading
still remains; no full-catalog browsing or background loading was added. No
enrollment action was clicked and no account content was saved.

Latest product direction (2026-10-01): the user explicitly rejected a separate
page and switching between Week/My classes/Find classes. Work only through the
existing Chrome extension on the existing MyUCLA page. Keep schedule, class list
and search visible together in one desktop workspace, reducing page scrolling
and information density. Keep important conflicts and enrollment state visible.

`PlannerWorkspace` moves whole known native sections into a three-column deck
inside their original form. The term chooser remains accessible at the top;
native plan actions and secondary tools go in a disclosure. Compact cards open
their ORIGINAL third row as a fixed details overlay without changing its DOM
ancestry, controls or handlers. Only the read-only heading is copied. Close and
Escape return focus. Original layout restores the stacked sections; disabling
tidy also restores their presentation. Native replacement panels remount via
the controller, without resurrecting disconnected old nodes. Containers with
native content are deliberately not marked owned. Dragging scrolls the class
panel; windows at 1150px or less stack for readability.

Live search inspection found 92 native subject autocomplete rows before
submitting Go. The public titles are already available to browse; full section
times/seats arrive through the native result request. No enrollment/plan action
was clicked. Do not promise all live section details without loading them, or
silently add background requests. The current extension still uses its original
native search flow. The earlier separate course-browser visualization was
rejected; do not present it as the extension or continue building a separate app.

Previously installed copy updated and hash-verified at
`<existing unpacked extension folder>/dist` (folder name remains old,
manifest was 0.11.1). The previous installed build was 0.11.0, so installation
was not the cause of the missing UI. A backup is in the workspace's
`outputs/installed-backup-v0.11.0`. The following turn's live inspection confirmed
the search controls mount after the user's reload. This validates mounting,
not the broader desired course-browsing workflow, which remains unimplemented.
The original live autocomplete and explicit Go search were exercised, without
any plan or enrollment action. No live account content was copied into fixtures.

Search presentation: `ClassSearchPresentation` adds Subject / Instructor / GE
shortcuts, field labels and a More searches disclosure around the existing
native search controls. Native autocomplete inputs, full dropdown, Go input,
form association and handlers remain intact. Shortcut mode changes are explicit
user actions; there is no automatic query submission or extra request.
The live page exposed a v0.11.0 mounting failure: its native options contain
recorded online classes instead of CUTF. Offerings and their order vary by term.
Require exact known common mappings, and validate each grouped action's exact
value/label immediately before forwarding a change. Unknown modes retain the
original dropdown; never guess actions from similar labels. Grouped choices
appear only when offered, and changed options wake reconciliation.
Desktop fields share a row; mobile fields stack. A hint tracks Go's native
disabled state. Required autocomplete selections, not arbitrary typed text,
enable the native Go control (verified with an explicit live search).
The submit caption uses a pointer-transparent overlay. Its temporary aria-label
is restored. Navigation/More/submit wrappers contain native nodes and must not
be marked owned; restore the presentation before general owned-node cleanup.
A comment anchor restores the dropdown panel to its exact original position.
Search-only redraws must wake reconciliation even when the plan table is unchanged.
The optional tidy setting also enables a calm page theme, without hiding sections.
`harness/verify-search.mjs` covers native submit identity, mode choices, field
label updates, search-only replacement, restoration and four viewport widths.

Local layout update: the course rail keeps drag, position and collapse visible,
with top/note actions inside an ellipsis menu. The optional tidy switch also
adds reversible nine-column colgroups and folds recognized exam location
advisories. Originals remain intact. Calendar text insets are on the wrapped
lines, never outer box padding: native content-box `calc(100% - 3px/7px)`
widths already account for solid/double borders. Do not switch these blocks
to border-box or overwrite native positions, dimensions or border styles.

`harness/verify-layout.mjs` exercises fictional percentage-width, overlapping
meetings at four viewport widths, detects the old padding overflow, checks
short-meeting text, menu keyboard behavior, layout reversal and popup version.
The popup identifies the manifest version so an old unpacked build can be distinguished.

Section status update: tidySectionStatuses adds short per-row wording inside
the existing Status column. Native nodes move into a reversible wrapper that
is NOT marked extension-owned, so readOfficialText still reads the originals.
The compact summary is owned and ignored by source readers. The wrapper becomes
a tooltip on hover/focus; Escape dismisses it. Only static known icons/text in
the exact nine-column table shape are supported. Waitlist Taken counts describe
capacity filled, never the student's queue position. No status text is stored
or refreshed by requests. restoreSectionStatuses must run before owned-node
cleanup, and when the tidy switch is disabled.

`README.md` is the project tracker and the place to start. This file is the
architecture and trap list.

## Start here

This is a Manifest V3 Chrome extension for the exact page:

`https://be.my.ucla.edu/ClassPlanner/ClassPlan.aspx`

It enhances the existing UI and reuses MyUCLA's native ordering buttons. It is not an enrollment bot and must never automate enrollment-state changes.

Quick verification:

```bash
npm install
npm run typecheck
npm test -- --run
npm run build
```

Last verified result: TypeScript passed, 155 tests passed across 15 files,
the build completed, and the browser layout/search checks passed at four widths.

Session timeouts (verified in page source, 2026-08-20): `Timeout.js` extends the
idle timer on any `mousedown keydown click` and, when `keepAlive` is set, pings
every two minutes. MyUCLA opens its own warning dialogs (`#divFeatureTimeout`,
`#divMaxTimeout`). Do not rebuild a general-purpose countdown on top of that.

The plan is inside the `ctl00_main_wrapper` UpdatePanel — see
`docs/MYUCLA_CONTRACT.md`. Never attach a MutationObserver to the course table,
never wait only on an iframe `load` event, and never assume `beforeunload` will
catch a MyUCLA-initiated re-render.

Real-page gotchas already paid for — do not regress these:

- `#div_landing > table` interleaves `tbody.course_divider` between course
  `tbody.courseItem` nodes. Anything that walks or restyles rows must account
  for them.
- CSS custom properties declared on our injected elements do **not** reach the
  official course table. Declare tokens on `.pl-plan-root` as well, or every
  `var()` there silently drops the whole declaration.
- The page ships Bootstrap base rules; injected form controls need element-name
  specificity, including `box-sizing` for `input[type=search]`.

Live-page read-only verification on 2026-08-20 confirmed the offscreen frame is
readable, same-origin, and shows the same term/Plan/order as the visible page.
A first real *mutating* run has still not been watched — do that with a course
that only needs one or two steps.

## What is implemented

### Safe server-persisted ordering

Two engines share one contract. `FastReorderCoordinator` is tried first;
`NavigationReorderCoordinator` is the fallback.

`src/content/fast-reorder.ts` (default path):

- Opens one offscreen same-origin `ClassPlan.aspx` frame.
- Requires the frame's contract and term/Plan context key to match before any
  click. The course *order* may legitimately differ (a stale visible page), so
  the run re-plans from the server's real order as long as the course *set*
  matches; a different set returns `unavailable` and the controller falls back.
- After the first click the full expected order must match exactly, every step.
- Clicks one strictly whitelisted native button per full frame load, then
  revalidates the entire expected order.
- Maximum 60 adjacent native moves per action; cancellable at any step.
- The visible page is never reordered by the extension; it reloads once when the
  run ends, restoring scroll position.

`src/content/navigation-reorder.ts` (fallback path, unchanged):

- One native move per full *page* navigation, with a chrome.storage write-ahead
  record and a sessionStorage tab marker so only the initiating tab resumes.
- Maximum 20 moves, 5-minute pending-operation expiry.

Shared:

- Stops on page, term, Plan, DOM, button, or order mismatch.

Confirmation model (changed in 0.6.0): rearranging is local and writes nothing.
The single `保存` button names the number of changes and the estimated wait, and
is the explicit authorisation for the whole batch. This is a deliberate reading
of the "retain user confirmation" rule, not a relaxation of it — the student now
authorises every server write with one informed, deliberate click instead of
being trained to dismiss a confirmation per drag.

Realm note: `MyUclaPlannerAdapter` takes a `Document`, and its button check reads
`HTMLButtonElement` from that document's own view. A bare `instanceof` against
the top frame's constructor is always false for offscreen-frame nodes.

### Where the UI lives (changed in 0.9.0)

Measured on the live page on 2026-08-22:

- Every Class Planner section has a `.classPlanner_SectionTitle` bar: `#2C5E91`,
  7px radius, 5px padding, white 14px ProximaNova. MyUCLA parks that section's
  own actions on the right of it. The plan toolbar therefore mounts **inside**
  `#plannerSectionClip` and adds `pl-host-bar` to it (removed on dispose). The
  old placement above the table survives as a fallback.
- `td.linkPanelRight` is ~300px wide; `.OrderingButtons` uses ~73px. Card
  controls are an `inline-block` beside them, not a second row underneath.
  Do not restore `width: 100%` on `.pl-card-tools`.
- Anything pending lives in `#planner-lift-actionbar`, fixed to the bottom of
  the window: unsaved changes, the restore-a-draft offer, and save progress.
  `html.pl-has-actionbar` exists so the landing chip can dodge it.
- A 17-class plan is ~5,800px tall with 163-246px cards. Assume every move
  leaves the viewport.

### Local/read-only enhancements

- Up to 24-character local tags.
- Search current cards by course, instructor/page text, or tag.
- Per-course collapse and collapse/expand all. Compact mode was removed in
  0.9.0 along with its persisted `compact` view-state field.
- `src/content/page-polish.ts` changes MyUCLA's own markup, and is **gated
  behind the `plannerLift.layout.v1` switch, which is off by default**. This is
  a product rule, not a technical one: our own injected controls are ours to
  design, but MyUCLA's markup is what students already have in their hands, and
  reshaping it is opt-in. 0.10.0 shipped it on for everyone and had to be
  reverted in 0.10.1. Do not turn it back on by default.
  Three further rules hold there: read only text MyUCLA already rendered, never rewrite it (hide the
  original and add ours beside it), and bail out on any shape that does not
  match the contract exactly. Everything it does is undone in `dispose`.
  - The weekly grid lives outside `getRoot()` and MyUCLA re-renders it from its
    own toggles, so `needsReconcile` watches for an untidied `.planneritembox`.
  - The shared column grid is applied only when a `table.coursetable` header row
    has exactly nine cells. Do not widen that check; a different column count
    with fixed widths would misalign every row.
  - A bare `<td>` cannot be parsed from `innerHTML` in a test. Wrap fixtures in
    a `<table>`.
- Drag measures in **document space** (`pageY`), never `clientY`. The page
  scrolls under a long drag, so a viewport-relative delta slides the card out
  from under the cursor. Edge auto-scroll runs on its own rAF loop and
  recomputes the drag from `lastClientY + scrollY` after each scroll step.
- Move feedback: the view is never scrolled for the student. `animateToOrder`
  pins an anchor card, skips the FLIP for a card travelling further than one
  viewport, flashes the landing spot, and raises a chip naming the new position
  with Show me / Undo when the landing spot is off screen.
- Cached course snapshots and status text; search does not re-run the full DOM contract.
- Extension-owned DOM mutations are ignored to prevent reconcile loops.
- Reorder confirmation is an inline page bar instead of a blocking browser dialog; confirmation is still required.
- Existing MyUCLA color picker, multiple Plans, optimizer, and conflict UI are preserved.

## Real-page facts already verified

On 2026-08-19, with the user logged in and explicitly authorizing a minimal test:

1. A native up/down click submitted the MyUCLA form and caused full-page navigation.
2. The expected adjacent pair swapped.
3. A normal refresh retained the changed order, confirming server persistence rather than a DOM-only reorder.
4. The inverse native move restored the original order, and another refresh confirmed restoration.
5. No Enroll, Drop, Remove, Exchange, or Waitlist action was clicked.

Do not repeat live mutation tests casually. If a future DOM change makes revalidation necessary, use one adjacent move, record the original order, immediately restore it, and retain explicit user confirmation.

Exact sanitized selectors and button rules are in `docs/MYUCLA_CONTRACT.md`.

## Architecture map

- `public/manifest.json` — exact URL match and the single `storage` permission.
  Two content scripts: the isolated-world extension, and a page-world bridge
  that reads MyUCLA's timeout counters and nothing else.
- `src/page-bridge/index.ts` — the page-world bridge (reads two numbers, posts
  them same-origin, never writes to the page).
- `src/content/session-clock.ts` — validates those messages and derives the chip.
- `src/content/boot-hold.ts` — the quiet-reload hold.
- `src/content/index.ts` — selects the real MyUCLA controller or local fixture controller.
- `src/adapters/myucla-adapter.ts` — strict real-page DOM and native-button allowlist, bound to one `Document`.
- `src/content/fast-reorder.ts` — offscreen-frame reorder engine and the `PlannerFrame` seam used by tests.
- `src/content/myucla-controller.ts` — toolbar, bottom action bar, card controls,
  filtering, collapse state, tags, move feedback, confirmation UI.
- `src/content/navigation-reorder.ts` — cross-navigation one-step reorder coordinator.
- `src/content/plan-insights.ts` — pure read-only status detection, filtering, and summary logic.
- `src/domain/reorder.ts` — adjacent-move planning and expected-order functions.
- `src/storage/annotations.ts` — validated local tag storage.
- `public/injected.css` — real-page styles; selectors are namespaced with `pl-`.
  Tokens mirror the live page (see `docs/MYUCLA_CONTRACT.md`), and form controls
  need element-name specificity to beat MyUCLA's Bootstrap base rules.
- `src/storage/settings.ts` — the popup on/off switch, watched by the content script.
- `tests/` — DOM contract, queue, controller, insights, storage, and reorder tests.
- `harness/` — headless-Chromium preview. `fixture.mjs` builds an invented plan
  that satisfies the production contract (note: the native buttons must carry
  **no** `type` attribute, or `isSafeMoveButton` rejects them); `run.mjs` loads
  the built `dist/` against it and screenshots into `harness/shots/`;
  `probe-position.mjs` checks that "move to #N" lands on #N from every start.
  Use it before asking the user to reload the extension.
- `scripts/build.mjs` — bundles `dist/` with esbuild.

The fixture/demo adapter remains intentionally separate from the real adapter so looser demo markup cannot weaken the production contract.

## Storage and privacy

Persistent local storage:

- Tags keyed by validated term/Plan/course identifiers.

Temporary local storage during sorting:

- Target course, target position, expected full order, step count, expiry, and random operation ID.
- A random operation ID is also kept in page `sessionStorage` so only the initiating tab resumes.
- Pending state is cleared on success, cancel, failure, or expiry.

There is no fetch, XHR, WebSocket, beacon, telemetry, analytics SDK, or external server.

## Deliberately not built

Each of these was asked for and declined with a reason. Re-read the reason
before implementing one.

- **Unit-cap dates ("when can I go to 22 units", "when can I petition").** The
  Registrar states the second-pass cap is the student's *College or school
  study-list limit*, not a universal number, and excess-unit petitions open with
  second pass rather than on their own date. Any hard-coded number or date would
  be wrong for some students in some terms, during enrollment, when it matters
  most. The overflow menu links to the authoritative page instead.
- **GE requirement tags.** Not present in the Class Planner DOM, so it would
  require scraping the Schedule of Classes per course. GE credit is
  college-specific and a wrong tag can cost a graduation requirement. The
  local note field already lets a student write `GE 社科` and search for it.
- **Background session heartbeat / auto re-login.** Still not built. A timer-based
  ping keeps an unattended machine signed in, which is the exact thing the idle
  timeout protects, and re-login needs credentials and Duo. What *is* built
  (0.8.0) is narrower: MyUCLA's own extend call, fired only by real input on a
  visible, focused tab, at most once a minute, with a hard cap. See
  `docs/MYUCLA_CONTRACT.md`.

## Known limitations

- User must load or reload `dist/` manually through `chrome://extensions`.
- The extension has not been published to the Chrome Web Store.
- Plan/Find view and pane widths are in memory for this page session. The header's
  compact choice is persisted as one local boolean across quarter changes/reloads.
- Tags stay in the local browser and do not sync to MyUCLA.
- Status summaries reflect the currently rendered MyUCLA page; they are not independently refreshed.
- Bruinwalk, DARS, reminders, additional seat polling, and automatic lecture/discussion/lab combination management are not implemented.
- The working branch is `planner-redesign`; upstream origin is read-only
  for this task, and the user's GitHub fork is the publication target.

## Recommended next work

Kept in `README.md` under "State of play" so there is one list, not two. The
short version: watch a real multi-step save end to end, then seat-pressure
bars, then back-to-back gap warnings, then note export/import. Bruinwalk only
as a separate read-only integration with its own privacy review. Avoid DARS and
automated course-combination generation; both substantially expand
sensitive-data and correctness risk.

Do not rebuild a weekly grid. MyUCLA ships one on this page.

### Getting a build onto a macOS user's machine from a Linux sandbox

The mounted folder refuses `unlink`, so `tar x` and `rm -rf dist` both fail with
EPERM, and the user's `node_modules/esbuild` is a darwin binary that will not
run under `device_bash`. What works: build `dist/` in the Linux sandbox, ship it
as a tarball, extract to `/tmp` on the device, and `cat file > dest` over each
existing path. Then the user presses Reload on the extension card.

## Handoff checklist

- Read `AGENTS.md`, this file, `PRIVACY.md`, and `docs/MYUCLA_CONTRACT.md`.
- Preserve the user's existing files and unrelated changes.
- Run tests before and after changes.
- Rebuild `dist/` after source or public asset changes.
- Update `CHANGELOG.md`, this status, and the README when behavior changes.
- Never place real logged-in page data in repository files or tool output intended for sharing.
