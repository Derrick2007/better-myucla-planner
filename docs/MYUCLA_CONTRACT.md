# MyUCLA Class Planner 脱敏页面合约

## Class search presentation (2026-10-01, structural inspection only)

- Section: `section.classPlanner_ClassSearchSection`, title `#classSearchTitle`.
- Widget: `#panelSearch > .ClassSearchWidget`; controls `.ClassSearchControls`.
- Native mode: `.searchType select#ctl00_MainContent_cs_searchBy.searchBy`.
  Its change handler triggers the existing native postback. Only an explicit
  user shortcut click dispatches that change; mounting does not change the mode.
- Offerings vary by term: a second live list has `onlinerecorded` in place of
  `cutf`. Require unique option values and exact common value/label mappings;
  do not require a fixed total or order. Every injected action checks its
  exact approved value/label, enabled state and current control contract again
  on click. Unrecognized core controls or common mappings leave search native.
  Grouped secondary choices contain only recognized options actually offered.
  The complete native dropdown remains intact and is visible under More when
  any option is unknown. Never create a shortcut for an unknown option.
- Three `.searchFields > input.ClassSearchBox` text inputs have IDs
  `searchTier0`, `searchTier1`, `searchTier2`. Their aria-label/placeholder and
  inline visibility change after a mode switch. Labels can briefly be empty
  during native initialization; observe only those input attributes to update
  presentation, without reading query values or making requests. Shortened
  visible labels preserve the original wording as their title. Native Go's
  disabled state updates a selection hint: typed text alone may not enable
  search until a required autocomplete suggestion has been selected.
- Native submit: `.goPanel input#ctl00_MainContent_cs_goButton.csGoButton`,
  `type=submit`, `value=Go`. All controls belong to the original POST form on
  the exact Class Planner path. Foreign form overrides reject the presentation.
- Preserve original input/select nodes, names, placeholders, values and handlers.
  The submit caption is a pointer-transparent owned span over the original input;
  no replacement button or automatic submit is used. Its temporary aria-label
  is restored when disabling tidy.
- Navigation, More-search and submit wrappers are deliberately NOT marked owned because they
  contain native nodes. Unwrap them before the general owned-node cleanup.
- Search-only redraws may replace `#panelSearch` without replacing the plan
  table. Reconcile on changed search widget/control identity or public options
  as well. Restore the mode panel at its original comment anchor before
  removing a wrapper that contains it.
- Optional calm section styling requires `.classPlannerWrapper` containing the
  known class-plan panel. No section is hidden or moved by the page theme.

验证日期：2026-08-19。本文只记录实现需要的结构，不包含课程名称、用户标识、凭证或请求内容。

## 页面边界

- Origin：`https://be.my.ucla.edu`
- Path：`/ClassPlanner/ClassPlan.aspx`
- 表单：`#aspnetForm`，`POST` 回同一路径
- 列表：`#ctl00_MainContent_classPlanPanel #panelPlan #div_landing > table`
- 直属课程卡：`:scope > tbody.courseItem`
- 学期选择器：`#ctl00_MainContent_termSessionChooser_TermChooser`
- Plan 字段：`#ctl00_MainContent_planIDField`

课程卡使用 `Class<数字> courseItem itemClass`（首卡另有 `firstClass`），扩展只接受唯一、受限长度的数字课程标识。

每张课程卡是一个 `<tbody>`，固定三行：

1. `td.SubjectAreaName_ClassName` + `td.linkPanelRight[rowspan=2]`
2. 标题下方的单个 `td`
3. 跨两列的 `td[colspan=2]`，内含 `table.coursetable`

注入样式的卡片描边必须按这三行的具体单元格来画，不能假设每行都有两个单元格。

页面自带 Bootstrap 基础样式（`select{width:220px}`、`input{width:206px}`、表单控件固定 height/padding、
`input[type=search]{box-sizing:content-box}`）。注入控件用元素名提高特异性压过这些规则，不用 `!important`。

页面同时提供 `iwe_icon_fonts.css` 图标字体，官方排序箭头用的就是 `icon-circle-arrow-up/down`。
注入控件复用同一套 `icon-*` 类名（`icon-reorder`、`icon-double-angle-up`、`icon-tag`、
`icon-chevron-down`、`icon-ellipsis-horizontal`），以保持与官网一致的观感。

## 排序按钮白名单

每张课程卡只允许：

