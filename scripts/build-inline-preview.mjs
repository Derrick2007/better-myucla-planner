/** Wrap the generated preview for an isolated inline conversation surface.
 * No alternate layout implementation: use the same DOM, CSS and bundle.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const repo = resolve(import.meta.dirname, '..');
if (!process.argv[2]) throw new Error('Pass the absolute output fragment path.');
const source = new JSDOM(await readFile(resolve(repo, 'site/workspace-preview.html'), 'utf8')).window.document;
const fragment = JSDOM.fragment(await readFile(resolve(repo, 'scripts/preview-fragment.html'), 'utf8'));
const root = fragment.querySelector('#better-myucla-build-preview');
const version = JSON.parse(await readFile(resolve(repo, 'public/manifest.json'), 'utf8')).version;
root.dataset.previewBuild = version;
const bootstrap = source.createElement('script');
bootstrap.textContent = `
document.documentElement.dataset.plFictionalPreview = 'true';
// The conversation owns frame height. Map document scrolling to this bounded
// preview surface while keeping the production header controls unchanged.
(() => {
  const root = document.getElementById('better-myucla-build-preview');
  window.scrollTo = (...args) => root.scrollTo(...args);
  window.scroll = window.scrollTo;
  for (const [property, field] of [['scrollY','scrollTop'],['pageYOffset','scrollTop'],['scrollX','scrollLeft'],['pageXOffset','scrollLeft']]) {
    Object.defineProperty(window, property, { configurable: true, get: () => root[field] });
  }
  root.addEventListener('scroll', () => window.dispatchEvent(new Event('scroll')));
})();`;
root.append(bootstrap);
for (const style of source.head.querySelectorAll('style')) root.append(style.cloneNode(true));
for (const meta of source.head.querySelectorAll('meta[name^="planner-"], #preview-build-meta')) root.append(meta.cloneNode(true));
for (const node of [...source.body.childNodes]) root.append(node.cloneNode(true));
const html = [...fragment.childNodes].map(node => node.outerHTML ?? node.textContent).join('');
if (Buffer.byteLength(html) >= 1_000_000) throw new Error('Inline preview exceeds 1 MB.');
if (/<!doctype\s|<\s*(?:html|head|body)(?:\s|>)/i.test(html)) throw new Error('Output must be a fragment.');
await writeFile(resolve(process.argv[2]), html, 'utf8');
console.log(`Inline preview v${version}: ${Buffer.byteLength(html)} bytes`);
