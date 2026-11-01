import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/apiClient.js';

const AppContext = createContext(null);
const emptyStatistics = { reports: { total: 0, pending: 0, approved: 0, rejected: 0, recovered: 0, lost: 0, found: 0, byCategory: [] }, claims: { total: 0, pending: 0, approved: 0, rejected: 0 } };
const emptyData = { reports: [], claims: [], categories: [], categoryRecords: [], users: [], statistics: emptyStatistics, reviewedMatches: [] };

function mergeReports(...lists) {
  const merged = new Map();
  for (const list of lists) for (const report of list || []) {
    const previous = merged.get(String(report.id));
    merged.set(String(report.id), { ...previous, ...report });
  }
  return [...merged.values()];
}

export function AppProvider({ children }) {
  const [data, setData] = useState(emptyData);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reviewedMatches, setReviewedMatches] = useState([]);

  const loadData = useCallback(async (user) => {
    const [categoryResponse, publicOrAdminResponse] = await Promise.all([api.getCategories(), api.getReports()]);
    const categoryRecords = categoryResponse.categories || [];
    let reports = publicOrAdminResponse.reports || [];
    let claims = [];
    let users = user ? [user] : [];
    let statistics = emptyStatistics;

    if (user?.role === 'admin') {
      const [claimResponse, userResponse, statisticsResponse] = await Promise.all([
        api.getAllClaims(), api.getUsers(), api.getStatistics(),
      ]);
      claims = claimResponse.claims || [];
      users = userResponse.users || [];
      statistics = statisticsResponse.statistics || emptyStatistics;
    } else if (user) {
      const [mineReports, mineClaims] = await Promise.all([api.getMyReports(), api.getMyClaims()]);
      reports = mergeReports(reports, mineReports.reports || []);
      claims = mineClaims.claims || [];
    }

    const next = {
      reports,
      claims,
      categoryRecords,
      categories: categoryRecords.map((category) => category.name),
      users,
      statistics,
    };
    setData((current) => ({ ...next, reviewedMatches: current.reviewedMatches || [] }));
    return next;
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      await api.initializeCsrf();
      const session = await api.getSession();
      const user = session.user || null;
      setCurrentUser(user);
      await loadData(user);
      return user;
    } catch (cause) {
      setError(cause.message || 'The server could not be reached.');
      throw cause;
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [loadData]);

  const refreshAfterAction = useCallback(async (user) => {
    try {
      return await loadData(user);
    } catch (cause) {
      setError(`The server action succeeded, but the latest data could not be refreshed: ${cause.message || 'connection error'}`);
      return null;
    }
  }, [loadData]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await api.initializeCsrf();
        const session = await api.getSession();
        const user = session.user || null;
        if (active) setCurrentUser(user);
        await loadData(user);
      } catch (cause) {
        if (active) setError(cause.message || 'The server could not be reached. Start the backend and refresh this page.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadData]);

  const actions = useMemo(() => ({
    signIn: async (email, password) => {
      const result = await api.login({ email, password });
      setCurrentUser(result.user);
      setError('');
      await refreshAfterAction(result.user);
      return result.user;
    },
    register: async (fullName, email, password, confirmPassword) => {
      const result = await api.register({ fullName, email, password, confirmPassword });
      setCurrentUser(result.user);
      setError('');
      await refreshAfterAction(result.user);
      return result.user;
    },
    signOut: async () => {
      await api.logout();
      setCurrentUser(null);
      setData((current) => ({ ...current, claims: [], users: [], statistics: emptyStatistics, reports: current.reports.filter((report) => ['Approved', 'Recovered'].includes(report.status)) }));
      setError('');
    },
    addReport: async (fields) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'file' && value) form.append('image', value);
        else if (key !== 'file' && key !== 'image' && value != null) form.append(key, String(value));
      }
      const result = await api.createReport(form);
      await refreshAfterAction(currentUser);
      return result.report;
    },
    addClaim: async (reportId, explanation) => {
      const result = await api.createClaim(reportId, explanation);
      await refreshAfterAction(currentUser);
      return result.claim;
    },
    updateReportStatus: async (reportId, status) => {
      const result = await api.updateReportStatus(reportId, status);
      await refreshAfterAction(currentUser);
      return result;
    },
    updateClaimStatus: async (claimId, status) => {
      const result = await api.updateClaimStatus(claimId, status);
      await refreshAfterAction(currentUser);
      return result;
    },
    getReport: (reportId) => api.getReport(reportId).then((result) => result.report),
    markMatchReviewed: (first, second) => {
      const key = [String(first), String(second)].sort().join(':');
      setReviewedMatches((current) => current.includes(key) ? current : [...current, key]);
    },
    addCategory: async (name) => {
      const result = await api.addCategory(name);
      await refreshAfterAction(currentUser);
      return result.category;
    },
    removeCategory: async (name) => {
      const category = data.categoryRecords.find((entry) => entry.name === name);
      if (!category) throw new Error('Category is no longer available. Refresh the page and try again.');
      const result = await api.removeCategory(category.id);
      await refreshAfterAction(currentUser);
      return result;
    },
  }), [currentUser, data.categoryRecords, loadData, refreshAfterAction]);

  const value = useMemo(() => ({ data: { ...data, reviewedMatches }, currentUser, loading, refreshing, error, actions, refresh }), [data, reviewedMatches, currentUser, loading, refreshing, error, actions, refresh]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider.');
  return value;
}
