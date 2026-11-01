import { describe, expect, it } from 'vitest';
import { findPotentialMatches, MATCH_DATE_WINDOW_DAYS } from './matching.js';

const lost = {
  id: 'lost-1', type: 'lost', title: 'Blue ruled notebook', category: 'Books & stationery',
  location: 'Main Library second floor', date: '2026-10-20', status: 'Approved',
};

const found = {
  id: 'found-2', type: 'found', title: 'Blue notebook', category: 'Books & stationery',
  location: 'Main Library entrance', date: '2026-10-18', status: 'Approved',
};

describe('transparent rule-based potential matches', () => {
  it('suggests only an approved opposite-type report and explains comparison evidence', () => {
    const suggestions = findPotentialMatches(lost, [lost, found]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].report.id).toBe(found.id);
    expect(suggestions[0].reasons).toContain('Same category');
    expect(suggestions[0].reasons).toContain('Similar location wording');
    expect(suggestions[0].reasons).toContain('Dates are close');
    expect(suggestions[0].status).toBe('Suggested');
  });

  it('does not suggest same-type, pending, rejected, out-of-window or date-only pairs', () => {
    const candidate = { ...found };
    expect(findPotentialMatches(lost, [{ ...candidate, type: 'lost' }])).toEqual([]);
    expect(findPotentialMatches(lost, [{ ...candidate, status: 'Pending review' }])).toEqual([]);
    expect(findPotentialMatches(lost, [{ ...candidate, status: 'Rejected' }])).toEqual([]);
    expect(findPotentialMatches(lost, [{ ...candidate, date: '2026-09-01' }])).toEqual([]);
    expect(findPotentialMatches(lost, [{ ...candidate, category: 'Keys & cards', location: 'Remote sports field' }])).toEqual([]);
  });

  it('supports a reviewed-in-this-session label without implying a claim decision', () => {
    const key = [lost.id, found.id].sort().join(':');
    const [suggestion] = findPotentialMatches(lost, [found], [key]);
    expect(suggestion.status).toBe('Reviewed');
    expect(suggestion).not.toHaveProperty('claimStatus');
    expect(MATCH_DATE_WINDOW_DAYS).toBe(14);
  });
});
