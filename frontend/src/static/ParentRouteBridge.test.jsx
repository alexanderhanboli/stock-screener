import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import ParentRouteBridge from './ParentRouteBridge';

let descriptor;
let postMessage;
beforeEach(() => {
  descriptor = Object.getOwnPropertyDescriptor(window, 'parent');
  postMessage = vi.fn();
  Object.defineProperty(window, 'parent', { value: { postMessage }, configurable: true });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'parent', descriptor);
  vi.unstubAllEnvs();
});
const mount = () => render(<MemoryRouter initialEntries={['/scan?market=HK']}>
  <ParentRouteBridge /><Link to="/groups?market=HK">Groups</Link>
</MemoryRouter>);

it('does not message the embedding parent unless explicitly configured', () => {
  vi.stubEnv('VITE_STATIC_EMBED_PARENT_ORIGIN', '');
  mount();
  expect(postMessage).not.toHaveBeenCalled();
});
it('sends initial and changed routes only to the configured origin', () => {
  vi.stubEnv('VITE_STATIC_EMBED_PARENT_ORIGIN', 'https://research.example.com');
  mount();
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'hengyuan-screener-route', route: '/scan?market=HK' }, 'https://research.example.com');
  fireEvent.click(screen.getByRole('link', { name: 'Groups' }));
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'hengyuan-screener-route', route: '/groups?market=HK' }, 'https://research.example.com');
});
it.each(['*', 'null', 'javascript:alert(1)', 'https://research.example.com/path'])('rejects unsafe or non-origin targets: %s', (origin) => {
  vi.stubEnv('VITE_STATIC_EMBED_PARENT_ORIGIN', origin);
  mount();
  expect(postMessage).not.toHaveBeenCalled();
});
it('does not emit route messages when opened as a top-level app', () => {
  Object.defineProperty(window, 'parent', { value: window, configurable: true });
  const spy = vi.spyOn(window, 'postMessage');
  vi.stubEnv('VITE_STATIC_EMBED_PARENT_ORIGIN', 'https://research.example.com');
  mount();
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
