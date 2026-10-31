import { tbilisiDayStart } from './dashboard.service.js';

describe('tbilisiDayStart', () => {
  it('is midnight in Tbilisi (20:00 UTC the day before)', () => {
    // 2026-11-01 10:00 in Tbilisi = 06:00 UTC.
    expect(tbilisiDayStart(Date.UTC(2026, 10, 1, 6)).toISOString()).toBe(
      '2026-10-31T20:00:00.000Z',
    );
    // 2026-11-01 23:30 in Tbilisi = 19:30 UTC: still the same day.
    expect(tbilisiDayStart(Date.UTC(2026, 10, 1, 19, 30)).toISOString()).toBe(
      '2026-10-31T20:00:00.000Z',
    );
    // 2026-11-02 00:10 in Tbilisi = 20:10 UTC on Nov 1: the next day.
    expect(tbilisiDayStart(Date.UTC(2026, 10, 1, 20, 10)).toISOString()).toBe(
      '2026-11-01T20:00:00.000Z',
    );
  });
});
