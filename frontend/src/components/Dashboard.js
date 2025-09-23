import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import roomService from '../api/roomService';
import feedbackService from '../api/feedbackService';
import menuService from '../api/menuService';
import authService from '../api/authService';
import UserInfo from './UserInfo';
import { useTheme } from '../contexts/ThemeContext';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [rooms, setRooms] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  // Utility function to get relative time
  const getRelativeTime = (isoString) => {
    const now = new Date();
    let date;

    // If the ISO string has timezone info, parse normally
    if (isoString.includes('Z') || isoString.includes('+') || isoString.includes('-')) {
      date = new Date(isoString);
    } else {
      // No timezone info, assume it's UTC and append 'Z'
      date = new Date(isoString + 'Z');
    }

    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) return `${diffHr} hr ago`;
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'home') {
        // Fetch dashboard overview data
        const stats = await roomService.getRoomStatistics();

        // Fetch all rooms to calculate total revenue
        const allRooms = await roomService.getRooms();
        const totalRevenue = allRooms
          .filter(room => room.status === 'occupied')
          .reduce((sum, room) => sum + (room.guests ? room.guests.length * parseInt(room.rent_amount) : 0), 0);

        setStatistics({ ...stats, total_revenue: totalRevenue });

        // Fetch recent activities (50 for pagination)
        try {
          const recentActivities = await roomService.getRecentActivities(50);
          // Map API fields to expected fields
          const mappedActivities = recentActivities.map(activity => ({
            ...activity,
            type: activity.activity_type,
            title: activity.description,
            timestamp: activity.timestamp
          }));
          setActivities(mappedActivities);
        } catch (activityError) {
          console.error('Error fetching activities:', activityError);
          setActivities([]);
        }

        return;
      } else if (activeTab === 'rooms') {
        // Navigate to /rooms page
        navigate('/rooms');
        return;
      } else if (activeTab === 'announcements') {
        // Navigate to /announcements page instead of fetching here
        navigate('/announcements');
        return;
      } else if (activeTab === 'feedbacks') {
        // Navigate to /feedbacks page instead of fetching here
        navigate('/feedbacks');
        return;
      } else if (activeTab === 'payments') {
        // Navigate to /payments page
        navigate('/payments');
        return;
      } else if (activeTab === 'menu') {
        // Redirect to /menu page instead of fetching here
        navigate('/menu');
        return;
      }
    } catch (err) {
      setError(`Failed to fetch ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };



  const renderContent = () => {
    if (loading) {
      return <div className="text-center py-8">Loading...</div>;
    }

    if (error) {
      return <div className="text-red-500 text-center py-8">{error}</div>;
    }

    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className={`relative overflow-hidden rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'} text-white`}>
              <div className="absolute inset-0 bg-black bg-opacity-20"></div>
              <div className="relative p-8 md:p-12">
                <div className="max-w-4xl mx-auto text-center">
                  <h2 className="text-4xl md:text-5xl font-bold mb-4 animate-pulse">
                    Welcome to PG Tracker
                  </h2>
                  <p className="text-xl md:text-2xl mb-6 opacity-90">
                    Manage your PG rooms, guests, and payments efficiently
                  </p>
                  <div className="flex flex-wrap justify-center gap-4 text-sm">
                    <span className="bg-white bg-opacity-20 px-4 py-2 rounded-full backdrop-blur-sm">
                      🏠 Smart Room Management
                    </span>
                    <span className="bg-white bg-opacity-20 px-4 py-2 rounded-full backdrop-blur-sm">
                      💰 Automated Payments
                    </span>
                    <span className="bg-white bg-opacity-20 px-4 py-2 rounded-full backdrop-blur-sm">
                      📊 Real-time Analytics
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className={`group p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${isDarkMode ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-100'}`}>
                  <div className="flex items-center">
                    <div className="p-4 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                <div className="ml-4 cursor-pointer" onClick={() => { setActiveTab('rooms'); navigate('/rooms', { state: { filters: { status: '', room_type: '', search: '' } } }); }}>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total Rooms</p>
                  <p className="text-3xl font-bold text-blue-600">{statistics.total_rooms || 0}</p>
                </div>
                  </div>
                </div>

                <div className={`group p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${isDarkMode ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-100'}`}>
                  <div className="flex items-center">
                    <div className="p-4 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                <div className="ml-4 cursor-pointer" onClick={() => { setActiveTab('rooms'); navigate('/rooms', { state: { filters: { status: 'occupied', room_type: '', search: '' } } }); }}>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Occupied</p>
                  <p className="text-3xl font-bold text-green-600">{statistics.occupied_rooms || 0}</p>
                </div>
                  </div>
                </div>

                <div className={`group p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${isDarkMode ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-100'}`}>
                  <div className="flex items-center">
                    <div className="p-4 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                <div className="ml-4 cursor-pointer" onClick={() => { setActiveTab('rooms'); navigate('/rooms', { state: { filters: { status: 'available', room_type: '', search: '' } } }); }}>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Available</p>
                  <p className="text-3xl font-bold text-yellow-600">{statistics.available_rooms || 0}</p>
                </div>
                  </div>
                </div>

                <div className={`group p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${isDarkMode ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-100'}`}>
                  <div className="flex items-center">
                    <div className="p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total Revenue</p>
                      <p className="text-3xl font-bold text-purple-600">₹{statistics.total_revenue || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className={`p-8 rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
              <div className="text-center mb-8">
                <h3 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Quick Actions</h3>
                <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Everything you need at your fingertips</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <button
                  onClick={() => setActiveTab('rooms')}
                  className={`group p-6 rounded-xl border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 hover:border-indigo-500 hover:bg-indigo-900'
                      : 'border-gray-200 bg-gray-50 hover:border-indigo-500 hover:bg-indigo-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3 group-hover:animate-bounce">🏠</div>
                    <p className={`font-semibold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Manage Rooms</p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Add, edit, or view rooms</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('payments')}
                  className={`group p-6 rounded-xl border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 hover:border-green-500 hover:bg-green-900'
                      : 'border-gray-200 bg-gray-50 hover:border-green-500 hover:bg-green-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3 group-hover:animate-bounce">💰</div>
                    <p className={`font-semibold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Payment Details</p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Track rent payments</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('feedbacks')}
                  className={`group p-6 rounded-xl border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 hover:border-blue-500 hover:bg-blue-900'
                      : 'border-gray-200 bg-gray-50 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3 group-hover:animate-bounce">💬</div>
                    <p className={`font-semibold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>View Feedbacks</p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Read guest feedback</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('announcements')}
                  className={`group p-6 rounded-xl border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 hover:border-purple-500 hover:bg-purple-900'
                      : 'border-gray-200 bg-gray-50 hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3 group-hover:animate-bounce">📢</div>
                    <p className={`font-semibold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Announcements</p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Manage announcements</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('menu')}
                  className={`group p-6 rounded-xl border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-700 hover:border-orange-500 hover:bg-orange-900'
                      : 'border-gray-200 bg-gray-50 hover:border-orange-500 hover:bg-orange-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3 group-hover:animate-bounce">🍽️</div>
                    <p className={`font-semibold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Menu Management</p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Update daily menu</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className={`p-8 rounded-2xl shadow-2xl transition-colors duration-500 ${isDarkMode ? 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-gray-700' : 'bg-white border border-gray-200'}`}>
              <h3 className="text-3xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                Recent Activity
              </h3>
              <div className="relative border-l-4 border-indigo-500 pl-6 space-y-8">
                {activities.length > 0 ? (
                  (() => {
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedActivities = activities.slice(startIndex, endIndex);

                    return paginatedActivities.map((activity, index) => (
                      <div
                        key={activity.id || index}
                        className={`fade-in relative flex items-center space-x-4 group transition-transform transform hover:scale-[1.02] hover:shadow-lg rounded-lg p-4 ${
                          isDarkMode ? 'bg-gray-700 bg-opacity-70 hover:bg-opacity-90' : 'bg-indigo-50 hover:bg-indigo-100'
                        }`}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <span className={`absolute -left-6 top-5 w-5 h-5 rounded-full border-4 border-indigo-500 bg-white shadow-lg ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}></span>
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                          activity.type.includes('room') ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
                          activity.type.includes('payment') ? 'bg-gradient-to-br from-green-500 to-green-700' :
                          activity.type.includes('guest') ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                          'bg-gradient-to-br from-gray-500 to-gray-700'
                        }`}>
                          {activity.type.includes('room') ? 'R' :
                           activity.type.includes('payment') ? 'P' :
                           activity.type.includes('guest') ? 'G' :
                           activity.icon || 'A'}
                        </div>
                        <div className="flex flex-col flex-grow">
                          <div className="flex justify-between items-start mb-1">
                            <p className={`font-bold text-lg ${
                              isDarkMode ? (
                                activity.type.includes('room') ? 'text-blue-300' :
                                activity.type.includes('payment') ? 'text-green-300' :
                                activity.type.includes('guest') ? 'text-purple-300' :
                                'text-white'
                              ) : (
                                activity.type.includes('room') ? 'text-blue-600' :
                                activity.type.includes('payment') ? 'text-green-600' :
                                activity.type.includes('guest') ? 'text-purple-600' :
                                'text-gray-900'
                              )
                            }`}>{activity.title}</p>
                            <span className={`text-xs font-medium whitespace-nowrap ml-4 px-2 py-1 rounded-full ${
                              (() => {
                                const now = new Date();
                                let date;
                                if (activity.timestamp.includes('Z') || activity.timestamp.includes('+') || activity.timestamp.includes('-')) {
                                  date = new Date(activity.timestamp);
                                } else {
                                  date = new Date(activity.timestamp + 'Z');
                                }
                                const diffMs = now - date;
                                const diffMin = Math.floor(diffMs / (1000 * 60));
                                const diffHr = Math.floor(diffMin / 60);
                                const diffDay = Math.floor(diffHr / 24);

                                if (diffMin < 60) return isDarkMode ? 'bg-green-600 text-green-100' : 'bg-green-200 text-green-800';
                                if (diffHr < 24) return isDarkMode ? 'bg-yellow-600 text-yellow-100' : 'bg-yellow-200 text-yellow-800';
                                return isDarkMode ? 'bg-red-600 text-red-100' : 'bg-red-200 text-red-800';
                              })()
                            }`}>{getRelativeTime(activity.timestamp)}</span>
                          </div>
                          <div className="flex items-center min-h-[2rem]">
                            <p className={`text-sm flex-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{activity.description}</p>
                          </div>
                        </div>
                      </div>
                    ));
                  })()
                ) : (
                  <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-700 bg-opacity-70' : 'bg-indigo-50'}`}>
                    <p className={`text-center text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>No recent activities</p>
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {activities.length > itemsPerPage && (
                <div className="flex justify-center mt-6 space-x-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-300 ${
                      currentPage === 1
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isDarkMode
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                  >
                    Previous
                  </button>
                  <span className={`px-4 py-2 rounded-lg font-medium ${
                    isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                  }`}>
                    Page {currentPage} of {Math.ceil(activities.length / itemsPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(activities.length / itemsPerPage)))}
                    disabled={currentPage === Math.ceil(activities.length / itemsPerPage)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-300 ${
                      currentPage === Math.ceil(activities.length / itemsPerPage)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isDarkMode
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'rooms':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map(room => (
              <div key={room.id} className={`p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Room {room.room_number}</h2>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    room.status === 'occupied' ? 'bg-green-100 text-green-800' :
                    room.status === 'available' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {room.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><span className="font-medium">Type:</span> {room.room_type}</p>
                  <p><span className="font-medium">Capacity:</span> {room.capacity}</p>
                  <p><span className="font-medium">Current Occupancy:</span> {room.current_occupancy}</p>
                  <p><span className="font-medium">Rent:</span> ₹{room.rent_amount}</p>
                </div>
              </div>
            ))}
          </div>
        );

      case 'feedbacks':
        return (
          <div className="space-y-4">
            {feedbacks.map(feedback => (
              <div key={feedback.id} className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{feedback.guest_name}</h2>
                <p className="text-gray-700 mb-4">{feedback.message}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Room: {feedback.room_number || 'N/A'}</span>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">Rating:</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${i < (feedback.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );



      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <header className={`shadow-sm border-b transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className={`text-2xl font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                PG Tracker Dashboard
              </h1>
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
            <UserInfo />
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className={`shadow-sm transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'home', label: 'Home', icon: '🏠' },
              { id: 'rooms', label: 'Rooms', icon: '🏘️' },
              { id: 'payments', label: 'Payment-Details', icon: '💰' },
              { id: 'announcements', label: 'Announcements', icon: '📢' },
              { id: 'feedbacks', label: 'Feedbacks', icon: '💬' },
              { id: 'menu', label: 'Menu', icon: '🍽️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors duration-300 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : `border-transparent ${
                        isDarkMode
                          ? 'text-gray-300 hover:text-white hover:border-gray-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