- 上移：`button.link.moveupClass`，ID 为 `muClass<课程数字>`
- 下移：`button.link.movedownClass`，ID 为 `mdClass<课程数字>`
- 英文 title 和 aria-label 必须与方向精确对应
- inline `onclick` 必须是已验证的 `courseListAction(...)` 格式，并引用同一课程数字
- 按钮必须属于 `#aspnetForm`，且不能自带 `formaction`、`formmethod` 或 `formenctype`

首张卡的上移与末张卡的下移通过 `visibility: hidden` 隐藏。执行前扩展会再次确认目标按钮可见且未禁用。

## 排序命令格式

`courseListAction(...)` 最终只是 `__doPostBack(sourceID, commandContent)`。页面上出现过的
command 形如 `moveupClass|<课程数字>!0`、`movedownClass|<课程数字>!0`、
`colorchange|<课程数字>!<颜色>!0`、`toggleAlternates|<课程数字>!0`，以及
`Remove Class From Plan|<科目>!<课号>!<课程数字>!0` 等。

结尾的 `!0` 出现在**所有**命令上（包括本身没有位置概念的 colorchange），因此它不是"移动几位"的参数。
官网没有"移动到第 N 位"的命令，只有与相邻课程交换。要移动 N 位就必须发生 N 次回发。

## UpdatePanel（2026-08-20 修正）

页面初始化脚本中：

```js
Sys.WebForms.PageRequestManager._initialize('ctl00$scriptManager1', 'aspnetForm',
  ['tctl00$main_wrapper',''], [], [], 90, 'ctl00');
```

`ctl00_main_wrapper` 是注册过的 **UpdatePanel**，整张课程表在它内部。因此
`courseListAction` 触发的排序、改颜色等操作**可能是异步局部回发**：服务器只返回
增量，MS AJAX 直接替换该 panel 的内容，**不触发 `load`、不发生页面导航**。

对实现的硬性要求：

- 注入 UI 必须挂在 panel 之外的稳定节点上观察（本项目观察 `document.body`），
  否则 MutationObserver 会随着旧节点一起失效，插件在一次改颜色后就再也不回来。
- 等待一步排序完成时**不能只等 `load` 事件**，必须轮询 DOM 直到出现预期顺序，
  这样整页导航和局部回发两种形态都能处理。
- 局部回发会用服务器顺序覆盖本地未保存的排序，且**不触发 `beforeunload`**。

## 冲突标记（2026-08-20 修正）

`div.final_exam_info.exam_conflict` 是**布局容器，出现在每一张课程卡上**，不是冲突
状态。以它判断冲突会把 17 门课全部误报为冲突。真实冲突只在 MyUCLA 渲染出显式控件
时存在：`[aria-label='Exam Conflict Info']` / `[title='Exam Conflict Info']`，时间
冲突同理。

## 已验证行为

1. 点击一次原生排序按钮触发表单提交（在 UpdatePanel 下可能表现为局部回发）。
2. 提交后只有目标课程与相邻课程交换。
3. 普通刷新后新顺序仍然存在，因此顺序已由 MyUCLA 保存，不是扩展只改页面显示。
4. 用反方向按钮复原并再次刷新，验证前的顺序已恢复。

## 离屏 frame（2026-08-20 只读验证）

在已登录页面上以只读方式建立一个同源 `ClassPlan.aspx` iframe：

- 未被 X-Frame-Options / CSP 阻止，`contentDocument` 可读；
- frame 内的课程数量、学期、Plan ID 与可见页面完全一致；
- frame 内每张卡都带有通过白名单校验的原生上移/下移按钮。

因此多步排序可以在离屏 frame 内逐步完成，可见页面只在最后刷新一次。
本次验证没有点击任何按钮，也没有改变任何顺序。

## 更新策略

任何必需选择器、按钮属性、课程唯一性、表单路径、学期/Plan 格式或预期完整顺序不匹配时，扩展停止操作并清理待办状态。重新适配官网更新前不得放宽到模糊按钮匹配。

## 冲突标记（2026-08-20 再次修正）

第一次修正（只认 `[aria-label='Exam Conflict Info']`）修过头了：**时间冲突没有任何
class 或 aria-label 标记**，因此会被完全漏掉。

真实结构：冲突信息在 `a.uit-clickover-bottom` 的 `data-content` 里，是一段
MyUCLA 自己写的 popover HTML：

```html
<div class="popover_section_title warning light">Warning: Time Conflicts</div>
<ul class='bulleted_list'><li>DESMA 10</li><li>ENGR 170</li></ul>
```

