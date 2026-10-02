/** Native percentage sizing with fictional meetings, including collisions. */
import { fixtureHtml } from "./fixture.mjs";

export function calendarFixtureHtml(count = 5) {
  const meeting = (day, slot, left, width, border, top, height) =>
    `<div class="planneritembox${height < 40 ? " smallitem" : ""}" style="background-color:${slot % 2 ? "#f6ecf9" : "#ecf8f9"};border:${border};top:${top}px;height:${height}px;left:${left};width:${width}">DEMO ${day * 10 + slot + 101}<br class="hide-small"><span class="hide-above-small"> · </span>Lec 1<br class="hide-small"><span class="hide-above-small"> · </span>Example Building ${slot + 10}</div>`;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const grid = `<div id="gridDiv" class="sgChecked">
    <div class="fixture-weekdays">${days.map(day => `<div>${day}</div>`).join("")}</div>
    <div class="fixture-weekbody"><div class="hourbox">8<sup>AM</sup></div>${days.map((_, day) => `<div class="timebox">
      ${meeting(day, 0, "0%", "calc(50% - 3px)", "solid 1px #41b5eb", 0, 38)}
      ${meeting(day, 1, "50%", "calc(50% - 7px)", "double 3px #4a2ff1", 20, 55)}
      ${meeting(day, 2, "0%", "calc(100% - 3px)", "solid 1px #41b5eb", 90, 38)}
      ${meeting(day, 3, "0%", "calc(100% - 7px)", "double 3px #4a2ff1", 140, 35)}
    </div>`).join("")}</div>
  </div>`;
  const fixture = fixtureHtml(count)
    .replace("box-sizing:border-box; border:1px solid #9ba7c4", "box-sizing:content-box; border:1px solid #9ba7c4")
    .replace(/<div id="gridDiv" class="sgChecked">[\s\S]*?<\/div><\/div>\s*<div id="ctl00_MainContent_classPlanPanel">/, `${grid}</div><div id="ctl00_MainContent_classPlanPanel">`);
  return fixture.replace("</style>", `
    #gridDiv { display:block; }
    .fixture-weekdays { display:flex; margin-left:40px; background:#24528f; color:#fff; }
    .fixture-weekdays > div { flex:1; text-align:center; padding:4px 0; }
    .fixture-weekbody { display:flex; }
    .hourbox { flex:0 0 40px; }
    .timebox { flex:1; width:auto; min-width:0; height:200px; }
  </style>`);
}
