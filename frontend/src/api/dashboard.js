import client from './client';

export const getDashboardStats = () => client.get('/dashboard/stats');

export const getOverdueAllocations = (limit = 10) =>
  client.get('/dashboard/overdue', { params: { limit } });

export const getRecentActivity = (limit = 20) =>
  client.get('/dashboard/activity', { params: { limit } });
