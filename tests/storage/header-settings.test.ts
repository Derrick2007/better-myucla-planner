// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readHeaderSettings, saveHeaderSettings } from '../../src/storage/settings';

afterEach(() => vi.unstubAllGlobals());

it('stores only the boolean header choice and reads it in a new page session', async () => {
  const stored: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {storage: {local: {
    get: async (key: string) => ({[key]: stored[key]}),
    set: async (values: Record<string, unknown>) => Object.assign(stored, values)
  }}});
  expect(await readHeaderSettings()).toEqual({compact: false});
  await saveHeaderSettings({compact: true});
  expect(stored).toEqual({'plannerLift.header.v1': {compact: true}});
  expect(await readHeaderSettings()).toEqual({compact: true});
  await saveHeaderSettings({compact: false});
  expect(await readHeaderSettings()).toEqual({compact: false});
});

it('does not enable compaction from malformed or truthy non-boolean preferences', async () => {
  for (const entry of [null, true, 'true', {compact: 'true'}, {compact: 1}]) {
    vi.stubGlobal('chrome', {storage: {local: {get: async (key: string) => ({[key]: entry})}}});
    expect(await readHeaderSettings()).toEqual({compact: false});
  }
});
