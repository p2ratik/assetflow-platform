import client from './client';

export const getAssets = (filters = {}) => {
  const params = {};
  if (filters.q) params.q = filters.q;
  if (filters.category_id) params.category_id = filters.category_id;
  if (filters.status) params.status = filters.status;
  if (filters.department_id) params.department_id = filters.department_id;
  if (filters.is_bookable !== undefined) params.is_bookable = filters.is_bookable;
  if (filters.page) params.page = filters.page;
  if (filters.per_page) params.per_page = filters.per_page;
  return client.get('/assets', { params });
};

export const getAsset = (id) => client.get(`/assets/${id}`);

export const registerAsset = (data) => client.post('/assets', data);

export const updateAsset = (id, data) => client.put(`/assets/${id}`, data);

export const uploadAssetPhoto = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post(`/assets/${id}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
