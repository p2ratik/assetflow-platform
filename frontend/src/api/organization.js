import client from './client';

// ── Departments ────────────────────────────────────────────────
export const getDepartments = () => client.get('/organization/departments');

export const createDepartment = (data) =>
  client.post('/organization/departments', data);

export const updateDepartment = (id, data) =>
  client.put(`/organization/departments/${id}`, data);

export const deactivateDepartment = (id) =>
  client.patch(`/organization/departments/${id}/deactivate`);

// ── Categories ─────────────────────────────────────────────────
export const getCategories = (includeInactive = false) =>
  client.get('/organization/categories', { params: { include_inactive: includeInactive } });

export const createCategory = (data) =>
  client.post('/organization/categories', data);

export const updateCategory = (id, data) =>
  client.put(`/organization/categories/${id}`, data);

export const deactivateCategory = (id) =>
  client.patch(`/organization/categories/${id}/deactivate`);

// ── Employees ──────────────────────────────────────────────────
export const getEmployees = (departmentId = null) =>
  client.get('/organization/employees', {
    params: departmentId ? { department_id: departmentId } : {},
  });

export const updateEmployee = (id, data) =>
  client.put(`/organization/employees/${id}`, data);
