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
  expect(document.querySelector('#CourseListEntry_M2')!.classList.contains('pl-browser-active')).toBe(true);
  expect(click).not.toHaveBeenCalled();
  expect([...document.querySelectorAll('.ClassSearchList input')]).toEqual(original);
  expect(original.every(node=>node.closest('form')===document.getElementById('aspnetForm'))).toBe(true);
  expect(statuses.every(({node,html})=>node.innerHTML===html)).toBe(true);
  expect(browser.needsReconcile(document)).toBe(false);
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
 it('returns to native presentation when a result becomes unfamiliar',()=>{
  browser.reconcile(document);
  document.querySelector('#container_course_M0 .header-row > .span1')!.textContent='Unknown';
  expect(browser.needsReconcile(document)).toBe(true);browser.reconcile(document);
  expect(document.querySelector('.pl-browser-index')).toBeNull();expect(document.querySelector('.pl-section-card')).toBeNull();
  expect(document.querySelectorAll('.CourseListEntry')).toHaveLength(3);
 });
});
