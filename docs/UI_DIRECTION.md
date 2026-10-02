# Planner UI direction

Implemented in the 0.14.5 redesign beta, inside the existing Chrome extension
and existing MyUCLA Class Planner page. There is no separate app or catalog
service. Tidy remains opt-in.

## Working layout

- Classes occupy the left sidebar (240px initially); the schedule is the central
  work area; Browse occupies the right sidebar (460px initially).
- Drag the dividers or use Left/Right arrows to resize. Shift adjusts in larger
  steps; Home/End reach the bounds; double-click resets a side pane. The schedule
  retains room while all three panes are open.
- Each pane folds locally once. Its name remains in the toolbar for reopening.
  Closing a supporting pane gives the schedule more space. Widths and pane
  choices are in memory only, with no new storage.
- Tools (3) exposes Plan Optimizer, Study list outside this plan, and Personal
  Entries. Shortcuts open folded content; Escape closes the tools disclosure.
- UCLA's original navigation and plan actions retain their original nodes,
  handlers and placement. Original layout restores all six sections.

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

Unfamiliar or incomplete results keep MyUCLA's original presentation and loading
controls. The extension cannot show information MyUCLA has not loaded. Subject
selection and explicit searches still use native autocomplete and server
requests. No catalog prefetching or polling is added.

## Selected class details

Details dock in the browser pane; the schedule and class list remain interactive.
The native details row stays in its original course tbody and form. CSS positions
it over the reserved content area without cloning a control. The visible close
button or Escape returns to browsing and restores focus. There is no backdrop or
outside-click interception. Narrow windows reveal the same details inline.
The final-exam note expands separately. The heading and section content fit the
available height, including below tall native headers.

Native status wording and icons remain unchanged; there are no aggregate status
badges. Section labels are appended as extension-owned read-only text and removed
on restoration. Hidden native action rows are not reformatted. Partial redraws
discard disconnected presentation references and never resurrect old controls.

## Validation and remaining work

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
