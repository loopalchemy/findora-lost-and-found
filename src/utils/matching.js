export const MATCH_DATE_WINDOW_DAYS = 14;
const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function locationSimilarity(a, b) {
  const left = normalize(a).split(' ').filter((token) => token.length > 2);
  const right = new Set(normalize(b).split(' ').filter((token) => token.length > 2));
  return left.some((token) => right.has(token));
}

function daysBetween(a, b) {
  const first = new Date(`${a}T00:00:00Z`).getTime();
  const second = new Date(`${b}T00:00:00Z`).getTime();
  return Number.isFinite(first) && Number.isFinite(second) ? Math.abs(first - second) / 86400000 : Infinity;
}

export function findPotentialMatches(report, reports, reviewedMatches = [], dateWindow = MATCH_DATE_WINDOW_DAYS) {
  if (!report || !['lost', 'found'].includes(report.type) || !['Approved', 'Recovered'].includes(report.status)) return [];
  return reports.filter((candidate) => {
    if (candidate.id === report.id || candidate.type === report.type || !['Approved', 'Recovered'].includes(candidate.status)) return false;
    return daysBetween(report.date, candidate.date) <= dateWindow;
  }).map((candidate) => {
    const reasons = [];
    let score = 0;
    if (normalize(report.category) && normalize(report.category) === normalize(candidate.category)) { reasons.push('Same category'); score += 3; }
    if (locationSimilarity(report.location, candidate.location)) { reasons.push('Similar location wording'); score += 2; }
    const delta = daysBetween(report.date, candidate.date);
    if (delta <= dateWindow) { reasons.push('Dates are close'); score += Math.max(1, 2 - delta / dateWindow); }
    return { report: candidate, score, reasons, status: reviewedMatches.includes([report.id, candidate.id].sort().join(':')) ? 'Reviewed' : 'Suggested' };
  }).filter((match) => match.reasons.some((reason) => reason !== 'Dates are close')).sort((a, b) => b.score - a.score || a.report.date.localeCompare(b.report.date));
}
