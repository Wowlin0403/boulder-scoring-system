import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
};

export const eventsAPI = {
  list: () => api.get('/events'),
  create: (data) => api.post('/events', data),
  get: (id) => api.get(`/events/${id}`),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  getBoulders: (id, round, categoryId) => api.get(`/events/${id}/boulders/${round}`, { params: { category_id: categoryId } }),
  resizeBoulders: (id, round, count, categoryId) => api.put(`/events/${id}/boulders/${round}/resize`, { count, category_id: categoryId }),
  updateBoulder: (id, bId, data) => api.put(`/events/${id}/boulders/${bId}`, data),
  getCategories: (id) => api.get(`/events/${id}/categories`),
  createCategory: (id, data) => api.post(`/events/${id}/categories`, data),
  updateCategory: (id, catId, data) => api.put(`/events/${id}/categories/${catId}`, data),
  deleteCategory: (id, catId) => api.delete(`/events/${id}/categories/${catId}`),
  getAthletes: (id, params) => api.get(`/events/${id}/athletes`, { params }),
  createAthlete: (id, data) => api.post(`/events/${id}/athletes`, data),
  updateAthlete: (id, athId, data) => api.put(`/events/${id}/athletes/${athId}`, data),
  deleteAthlete: (id, athId) => api.delete(`/events/${id}/athletes/${athId}`),
  deleteAllAthletes: (id) => api.delete(`/events/${id}/athletes`),
  bulkImportAthletes: (id, athletes) => api.post(`/events/${id}/athletes/bulk`, { athletes }),
  getScores: (id, round) => api.get(`/events/${id}/scores/${round}`),
  saveScores: (id, data) => api.post(`/events/${id}/scores`, data),
  getRanking: (id, round) => api.get(`/events/${id}/ranking/${round}`),
  exportCSV: (id, round, categoryId, type) => api.get(`/events/${id}/export/${round}`, { params: { category_id: categoryId, type }, responseType: 'blob' }),
  getStartOrder: (id, catId, round) => api.get(`/events/${id}/categories/${catId}/startorder/${round}`),
  lockEvent: (id, locked) => api.put(`/events/${id}/lock`, { locked }),
};

const publicApi = axios.create({
  baseURL: '/api/public',
  headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
});

export const publicAPI = {
  getEvent: (id) => publicApi.get(`/events/${id}`),
  getCategories: (id) => publicApi.get(`/events/${id}/categories`),
  getRanking: (id, round) => publicApi.get(`/events/${id}/ranking/${round}`),
};

export const usersAPI = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, password) => api.put(`/users/${id}/password`, { password }),
  toggleActive: (id, active) => api.put(`/users/${id}/active`, { active }),
  updateEvents: (id, event_ids) => api.put(`/users/${id}/events`, { event_ids }),
  getJudge: (id) => api.get(`/users/${id}/judge`),
  setJudgePassword: (id, password) => api.put(`/users/${id}/judge/password`, { password }),
  changeMyPassword: (currentPassword, newPassword) => api.put('/users/self/change-password', { currentPassword, newPassword }),
  toggleJudgeActive: (id, active) => api.put(`/users/${id}/judge/active`, { active }),
};
