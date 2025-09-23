import axios from 'axios';

const announcementAxiosInstance = axios.create({
  baseURL: 'http://localhost:8003',
  timeout: 10000,
});

// Request interceptor to add auth token
announcementAxiosInstance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor to handle token refresh
announcementAxiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post('http://localhost:8000/refresh-token', {
            refresh_token: refreshToken
          });

          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return announcementAxiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

const announcementService = {
  getAnnouncements: async (filters = {}) => {
    const response = await announcementAxiosInstance.get('/announcements', { params: filters });
    return response.data;
  },

  getAnnouncementDetails: async (announcementId) => {
    const response = await announcementAxiosInstance.get(`/announcements/id/${announcementId}`);
    return response.data;
  },

  createAnnouncement: async (announcementData) => {
    const response = await announcementAxiosInstance.post('/announcements', announcementData);
    return response.data;
  },

  updateAnnouncement: async (announcementId, updateData) => {
    const response = await announcementAxiosInstance.put(`/announcements/id/${announcementId}`, updateData);
    return response.data;
  },

  deleteAnnouncement: async (announcementId) => {
    const response = await announcementAxiosInstance.delete(`/announcements/id/${announcementId}`);
    return response.data;
  }
};

export default announcementService;
