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
  getBoulders: (id, round) => api.get(`/events/${id}/boulders/${round}`),
  resizeBoulders: (id, round, count) => api.put(`/events/${id}/boulders/${round}/resize`, { count }),
  updateBoulder: (id, bId, data) => api.put(`/events/${id}/boulders/${bId}`, data),
  getCategories: (id) => api.get(`/events/${id}/categories`),
  createCategory: (id, data) => api.post(`/events/${id}/categories`, data),
  updateCategory: (id, catId, data) => api.put(`/events/${id}/categories/${catId}`, data),
  deleteCategory: (id, catId) => api.delete(`/events/${id}/categories/${catId}`),
  getAthletes: (id, params) => api.get(`/events/${id}/athletes`, { params }),
  createAthlete: (id, data) => api.post(`/events/${id}/athletes`, data),
  deleteAthlete: (id, athId) => api.delete(`/events/${id}/athletes/${athId}`),
  bulkImportAthletes: (id, athletes) => api.post(`/events/${id}/athletes/bulk`, { athletes }),
  getScores: (id, round) => api.get(`/events/${id}/scores/${round}`),
  saveScores: (id, data) => api.post(`/events/${id}/scores`, data),
  getRanking: (id, round) => api.get(`/events/${id}/ranking/${round}`),
  exportCSV: (id, round) => api.get(`/events/${id}/export/${round}`, { responseType: 'blob' }),
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
};