标题为 `Warning: Time Conflict(s)` 或 `Final Exam Conflict`，`<li>` 就是冲突对手的
课程代号。判定必须按 `data-content` 的文本，不能按 class、aria-label 或图标——
`icon-warning-sign` 同样用在 `Additional Information` 之类的普通提示上。

注意：同一份 plan 内 `tip-*` 这些 id 会重复，不可作为唯一键。

## 周历方块的边框就是选课状态（2026-08-27 只读验证）

`#gridDiv .planneritembox` 的 inline style 里，`border` 的样式表示这门课属于哪一类。
**这不是推断，是 MyUCLA 自己在控件的帮助气泡里写的**（`div.classPlanner_SectionMenu`
里那三个 `uit-clickover-bottom` 按钮的 `data-content`）：

| 边框 | MyUCLA 的原话 |
| --- | --- |
| `double 3px` | enrolled/waitlisted classes appear with a double border |
| `solid 1px` | Planned classes appear with a solid border |
| `dashed 1px` | Alternates appear with a dashed border |

注意 `double` 是 **enrolled 或 waitlisted**，不是只有 enrolled。在一份 7 门课、
20 个方块的真实 plan 上逐个核对与上表一致，但那份 plan 里没有 waitlist 的课，
因此 waitlist 这一半只有 MyUCLA 的原话为证，尚未在真实页面上见过。

同一门课的所有方块颜色一致（`background-color` / `color` / 边框色三个值成套），
因此颜色可以在**周历内部**把同一门课的方块归为一组。但它不能用来对应到下面的
课程卡：卡片上没有任何元素带这个颜色，`.colorswatch` 这个选择器在真实页面上不
存在（返回空集）。

对实现的意义：注入 UI 要表达「已选上 / 还在计划 / 备选」时，这三种边框是**页面
自己已经在用的记号**，学生在周历上已经在读它了。不要另发明一套，也不要用同一个
记号表示别的意思。

样例（脱敏，只保留结构与颜色）：

```html
<div style="background-color: #F9F9EC !important; color: #605F20;
            border: double 3px #CECD6B; top: 48px; left: 0%;
            width: calc(100% - 7px); height: 35px;"
     class="planneritembox smallitem">MGMT 170<br class="hide-small"><span
     class="hide-above-small"> </span>Lec 1<br class="hide-small"><span
     class="hide-above-small"> </span>Entrepreneurs Hall C314</div>
```

方块本身**没有 id，也没有任何 data 属性**，三行文字依次是课程代号、section、地点。

Layout sizing check (2026-10-01, numeric DOM measurements only): day columns
and meeting blocks use content-box sizing. Full-day blocks use
`calc(100% - 3px)` for solid borders or `calc(100% - 7px)` for double borders;
collisions use the same deductions with 50% widths and 0%/50% positions.
Adding outer horizontal padding makes these boxes spill into the next lane.
Keep native inline geometry and apply text insets to owned inner line spans.

## 周历上方的三个显示开关（2026-08-27 只读验证）

容器是 `div.classPlanner_SectionMenu.plannerMenuLinks.checkboxStateHolder`，
当前状态写在容器自己的 class 上：`studylistChecked`、`planChecked`、
`alternatesChecked`。

每个开关是一个 `span#<name>ShowHide`，里面两段：

1. `<span>` 包一个 `uit-clickover-bottom link` 按钮，按钮文字就是标签（`Study List`
   / `Plan` / `Alternates`），`onclick="return false"` —— 它只负责弹帮助气泡。
2. `<span class="show<name> icontoggle gridsizeicons">`，里面**两个绝对定位的按钮
   叠在一起**：`icon-check-empty` 与 `icon-check`。显示哪一个由容器上的状态 class
   决定，点击则同时改状态 class 并发 `triggerPostback('<n>|+' / '<n>|-')`。

也就是说这些「复选框」**不是 `input[type=checkbox]`**，是两个叠放的按钮加一次回发。
注入自己的开关时可以沿用同一套结构和图标，但**不得调用 `triggerPostback`**，
也不得复用它们的 id。

## 课程卡的 section 表（2026-08-27 只读验证）

`tbody.courseItem` 第三行里的 `table.coursetable` 是九列：

```
Change | Section | Status | Info | Days | Time | Location | Units | Instructor
```

`Section` 与 `Location` 两列的写法和周历方块的第二、三行**逐字一致**（`Act 1` /
`Entrepreneurs Hall C314`），而周历方块的课程代号用缩写（`MGMT 170`），
卡片标题用全称（`Management 170`）——**课号部分两边相同，只有学科名不同**。

