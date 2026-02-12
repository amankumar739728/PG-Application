import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import menuService from '../api/menuService';
import authService from '../api/authService';
import UserInfo from './UserInfo';
import UniversalNav from './UniversalNav';

const Menu = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const [menuItems, setMenuItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [categories, setCategories] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMenuId, setDeleteMenuId] = useState(null);
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [useCustomTiming, setUseCustomTiming] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    day: '',
    meal_type: '',
    description: '',
    items: '',
    category: '',
    available: true,
    timing: ''
  });
  const [filters, setFilters] = useState({
    day: '',
    meal_type: '',
    category: '',
    available: ''
  });

  // Standard timing options
  const timingOptions = [
    '7:00 AM - 9:00 AM',
    '7:30 AM - 9:30 AM',
    '7:30 AM - 10:00 AM',
    '8:00 AM - 10:00 AM',
    '9:00 AM - 11:00 AM',
    '9:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '11:30 AM - 1:00 PM',
    '11:30 AM - 1:30 PM',
    '11:30 AM - 2:00 PM',
    '12:00 PM - 1:00 PM',
    '1:00 PM - 2:00 PM',
    '2:00 PM - 3:00 PM',
    '3:00 PM - 4:00 PM',
    '4:00 PM - 5:00 PM',
    '5:00 PM - 6:00 PM',
    '6:00 PM - 7:00 PM',
    '7:00 PM - 8:00 PM',
    '7:30 PM - 9:30 PM',
    '7:30 PM - 10:00 PM',
    '8:00 PM - 10:00 PM',
    '8:30 PM - 11:00 PM',
    '9:00 PM - 11:00 PM'
  ];

  useEffect(() => {
    fetchMenu();
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
      const userData = await authService.getCurrentUser();
      setCurrentUser(userData);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchMenu = async () => {
    setLoading(true);
    setError('');
    try {
      const filterParams = {};
      if (filters.day) filterParams.day = filters.day;
      if (filters.meal_type) filterParams.meal_type = filters.meal_type;
      if (filters.category) filterParams.category = filters.category;
      if (filters.available !== '') filterParams.available = filters.available === 'true';
      const data = await menuService.getMenu(filterParams);
      setMenuItems(data);
    } catch (err) {
      setError('Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleFilterChange = (e) => {
    setFilters({...filters, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Normalize category and timing to lowercase for backend validation consistency
      const normalizedData = {
        ...formData,
        category: formData.category.trim(),
        timing: formData.timing.trim(),
      };

      if (editingItem) {
        await menuService.updateMenuItem(editingItem.id, normalizedData);
        setNotificationMessage('Menu item updated successfully');
        setShowNotificationModal(true);
      } else {
        await menuService.createMenuItem(normalizedData);
        setNotificationMessage('Menu item added successfully');
        setShowNotificationModal(true);
      }
      setShowForm(false);
      setEditingItem(null);
      setFormData({
        day: '',
        meal_type: '',
        description: '',
        items: '',
        category: '',
        available: true,
        timing: ''
      });
      fetchMenu();
    } catch (err) {
      setError('Failed to save menu item');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      day: item.day || '',
      meal_type: item.meal_type || '',
      description: item.description || '',
      items: item.items || '',
      category: item.category || '',
      available: item.available !== undefined ? item.available : true,
      timing: item.timing || ''
    });
    // Check if category is custom (not in predefined list)
    const predefinedCategories = ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Side Dish'];
    setUseCustomCategory(!predefinedCategories.includes(item.category));
    // Check if timing is custom (not in predefined list)
    setUseCustomTiming(!timingOptions.includes(item.timing));
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setDeleteMenuId(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    setLoading(true);
    setError('');
    try {
      await menuService.deleteMenuItem(deleteMenuId);
      setNotificationMessage('Menu item deleted successfully');
      setShowNotificationModal(true);
      fetchMenu();
    } catch (err) {
      setError('Failed to delete menu item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Menu Management</h1>
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
            onClick={() => navigate('/dashboard')}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingItem(null);
              setFormData({
                day: '',
                meal_type: '',
                description: '',
                items: '',
                category: '',
                available: true,
                timing: ''
              });
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Add Menu Item'}
          </button>
          <UserInfo />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded shadow flex flex-wrap gap-4">
        <select name="day" value={filters.day} onChange={handleFilterChange} className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">All Days</option>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
        <select name="meal_type" value={filters.meal_type} onChange={handleFilterChange} className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">All Meal Types</option>
          {['Breakfast', 'Lunch', 'Dinner'].map(meal => (
            <option key={meal} value={meal}>{meal}</option>
          ))}
        </select>
        <input
          type="text"
          name="category"
          placeholder="Category"
          value={filters.category}
          onChange={handleFilterChange}
          className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <select name="available" value={filters.available} onChange={handleFilterChange} className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">All Availability</option>
          <option value="true">Available</option>
          <option value="false">Unavailable</option>
        </select>
        <button onClick={fetchMenu} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Filter</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select name="day" value={formData.day} onChange={handleChange} required className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Select Day</option>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <select name="meal_type" value={formData.meal_type} onChange={handleChange} required className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Select Meal Type</option>
              {['Breakfast', 'Lunch', 'Dinner'].map(meal => (
                <option key={meal} value={meal}>{meal}</option>
              ))}
            </select>
            <input type="text" name="description" placeholder="Description" value={formData.description} onChange={handleChange} required className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <input type="text" name="items" placeholder="Items" value={formData.items} onChange={handleChange} required className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

            {/* Category Field */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1">Category</label>
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={useCustomCategory}
                  onChange={(e) => setUseCustomCategory(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Use custom category</span>
              </div>
              {useCustomCategory ? (
                <input
                  type="text"
                  name="category"
                  placeholder="Enter custom category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full"
                />
              ) : (
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full"
                >
                  <option value="">Select Category</option>
                  <option value="Appetizer">Appetizer</option>
                  <option value="Main Course">Main Course</option>
                  <option value="Dessert">Dessert</option>
                  <option value="Beverage">Beverage</option>
                  <option value="Side Dish">Side Dish</option>
                </select>
              )}
            </div>

            {/* Timing Field */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1">Timing</label>
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={useCustomTiming}
                  onChange={(e) => setUseCustomTiming(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Use custom timing</span>
              </div>
              {useCustomTiming ? (
                <input
                  type="text"
                  name="timing"
                  placeholder="Enter custom timing (e.g., 2:00 PM - 3:00 PM)"
                  value={formData.timing}
                  onChange={handleChange}
                  required
                  className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full"
                />
              ) : (
                <select
                  name="timing"
                  value={formData.timing}
                  onChange={handleChange}
                  required
                  className="border p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full"
                >
                  <option value="">Select Timing</option>
                  {timingOptions.map(timing => (
                    <option key={timing} value={timing}>{timing}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" name="available" checked={formData.available} onChange={(e) => setFormData({...formData, available: e.target.checked})} />
                <span>Available</span>
              </label>
            </div>
            <div className="md:col-span-2 flex space-x-2">
              <button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Saving...' : (editingItem ? 'Update' : 'Add')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); }} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error Message */}
      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Menu List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : menuItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No menu items found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{item.day} - {item.meal_type}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  item.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {item.available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-2"><strong>Description:</strong> {item.description}</p>
              <p className="text-gray-700 dark:text-gray-300 mb-2"><strong>Items:</strong> {item.items}</p>
              <p className="text-gray-700 dark:text-gray-300 mb-2"><strong>Category:</strong> {item.category}</p>
              <p className="text-gray-700 dark:text-gray-300 mb-2"><strong>Timing:</strong> {item.timing}</p>
              {isAdmin() && (
                <div className="flex space-x-2 mt-4">
                  <button onClick={() => handleEdit(item)} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Delete</button>
                </div>
              )}
            </div>
          ))}
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Delete Menu Item
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Are you sure you want to delete this menu item? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;
