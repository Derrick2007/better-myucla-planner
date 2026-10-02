// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SectionCards } from '../../src/content/section-cards';
// @ts-expect-error Shared fictional fixture.
import { workspaceFixtureHtml } from '../../harness/workspace-fixture.mjs';
const fixture=()=>{document.body.innerHTML=new DOMParser().parseFromString(workspaceFixtureHtml(),'text/html').body.innerHTML;return document.querySelector<HTMLTableElement>('table.coursetable')!;};
describe('native section-card presentation',()=>{
 it('keeps original controls first, native statuses exact and hidden action rows untouched',()=>{
  const table=fixture(),before=table.outerHTML,controls=[...table.querySelectorAll('a')];
  const statuses=[...table.querySelectorAll('td:nth-child(3)')].map(node=>({node,html:node.innerHTML}));
  const hidden=[...table.querySelectorAll<HTMLTableRowElement>('tr')].filter(row=>row.style.display==='none');
  const hiddenHtml=hidden.map(row=>row.outerHTML),cards=new SectionCards();
  expect(cards.table(table)).toBe(true);
  expect([...table.querySelectorAll('a')]).toEqual(controls);
  expect(table.querySelector('td:nth-child(2)')!.firstElementChild).toBe(controls[1]);
  expect(statuses.every(({node,html})=>node.innerHTML===html)).toBe(true);
  expect(hidden.map(row=>row.outerHTML)).toEqual(hiddenHtml);
  cards.restore();expect(table.outerHTML).toBe(before);
 });
 it('preserves native class updates and detects disconnected rows during inspection',()=>{
  const table=fixture(),cards=new SectionCards();cards.table(table);
  const row=table.querySelector<HTMLElement>('.pl-section-card')!;row.classList.add('native-updated');
  expect(cards.needsRefresh()).toBe(false);row.remove();expect(cards.needsRefresh()).toBe(true);
  cards.restore();expect(row.classList.contains('native-updated')).toBe(true);expect(row.classList.contains('pl-section-card')).toBe(false);
 });
 it('rejects unknown headers without partially formatting any control',()=>{
  const table=fixture();table.querySelector('th')!.textContent='Unknown';const before=table.outerHTML;
  const cards=new SectionCards();expect(cards.table(table)).toBe(false);expect(table.outerHTML).toBe(before);
 });
});
