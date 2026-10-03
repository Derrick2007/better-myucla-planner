# Better MyUCLA — Agent handoff

Last updated: 2026-10-03

Current version: `0.14.7` (redesign beta)

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
- UI state such as active search, compact mode, and collapsed cards is session-only and resets after a MyUCLA full-page reorder.
- Tags stay in the local browser and do not sync to MyUCLA.
- Status summaries reflect the currently rendered MyUCLA page; they are not independently refreshed.
- Bruinwalk, DARS, reminders, additional seat polling, and automatic lecture/discussion/lab combination management are not implemented.
- The working branch is `planner-improvements`; upstream origin is read-only
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
