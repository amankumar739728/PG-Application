import axios from 'axios';

const roomAxiosInstance = axios.create({
  baseURL: 'https://pg-application-room-service.onrender.com',
  timeout: 10000,
});

// Request interceptor to add auth token
roomAxiosInstance.interceptors.request.use(
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
roomAxiosInstance.interceptors.response.use(
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
          return roomAxiosInstance(originalRequest);
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

const roomService = {
  getRooms: async (filters = {}) => {
    const response = await roomAxiosInstance.get('/rooms', { params: filters });
    return response.data;
  },

  getRoomDetails: async (roomNumber) => {
    const response = await roomAxiosInstance.get(`/rooms/${roomNumber}`);
    return response.data;
  },

  createRoom: async (roomData) => {
    const response = await roomAxiosInstance.post('/rooms', roomData);
    return response.data;
  },

  updateRoom: async (roomNumber, updateData) => {
    const response = await roomAxiosInstance.put(`/rooms/${roomNumber}`, updateData);
    return response.data;
  },

  deleteRoom: async (roomNumber) => {
    const response = await roomAxiosInstance.delete(`/rooms/${roomNumber}`);
    return response.data;
  },

  addGuestToRoom: async (roomNumber, guestData) => {
    const response = await roomAxiosInstance.post(`/rooms/${roomNumber}/guests`, guestData);
    return response.data;
  },

  updateGuestDetails: async (roomNumber, userId, updateData) => {
    const response = await roomAxiosInstance.put(`/rooms/${roomNumber}/guests/${userId}`, updateData);
    return response.data;
  },

  removeGuestFromRoom: async (roomNumber, userId) => {
    const response = await roomAxiosInstance.delete(`/rooms/${roomNumber}/guests/${userId}`);
    return response.data;
  },

  addPayment: async (roomNumber, userId, paymentData) => {
    // Ensure payment type is preserved from paymentData
    const data = {
      ...paymentData,
      payment_type: paymentData.payment_type || 'rent'  // Default to rent if not specified
    };
    const response = await roomAxiosInstance.post(`/rooms/${roomNumber}/guests/${userId}/payments`, data);
    return response.data;
  },

  // Alias for backward compatibility
  addRentPayment: async (roomNumber, userId, paymentData) => {
    return roomService.addPayment(roomNumber, userId, paymentData, 'rent');
  },

  addSecurityPayment: async (roomNumber, userId, paymentData) => {
    return roomService.addPayment(roomNumber, userId, paymentData, 'security');
  },

  getRoomStatistics: async () => {
    const response = await roomAxiosInstance.get('/all/rooms/statistics');
    return response.data;
  },

  // Payment-related API functions
  getPaymentDetails: async (filters = {}) => {
    // Add payment_type to filters if present
    const response = await roomAxiosInstance.get('/payments/details', { params: filters });
    return response.data;
  },

  getOverduePayments: async (paymentType = null) => {
    const response = await roomAxiosInstance.get('/payments/overdue', {
      params: paymentType ? { payment_type: paymentType } : {}
    });
    return response.data;
  },

  getPaymentAnalytics: async (paymentType = null) => {
    const response = await roomAxiosInstance.get('/payments/analytics', {
      params: paymentType ? { payment_type: paymentType } : {}
    });
    return response.data;
  },

  getPaymentNotifications: async () => {
    const response = await roomAxiosInstance.get('/payments/notifications');
    return response.data;
  },

  exportPaymentsCSV: async (filters = {}) => {
    const response = await roomAxiosInstance.get('/payments/export/csv', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  },

  exportPaymentsPDF: async (filters = {}) => {
    const response = await roomAxiosInstance.get('/payments/export/pdf', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  },

  sendBulkPaymentNotifications: async (paymentType = null) => {
    const response = await roomAxiosInstance.post('/payments/send-notifications', {
      payment_type: paymentType
    },{ timeout: 120000 }); // 2 minutes
    return response.data;
  },

  getPendingMonthlyPayments: async (paymentType = null) => {
    const response = await roomAxiosInstance.get('/payments/monthly-pending', {
      params: paymentType ? { payment_type: paymentType } : {}
    });
    return response.data;
  },
  
  sendMonthlyRentReminders: async (paymentType = null) => {
    const response = await roomAxiosInstance.post('/payments/send-monthly-reminders', {
      payment_type: paymentType
    },{ timeout: 120000 }); // 2 minutes
    return response.data;
  },

  // Additional room management functions
  getAvailableRooms: async () => {
    const response = await roomAxiosInstance.get('/all/rooms/available');
    return response.data;
  },

  getOccupiedRooms: async () => {
    const response = await roomAxiosInstance.get('/all/rooms/occupied');
    return response.data;
  },

  getRoomGuests: async (roomNumber) => {
    const response = await roomAxiosInstance.get(`/rooms/${roomNumber}/guests`);
    return response.data;
  },

  searchRooms: async (filters = {}) => {
    const response = await roomAxiosInstance.get('/all/rooms/search', { params: filters });
    return response.data;
  },

  getRecentActivities: async (limit = 10) => {
    const response = await roomAxiosInstance.get('/activities/recent', { params: { limit } });
    return response.data;
  }
};

export default roomService;
