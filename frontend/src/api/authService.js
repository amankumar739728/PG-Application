import axiosInstance from './axiosInstance';

const authService = {
  login: async (username, password) => {
    const response = await axiosInstance.post('/login', { username, password });
    return response.data;
  },

  signup: async (userData) => {
    const response = await axiosInstance.post('/signup', userData);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await axiosInstance.get('/current_user');
    return response.data;
  },

  updateUser: async (updateData) => {
    const response = await axiosInstance.patch('/update/details', updateData);
    return response.data;
  },

  changePassword: async (passwordData) => {
    const response = await axiosInstance.post('/change-password', passwordData);
    return response.data;
  },

  logout: async () => {
    const response = await axiosInstance.post('/logout');
    return response.data;
  },

  listUsers: async () => {
    const response = await axiosInstance.get('/list-users');
    return response.data;
  },

  deleteUser: async (targetUsername) => {
    const response = await axiosInstance.delete('/delete', { data: { target_username: targetUsername } });
    return response.data;
  },

  disableUser: async (username) => {
    const response = await axiosInstance.post('/disable-user', { username });
    return response.data;
  },

  activateUser: async (username) => {
    const response = await axiosInstance.post('/activate-user', { username });
    return response.data;
  },

  createUser: async (userData) => {
    const response = await axiosInstance.post('/signup', userData);
    return response.data;
  },

  refreshToken: async (refreshToken) => {
    const response = await axiosInstance.post('/refresh-token', { refresh_token: refreshToken });
    return response.data;
  },

  forgotPassword: async (emailData) => {
    const response = await axiosInstance.post('/forgot-password', emailData);
    return response.data;
  },

  verifyEmail: async (token) => {
    const response = await axiosInstance.post('/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email) => {
    const response = await axiosInstance.post('/resend-verification', { email });
    return response.data;
  }
};

export default authService;
