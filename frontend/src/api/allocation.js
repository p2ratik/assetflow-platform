import client from './client';

// Lightweight user list for dropdowns — accessible to all auth users
export const getUsers = () => client.get('/users');


// ── Allocations ────────────────────────────────────────────────

/** List allocations. status: 'active' | 'returned' | 'overdue' */
export const listAllocations = (params = {}) =>
  client.get('/allocations', { params });

/** Current active allocation for one asset. Returns {active, ...alloc} */
export const getAssetAllocation = (assetId) =>
  client.get(`/allocations/asset/${assetId}`);

/**
 * Allocate asset to employee.
 * Response may have {blocked: true, held_by} if asset is taken.
 */
export const allocateAsset = (data) => client.post('/allocations', data);

/** Return asset — records checkin_notes + optional condition update */
export const returnAsset = (allocationId, data) =>
  client.post(`/allocations/${allocationId}/return`, data);

// ── Transfer Requests ──────────────────────────────────────────

export const createTransferRequest = (data) =>
  client.post('/transfer-requests', data);

export const listTransferRequests = (params = {}) =>
  client.get('/transfer-requests', { params });

export const approveTransfer = (id) =>
  client.patch(`/transfer-requests/${id}/approve`);

export const rejectTransfer = (id, reason) =>
  client.patch(`/transfer-requests/${id}/reject`, { reason });
