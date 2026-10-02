// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CourseBrowserPresentation } from '../../src/content/course-browser';
// @ts-expect-error Shared fictional browser fixture.
import { workspaceFixtureHtml } from '../../harness/workspace-fixture.mjs';

describe('local course browser',()=>{
 let browser:CourseBrowserPresentation;
 beforeEach(()=>{document.body.innerHTML=new DOMParser().parseFromString(workspaceFixtureHtml(3,true),'text/html').body.innerHTML;browser=new CourseBrowserPresentation();});
 afterEach(()=>browser.restore());
 it('switches loaded previews without invoking native links or changing their controls',()=>{
  const original=[...document.querySelectorAll('.ClassSearchList input')];
  const statuses=[...document.querySelectorAll('.ClassSearchList .data_row > .span3')].map(node=>({node,html:node.innerHTML}));
  const click=vi.fn();document.querySelectorAll('.class-title a').forEach(node=>node.addEventListener('click',click));
  browser.reconcile(document);
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('.pl-browser-index button')];
  expect(buttons).toHaveLength(3);buttons[2].click();
  expect(buttons.map(button=>button.getAttribute('aria-pressed'))).toEqual(['false','false','true']);
  expect(buttons[2].getAttribute('aria-controls')).toBe('container_course_M2');
  expect(document.querySelector('.pl-browser-preview-title')!.textContent).toBe(buttons[2].textContent);
  expect(document.querySelector('#CourseListEntry_M2')!.classList.contains('pl-browser-active')).toBe(true);
  expect(document.querySelector('#container_course_M2')!.classList.contains('pl-browser-body-active')).toBe(true);
  expect(document.querySelector('#container_course_M0')!.classList.contains('pl-browser-body-active')).toBe(false);
  expect(click).not.toHaveBeenCalled();
  expect([...document.querySelectorAll('.ClassSearchList input')]).toEqual(original);
  expect(original.every(node=>node.closest('form')===document.getElementById('aspnetForm'))).toBe(true);
  expect(statuses.every(({node,html})=>node.innerHTML===html)).toBe(true);
  expect(browser.needsReconcile(document)).toBe(false);
 });
 it('filters only loaded headings locally and presents an empty result without submitting a search',()=>{
  const inputs=[...document.querySelectorAll<HTMLInputElement>('.ClassSearchWidget input')];
  const values=inputs.map(input=>input.value);
  const submit=vi.fn();document.getElementById('aspnetForm')!.addEventListener('submit',submit);
  const click=vi.fn();document.querySelectorAll('.class-title a').forEach(node=>node.addEventListener('click',click));
  browser.reconcile(document);
  const filter=document.querySelector<HTMLInputElement>('.pl-browser-filter input')!;
  const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});filter.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(true);
  filter.value='EXAMPLE 103';filter.dispatchEvent(new Event('input',{bubbles:true}));
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('.pl-browser-index button')];
  expect(buttons.map(button=>button.hidden)).toEqual([true,true,false]);
  expect(document.querySelector('.pl-browser-preview-title')!.textContent).toBe(buttons[2].textContent);
  expect(document.querySelector('.pl-browser-filter-status')!.textContent).toBe('1 of 3 courses');
  filter.value='No such course';filter.dispatchEvent(new Event('input',{bubbles:true}));
  expect(buttons.every(button=>button.hidden)).toBe(true);
  expect(document.querySelector('.pl-browser-body-active')).toBeNull();
  expect(document.querySelector('.pl-browser-preview-title')!.textContent).toBe('No matching courses');
  filter.value='';filter.dispatchEvent(new Event('input',{bubbles:true}));
  expect(buttons.every(button=>!button.hidden)).toBe(true);
  expect(document.querySelector<HTMLElement>('.pl-browser-filter-status')!.hidden).toBe(true);
  expect(document.querySelector('.pl-browser-body-active')).not.toBeNull();
  expect(inputs.map(input=>input.value)).toEqual(values);
  expect(submit).not.toHaveBeenCalled();expect(click).not.toHaveBeenCalled();
 });
 it('supports arrow, Home and End navigation without activating native course links',()=>{
  browser.reconcile(document);
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('.pl-browser-index button')];
  const key=(button:HTMLElement,value:string)=>button.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
  buttons[0].focus();key(buttons[0],'ArrowDown');
  expect(document.activeElement).toBe(buttons[1]);expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  key(buttons[1],'End');expect(document.activeElement).toBe(buttons[2]);
  key(buttons[2],'Home');expect(document.activeElement).toBe(buttons[0]);
  key(buttons[0],'ArrowUp');expect(document.activeElement).toBe(buttons[0]);
  const filter=document.querySelector<HTMLInputElement>('.pl-browser-filter input')!;
  filter.value='103';filter.dispatchEvent(new Event('input',{bubbles:true}));
  buttons[2].focus();key(buttons[2],'Home');expect(document.activeElement).toBe(buttons[2]);
  filter.focus();key(filter,'ArrowDown');expect(document.activeElement).toBe(filter);
 });
 it('restores exact markup including original collapsed courses and action handlers',()=>{
  const before=document.body.innerHTML;
  browser.reconcile(document);document.querySelector<HTMLButtonElement>('.pl-browser-toolbar button:last-child')!.click();
  browser.restore();expect(document.body.innerHTML).toBe(before);
 });
 it('leaves incomplete or unknown results in native form',()=>{
  document.querySelector('#container_course_M1 .data_row')!.lastElementChild!.remove();
  const before=document.body.innerHTML;browser.reconcile(document);expect(document.body.innerHTML).toBe(before);
 });
 it('reconciles new native rows without duplicating labels or reviving replaced controls',()=>{
  browser.reconcile(document);
  const row=document.querySelector<HTMLElement>('#container_course_M0 .data_row')!;
  const next=row.cloneNode(true) as HTMLElement;next.querySelectorAll('[data-planner-lift-owned]').forEach(node=>node.remove());
  next.classList.remove('pl-section-card');next.querySelectorAll('.pl-section-field').forEach(node=>{node.classList.remove('pl-section-field');node.removeAttribute('data-pl-field');});
  row.replaceWith(next);expect(browser.needsReconcile(document)).toBe(true);browser.reconcile(document);
  expect(document.querySelectorAll('.pl-browser-toolbar')).toHaveLength(1);
  expect(next.querySelectorAll('.pl-section-label')).toHaveLength(6);
  expect(row.isConnected).toBe(false);expect(browser.needsReconcile(document)).toBe(false);
 });
 it('retains filters, disclosure choices, focus and index scroll through a row-only redraw',()=>{
  browser.reconcile(document);
  document.querySelector<HTMLButtonElement>('.pl-browser-toolbar button')!.click();
  document.querySelector<HTMLButtonElement>('.pl-browser-toolbar button:last-child')!.click();
  const filter=document.querySelector<HTMLInputElement>('.pl-browser-filter input')!;
  filter.value='102';filter.dispatchEvent(new Event('input',{bubbles:true}));filter.focus();
  document.querySelector<HTMLElement>('.pl-browser-index')!.scrollTop=40;
  const row=document.querySelector<HTMLElement>('#container_course_M1 .data_row')!;
  const next=row.cloneNode(true) as HTMLElement;next.querySelectorAll('[data-planner-lift-owned]').forEach(node=>node.remove());
  next.classList.remove('pl-section-card');next.querySelectorAll('.pl-section-field').forEach(node=>{node.classList.remove('pl-section-field');node.removeAttribute('data-pl-field');});
  row.replaceWith(next);browser.reconcile(document);
  const replacementFilter=document.querySelector<HTMLInputElement>('.pl-browser-filter input')!;
  expect(replacementFilter.value).toBe('102');expect(document.activeElement).toBe(replacementFilter);
  expect(document.querySelector('.pl-browser-results')!.classList.contains('pl-browser-editing')).toBe(true);
  expect(document.querySelector('.pl-browser-list')!.classList.contains('pl-section-more')).toBe(true);
  expect(document.querySelector<HTMLElement>('.pl-browser-index')!.scrollTop).toBe(40);
  expect(document.querySelector<HTMLButtonElement>('.pl-browser-toolbar button')!.getAttribute('aria-expanded')).toBe('true');
  expect(document.querySelector<HTMLButtonElement>('.pl-browser-toolbar button:last-child')!.getAttribute('aria-expanded')).toBe('true');
  expect(document.querySelector('.pl-browser-body-active')!.id).toBe('container_course_M1');
  browser.restore();
  expect(document.getElementById('container_course_M0')!.hasAttribute('class')).toBe(false);
  expect(document.querySelector('.pl-browser-preview-title')).toBeNull();
 });
 it('starts a fresh local filter and disclosure state for replacement search results',()=>{
  browser.reconcile(document);
  document.querySelector<HTMLButtonElement>('.pl-browser-toolbar button')!.click();
  document.querySelector<HTMLButtonElement>('.pl-browser-toolbar button:last-child')!.click();
  const filter=document.querySelector<HTMLInputElement>('.pl-browser-filter input')!;
  filter.value='missing';filter.dispatchEvent(new Event('input',{bubbles:true}));
  const fresh=new DOMParser().parseFromString(workspaceFixtureHtml(3,true),'text/html').querySelector('.ClassSearchList')!;
  document.querySelector('.ClassSearchList')!.replaceWith(document.importNode(fresh,true));
  browser.reconcile(document);
  expect(document.querySelector<HTMLInputElement>('.pl-browser-filter input')!.value).toBe('');
  expect(document.querySelector('.pl-browser-results')!.classList.contains('pl-browser-editing')).toBe(false);
  expect(document.querySelector('.pl-browser-list')!.classList.contains('pl-section-more')).toBe(false);
  expect(document.querySelectorAll('.pl-browser-index button:not([hidden])')).toHaveLength(3);
  expect(document.querySelectorAll('.pl-browser-preview-title')).toHaveLength(1);
 });
 it('returns to native presentation when a result becomes unfamiliar',()=>{
  browser.reconcile(document);
  document.querySelector('#container_course_M0 .header-row > .span1')!.textContent='Unknown';
  expect(browser.needsReconcile(document)).toBe(true);browser.reconcile(document);
  expect(document.querySelector('.pl-browser-index')).toBeNull();expect(document.querySelector('.pl-section-card')).toBeNull();
  expect(document.querySelectorAll('.CourseListEntry')).toHaveLength(3);
 });
 it('preserves sibling bodies, native header help, and the global result actions',()=>{
  const root=document.querySelector('.ClassSearchList')!;
  const bodies=[...root.querySelectorAll('[id^="container_course_M"]')];
  const helps=[...root.querySelectorAll('.header-row button')];
  const footer=document.getElementById('fixture-result-footer')!;
  const helpClick=vi.fn();helps[0].addEventListener('click',helpClick);
  browser.reconcile(document);
  expect(bodies.every(node=>node.parentElement===root)).toBe(true);
  expect(helps.every(node=>node.closest('.pl-section-help-row')&&!node.closest('.pl-section-heading'))).toBe(true);
  (helps[0] as HTMLButtonElement).click();expect(helpClick).toHaveBeenCalledOnce();
  expect(footer.parentElement).toBe(root);expect(footer.closest('.pl-browser-body,.pl-browser-course')).toBeNull();
  expect([...root.querySelectorAll('.header-row button')]).toEqual(helps);
 });
 it('supports the older nested body shape but rejects an ambiguous duplicate',()=>{
  for(let i=0;i<3;i++)document.getElementById(`CourseListEntry_M${i}`)!.append(document.getElementById(`container_course_M${i}`)!);
  browser.reconcile(document);expect(document.querySelectorAll('.pl-browser-index button')).toHaveLength(3);
  browser.restore();const body=document.getElementById('container_course_M0')!;
  document.querySelector('.ClassSearchList')!.append(body.cloneNode(true));
  const before=document.body.innerHTML;browser.reconcile(document);expect(document.body.innerHTML).toBe(before);
 });
});
