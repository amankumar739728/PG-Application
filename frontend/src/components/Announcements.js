import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import announcementService from '../api/announcementService';
import authService from '../api/authService';
import UserInfo from './UserInfo';
import UniversalNav from './UniversalNav';

const Announcements = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const [announcements, setAnnouncements] = useState([]);
  const [allAnnouncements, setAllAnnouncements] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAnnouncementId, setDeleteAnnouncementId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'normal',
    status: 'active'
  });

  useEffect(() => {
    fetchAnnouncements();
    fetchStats();
    getUserRole();
    fetchCurrentUser();
  }, []);

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

  const fetchCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchAnnouncements = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const skip = (page - 1) * 5;
      const data = await announcementService.getAnnouncements({ limit: 5, skip });
      setAnnouncements(data);
      setAllAnnouncements(data);
      // Calculate stats after fetching announcements
      calculateStats(data);
      // For pagination, assume if data.length < 5, it's the last page
      setTotalItems(data.length < 5 ? (page - 1) * 5 + data.length : page * 5 + 1);
      setTotalPages(data.length < 5 ? page : page + 1);
      setCurrentPage(page);
      setHasNext(data.length === 5);
      setHasPrev(page > 1);
    } catch (err) {
      setError('Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (announcementData) => {
    const priorityStats = {
      total: announcementData.length,
      high: announcementData.filter(a => a.priority === 'high').length,
      medium: announcementData.filter(a => a.priority === 'medium').length,
      low: announcementData.filter(a => a.priority === 'low').length,
      active: announcementData.filter(a => a.status === 'active').length,
      expired: announcementData.filter(a => a.status === 'expired').length
    };
    setStats(priorityStats);
  };

  const fetchStats = async () => {
    // Stats are calculated in fetchAnnouncements
    if (allAnnouncements.length > 0) {
      calculateStats(allAnnouncements);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Prepare payload with author from current user
      const payload = {
        ...formData,
        author: currentUser?.username || 'Unknown User'
      };

      // Remove status from payload as it's calculated by backend
      delete payload.status;

      if (editingAnnouncement) {
        await announcementService.updateAnnouncement(editingAnnouncement.id, payload);
        setNotificationMessage('Announcement updated successfully');
        setShowNotificationModal(true);
      } else {
        await announcementService.createAnnouncement(payload);
        setNotificationMessage('Announcement created successfully');
        setShowNotificationModal(true);
      }
      setShowForm(false);
      setEditingAnnouncement(null);
      setFormData({ title: '', message: '', priority: 'medium', status: 'active' });
      fetchAnnouncements();
    } catch (err) {
      setError('Failed to save announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title || '',
      message: announcement.message || '',
      priority: announcement.priority || 'medium',
      status: announcement.status || 'active'
    });
    setShowForm(true);
  };

  const handleDelete = (announcementId) => {
    setDeleteAnnouncementId(announcementId);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    setLoading(true);
    setError('');
    try {
      await announcementService.deleteAnnouncement(deleteAnnouncementId);
      setNotificationMessage('Announcement deleted successfully');
      setShowNotificationModal(true);
      fetchAnnouncements();
    } catch (err) {
      setError('Failed to delete announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (page = 1) => {
    try {
      setLoading(true);
      if (searchTerm.trim()) {
        // Search by title, author, or message via backend API
        const skip = (page - 1) * 5;
        const data = await announcementService.getAnnouncements({
          title: searchTerm,
          author: searchTerm,
          message: searchTerm,
          limit: 5,
          skip
        });
        setAnnouncements(data);
        setIsSearching(true);
        // Update pagination state for search
        setTotalItems(data.length < 5 ? (page - 1) * 5 + data.length : page * 5 + 1);
        setTotalPages(data.length < 5 ? page : page + 1);
        setCurrentPage(page);
        setHasNext(data.length === 5);
        setHasPrev(page > 1);
      } else {
        fetchAnnouncements(page);
        setIsSearching(false);
      }
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityFilter = (priority) => {
    if (priority === 'all' || priority === '') {
      setPriorityFilter('');
      fetchAnnouncements();
    } else {
      setPriorityFilter(priority);
      // Filter from allAnnouncements to avoid filtering already filtered list
      const filteredAnnouncements = allAnnouncements.filter(a => a.priority === priority);
      setAnnouncements(filteredAnnouncements);
      // Always calculate stats from full dataset
      calculateStats(allAnnouncements);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-xl font-bold text-white`}>Announcement Management</h1>
        <div className="flex gap-4 items-center">
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
            className="p-2 rounded-full bg-yellow-400 text-gray-900 hover:bg-yellow-300 transition-colors duration-300"
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
              window.location.href = '/dashboard';
            }}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingAnnouncement(null);
              setFormData({ title: '', message: '', priority: 'medium', status: 'active' });
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Add Announcement'}
          </button>
          <UserInfo />
        </div>
      </div>

      {/* Statistics Dashboard */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handlePriorityFilter('all')}
            title="Click to show all announcements"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handlePriorityFilter('high')}
            title="Click to filter by high priority"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>High Priority</h3>
            <p className="text-2xl font-bold text-red-600">{stats.high}</p>
          </div>
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handlePriorityFilter('medium')}
            title="Click to filter by medium priority"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Medium Priority</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
          </div>
          <div
            className={`p-4 rounded-lg shadow cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => handlePriorityFilter('low')}
            title="Click to filter by low priority"
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Low Priority</h3>
            <p className="text-2xl font-bold text-green-600">{stats.low}</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className={`p-4 rounded-lg shadow mb-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by title, author, or message..."
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
            value={priorityFilter}
            onChange={(e) => handlePriorityFilter(e.target.value)}
            className={`border p-2 rounded ${
              isDarkMode
                ? 'border-gray-600 bg-gray-700 text-white'
                : 'border-gray-300 bg-white text-gray-900'
            }`}
          >
            <option value="">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <button
            onClick={handleSearch}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearchTerm('');
              setPriorityFilter('');
              fetchAnnouncements();
              setIsSearching(false);
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
            {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block mb-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
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
                <label className={`block mb-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className={`w-full border p-2 rounded ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 text-white'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
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
            {isAdmin() && (
              <div className="mt-4">
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
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : (editingAnnouncement ? 'Update' : 'Create')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingAnnouncement(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {isSearching ? 'No announcements found matching your search.' : 'No announcements found.'}
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(announcement => (
            <div key={announcement.id} className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{announcement.title}</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>By: {announcement.author}</p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {new Date(announcement.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>
                    {announcement.priority} priority
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(announcement.status)}`}>
                    {announcement.status}
                  </span>
                </div>
              </div>

              <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{announcement.message}</p>

              {isAdmin() && (
                <div className="flex justify-end">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 space-x-4">
          <button
            onClick={() => {
              if (isSearching) {
                handleSearch(currentPage - 1);
              } else {
                fetchAnnouncements(currentPage - 1);
              }
            }}
            disabled={!hasPrev}
            className={`px-4 py-2 rounded ${
              hasPrev
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Previous
          </button>
          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => {
              if (isSearching) {
                handleSearch(currentPage + 1);
              } else {
                fetchAnnouncements(currentPage + 1);
              }
            }}
            disabled={!hasNext}
            className={`px-4 py-2 rounded ${
              hasNext
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Next
          </button>
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
            }`}>Are you sure you want to delete this announcement?</p>
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

export default Announcements;
