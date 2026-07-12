import client from './client';

export const listMaintenanceRequests = (params = {}) =>
  client.get('/maintenance', { params });

export const createMaintenanceRequest = (data) =>
  client.post('/maintenance', data);

export const approveMaintenanceRequest = (id) =>
  client.post(`/maintenance/${id}/approve`);

export const rejectMaintenanceRequest = (id, reason) =>
  client.post(`/maintenance/${id}/reject`, { reason });

export const assignMaintenanceTechnician = (id, technician) =>
  client.post(`/maintenance/${id}/assign`, { technician });

export const startMaintenanceWork = (id) =>
  client.post(`/maintenance/${id}/start`);

export const resolveMaintenanceRequest = (id) =>
  client.post(`/maintenance/${id}/resolve`);
