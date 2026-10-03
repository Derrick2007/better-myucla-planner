# Planner UI direction

Implemented in the 0.16.0 redesign beta, inside the existing Chrome extension
and existing MyUCLA Class Planner page. There is no separate app or catalog
service. Tidy remains opt-in.

## Working layout

- Plan and Find classes are the two main toolbar choices, inside the same page.
  Plan shows a 360px class list beside a larger schedule; Find classes dedicates
  the workspace to native search and course previews. Switching preserves the
  original fields and local selections without remounting them.
- Drag the Plan divider or use Left/Right arrows to resize. Shift adjusts in
  larger steps; Home/End reach the bounds; double-click resets the list width.
  Below 900px, Plan stacks its two modules for legibility.
- Folded plan panes reopen from Tools. Width, view and pane choices are in
  memory only, with no new storage. Escape in Find classes returns to Plan.
- Tools (3) exposes Plan Optimizer, Study list outside this plan, and Personal
  Entries. Shortcuts open folded content; Escape closes the tools disclosure.
- UCLA's original navigation and plan actions retain their original nodes,
  handlers and placement. Original layout in Tools restores all six sections.

## Compact planner introduction

The UCLA banner and navigation are unchanged and scroll away with normal page
scrolling. The planner grows into the available viewport as the introduction
leaves the screen; Classes, Schedule and Browse still scroll independently.
BODY is not a scroll container, preventing its earlier hidden scrolling bug.
Compact header explicitly scrolls the banner away in one click, stopping with
the title, native term selector and notices still visible. Show header returns
to UCLA's menu. The owned button follows manual scrolling and keeps keyboard
focus; no native navigation nodes, styling or handlers change. The boolean
preference is saved locally and reapplied after quarter changes, reloads and
tab return. While compact, Show header releases the minimum scroll position;
keyboard focus on UCLA's menu also restores its access. These preferences contain
no page contents and introduce no polling or requests.

Below UCLA's header, the planner heading is smaller and the original term
selector appears alongside it on desktop. Its native form, parent, options and
handlers remain intact. The original explanatory text and links live under
About this planner; both term notices and native alerts remain visible.
Links & help in the workspace toolbar opens every original sidebar widget in
place, including planner links and enrollment information. Close or Escape
returns focus. Unknown introduction structures keep their native presentation.
Narrow windows place the term control beneath the heading. Original layout or
turning Tidy off restores the native introduction and sidebar.

## Course browsing

Complete, already-rendered result sets show a course index and one selected
course's native sections. Selecting a heading is instant and local; it never
clicks a native disclosure or issues a query. Section cards show section, native
status, days, time, units and existing selection/info controls. Rooms and
instructors reveal together on demand. Edit search exposes the original fields.
Native column help buttons remain accessible. Section bodies retain their native
sibling or nested placement, and global result actions remain visible.

Find classes gives this task the full workspace. At sufficient pane width the
course list and selected-course preview sit side by side; narrow screens stack
them. Plan or Escape returns to the earlier plan pane choices. Filtering course
numbers/titles works only on loaded headings.
The preview repeats the selected course heading so its sections have context;
Up/Down/Home/End move through visible choices. Filter text, disclosures, focus
and list scroll survive section-row redraws while the same result set remains.
New result sets reset them. This state is in memory only.

A single result opens directly with its heading and sections; repeating it in a
course list and filter adds no useful choice. Multi-course results retain those
controls. Find classes also closes the inline class details before hiding their
original class row, so switching tasks cannot leave an empty inspector.

Checked sections in other course previews receive a count and Show selections
disclosure only while needed. Review opens the existing selected course and
clears the local filter without changing native selections. Both list and preview
scroll survive row redraws. Unknown extra controls in a native course heading
keep that result set in its original layout.

One task has visual priority at a time. The schedule and class list support
planning; a full-width course browser supports searching. A restrained segmented
control, fewer enclosing borders and consistent spacing establish the hierarchy.
Section rows respond to the preview's own width, with optional rooms and
instructors revealed on demand.

At 640px of actual preview width, each native section group's original column
headings align with its rows and remain visible while scrolling. Individual
Section, Days, Time and Units labels remain accessible but are visually clipped
to reduce repetition. Narrow cards keep their labels. Location/instructor
values retain local captions when revealed; their native help stays available.

Unfamiliar or incomplete results keep MyUCLA's original presentation and loading
controls. The extension cannot show information MyUCLA has not loaded. Subject
selection and explicit searches still use native autocomplete and server
requests. No catalog prefetching or polling is added.

## Selected class details

Details expand inside the selected class card at every width; the schedule stays
available. The native details row stays in its original course tbody and form.
The visible close button or Escape closes it and restores focus. No floating
inspector, cloned controls or backdrop is needed. The final-exam note expands
separately. Only one card's details is open at a time.
Opening a card near the pane's lower edge reveals the Details header and close
button with a small scroll inside that pane. The document does not jump.

Details is the first class action in both visual and keyboard order. Class
actions is the second: it reveals original order/color controls and note tools
in place. The default card focuses on the course rather than a row of icons.
Every original action remains available; opening the disclosure changes only
presentation. Escape closes it with focus return. Find classes closes it before
hiding the Plan pane.

