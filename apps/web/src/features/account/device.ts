const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** "Chrome on Windows" from a user agent; `name` is null when nothing is recognised. */
export function describeDevice(userAgent: string | null): { name: string | null; mobile: boolean } {
  const agent = userAgent ?? '';
  const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1];
  return {
    name: browser && system ? `${browser} · ${system}` : (browser ?? system ?? null),
    mobile: /Mobi|iPhone|Android/.test(agent),
  };
}
