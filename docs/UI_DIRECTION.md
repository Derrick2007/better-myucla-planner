# Planner UI direction

The extension should improve the existing Class Planner page. Keep UCLA's
original top navigation, term chooser and plan menus accessible and unchanged.
Keep schedule, planned classes and course browsing available together; do not
introduce a separate app or require switching between task pages.

## Implemented in 0.13.0

- Known modules have consistent local fold controls. Closing a main pane frees
  its column; its name remains in the top pane row for reopening.
- The secondary modules remain under Other sections, with named shortcuts that
  open their content. Original layout restores all six native sections.
- Native section status wording and icons remain intact. Compact status
  tooltips and aggregate course badges have been removed.
- The workspace reserves space above it for the original page header and
  menus. Short windows use local pane scrolling or a flow fallback.

## Recommended next design

Three rigid columns still compete for space. The schedule should be the main
work area, with a compact planned-course list and a course browser beside it.
Allow their widths to be adjusted, collapsed and reopened with consistent
controls. Preserve the combined desktop view rather than adding workflow tabs.

Borrow Obsidian's persistent sidebar reopening affordances and stable command
locations, rather than copying its entire interface:

- https://obsidian.md/help/User%2Binterface/Sidebar
- https://obsidian.md/help/User%2Binterface/Ribbon

Course browsing should first show course code, title and a concise section
summary. Selecting a course should expose its available sections in that same
pane. Meeting times and native status text should be easy to compare; room,
instructor and policy details should expand in context. Dock selected-course
details beside the work area when width permits, with Escape and a visible
close control. Preserve the original controls and form association throughout.

This is a recommendation, not a shipped course-browser redesign. The current
nine-column native results still need local horizontal scrolling in the narrow
search pane; Expand search provides more space. Complete live section data
requires MyUCLA's native request. Layout work alone cannot eliminate those
server loads or provide information that has not been fetched. Do not silently
add catalog prefetching, extra queries or polling.

Acceptance checks for the next iteration: readable results at the user's
window size, stable pane resizing with keyboard support, all six modules
discoverable, selected-course context maintained, untouched UCLA navigation,
native statuses and controls, and verified restoration after partial redraws.