表格最后一行是 Plan Actions / Enrollment Actions，其中包含 **Enroll 按钮**。任何
注入行为都不得触碰这一行。

Status-cell structure check (2026-10-01, element structure only): the third
cell uses an empty `i.icon-ok` or `i.icon-unlock`, text, and an optional `br`
before capacity text. The compact view also supports the previously recorded
empty span icons. Only known static status text is folded. Interactive notices
and unfamiliar markup remain native. The original nodes must remain readable
by source readers and be restored on disabling the tidy layout. A waitlist
"Taken" count means filled capacity, not a student's position in the queue.

## 会话超时：只补在场信号，不做后台心跳

`IWE/js/Timeout.js` 的事实：

- 空闲超时由服务器下发，本次观测为 15 分钟；绝对上限 `maxTimeoutMinutes` 为 239 分钟。
- `$(document).on("mousedown keydown click", ...)` 会在任何一次交互后调用
  `ExtendSession()`（内部 60 秒节流），因此**正在操作的用户不会撞到空闲超时**。
- `if (keepAlive) setInterval(ExtendSession, 2 * 60000, true)` —— 是否常驻心跳由页面决定。
- MyUCLA 自带 `#divFeatureTimeout` / `#divMaxTimeout` 两个警告框。

补充观测（2026-08-20，Class Planner 页）：`keepAlive` 为空字符串，即**本页没有
常驻心跳**，只有交互能续期。而 `Timeout.js` 监听的是 `mousedown keydown click`，
**不含 scroll 与 mousemove**——因此一个正在滚动阅读计划的学生会被判定为"不在"。

本扩展在用户明确要求并知情的前提下实现 **presence-based keep-alive**，边界如下：

- 只由真实输入事件触发：`scroll` `wheel` `mousemove` `keydown` `pointerdown`
  `touchstart`；**没有任何定时器**。
- 必须 `visibilityState === "visible"` 且 `document.hasFocus()`。切走或失焦即停。
- 自身节流 60 秒一次，且调用的是页面自己的 `ExtendSession(false)`（它另有 60 秒节流
  和自己的 CSRF token）。扩展不构造任何请求。
- 有硬上限（默认 60 分钟，可设 30 / 60 / 120 / 不限），超过后彻底停止。
- 默认开启，可在扩展弹窗关闭。

因此人一旦离开，会话仍按原本的时间线过期。

**仍然不做**：后台定时心跳、自动重新登录。绝对上限（约 239 分钟）无法续期，
重新登录需要凭据和 Duo，本项目从不接触这两样。
## Optional one-page workspace (0.12.0)

Mount only when `#ctl00_MainContent_classPlanPanel` is directly inside
`.classPlannerWrapper` in `form#aspnetForm`, with one direct section/title pair
for Calendar (`classPlanner_CalendarSection` / `plannerSectionCal`), Plan
(`classPlanner_ClassesInPlanSection` / `plannerSectionClip`) and Search
(`classPlanner_ClassSearchSection` / `classSearchTitle`). Move the whole native
sections with restoration anchors, preserving the form and descendants.
Native-containing containers must not carry `data-planner-lift-owned`.

The Details view requires the recorded three-row course-card/nine-column
section-table shape. Its native third row stays inside its original tbody; CSS
positions it over an owned, read-only heading. Never clone controls or rewrite
native handlers. All move-button contracts continue to apply. Escape closes and
restores focus. Partial panel replacement drops old anchors and remounts without
reinserting stale native nodes. No additional query, polling or submit is added.

Live coursetables contain a COLGROUP, a header TBODY and one TBODY per section;
each section has its normal row and a hidden controls row. Inspect the first
actual TR for its nine columns, never `tr:first-child` across all row groups.
If any card's details shape becomes unfamiliar, restore the stacked layout so
native information cannot be hidden behind a missing Details button.

Workspace search sizing (0.12.1): the native result row shape is
`.ClassSearchList .row-fluid.class-info.table-width2`, with `.span1` through
`.span9` cells. Only that known row class gets a readable minimum width.
Expand search is a local CSS mode on the existing deck, with no native node
cloning or submission. The original result controls and course disclosure stay
in their form. Other sections remain native inside the top disclosure, with
owned scroll shortcuts; Original layout restores all six section placements.

