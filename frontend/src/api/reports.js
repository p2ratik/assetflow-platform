import client from './client';

export const getReportsOverview = () => client.get('/reports/overview');

export const exportReportsCsv = () =>
  client.get('/reports/export', { responseType: 'blob' });
