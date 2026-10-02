# Planner UI direction

Implemented in the 0.14.2 redesign beta, inside the existing Chrome extension
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
- UCLA's original navigation, term chooser and plan actions retain their original
  nodes, handlers and placement. Original layout restores all six sections.

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
v0.14.2 prevents that scroll without moving navigation; it still needs a reload
and live confirmation. Enrollment and plan-changing actions are not automated
during verification.
