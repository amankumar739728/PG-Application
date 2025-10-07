import axios from 'axios';

const menuAxiosInstance = axios.create({
  baseURL: 'https://pg-application-menu-service.onrender.com',
  timeout: 10000,
});

// Request interceptor to add auth token
menuAxiosInstance.interceptors.request.use(
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
menuAxiosInstance.interceptors.response.use(
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
          return menuAxiosInstance(originalRequest);
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

const menuService = {
  getMenu: async (filters = {}) => {
    const response = await menuAxiosInstance.get('/menu', { params: filters });
    return response.data;
  },

  getMenuItem: async (menuId) => {
    const response = await menuAxiosInstance.get(`/menu/${menuId}`);
    return response.data;
  },

  createMenuItem: async (menuData) => {
    const response = await menuAxiosInstance.post('/menu', menuData);
    return response.data;
  },

  updateMenuItem: async (menuId, updateData) => {
    const response = await menuAxiosInstance.put(`/menu/${menuId}`, updateData);
    return response.data;
  },

  deleteMenuItem: async (menuId) => {
    const response = await menuAxiosInstance.delete(`/menu/${menuId}`);
    return response.data;
  },

  getMenuByDay: async (day) => {
    const response = await menuAxiosInstance.get(`/menu/day/${day}`);
    return response.data;
  },

  getMenuByDayAndMeal: async (day, mealType) => {
    const response = await menuAxiosInstance.get(`/menu/day/${day}/meal/${mealType}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await menuAxiosInstance.get('/menu/categories/list');
    return response.data;
  }
};

export default menuService;
