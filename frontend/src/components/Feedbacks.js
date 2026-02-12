import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import feedbackService from '../api/feedbackService';
import authService from '../api/authService';
import UserInfo from './UserInfo';
import UniversalNav from './UniversalNav';

const Feedbacks = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFeedbackId, setDeleteFeedbackId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [formData, setFormData] = useState({
    guest_name: '',
    message: '',
    rating: 5,
    room_number: '',
    status: 'submitted'
  });

  useEffect(() => {
    fetchFeedbacks();
    fetchStats();
    getUserRole();
    fetchCurrentUser();
  }, []);
  
  const fetchCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };
  

  useEffect(() => {
    if (showNotificationModal) {
      const timer = setTimeout(() => setShowNotificationModal(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showNotificationModal]);

  const getUserRole = () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || '');
      } catch (err) {
        console.error('Error parsing token:', err);
      }
    }
  };

  const isAdmin = () => {
    return userRole === 'admin' || userRole === 'super_admin';
  };


  const fetchFeedbacks = async (page = 1, statusOverride = null) => {
    try {
      setLoading(true);
      const filters = { page, size: 5 };
      const currentStatus = statusOverride !== null ? statusOverride : statusFilter;
      if (currentStatus) filters.status = currentStatus;
      const data = await feedbackService.getFeedbacks(filters);

      // Handle new pagination response format
      if (data.items) {
        setFeedbacks(data.items);
        setTotalItems(data.total);
        setTotalPages(data.total_pages);
        setCurrentPage(data.page);
        setHasNext(data.has_next);
        setHasPrev(data.has_prev);
      } else {
        // Fallback for old format
        setFeedbacks(data);
        setTotalItems(data.length);
        setTotalPages(1);
        setCurrentPage(1);
        setHasNext(false);
        setHasPrev(false);
      }
      setIsSearching(false);
    } catch (err) {
      setError('Failed to fetch feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await feedbackService.getFeedbackStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingFeedback) {
        await feedbackService.updateFeedback(editingFeedback.id, formData);
        setNotificationMessage('Feedback updated successfully');
        setShowNotificationModal(true);
      } else {
        await feedbackService.submitFeedback(formData);
        setNotificationMessage('Feedback submitted successfully');
        setShowNotificationModal(true);
      }
      setFormData({ guest_name: '', message: '', rating: 5, room_number: '', status: 'submitted' });
      setShowForm(false);
      setEditingFeedback(null);
      fetchFeedbacks();
      fetchStats();
    } catch (err) {
      setError('Failed to save feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (feedback) => {
    setEditingFeedback(feedback);
    setFormData({
      guest_name: feedback.guest_name,
      message: feedback.message,
      rating: feedback.rating || 5,
      room_number: feedback.room_number || '',
      status: feedback.status || 'submitted'
    });
    setShowForm(true);
  };

  const handleDelete = (feedbackId) => {
    setDeleteFeedbackId(feedbackId);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    try {
      setLoading(true);
      await feedbackService.deleteFeedback(deleteFeedbackId);
      setNotificationMessage('Feedback deleted successfully');
      setShowNotificationModal(true);
      setError('');
      fetchFeedbacks();
      fetchStats();
    } catch (err) {
      setError('Failed to delete feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (feedbackId, newStatus) => {
    try {
      setLoading(true);
      await feedbackService.updateFeedback(feedbackId, { status: newStatus });
      setNotificationMessage('Status updated successfully');
      setShowNotificationModal(true);
      fetchFeedbacks();
      fetchStats();
    } catch (err) {
      setError('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (page = 1) => {
    try {
      setLoading(true);
      if (searchTerm.trim()) {
        // Determine if searchTerm is a number (room number) or string (guest name)
        const isNumber = /^\d+$/.test(searchTerm.trim());
        let data;
        if (isNumber) {
          data = await feedbackService.searchFeedbacks(null, searchTerm.trim(), statusFilter || null, Number(page), 5);
        } else {
          data = await feedbackService.searchFeedbacks(searchTerm.trim(), null, statusFilter || null, Number(page), 5);
        }

        // Handle new pagination response format
        if (data.items) {
          setFeedbacks(data.items);
          setTotalItems(data.total);
          setTotalPages(data.total_pages);
          setCurrentPage(data.page);
          setHasNext(data.has_next);
          setHasPrev(data.has_prev);
        } else {
          // Fallback for old format
          setFeedbacks(data);
          setTotalItems(data.length);
          setTotalPages(1);
          setCurrentPage(1);
          setHasNext(false);
          setHasPrev(false);
        }
        setIsSearching(true);
      } else {
        fetchFeedbacks(Number(page));
      }
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatsCardClick = async (status) => {
    try {
      setLoading(true);
      setSearchTerm('');
      setIsSearching(false);

      if (status === 'total') {
        // Clear all filters and show all feedbacks
        setStatusFilter('');
        await fetchFeedbacks(1, '');
      } else {
        // Filter by specific status
        setStatusFilter(status);
        await fetchFeedbacks(1, status);
      }
    } catch (err) {
      setError('Failed to filter feedbacks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Feedback Management</h1>
        <div className="flex gap-2 items-center">
          <UniversalNav />
          {/* User Info Display */}
          {currentUser && (
            <div className={`flex items-center space-x-2 text-sm rounded-lg px-3 py-1 shadow-sm ${
              isDarkMode
                ? 'text-gray-300 bg-gray-700 border border-gray-600'
                : 'text-gray-600 bg-indigo-50 border border-indigo-200'
            }`}>
              <span className={`font-semibold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>Logged in as:</span>
              <span className={`font-medium ${isDarkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>@{currentUser.username}</span>
              <span className={`text-xs px-2 py-1 rounded-full uppercase tracking-wide font-semibold ${
                isDarkMode ? 'bg-gray-600 text-indigo-300' : 'bg-indigo-200 text-indigo-900'
              }`}>{currentUser.role}</span>
            </div>
          )}
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors duration-300 ${
              isDarkMode
                ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => {
              // Navigate back to dashboard
              navigate('/dashboard');
            }}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingFeedback(null);
              setFormData({ guest_name: '', message: '', rating: 5, room_number: '', status: 'submitted' });
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Add Feedback'}
          </button>
          <UserInfo />
        </div>
      </div>

      {/* Statistics Dashboard */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handleStatsCardClick('total')}
            title="Click to show all feedbacks"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Feedbacks</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handleStatsCardClick('submitted')}
            title="Click to filter by submitted feedbacks"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Submitted</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.by_status.submitted}</p>
          </div>
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handleStatsCardClick('in_progress')}
            title="Click to filter by in-progress feedbacks"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>In Progress</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.by_status.in_progress}</p>
          </div>
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handleStatsCardClick('completed')}
            title="Click to filter by completed feedbacks"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Completed</h3>
            <p className="text-2xl font-bold text-green-600">{stats.by_status.completed}</p>
          </div>
          <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Avg Rating</h3>
            <p className="text-2xl font-bold text-purple-600">
              {stats.average_rating ? stats.average_rating.toFixed(1) : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className={`p-4 rounded-lg shadow mb-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by guest name or room number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className={`w-full border p-2 rounded ${
                isDarkMode
                  ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                  : 'border-gray-300 bg-white text-gray-900'
              }`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`border p-2 rounded ${
              isDarkMode
                ? 'border-gray-600 bg-gray-700 text-white'
                : 'border-gray-300 bg-white text-gray-900'
            }`}
          >
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => handleSearch()}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              // Clear filters and fetch all feedbacks immediately
              const clearFilters = async () => {
                try {
                  setLoading(true);
                  const filters = { page: 1, size: 5 }; // No status filter
                  const data = await feedbackService.getFeedbacks(filters);

                  // Handle new pagination response format
                  if (data.items) {
                    setFeedbacks(data.items);
                    setTotalItems(data.total);
                    setTotalPages(data.total_pages);
                    setCurrentPage(data.page);
                    setHasNext(data.has_next);
                    setHasPrev(data.has_prev);
                  } else {
                    // Fallback for old format
                    setFeedbacks(data);
                    setTotalItems(data.length);
                    setTotalPages(1);
                    setCurrentPage(1);
                    setHasNext(false);
                    setHasPrev(false);
                  }
                  setIsSearching(false);
                } catch (err) {
                  setError('Failed to fetch feedbacks');
                } finally {
                  setLoading(false);
                }
              };
              clearFilters();
            }}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      {/* Form */}
      {showForm && (
        <div className={`p-6 rounded-lg shadow mb-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {editingFeedback ? 'Edit Feedback' : 'Submit New Feedback'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block mb-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Guest Name</label>
                <input
                  type="text"
                  name="guest_name"
                  value={formData.guest_name}
                  onChange={handleChange}
                  className={`w-full border p-2 rounded ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className={`block mb-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Room Number</label>
                <input
                  type="text"
                  name="room_number"
                  value={formData.room_number}
                  onChange={handleChange}
                  className={`w-full border p-2 rounded ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={`block mb-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Message</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                className={`w-full border p-2 rounded ${
                  isDarkMode
                    ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                    : 'border-gray-300 bg-white text-gray-900'
                }`}
                rows="4"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={`block mb-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Rating (1-5)</label>
                <input
                  type="number"
                  name="rating"
                  min="1"
                  max="5"
                  value={formData.rating}
                  onChange={handleChange}
                  className={`w-full border p-2 rounded ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                />
              </div>
              {isAdmin() && (
                <div>
                  <label className={`block mb-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={`w-full border p-2 rounded ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-700 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="submitted">Submitted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : (editingFeedback ? 'Update' : 'Submit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingFeedback(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feedbacks List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No feedback records found.</div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map(feedback => (
            <div key={feedback.id} className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{feedback.guest_name}</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Room: {feedback.room_number || 'N/A'}</p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {new Date(feedback.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(feedback.status)}`}>
                    {feedback.status || 'submitted'}
                  </span>
                  {isAdmin() && (
                    <select
                      value={feedback.status || 'submitted'}
                      onChange={(e) => handleStatusChange(feedback.id, e.target.value)}
                      className={`text-xs border rounded px-2 py-1 ${
                        isDarkMode
                          ? 'border-gray-600 bg-gray-700 text-white'
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  )}
                </div>
              </div>

              <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{feedback.message}</p>

              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className={`text-sm mr-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Rating:</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-4 h-4 ${i < (feedback.rating || 0) ? 'text-yellow-400' : (isDarkMode ? 'text-gray-600' : 'text-gray-300')}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    ({feedback.rating || 0}/5)
                  </span>
                </div>

                {isAdmin() && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(feedback)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(feedback.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8">
          <div className={`px-6 py-4 rounded-lg shadow-sm border ${
            isDarkMode
              ? 'bg-gray-800 border-gray-700 text-white'
              : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Page Info */}
              <div className={`text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Showing <span className="text-indigo-600 font-semibold">{((currentPage - 1) * 5) + 1}</span> to{' '}
                <span className="text-indigo-600 font-semibold">
                  {Math.min(currentPage * 5, totalItems)}
                </span> of{' '}
                <span className={`font-semibold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>{totalItems}</span> results
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => {
                    if (isSearching) {
                      handleSearch(currentPage - 1);
                    } else {
                      fetchFeedbacks(currentPage - 1);
                    }
                  }}
                  disabled={!hasPrev || loading}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm ${
                    isDarkMode
                      ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700 disabled:hover:border-gray-600'
                      : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {totalPages <= 7 ? (
                    // Show all pages if 7 or fewer
                    Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        onClick={() => {
                          if (isSearching) {
                            handleSearch(pageNum);
                          } else {
                            fetchFeedbacks(pageNum);
                          }
                        }}
                        disabled={loading}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white shadow-md'
                            : isDarkMode
                              ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                              : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {pageNum}
                      </button>
                    ))
                  ) : (
                    // Show condensed pagination for more than 7 pages
                    <>
                      {/* First page */}
                      <button
                        onClick={() => {
                          if (isSearching) {
                            handleSearch(1);
                          } else {
                            fetchFeedbacks(1);
                          }
                        }}
                        disabled={loading}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          currentPage === 1
                            ? 'bg-indigo-600 text-white shadow-md'
                            : isDarkMode
                              ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                              : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        1
                      </button>

                      {/* Ellipsis if needed */}
                      {currentPage > 4 && (
                        <span className={`px-2 py-2 ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>...</span>
                      )}

                      {/* Pages around current page */}
                      {Array.from(
                        { length: Math.min(3, totalPages - 2) },
                        (_, i) => {
                          const pageNum = Math.max(2, Math.min(totalPages - 1, currentPage - 1 + i));
                          return pageNum;
                        }
                      )
                        .filter((pageNum, index, arr) => arr.indexOf(pageNum) === index)
                        .map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => {
                              if (isSearching) {
                                handleSearch(pageNum);
                              } else {
                                fetchFeedbacks(pageNum);
                              }
                            }}
                            disabled={loading}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                              currentPage === pageNum
                                ? 'bg-indigo-600 text-white shadow-md'
                                : isDarkMode
                                  ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                                  : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {pageNum}
                          </button>
                        ))}

                      {/* Ellipsis if needed */}
                      {currentPage < totalPages - 3 && (
                        <span className={`px-2 py-2 ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>...</span>
                      )}

                      {/* Last page */}
                      {totalPages > 1 && (
                        <button
                          onClick={() => {
                            if (isSearching) {
                              handleSearch(totalPages);
                            } else {
                              fetchFeedbacks(totalPages);
                            }
                          }}
                          disabled={loading}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                            currentPage === totalPages
                              ? 'bg-indigo-600 text-white shadow-md'
                              : isDarkMode
                                ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {totalPages}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => {
                    if (isSearching) {
                      handleSearch(currentPage + 1);
                    } else {
                      fetchFeedbacks(currentPage + 1);
                    }
                  }}
                  disabled={!hasNext || loading}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm ${
                    isDarkMode
                      ? 'text-gray-300 bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700 disabled:hover:border-gray-600'
                      : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300'
                  }`}
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Loading indicator */}
            {loading && (
              <div className="mt-3 flex justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg shadow-xl p-6 w-full max-w-md mx-4 border-l-4 border-green-500 ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
          }`}>
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className={`ml-3 text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Success!</h2>
            </div>
            <p className={`mb-4 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>{notificationMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200 font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg p-6 w-full max-w-md mx-4 ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>Confirm Delete</h2>
            <p className={`${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Are you sure you want to delete this feedback?</p>
            <div className="flex space-x-3 mt-4">
              <button
                onClick={handleDeleteConfirm}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition duration-200"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className={`px-4 py-2 rounded transition duration-200 ${
                  isDarkMode
                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedbacks;
