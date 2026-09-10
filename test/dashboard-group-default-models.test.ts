import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { GroupDefaultModelsRow } from '../src/dashboard/web/group-default-models.js';
import { setDefaultModelsForGroup, type GroupsActionDeps } from '../src/dashboard/groups-action-helpers.js';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.unstubAllGlobals());

it('saves both models to the exact group and bot, and supports clearing', async () => {
  const request = vi.fn(async (_url: string, init: RequestInit) => new Response(JSON.stringify({ ok: true, models: JSON.parse(init.body as string) })));
  vi.stubGlobal('fetch', request);
  const onSaved = vi.fn(async () => undefined);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(GroupDefaultModelsRow, {
    chatId: 'oc_demo', appId: 'app-a', botName: 'Assistant', models: { codex: 'old' }, onSaved,
  })); });
  await act(async () => renderer.root.findAllByType('input')[0].props.onChange({ currentTarget: { value: 'new-codex' } }));
  await act(async () => renderer.root.findAllByType('input')[1].props.onChange({ currentTarget: { value: 'sonnet' } }));
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  expect(request.mock.calls[0][0]).toBe('/api/groups/oc_demo/default-models/app-a');
  expect(JSON.parse(request.mock.calls[0][1].body as string)).toEqual({ codex: 'new-codex', 'claude-code': 'sonnet' });
  expect(onSaved).toHaveBeenCalledOnce();
  await act(async () => renderer.root.findAllByType('input')[0].props.onChange({ currentTarget: { value: '' } }));
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  expect(JSON.parse(request.mock.calls[1][1].body as string).codex).toBe('');
  await act(async () => renderer.unmount());
});

it('retains edits on failed saves and disables writes for unavailable groups', async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'offline' }), { status: 503 }));
  vi.stubGlobal('fetch', request);
  const props = { chatId: 'oc_demo', appId: 'app-a', botName: 'Assistant', onSaved: vi.fn(async () => undefined) };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(GroupDefaultModelsRow, props)); });
  await act(async () => renderer.root.findAllByType('input')[0].props.onChange({ currentTarget: { value: 'draft' } }));
  await act(async () => renderer.update(React.createElement(GroupDefaultModelsRow, { ...props, models: { codex: 'server-refresh' } })));
  expect(renderer.root.findAllByType('input')[0].props.value).toBe('draft');
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  expect(renderer.root.findAllByType('input')[0].props.value).toBe('draft');
  expect(renderer.root.findByProps({ role: 'status' }).children.join('')).toContain('offline');
  expect(props.onSaved).not.toHaveBeenCalled();
  await act(async () => renderer.update(React.createElement(GroupDefaultModelsRow, { ...props, disabled: true })));
  expect(renderer.root.findByType('button').props.disabled).toBe(true);
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  expect(request).toHaveBeenCalledOnce();
  await act(async () => renderer.unmount());
});

it('proxies exact group/bot settings and invalidates the group cache only on success', async () => {
  const proxyToDaemon = vi.fn(async () => new Response(JSON.stringify({ ok: true, models: { codex: 'custom' } })));
  const invalidateGroups = vi.fn();
  const deps = { proxyToDaemon, invalidateGroups } as unknown as GroupsActionDeps;
  expect(await setDefaultModelsForGroup('oc_demo', 'app-a', '{"codex":"custom"}', deps)).toEqual({ status: 200, body: { ok: true, models: { codex: 'custom' } } });
  expect(proxyToDaemon).toHaveBeenCalledWith('app-a', '/api/group-default-models/oc_demo', expect.objectContaining({ method: 'PUT', body: '{"codex":"custom"}' }));
  expect(invalidateGroups).toHaveBeenCalledOnce();
  proxyToDaemon.mockResolvedValue(new Response('{"ok":false}', { status: 503 }));
  await setDefaultModelsForGroup('oc_demo', 'app-a', '{}', deps);
  expect(invalidateGroups).toHaveBeenCalledOnce();
});
