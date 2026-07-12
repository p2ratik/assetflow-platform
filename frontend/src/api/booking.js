import client from './client';

/** Create a booking. Returns BookingResponse or {conflict: true, ...} */
export const createBooking = (data) => client.post('/bookings', data);

/** List bookings. Admin sees all, others see own. ?asset_id= optional. */
export const listBookings = (params = {}) => client.get('/bookings', { params });

/** Hourly slot view: ?asset_id=X&day=YYYY-MM-DD */
export const getDaySlots = (assetId, day) =>
  client.get('/bookings/slots', { params: { asset_id: assetId, day } });

/** Cancel a booking */
export const cancelBooking = (id) => client.delete(`/bookings/${id}/cancel`);

/** Bookable assets for dropdown */
export const getBookableAssets = () => client.get('/bookings/bookable-assets');