Details dismissal (0.12.2): an owned backdrop provides an outside-click target.
A capture listener consumes clicks outside both the owned heading and the
original third row before they can invoke native page actions. Clicks inside
the original row are untouched. Escape and the accessible × button also close;
focus returns without scrolling. Restore removes the listener and backdrop.

## Local pane folding and native navigation (0.13.0)

Local folding requires a known section with an identified direct title and one
direct DIV body (exactly two element children). Unfamiliar primary shapes keep
the native stacked layout; unfamiliar secondary shapes keep their native
controls. Never invoke a native postback merely to open or close a pane.

An owned chevron controls presentation classes on the original section/body.
Capture only clicks on a direct `button.planSectionToggle` in that title, to
avoid applying both the native and local toggles. Keep the button attributes and
handler unchanged. Do not intercept other title actions or body controls.
The original body's inline style/hidden attribute stays unchanged; workspace
CSS reveals or folds only that validated body. Restore removes classes,
controls and listeners. Pane choices survive redraws in memory only.

Primary panes have persistent named buttons outside the deck; closed panes take
no column space. Secondary shortcuts unfold before scrolling/focusing. An
in-flow owned position marker reserves the original space above the wrapper;
the term chooser, plan menus and all external navigation keep their native
placements. Insufficient vertical room selects a flow fallback. Other sections
is positioned below its summary using geometric measurements.

Native section statuses are no longer folded or summarized. Existing compact
wrappers are unwrapped as migration cleanup; icons, text and node identity must
remain unchanged while tidy is enabled. No aggregate status badge is inserted.

## Resizable workspace and course browser (0.14.0)

This replaces the rigid columns, full-width search mode and modal details.
Primary order is Classes, Schedule, Browse. Owned dividers resize side columns
locally, via pointer or keyboard. Width clamps reserve schedule room; no stored
preference or native request is added. All original navigation placement and
folding contracts above still apply.

Dock details in the Browse pane. The original third row remains under its
original tbody; only its CSS coordinates change. Section-card formatting requires
an exact nine-TH header: Change, Section, Status, Info, Days, Time, Location, Units,
Instructor. Mark only nine-TD data rows with unit colspans/rowspans; hidden action
rows remain untouched. Append owned labels after existing children, preserving
first-child controls and native status innerHTML. Never label or rewrite status
content. Close/Escape restores focus; other planner controls remain interactive.
On narrow windows move only the owned heading inline, never a native table.

Course previews require exactly one direct .ClassSearchList beneath the existing
.ClassSearchWidget in section.classPlanner_ClassSearchSection > #panelSearch.
Each direct .CourseListEntry must have CourseListEntry_M<digits>, a direct
.class-title > h3.head > a, and exactly one matching #container_course_M<digits>
either directly in the entry or as a direct sibling in .ClassSearchList.
Every recorded .row-fluid.class-info.table-width2 row must have exactly nine
.span1 through .span9 cells, with at least one header (Select then the eight labels above)
and at least one data_row. Incomplete/unknown sets remain native in their entirety.
Headers also accept the exact native Day(s), Time in Pacific Time and
Instructor(s) labels, normalizing whitespace only. Every header must match.
Native help buttons remain accessible in their original header cells. Body
selection handles the sibling and nested shapes independently of their headings.
Only headings are copied as read-only index button text; section cells and actions
remain in place. Selection never invokes a native course link or query. Retain
all controls, messages and action rows. Only the selected native result entry is
visible; Rooms & instructors changes local cell visibility. Edit search reveals
the original fields. Added/replaced rows, cells, entries or headings reconcile;
restoration removes owned labels/classes/index and preserves native hidden states.

## Native BODY scrolling (0.14.2)

The live native layout can constrain BODY while content outside the fixed planner
extends below it. Native postbacks or focus can scroll BODY even when its overflow
is hidden; window.scrollY and document.scrollingElement.scrollTop can both remain
zero. This makes the workspace's position marker negative and hides navigation.
Desktop workspace CSS uses overflow:clip on BODY so it is not a scroll container.
Pane scrolling stays local. Narrow/flow layouts retain overflow:auto. Do not
move or clone UCLA navigation to compensate for this scroll behavior.

Authorized live v0.14.2 verification after reload confirmed overflow:clip and
BODY scrollTop zero through native subject/course selection, search and section
expansion. The original header and term chooser stay on screen and the workspace
position marker stays stable. Only structural measurements were retained.

## Compact introduction and intentional document scrolling (0.14.3)

