// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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
 it('marks each native result group heading without duplicating labels or changing help controls',()=>{
  document.body.innerHTML=new DOMParser().parseFromString(workspaceFixtureHtml(3,true),'text/html').body.innerHTML;
  const body=document.getElementById('container_course_M0')!;
  const first=body.querySelector<HTMLElement>('.header-row')!,second=first.cloneNode(true) as HTMLElement;
  second.querySelectorAll('button').forEach(button=>button.replaceWith(document.createTextNode(button.textContent!)));
  body.append(second);
  const headings=[first,second],cells=headings.flatMap(header=>[...header.children] as HTMLElement[]);
  cells[0].setAttribute('data-pl-field','native-field');
  const before=body.outerHTML,contents=cells.map(cell=>cell.innerHTML);
  const help=first.querySelector<HTMLButtonElement>('button')!,parent=help.parentElement,handler=vi.fn();help.addEventListener('click',handler);
  const statuses=[...body.querySelectorAll('.data_row > .span3')].map(node=>({node,html:node.innerHTML}));
  const cards=new SectionCards();expect(cards.results(body)).toBe(true);
  expect([...body.querySelectorAll('.pl-section-result-heading')]).toEqual(headings);
  expect(headings.every(header=>header.classList.contains('pl-section-help-row'))).toBe(true);
  expect(cells.map(cell=>cell.dataset.plField)).toEqual([...Array(9).keys(),...Array(9).keys()].map(String));
  expect(cells.every(cell=>cell.classList.contains('pl-section-help-field'))).toBe(true);
  expect(cells.map(cell=>cell.innerHTML)).toEqual(contents);
  expect(body.querySelector('.header-row .pl-section-label')).toBeNull();
  expect(body.querySelector('.data_row .span2 .pl-section-label')!.textContent).toBe('Section');
  expect(statuses.every(({node,html})=>node.innerHTML===html)).toBe(true);
  help.click();expect(handler).toHaveBeenCalledOnce();expect(help.parentElement).toBe(parent);
  cards.restore();expect(body.outerHTML).toBe(before);expect(help.parentElement).toBe(parent);
 });
 it('leaves all result groups native when any shared heading fails validation',()=>{
  document.body.innerHTML=new DOMParser().parseFromString(workspaceFixtureHtml(3,true),'text/html').body.innerHTML;
  const body=document.getElementById('container_course_M0')!;
  const invalid=body.querySelector('.header-row')!.cloneNode(true) as HTMLElement;
  invalid.children[4].textContent='Unknown days';body.append(invalid);
  const before=body.outerHTML,cards=new SectionCards();
  expect(cards.results(body)).toBe(false);expect(body.outerHTML).toBe(before);
  cards.restore();expect(body.outerHTML).toBe(before);
 });
});
