import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import roomService from '../api/roomService';
import announcementService from '../api/announcementService';
import feedbackService from '../api/feedbackService';
import menuService from '../api/menuService';

const Homepage = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const [stats, setStats] = useState({
    rooms: { total: 0, available: 0 },
    announcements: 0,
    feedbacks: 0,
    menuItems: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [roomsData, announcementsData, feedbacksData, menuData] = await Promise.allSettled([
        roomService.getRooms(),
        announcementService.getAnnouncements(),
        feedbackService.getFeedbacks(),
        menuService.getMenu()
      ]);

      setStats({
        rooms: {
          total: roomsData.status === 'fulfilled' ? roomsData.value.length : 0,
          available: roomsData.status === 'fulfilled' ? roomsData.value.filter(r => r.status === 'available').length : 0
        },
        announcements: announcementsData.status === 'fulfilled' ? announcementsData.value.length : 0,
        feedbacks: feedbacksData.status === 'fulfilled' ? feedbacksData.value.length : 0,
        menuItems: menuData.status === 'fulfilled' ? menuData.value.length : 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const services = [
    {
      id: 'rooms',
      title: 'Room Management',
      description: 'Track room occupancy, rent, and maintenance with ease. View detailed room information and manage guest assignments.',
      icon: '🏠',
      path: '/dashboard',
      stats: `${stats.rooms.available}/${stats.rooms.total} Available`,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'announcements',
      title: 'Announcements',
      description: 'Keep residents informed with important updates, notices, and community information. Create and manage announcements.',
      icon: '📢',
      path: '/announcements',
      stats: `${stats.announcements} Active`,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'feedbacks',
      title: 'Feedback System',
      description: 'Collect and manage resident feedback to improve services. View ratings and suggestions from your community.',
      icon: '💬',
      path: '/feedbacks',
      stats: `${stats.feedbacks} Reviews`,
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'menu',
      title: 'Menu Management',
      description: 'View daily menu items, meal timings, and dietary information. Filter by day and meal type for easy planning.',
      icon: '🍽️',
      path: '/menu',
      stats: `${stats.menuItems} Items`,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode
        ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
        : 'bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900'
    }`}>
      {/* Header with Theme Toggle */}
      <header className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full shadow-lg transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600'
              : 'bg-white text-gray-800 hover:bg-gray-50'
          }`}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className={`text-5xl font-bold mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Welcome to <span className="text-indigo-600">PG Tracker</span>
          </h1>
          <p className={`text-xl mb-8 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Comprehensive property management solution for PG owners. Manage rooms, announcements,
            feedback, and menu all in one modern dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/signup')}
              className={`px-8 py-3 font-semibold rounded-lg border-2 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${
                isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                  : 'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-50'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map(service => (
            <div
              key={service.id}
              onClick={() => navigate(service.path)}
              className={`group cursor-pointer rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${
                isDarkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${service.color} flex items-center justify-center text-2xl shadow-lg`}>
                    {service.icon}
                  </div>
                  <div className={`text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    <div className="text-sm font-medium">{service.stats}</div>
                  </div>
                </div>

                <h3 className={`text-2xl font-bold mb-3 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {service.title}
                </h3>

                <p className={`text-base leading-relaxed mb-6 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {service.description}
                </p>

                <div className="flex items-center text-indigo-600 group-hover:text-indigo-700 font-semibold">
                  <span>Explore {service.title}</span>
                  <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Loading dashboard statistics...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Homepage;