This supersedes the desktop overflow:clip rule above. The user explicitly wants
UCLA's unchanged banner to scroll away. HTML is the document scroll container;
BODY has visible overflow and cannot scroll independently. A passive root-scroll
listener reads the marker's viewport position (without adding window.scrollY),
updates workspace/Details bounds, and reserves a stable full-height owned spacer.
Narrow and short-window flow fallbacks retain normal document flow. Remove the
spacer/listener/CSS state on restoration. Never style or move UCLA's masthead/menu.

Compact only the exact section#layoutContentArea containing direct h2#titleText
with public text Class Planner, #div_page_title_section2 > div#page_title_text,
and layout-columnwrapper.col-2MR > main-content#main-content + right-sidebar.
The term container must be main-content's direct #ctl00_MainContent_termSessionChooser
with div.term_display + div.term and exactly one native select with the recorded
term chooser ID, directly under div.term and associated with form#aspnetForm.
Unknown shapes leave the introduction native.

The native term container, selector and sidebar keep their parents/handlers.
An owned Term label identifies the existing selector. Only the duplicate static
term display is visually hidden. Native introductory text/links are wrapped in
an unowned details container with an owned summary. Preserve native replacement
children when unwrapping; never resurrect disconnected text. Static, control-free
direct notice DIVs get compact spacing and remain visible; #AlertDiv is untouched.
Links & help toggles a CSS class on the original sidebar; no widget content is
read or copied. Its close control/Escape returns focus. Containers with native
descendants must not be marked extension-owned. Restoration removes only owned
controls/classes and restores the original text placement and sidebar styles.

## Explicit header compaction (0.14.4)

The owned Compact header / Show header button mounts only with the validated
introduction. Its type is button, never submit. An explicit click scrolls the
root document until the existing title is 12px from the viewport top, retaining
the native term chooser and notices. Show header returns to scrollTop zero.
The button follows manual root scrolling and retains focus without scrolling.
It does not inspect, style, hide, move or clone UCLA masthead/menu nodes, invoke
native handlers, submit a form, store state or introduce requests. Original
layout and Tidy restoration remove the owned control.

## Persistent compaction (0.14.5)

The explicit choice is a single local boolean, `plannerLift.header.v1.compact`.
The controller reads it before mounting. Intro remounts retain the choice;
root-scroll, load/pageshow, resize and visibility/focus events reapply the
minimum document scroll position while compact. There are no timers or queries.
Scrolling deeper is unaffected. Show header releases the minimum and saves false.
Focus inside the original `layout-headerwrap` releases compaction and saves false
so keyboard access to native navigation is never blocked. Only ancestry/bounds
are inspected, never menu content. Preference writes are ordered, and failures
are reported in the control tooltip. Remove all listeners on restoration.
Native masthead/menu/term nodes, styles, handlers and forms remain unchanged.

Bootstrap presentation only on the exact origin/path, including empty/future
quarters. The validated introduction may mount its owned toolbar in normal flow
without a course table. Its root-scroll CSS keeps BODY non-scrollable and gives
the introduction enough flow height to scroll the original masthead away. All
future-plan content stays native. This does not relax inspectContract or mount
course controls when it fails. Observe the existing BODY for native replacement;
initialize course tools only after the original adapter contract passes, then
restore presentation-only mode if a later quarter has no editable table.

## Browser presentation and lifecycle review (0.14.6)

Expand Browse is an owned button on the validated search title. It changes the
existing deck's CSS columns/visibility only. Restore panes, Escape and named pane
buttons restore access; no native section handler is invoked. The original-layout
return button is reattached only inside the known wrapper/form after redraw.

An unnamed owned search input filters only the already-copied public result
headings. Enter is prevented from submitting the native form. Arrow keys and
Home/End select visible owned index buttons; aria-controls points to the existing
native course body. An owned preview heading repeats that course label. Retain
local filter/disclosure/scroll/focus only when root, entry, body and heading
identities and heading text still match; new results reset these local choices.
Restore removes all owned nodes and preserves the native class-attribute state.
Print reveals all loaded bodies and optional room/instructor cells without
viewport clipping. No native query input is read and no extra request is sent.

Controller startup/redraw/save continuations are generation- and disposal-guarded.
Every term/plan transition clears obsolete in-memory course state and reloads
the existing keyed notes/view/draft records. Ignore stale asynchronous results;
preserve prior-context persisted drafts. Recheck the strict native contract and
active context before any local move/tag/save. Invalid/future contexts remove
obsolete course/save UI and allow only independently validated introduction
presentation. The native adapter and permissions remain unchanged.
