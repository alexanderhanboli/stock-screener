import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStaticDataUrl } from './runtimeMode';

afterEach(() => vi.unstubAllEnvs());
describe('static data URL configuration', () => {
  it('keeps same-origin data under the configured deployment base by default', () => {
    vi.stubEnv('VITE_STATIC_DATA_URL', '');
    vi.stubEnv('BASE_URL', '/screener/');
    expect(getStaticDataUrl('/manifest.json')).toBe('/screener/static-data/manifest.json');
  });
  it('pins the generation beneath an optional public data root', () => {
    vi.stubEnv('VITE_STATIC_DATA_URL', ' https://data.example.com/daily/// ');
    expect(getStaticDataUrl('/markets/us/home.json', 'g/version/'))
      .toBe('https://data.example.com/daily/g/version/markets/us/home.json');
  });
});
