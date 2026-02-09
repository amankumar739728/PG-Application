import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import roomService from '../api/roomService';
import authService from '../api/authService';
import UserInfo from './UserInfo';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const Payments = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [overduePayments, setOverduePayments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // Pay Now states
  const [selectedAmount, setSelectedAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentPurpose, setPaymentPurpose] = useState('rent');
  const [showQRCode, setShowQRCode] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    month: '',
    year: '',
    payment_status: '',
    room_number: '',
    search: '',
    payment_type: '' // Added payment type filter
  });

  // Notification states
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');
  // Force send monthly reminders (for testing)
  const [forceMonthlyReminders, setForceMonthlyReminders] = useState(false);

  useEffect(() => {
    fetchData();
    getUserRole();
    fetchCurrentUser();
  }, [activeTab]);

  // Removed automatic filtering on filter changes

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'all') {
        const data = await roomService.getPaymentDetails();
        setPayments(data);
        setFilteredPayments(data); // Initialize filtered payments with all data
      } else if (activeTab === 'overdue') {
        const data = await roomService.getOverduePayments();
        setOverduePayments(data);
      } else if (activeTab === 'analytics') {
        const data = await roomService.getPaymentAnalytics();
        setAnalytics(data);
      } else if (activeTab === 'pending') {
        const data = await roomService.getPendingMonthlyPayments();
        setPendingPayments(data);
      }
    } catch (err) {
      setError(`Failed to fetch ${activeTab} data`);
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = async () => {
    try {
      const user = await authService.getCurrentUser();
      setUserRole(user.role || 'user');
    } catch (err) {
      console.error('Failed to get user role:', err);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const handleSearch = () => {
    if (activeTab !== 'all') return;

    let filtered = [...payments];

    if (filters.month) {
      filtered = filtered.filter(payment => payment.payment_month && payment.payment_month.toLowerCase().includes(filters.month.toLowerCase()));
    }

    if (filters.year) {
      filtered = filtered.filter(payment => payment.payment_date && payment.payment_date.includes(filters.year));
    }

    if (filters.payment_status) {
      if (filters.payment_status === 'paid') {
        filtered = filtered.filter(payment => payment.payment_status === 'full');
      } else if (filters.payment_status === 'unpaid') {
        filtered = filtered.filter(payment => payment.payment_status !== 'full');
      }
    }

    if (filters.payment_type) {
      filtered = filtered.filter(payment => payment.payment_type === filters.payment_type);
    }

    if (filters.room_number) {
      filtered = filtered.filter(payment => payment.room_number === filters.room_number);
    }

    if (filters.search) {
      filtered = filtered.filter(payment =>
        payment.guest_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        payment.room_number.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredPayments(filtered);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setFilters({
      month: '',
      year: '',
      payment_status: '',
      room_number: '',
      search: '',
      payment_type: ''
    });
    setFilteredPayments([...payments]);
  };

  // const handleSendNotifications = async () => {
  //   try {
  //     const result = await roomService.sendBulkPaymentNotifications();
  //     showNotificationMessage(`Notifications sent successfully. Sent: ${result.sent_count}, Failed: ${result.failed_count}`, 'success');
  //   } catch (err) {
  //     // showNotificationMessage('Failed to send notifications', 'error');
  //     // Surface backend error details when available to help debugging
  //     console.error('Send notifications error:', err);
  //     const serverMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to send notifications';
  //     showNotificationMessage(serverMessage, 'error');
  //   }
  // };


//   const handleSendNotifications = async () => {
//   try {
//     const result = await roomService.sendBulkPaymentNotifications();
//     if (result.status === 'processing') {
//       showNotificationMessage('Notifications are being sent in the background. Check back in a moment.', 'success');
//     } else {
//       showNotificationMessage(`Notifications sent. Sent: ${result.sent_count}, Failed: ${result.failed_count}`, 'success');
//     }
//   } catch (err) {
//     console.error('Send notifications error:', err);
//     const serverMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to send notifications';
//     showNotificationMessage(serverMessage, 'error');
//   }
// };


  const handleSendNotifications = async () => {
    try {
      const result = await roomService.sendBulkPaymentNotifications();
      // Handle both response formats: async (status/message) and sync (sent_count/failed_count)
      if (result.status === 'processing') {
        showNotificationMessage(result.message, 'success');
      } else {
        showNotificationMessage(`Notifications sent successfully. Sent: ${result.sent_count}, Failed: ${result.failed_count}`, 'success');
      }
    } catch (err) {
      console.error('Send notifications error:', err);
      const serverMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to send notifications';
      showNotificationMessage(serverMessage, 'error');
      // showNotificationMessage('Failed to send notifications', 'error');
    }
  };

  // const handleSendMonthlyReminders = async () => {
  //   try {
  //     const result = await roomService.sendMonthlyRentReminders();
  //     showNotificationMessage(`Monthly reminders sent successfully. Sent: ${result.sent_count}, Failed: ${result.failed_count}`, 'success');
  //   } catch (err) {
  //     showNotificationMessage('Failed to send monthly reminders', 'error');
  //   }
  // };

//   const handleSendMonthlyReminders = async () => {
//   try {
//     const result = await roomService.sendMonthlyRentReminders();
//     if (result.status === 'processing') {
//       showNotificationMessage('Monthly reminders are being sent in the background. Check back in a moment.', 'success');
//     } else {
//       showNotificationMessage(`Monthly reminders sent. Sent: ${result.sent_count}, Failed: ${result.failed_count}`, 'success');
//     }
//   } catch (err) {
//     console.error('Send monthly reminders error:', err);
//     const serverMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to send monthly reminders';
//     showNotificationMessage(serverMessage, 'error');
//   }
// };


  const handleSendMonthlyReminders = async () => {
    try {
      const result = await roomService.sendMonthlyRentReminders(null, forceMonthlyReminders);
      showNotificationMessage(`Monthly reminders sent successfully. Sent: ${result.sent_count}, Failed: ${result.failed_count}`, 'success');
    } catch (err) {
      showNotificationMessage('Failed to send monthly reminders', 'error');
    }
  };

  const handleExportCSV = async () => {
    try {
      // The filters object includes payment_type, which the API will use to filter the exported data
      // Export will include payment type column and relevant fields based on payment type
      const blob = await roomService.exportPaymentsCSV(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      // Update filename to include payment type if specific type is selected
      const filename = filters.payment_type ? 
        `payments_${filters.payment_type}.csv` : 
        'payments_all.csv';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotificationMessage('CSV exported successfully', 'success');
    } catch (err) {
      showNotificationMessage('Failed to export CSV', 'error');
    }
  };

  const handleExportPDF = async () => {
    try {
      // The filters object includes payment_type, which the API will use to filter the exported data
      // Export will include payment type column and relevant fields based on payment type
      const blob = await roomService.exportPaymentsPDF(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      // Update filename to include payment type if specific type is selected
      const filename = filters.payment_type ? 
        `payments_${filters.payment_type}.pdf` : 
        'payments_all.pdf';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotificationMessage('PDF exported successfully', 'success');
    } catch (err) {
      showNotificationMessage('Failed to export PDF', 'error');
    }
  };

  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const renderPaymentCard = (payment) => {
    const rentAmounts = {
      '1-sharing': 15000,
      '2-sharing': 10000,
      '3-sharing': 8500,
      '4-sharing': 6500
    };

    const getStatusColor = (status, isDarkMode) => {
      switch (status) {
        case 'full':
          return isDarkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800';
        case 'partial':
          return isDarkMode ? 'bg-yellow-800 text-yellow-100' : 'bg-yellow-100 text-yellow-800';
        default:
          return isDarkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800';
      }
    };

    return (
      <div key={`${payment.room_number}-${payment.guest_name}-${payment.payment_month}-${payment.payment_type}`} 
        className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold">{payment.guest_name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              payment.payment_type === 'security' 
                ? (isDarkMode ? 'bg-purple-800 text-purple-100' : 'bg-purple-100 text-purple-800')
                : (isDarkMode ? 'bg-blue-800 text-blue-100' : 'bg-blue-100 text-blue-800')
            }`}>
              {payment.payment_type === 'security' ? 'Security' : 'Rent'}
            </span>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.payment_status, isDarkMode)}`}>
            {payment.payment_status === 'full' ? 'Paid' :
             payment.payment_status === 'partial' ? 'Partial' :
             'Pending'}
          </span>
        </div>
        <div className="space-y-1 text-sm">
          <p><strong>Room:</strong> {payment.room_number}</p>
          <p><strong>Month:</strong> {payment.payment_month}</p>
          {payment.payment_type === 'rent' ? (
            <>
              <p><strong>Rent Amount:</strong> ₹{payment.total_amount}</p>
              <p><strong>Amount Paid:</strong> ₹{payment.payment_amount}</p>
              {payment.balance_amount > 0 &&
                <p className={`${isDarkMode ? 'text-red-400' : 'text-red-600'} font-medium`}>
                  <strong>Balance:</strong> ₹{payment.balance_amount}
                </p>
              }
              {payment.payment_amount > payment.total_amount && (
                <div className={`${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} font-medium`}>
                  <p><strong>Overpaid:</strong> ₹{payment.payment_amount - payment.total_amount}</p>
                  <p>Please contact admin for refund.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <p><strong>Security Deposit:</strong> ₹{payment.total_amount}</p>
              <p><strong>Amount Paid:</strong> ₹{payment.payment_amount}</p>
              {payment.balance_amount > 0 &&
                <p className={`${isDarkMode ? 'text-red-400' : 'text-red-600'} font-medium`}>
                  <strong>Balance:</strong> ₹{payment.balance_amount}
                </p>
              }
              {payment.refunded_amount > 0 &&
                <p className={`${isDarkMode ? 'text-green-400' : 'text-green-600'} font-medium`}>
                  <strong>Refunded Amount:</strong> ₹{payment.refunded_amount}
                </p>
              }
            </>
          )}
          {payment.payment_date && 
            <p><strong>Payment Date:</strong> {new Date(payment.payment_date).toLocaleDateString()}</p>
          }
          {payment.payment_method && 
            <p><strong>Method:</strong> {payment.payment_method}</p>
          }
        </div>
      </div>
    );
  };

  // Helper to process overdue payments with detailed breakdown from backend
  const getUniqueOverduePayments = (payments) => {
    // The backend now returns aggregated data per guest with detailed breakdown
    return payments.map(payment => {
      // Calculate total outstanding from the detailed breakdown
      const totalOutstanding = payment.overdue_types.reduce((sum, type) => sum + type.outstanding, 0);

      // Format the breakdown for better display
      const formattedBreakdown = payment.overdue_types.map(type => ({
        type: type.type,
        month: type.month,
        outstanding: type.outstanding,
        total_due: type.total_due,
        total_paid: type.total_paid,
        display_text: type.type === 'security' && type.month === 'N/A'
          ? `Security Deposit: ₹${type.outstanding} (₹${type.total_paid}/₹${type.total_due})`
          : `${type.type.charAt(0).toUpperCase() + type.type.slice(1)} - ${type.month}: ₹${type.outstanding} (₹${type.total_paid}/₹${type.total_due})`
      }));

      return {
        ...payment,
        balance_amount: totalOutstanding,
        payment_date: payment.latest_overdue_date,
        overdue_breakdown: formattedBreakdown,
        // Add summary for quick display
        summary: {
          total_outstanding: totalOutstanding,
          breakdown_count: formattedBreakdown.length,
          types: [...new Set(payment.overdue_types.map(t => t.type))]
        }
      };
    });
  };

  const renderOverdueCard = (payment) => (
    <div key={`${payment.room_number}-${payment.guest_name}`} className={`p-4 rounded-lg shadow border-l-4 border-red-500 ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{payment.guest_name}</h3>
        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
          Overdue
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <p><strong>Room:</strong> {payment.room_number}</p>
        <p><strong>Phone:</strong> {payment.guest_phone}</p>
        <p><strong>Email:</strong> {payment.guest_email}</p>
        <p><strong>Total Outstanding:</strong> ₹{payment.balance_amount}</p>
        <p><strong>Last Payment:</strong> {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'Never'}</p>

        {/* Detailed Breakdown */}
        {payment.overdue_breakdown && payment.overdue_breakdown.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <p className="font-medium text-xs text-gray-600 dark:text-gray-400 mb-2">DETAILED BREAKDOWN:</p>
            <div className="space-y-1">
              {payment.overdue_breakdown.map((item, index) => (
                <div key={index} className={`text-xs p-2 rounded ${
                  item.type === 'security'
                    ? (isDarkMode ? 'bg-purple-900 text-purple-100' : 'bg-purple-50 text-purple-800')
                    : (isDarkMode ? 'bg-blue-900 text-blue-100' : 'bg-blue-50 text-blue-800')
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{item.display_text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPendingCard = (guest) => (
    <div key={guest.guest_id} className={`p-4 rounded-lg shadow border-l-4 border-yellow-500 ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{guest.guest_name}</h3>
        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
          Pending
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <p><strong>Room:</strong> {guest.room_number}</p>
        <p><strong>Email:</strong> {guest.guest_email}</p>
        <p><strong>Phone:</strong> {guest.guest_phone}</p>
        <p><strong>Monthly_Rent:</strong> ₹{guest.rent_amount}</p>
        <p><strong>Payment_Month:</strong> ₹{guest.payment_month}</p>
        <p><strong>Payment_Year:</strong> ₹{guest.payment_year}</p>
      </div>
    </div>
  );

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Payment Management</h1>
        <div className="flex gap-2 items-center">
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
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707-.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
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
          <UserInfo />
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className={`shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'all', label: 'All Payments', icon: '💰' },
              { id: 'overdue', label: 'Overdue', icon: '⚠️' },
              { id: 'pending', label: 'Monthly Pending', icon: '⏰' },
              { id: 'paynow', label: 'Pay Now', icon: '💳' },
              { id: 'analytics', label: 'Analytics', icon: '📊' }
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
        {/* Enhanced Analytics Summary */}
        {analytics && activeTab === 'analytics' && (
          <div className="space-y-6 mb-6">
            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Total Revenue</h4>
                    <p className="text-3xl font-bold text-green-600">₹{(analytics.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">All time collection</p>
              </div>

              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Collection Rate</h4>
                    <p className="text-3xl font-bold text-blue-600">
                      {analytics.total_payments > 0 ? Math.round((analytics.paid_payments / analytics.total_payments) * 100) : 0}%
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Overall payment success</p>
              </div>

              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Overdue Amount</h4>
                    <p className="text-3xl font-bold text-red-600">₹{(analytics.overdue_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-full">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Needs immediate attention</p>
              </div>

              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Active Payments</h4>
                    <p className="text-3xl font-bold text-purple-600">{analytics.total_payments || 0}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Total payment records</p>
              </div>
            </div>

            {/* Payment Type Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rent Analytics */}
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6`}>
                <h3 className="text-xl font-semibold mb-4 text-blue-600">Rent Analytics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Collected</h4>
                    <p className="text-2xl font-bold text-green-600">₹{(analytics.payment_type_summary?.rent?.paid_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Pending</h4>
                    <p className="text-2xl font-bold text-yellow-600">₹{(analytics.payment_type_summary?.rent?.pending_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Overdue</h4>
                    <p className="text-2xl font-bold text-red-600">₹{(analytics.payment_type_summary?.rent?.overdue_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Success Rate</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {analytics.payment_type_summary?.rent?.total_payments > 0
                        ? Math.round((analytics.payment_type_summary.rent.paid_payments / analytics.payment_type_summary.rent.total_payments) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Security Deposit Analytics */}
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6`}>
                <h3 className="text-xl font-semibold mb-4 text-purple-600">Security Deposit Analytics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-purple-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Collected</h4>
                    <p className="text-2xl font-bold text-green-600">₹{(analytics.payment_type_summary?.security?.paid_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-purple-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Pending</h4>
                    <p className="text-2xl font-bold text-yellow-600">₹{(analytics.payment_type_summary?.security?.pending_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-purple-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Overdue</h4>
                    <p className="text-2xl font-bold text-red-600">₹{(analytics.payment_type_summary?.security?.overdue_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-purple-50'}`}>
                    <h4 className="text-sm font-semibold text-gray-500">Success Rate</h4>
                    <p className="text-2xl font-bold text-purple-600">
                      {analytics.payment_type_summary?.security?.total_payments > 0
                        ? Math.round((analytics.payment_type_summary.security.paid_payments / analytics.payment_type_summary.security.total_payments) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters for All Payments */}
        {activeTab === 'all' && (
          <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
              <input
                type="text"
                placeholder="Search guests..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                onKeyPress={handleKeyPress}
                className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <input
                type="month"
                value={filters.month}
                onChange={(e) => setFilters({...filters, month: e.target.value})}
                onKeyPress={handleKeyPress}
                className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <input
                type="text"
                placeholder="Room Number"
                value={filters.room_number}
                onChange={(e) => setFilters({...filters, room_number: e.target.value})}
                onKeyPress={handleKeyPress}
                className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <select
                value={filters.payment_status}
                onChange={(e) => setFilters({...filters, payment_status: e.target.value})}
                onKeyPress={handleKeyPress}
                className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <select
                value={filters.payment_type}
                onChange={(e) => setFilters({...filters, payment_type: e.target.value})}
                onKeyPress={handleKeyPress}
                className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">All Types</option>
                <option value="rent">Rent</option>
                <option value="security">Security Deposit</option>
              </select>
              <button
                onClick={handleSearch}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
              >
                Search
              </button>
              <button
                onClick={handleClear}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
              >
                Clear
              </button>
              <button
                onClick={handleExportCSV}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Export PDF
              </button>
            </div>
          </div>
        )}

        {/* Admin Actions */}
        {userRole === 'admin' && (activeTab === 'overdue' || activeTab === 'pending') && (
          <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="flex space-x-4">
              {activeTab === 'overdue' && (
                <button
                  onClick={handleSendNotifications}
                  className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition"
                >
                  Send Overdue Notifications
                </button>
              )}
              {activeTab === 'pending' && (
                <div className="flex items-center space-x-4">
                <button
                  onClick={handleSendMonthlyReminders}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
                >
                  Send Monthly Reminders
                </button>
               <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={forceMonthlyReminders}
                      onChange={(e) => setForceMonthlyReminders(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                      Force Send (ignore date check)
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">Loading...</div>
        )}

        {/* Content based on active tab */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'all' && filteredPayments.length === 0 && (
            <p className={`col-span-full text-center text-gray-500 ${isDarkMode ? 'text-gray-400' : ''}`}>
              No payments found matching the filter criteria.
            </p>
          )}
          {activeTab === 'all' && filteredPayments.map(renderPaymentCard)}

          {activeTab === 'overdue' && getUniqueOverduePayments(overduePayments).length === 0 && (
            <div className={`col-span-full text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="mb-4">
                <svg className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No Overdue Payments</h3>
              <p className="text-sm">Great news! All guests are up to date with their payments.</p>
              {userRole === 'admin' && (
                <p className="text-xs mt-2 opacity-75">No action required at this time.</p>
              )}
            </div>
          )}
          {activeTab === 'overdue' && getUniqueOverduePayments(overduePayments).map(renderOverdueCard)}

          {activeTab === 'pending' && pendingPayments.length === 0 && (
            <div className={`col-span-full text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="mb-4">
                <svg className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No Pending Payments</h3>
              <p className="text-sm">All monthly payments are current.</p>
              {userRole === 'admin' && (
                <p className="text-xs mt-2 opacity-75">Monthly rent collection is on track.</p>
              )}
            </div>
          )}
          {activeTab === 'pending' && pendingPayments.map(renderPendingCard)}

          {/* Pay Now Tab */}
          {activeTab === 'paynow' && (
            <div className="col-span-full">
              <div className={`max-w-2xl mx-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-8`}>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Make a Payment</h2>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Choose your payment amount and scan the QR code to pay
                  </p>
                </div>

                {/* Payment Purpose Selection */}
                <div className="mb-6">
                  <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Payment Purpose
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentPurpose('rent')}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                        paymentPurpose === 'rent'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">🏠</div>
                        <div className="font-semibold">Monthly Rent</div>
                        <div className="text-sm opacity-75">Regular payment</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setPaymentPurpose('security')}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                        paymentPurpose === 'security'
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">🛡️</div>
                        <div className="font-semibold">Security Deposit</div>
                        <div className="text-sm opacity-75">One-time payment</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Amount Selection */}
                <div className="mb-6">
                  <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Select Amount
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {paymentPurpose === 'rent' ? (
                      <>
                        <button
                          onClick={() => setSelectedAmount('10000')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '10000'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹10,000
                        </button>
                        <button
                          onClick={() => setSelectedAmount('8500')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '8500'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹8,500
                        </button>
                        <button
                          onClick={() => setSelectedAmount('6500')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '6500'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹6,500
                        </button>
                        <button
                          onClick={() => setSelectedAmount('15000')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '15000'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹15,000
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectedAmount('12000')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '12000'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹12,000
                        </button>
                        <button
                          onClick={() => setSelectedAmount('24000')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '24000'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹24,000
                        </button>
                        <button
                          onClick={() => setSelectedAmount('36000')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '36000'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹36,000
                        </button>
                        <button
                          onClick={() => setSelectedAmount('48000')}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            selectedAmount === '48000'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : `border-gray-200 ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`
                          }`}
                        >
                          ₹48,000
                        </button>
                      </>
                    )}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Or enter custom amount"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setSelectedAmount('');
                      }}
                      className={`w-full p-3 border rounded-lg transition-all duration-200 ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                          : 'bg-white border-gray-300 focus:border-blue-500'
                      }`}
                    />
                    <span className="absolute right-3 top-3 text-gray-500">₹</span>
                  </div>
                </div>

                {/* Pay Now Button */}
                <button
                  onClick={() => {
                    const amount = customAmount || selectedAmount;
                    if (!amount) {
                      showNotificationMessage('Please select or enter an amount', 'error');
                      return;
                    }
                    setShowQRCode(true);
                  }}
                  disabled={!selectedAmount && !customAmount}
                  className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
                    selectedAmount || customAmount
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 shadow-lg'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {selectedAmount || customAmount ? `Pay ₹${(selectedAmount || customAmount).toLocaleString()}` : 'Select Amount to Continue'}
                </button>

                {/* QR Code Modal */}
                {showQRCode && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className={`relative max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-6`}>
                      {/* Close Button */}
                      <button
                        onClick={() => setShowQRCode(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>

                        <h3 className="text-xl font-bold mb-2">Payment Ready</h3>
                        <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Amount: ₹{(selectedAmount || customAmount).toLocaleString()}
                        </p>

                        {/* QR Code Placeholder */}
                        <div className={`w-64 h-64 mx-auto mb-6 border-4 rounded-lg flex items-center justify-center ${
                          isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
                        }`}>
                          <div className="text-center">
                            <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded-lg mx-auto mb-4 flex items-center justify-center">
                              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 15h4.01M12 21h4.01M12 12v.01M12 15v.01M12 18v.01M12 21v.01M8 12h.01M8 15h.01M8 18h.01M8 21h.01M4 12h.01M4 15h.01M4 18h.01M4 21h.01" />
                              </svg>
                            </div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              QR Code
                            </p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Scan to Pay
                            </p>
                          </div>
                        </div>

                        <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                          <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                            Payment Instructions:
                          </p>
                          <ul className={`text-xs space-y-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <li>• Open your UPI app (Google Pay, PhonePe, Paytm, etc.)</li>
                            <li>• Scan the QR code above</li>
                            <li>• Verify the amount: ₹{(selectedAmount || customAmount).toLocaleString()}</li>
                            <li>• Complete the payment</li>
                            <li>• Payment will be reflected in your account within 24 hours</li>
                          </ul>
                        </div>

                        <button
                          onClick={() => {
                            setShowQRCode(false);
                            showNotificationMessage('Payment initiated successfully! Please complete the payment in your UPI app.', 'success');
                          }}
                          className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-600 hover:to-blue-600 transition-all duration-200"
                        >
                          I've Completed the Payment
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Interactive Analytics Charts */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <h2 className="text-xl font-bold mb-6">Payment Analytics Dashboard</h2>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Payment Status Distribution */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className="text-lg font-semibold mb-4 text-center">Payment Status Distribution</h3>
                  <div className="h-64">
                    <Doughnut
                      data={{
                        labels: ['Paid', 'Pending', 'Overdue'],
                        datasets: [{
                          data: [
                            analytics.paid_payments || 0,
                            (analytics.total_payments || 0) - (analytics.paid_payments || 0) - (analytics.overdue_payments || 0),
                            analytics.overdue_payments || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(251, 191, 36, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                          ],
                          borderColor: [
                            'rgba(34, 197, 94, 1)',
                            'rgba(251, 191, 36, 1)',
                            'rgba(239, 68, 68, 1)'
                          ],
                          borderWidth: 2,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: isDarkMode ? '#e5e7eb' : '#374151',
                              padding: 20,
                              usePointStyle: true,
                            },
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                              }
                            }
                          }
                        },
                      }}
                    />
                  </div>
                </div>

                {/* Payment Type Distribution */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className="text-lg font-semibold mb-4 text-center">Payment Type Distribution</h3>
                  <div className="h-64">
                    <Pie
                      data={{
                        labels: ['Rent', 'Security Deposit'],
                        datasets: [{
                          data: [
                            analytics.payment_type_summary?.rent?.total_payments || 0,
                            analytics.payment_type_summary?.security?.total_payments || 0
                          ],
                          backgroundColor: [
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(147, 51, 234, 0.8)'
                          ],
                          borderColor: [
                            'rgba(59, 130, 246, 1)',
                            'rgba(147, 51, 234, 1)'
                          ],
                          borderWidth: 2,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: isDarkMode ? '#e5e7eb' : '#374151',
                              padding: 20,
                              usePointStyle: true,
                            },
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                              }
                            }
                          }
                        },
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Payment Method Distribution Chart */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className="text-lg font-semibold mb-4 text-center">Payment Method Distribution</h3>
                  <div className="h-64">
                    <Doughnut
                      data={{
                        labels: ['Cash', 'Online', 'Bank Transfer', 'Cheque', 'Other'],
                        datasets: [{
                          data: [
                            analytics.payment_method_summary?.cash?.count || 0,
                            analytics.payment_method_summary?.online?.count || 0,
                            analytics.payment_method_summary?.bank_transfer?.count || 0,
                            analytics.payment_method_summary?.cheque?.count || 0,
                            analytics.payment_method_summary?.other?.count || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',   // Green for Cash
                            'rgba(59, 130, 246, 0.8)',  // Blue for Online
                            'rgba(147, 51, 234, 0.8)',  // Purple for Bank Transfer
                            'rgba(251, 191, 36, 0.8)',  // Yellow for Cheque
                            'rgba(156, 163, 175, 0.8)'  // Gray for Other
                          ],
                          borderColor: [
                            'rgba(34, 197, 94, 1)',
                            'rgba(59, 130, 246, 1)',
                            'rgba(147, 51, 234, 1)',
                            'rgba(251, 191, 36, 1)',
                            'rgba(156, 163, 175, 1)'
                          ],
                          borderWidth: 2,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: isDarkMode ? '#e5e7eb' : '#374151',
                              padding: 15,
                              usePointStyle: true,
                              font: {
                                size: 12
                              }
                            },
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                return `${context.label}: ${context.parsed} payments (${percentage}%)`;
                              }
                            }
                          }
                        },
                      }}
                    />
                  </div>
                </div>

                {/* Payment Method Amount Distribution */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className="text-lg font-semibold mb-4 text-center">Payment Method Amount Distribution</h3>
                  <div className="h-64">
                    <Bar
                      data={{
                        labels: ['Cash', 'Online', 'Bank Transfer', 'Cheque', 'Other'],
                        datasets: [{
                          label: 'Amount (₹)',
                          data: [
                            analytics.payment_method_amounts?.cash || 0,
                            analytics.payment_method_amounts?.online || 0,
                            analytics.payment_method_amounts?.bank_transfer || 0,
                            analytics.payment_method_amounts?.cheque || 0,
                            analytics.payment_method_amounts?.other || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(147, 51, 234, 0.8)',
                            'rgba(251, 191, 36, 0.8)',
                            'rgba(156, 163, 175, 0.8)'
                          ],
                          borderColor: [
                            'rgba(34, 197, 94, 1)',
                            'rgba(59, 130, 246, 1)',
                            'rgba(147, 51, 234, 1)',
                            'rgba(251, 191, 36, 1)',
                            'rgba(156, 163, 175, 1)'
                          ],
                          borderWidth: 1,
                          borderRadius: 4,
                          borderSkipped: false,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return `₹${context.parsed.y.toLocaleString()}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return '₹' + value.toLocaleString();
                              },
                              color: isDarkMode ? '#e5e7eb' : '#374151',
                            },
                            grid: {
                              color: isDarkMode ? '#374151' : '#e5e7eb',
                            }
                          },
                          x: {
                            ticks: {
                              color: isDarkMode ? '#e5e7eb' : '#374151',
                            },
                            grid: {
                              display: false,
                            }
                          }
                        },
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h3 className="text-lg font-semibold mb-4 text-center">Revenue Overview</h3>
                <div className="h-80">
                  <Bar
                    data={{
                      labels: ['Rent Collected', 'Security Collected', 'Pending Amount', 'Overdue Amount'],
                      datasets: [{
                        label: 'Amount (₹)',
                        data: [
                          analytics.payment_type_summary?.rent?.paid_amount || 0,
                          analytics.payment_type_summary?.security?.paid_amount || 0,
                          (analytics.payment_type_summary?.rent?.pending_amount || 0) + (analytics.payment_type_summary?.security?.pending_amount || 0),
                          (analytics.payment_type_summary?.rent?.overdue_amount || 0) + (analytics.payment_type_summary?.security?.overdue_amount || 0)
                        ],
                        backgroundColor: [
                          'rgba(34, 197, 94, 0.8)',
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(251, 191, 36, 0.8)',
                          'rgba(239, 68, 68, 0.8)'
                        ],
                        borderColor: [
                          'rgba(34, 197, 94, 1)',
                          'rgba(59, 130, 246, 1)',
                          'rgba(251, 191, 36, 1)',
                          'rgba(239, 68, 68, 1)'
                        ],
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return `₹${context.parsed.y.toLocaleString()}`;
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function(value) {
                              return '₹' + value.toLocaleString();
                            },
                            color: isDarkMode ? '#e5e7eb' : '#374151',
                          },
                          grid: {
                            color: isDarkMode ? '#374151' : '#e5e7eb',
                          }
                        },
                        x: {
                          ticks: {
                            color: isDarkMode ? '#e5e7eb' : '#374151',
                          },
                          grid: {
                            display: false,
                          }
                        }
                      },
                    }}
                  />
                </div>
              </div>

              {/* Collection Rate Trend */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className="text-lg font-semibold mb-4 text-center">Collection Rates</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Rent Collection Rate</span>
                        <span className="text-sm font-bold text-blue-600">
                          {analytics.payment_type_summary?.rent?.total_payments > 0
                            ? Math.round((analytics.payment_type_summary.rent.paid_payments / analytics.payment_type_summary.rent.total_payments) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${analytics.payment_type_summary?.rent?.total_payments > 0
                              ? Math.round((analytics.payment_type_summary.rent.paid_payments / analytics.payment_type_summary.rent.total_payments) * 100)
                              : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Security Collection Rate</span>
                        <span className="text-sm font-bold text-purple-600">
                          {analytics.payment_type_summary?.security?.total_payments > 0
                            ? Math.round((analytics.payment_type_summary.security.paid_payments / analytics.payment_type_summary.security.total_payments) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{
                            width: `${analytics.payment_type_summary?.security?.total_payments > 0
                              ? Math.round((analytics.payment_type_summary.security.paid_payments / analytics.payment_type_summary.security.total_payments) * 100)
                              : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Overall Collection Rate</span>
                        <span className="text-sm font-bold text-green-600">
                          {analytics.total_payments > 0 ? Math.round((analytics.paid_payments / analytics.total_payments) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${analytics.total_payments > 0 ? Math.round((analytics.paid_payments / analytics.total_payments) * 100) : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className="text-lg font-semibold mb-4 text-center">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{analytics.paid_payments || 0}</div>
                      <div className="text-xs text-gray-500">Paid Payments</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {(analytics.total_payments || 0) - (analytics.paid_payments || 0)}
                      </div>
                      <div className="text-xs text-gray-500">Pending Payments</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{analytics.overdue_payments || 0}</div>
                      <div className="text-xs text-gray-500">Overdue Payments</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        ₹{((analytics.total_amount || 0) / Math.max(analytics.total_payments || 1, 1)).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">Avg Payment</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Modal */}
        {showNotification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg shadow-lg max-w-sm w-full mx-4 ${
              notificationType === 'success' ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'
            }`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  {notificationType === 'success' ? (
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-medium ${
                    notificationType === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {notificationType === 'success' ? 'Success!' : 'Error!'}
                  </h3>
                  <p className={`text-sm ${
                    notificationType === 'success' ? 'text-green-700' : 'text-red-700'
                  } mt-1`}>
                    {notificationMessage}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowNotification(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    notificationType === 'success'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Payments;