## Visual system (0.16.0)

Use a readable 14px body scale, stronger section headings, consistent control
sizes and a single quiet workspace surface. Constrain course browsing to a
readable width, including a narrower single-result preview; related section
values should stay together rather than spread across a large monitor. The
course index has a predictable width. Schedule controls are styled in place;
native meeting colors, borders and geometry remain authoritative.

The user's UI-design topic link led to [Oat](https://oat.ink/) for restrained
native-element styling and [daisyUI lists](https://daisyui.com/components/list/)
for clear list hierarchy. These are design references, not bundled dependencies.
Global framework styles would affect UCLA's navigation, so all implementation
styles remain scoped to the validated planner presentation.

Native status wording and icons remain unchanged; there are no aggregate status
badges. Section labels are appended as extension-owned read-only text and removed
on restoration. Hidden native action rows are not reformatted. Partial redraws
discard disconnected presentation references and never resurrect old controls.

## Validation and remaining work

Version 0.16.0 passed typecheck, 220 tests and production build. The full
fictional Chrome suite passed at seven workspace widths, with three single-course
and five introduction widths, including keyboard/touch/mouse actions, note
editing, foreground Tools dismissal, printing, calendar text/geometry and
quarter lifecycle checks. Desktop and narrow screenshots were visually reviewed.
The installed build matches all 17 dist hashes. Live verification awaits the
user's extension reload and Class Planner refresh.

Version 0.15.1 passed typecheck, 213 tests and production build. The full fictional
Chrome suite passed at seven widths, including shared-header alignment/stickiness,
narrow labels, native header help/identity, Details keyboard order and target size,
printing and native redraws. Desktop and narrow screenshots were visually reviewed.
After reload, live verification passed Details placement/size, inline opening,
Close/Escape focus return, native search redraws, shared-header alignment and
accessible native help, optional labels, retained previews and module access.
The page remains compact without horizontal overflow or BODY scrolling. No live
plan/enrollment action was taken; the final view is Plan.

Version 0.15.0 passed typecheck, 211 tests across 20 files and production build.
The production fixture suite covers Plan/Find transitions, preserved native
controls/selections, inline Details, local pane resizing, task persistence on
redraw, all six modules, print, seven widths, compact-header lifecycle and future
quarter transitions. Follow-up checks cover narrow control wrapping, Details
at the bottom of a pane and Tools open/closed before printing. After reload,
live verification passed Plan/Find switching, bottom-of-list Details visibility
and Escape/focus, native search redraws and retained loaded preview, access to
all secondary modules, and compact title/term placement without horizontal
overflow. No live plan/enrollment action was taken.

Fictional production-browser checks cover resizing, focus, folding/reopening, all
six modules, native navigation/control/status identity, result switching without
requests, calendar geometry, redraws, restoration and local dragging. Seven
window sizes include 1536x735 and a narrow stacked fallback.

Authorized live inspection verified resizing, pane reopening, all secondary
modules, real course previews, nested section expansion, native help visibility,
search reopening and Details bounds/dismissal. A native search redraw exposed
BODY scrolling behind the fixed workspace, which could hide UCLA navigation.
The reloaded v0.14.2 build passed native subject/course selection, search and
section expansion with BODY scrollTop remaining zero and UCLA's original header
and term chooser visible. Course previews retain native form controls, and
Details fits Browse, closes with Escape and restores focus/results. All six
native modules remain available. Enrollment and plan-changing actions are not
automated during verification.

The v0.14.3 production fixture adds five introduction widths, ordinary root
scrolling away/back, full-height workspace bounds, native redraws while scrolled,
Details tracking, notices, all sidebar widgets, dismissal/focus and restoration.
Authorized live v0.14.3 verification after reload passed the compact heading and
term/notices, explanatory disclosure spacing, all original sidebar widgets,
close/Escape/focus, scrolling away/back and Details bounds. Native course search
retained the scrolled document position, compact presentation, native form
controls and loaded preview without horizontal overflow.

The 0.14.6 review passed 196 automated tests and production-browser fixtures at
seven widths, including expanded Browse, filtering without submission, preview
headings, keyboard selection, print completeness and native identity checks.
Five introduction widths and root-scroll remount checks also passed, together
with saved header choices across redraws/reloads and both future/current quarter
transitions. Search and calendar/layout regression checks passed. After user
reload, live v0.14.6 verification passed full-width Browse, persistence through
native search updates, side-by-side loaded previews, local filtering/Enter,
Escape/focus return and native form association without horizontal overflow.
Future/current quarter changes retained compact choice and removed obsolete
save controls, then restored all six modules. No plan/enrollment action was
automated; only structural facts were retained.

The 0.14.7 follow-up passed 201 tests and production fixtures at seven widths,
including three single-result widths and fictional checked-selection review.
On October 3 the installed build passed live Details-to-Expand-Browse checks
before and after a native search. One loaded course fills the preview without
a redundant index/filter/count. Escape restores three panes and button focus;
three additional modules remain accessible. Native form association, compact
header choice and zero horizontal overflow were verified. No live selection,
plan or enrollment action was automated. Native initial loading remains.
