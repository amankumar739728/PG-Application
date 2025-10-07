import axios from 'axios';

const feedbackAxiosInstance = axios.create({
  baseURL: 'https://pg-application-feedback-service.onrender.com',
  timeout: 10000,
});

// Request interceptor to add auth token
feedbackAxiosInstance.interceptors.request.use(
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
feedbackAxiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post('https://pg-application-auth-service.onrender.com/refresh-token', {
            refresh_token: refreshToken
          });

          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return feedbackAxiosInstance(originalRequest);
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

const feedbackService = {
  // Basic CRUD operations
  getFeedbacks: async (filters = {}) => {
    const response = await feedbackAxiosInstance.get('/feedbacks', { params: filters });
    return response.data;
  },

  getFeedbackDetails: async (feedbackId) => {
    const response = await feedbackAxiosInstance.get(`/feedbacks/${feedbackId}`);
    return response.data;
  },

  submitFeedback: async (feedbackData) => {
    const response = await feedbackAxiosInstance.post('/feedbacks', feedbackData);
    return response.data;
  },

  updateFeedback: async (feedbackId, updateData) => {
    const response = await feedbackAxiosInstance.put(`/feedbacks/${feedbackId}`, updateData);
    return response.data;
  },

  deleteFeedback: async (feedbackId) => {
    const response = await feedbackAxiosInstance.delete(`/feedbacks/${feedbackId}`);
    return response.data;
  },

  // Search functionality
  searchFeedbacks: async (guestName = null, roomNumber = null, status = null, page = 1, size = 5) => {
    const params = {};
    if (guestName) params.guest_name = guestName;
    if (roomNumber) params.room_number = roomNumber;
    if (status) params.status = status;
    params.page = page;
    params.size = size;
    const response = await feedbackAxiosInstance.get('/feedbacks/search', { params });
    return response.data;
  },

  // Bulk operations
  updateFeedbacksByCriteria: async (guestName = null, roomNumber = null, updateData) => {
    const params = {};
    if (guestName) params.guest_name = guestName;
    if (roomNumber) params.room_number = roomNumber;
    const response = await feedbackAxiosInstance.put('/feedbacks', updateData, { params });
    return response.data;
  },

  deleteFeedbacksByCriteria: async (guestName = null, roomNumber = null) => {
    const params = {};
    if (guestName) params.guest_name = guestName;
    if (roomNumber) params.room_number = roomNumber;
    const response = await feedbackAxiosInstance.delete('/feedbacks', { params });
    return response.data;
  },

  // Statistics
  getFeedbackStats: async () => {
    const response = await feedbackAxiosInstance.get('/feedbacks/stats/summary');
    return response.data;
  }
};

export default feedbackService;
