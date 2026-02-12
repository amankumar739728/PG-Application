import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import roomService from '../api/roomService';
import authService from '../api/authService';
import UserInfo from './UserInfo';
import UniversalNav from './UniversalNav';

const Rooms = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();

  // Room-specific rent and security amounts
  const rentAmounts = {
    '1-sharing': 15000,
    '2-sharing': 10000,
    '3-sharing': 8500,
    '4-sharing': 6500
  };

  const securityAmounts = {
    '1-sharing': 5000,
    '2-sharing': 5000,
    '3-sharing': 5000,
    '4-sharing': 5000
  };

  // Room capacities
  const capacities = {
    '1-sharing': 1,
    '2-sharing': 2,
    '3-sharing': 3,
    '4-sharing': 4
  };

  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success'); // 'success' or 'error'
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedRoomToDelete, setSelectedRoomToDelete] = useState(null);
  const [showDeleteGuestConfirmation, setShowDeleteGuestConfirmation] = useState(false);
  const [selectedGuestToDelete, setSelectedGuestToDelete] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('rooms');

  // Room management states
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomFormData, setRoomFormData] = useState({
    room_number: '',
    room_type: '1-sharing',
    capacity: 1,
    rent_amount: 15000,
    security_deposit: '',
    status: 'available'
  });

  // Guest management states
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [guests, setGuests] = useState([]);
  const [editingGuest, setEditingGuest] = useState(null);
  const [guestFormData, setGuestFormData] = useState({
    user_id: '',
    username: '',
    phone: '',
    email: '',
    aadhar: '',
    date_of_joining: '',
    rent_paid: false,
    security_paid: false,
    rent_amount_paid: '',
    security_amount_paid: ''
  });

  // Payment management states
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [paymentFormData, setPaymentFormData] = useState({
    payment_type: 'rent', // 'rent' or 'security'
    month: '',
    amount: '',
    payment_method: 'UPI',
    notes: ''
  });

  // Overpayment confirmation modal states
  const [showOverpaymentConfirmModal, setShowOverpaymentConfirmModal] = useState(false);
  const [overpaymentDetails, setOverpaymentDetails] = useState(null);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState(null);

  // Filters and search
  const [filters, setFilters] = useState({
    status: '',
    room_type: '',
    search: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const roomsPerPage = 6;

  // Statistics
  const [statistics, setStatistics] = useState(null);
  const [filteredRevenue, setFilteredRevenue] = useState(0);
  const [filteredGuests, setFilteredGuests] = useState(0);

  useEffect(() => {
    fetchRooms();
    getUserRole();
    fetchCurrentUser();
    fetchStatistics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rooms, filters]);


  useEffect(() => {
    if (showNotificationModal) {
      const timer = setTimeout(() => setShowNotificationModal(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showNotificationModal]);

  useEffect(() => {
    // Always start with empty filters to show all rooms by default
    setFilters({ status: '', room_type: '', search: '' });
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const data = await roomService.getRooms();
      setRooms(data);
    } catch (err) {
      setError('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const stats = await roomService.getRoomStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
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

  const applyFilters = () => {
    let filtered = [...rooms];

    if (filters.status) {
      filtered = filtered.filter(room => room.status === filters.status);
    }

    if (filters.room_type) {
      filtered = filtered.filter(room => room.room_type === filters.room_type);
    }

    if (filters.search) {

      // Apply the original filtering logic
      filtered = filtered.filter(room =>
        room.room_number.toLowerCase().includes(filters.search.toLowerCase()) ||
        room.room_type.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredRooms(filtered);
    setFilteredRevenue(filtered.filter(room => room.status === 'occupied').reduce((sum, room) => sum + (room.guests ? room.guests.length * parseInt(room.rent_amount) : 0), 0));
    setFilteredGuests(filtered.filter(room => room.status === 'occupied').reduce((sum, room) => sum + (room.guests ? room.guests.length : 0), 0));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Calculate paginated rooms
  const paginatedRooms = filteredRooms.slice(
    (currentPage - 1) * roomsPerPage,
    currentPage * roomsPerPage
  );

  // Calculate total pages
  const totalPages = Math.ceil(filteredRooms.length / roomsPerPage);

  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await roomService.updateRoom(editingRoom.room_number, roomFormData);
        showNotification('Room updated successfully');
      } else {
        await roomService.createRoom(roomFormData);
        showNotification('Room created successfully');
      }
      setShowRoomForm(false);
      setEditingRoom(null);
      resetRoomForm();
      fetchRooms();
      fetchStatistics();
    } catch (err) {
      showNotification('Failed to save room', 'error');
    }
  };

  const handleDeleteRoom = (roomNumber) => {
    setSelectedRoomToDelete(roomNumber);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteRoom = async () => {
    if (selectedRoomToDelete) {
      try {
        await roomService.deleteRoom(selectedRoomToDelete);
        fetchRooms();
        fetchStatistics();
        showNotification('Room deleted successfully');
      } catch (err) {
        showNotification('Failed to delete room', 'error');
      } finally {
        setShowDeleteConfirmation(false);
        setSelectedRoomToDelete(null);
      }
    }
  };

  const handleAddGuest = async (e) => {
    e.preventDefault();
    try {
      // Ensure we have valid amounts for both rent and security
      const rentAmount = parseInt(guestFormData.rent_amount_paid) || 0;
      const securityAmount = parseInt(guestFormData.security_amount_paid) || 0;
      const requiredRent = rentAmounts[selectedRoom.room_type];
      const requiredSecurity = securityAmounts[selectedRoom.room_type];

      // Always require initial rent payment
      if (rentAmount <= 0) {
        showNotification('Initial rent payment is required', 'error');
        return;
      }
      if (rentAmount > requiredRent) {
        showNotification(`Rent payment cannot exceed monthly rent amount (₹${requiredRent})`, 'error');
        return;
      }

      // Always require security deposit
      if (securityAmount <= 0) {
        showNotification('Security deposit is required', 'error');
        return;
      }
      if (securityAmount > requiredSecurity) {
        showNotification(`Security deposit cannot exceed required amount (₹${requiredSecurity})`, 'error');
        return;
      }

      // First add the guest with proper payment flags and the actual amounts paid
      const guestData = {
        ...guestFormData,
        security_paid: guestFormData.security_paid,
        rent_paid: guestFormData.rent_paid,
        rent_amount_paid: rentAmount,
        security_amount_paid: securityAmount,
        rent_payment_method: guestFormData.rent_payment_method || 'UPI',
        security_payment_method: guestFormData.security_payment_method || 'UPI'
      };

      // Add the guest with all payment history
      await roomService.addGuestToRoom(selectedRoom.room_number, guestData);

      setShowGuestForm(false);
      resetGuestForm();
      await fetchRooms(); // Refetch to get updated data
      showNotification('Guest and initial payments added successfully');

    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to add guest';
      showNotification(errorMessage, 'error');
    }
  };

  const handleRemoveGuest = (roomNumber, userId) => {
    setSelectedGuestToDelete({ roomNumber, userId });
    setShowDeleteGuestConfirmation(true);
  };

  const confirmDeleteGuest = async () => {
    if (selectedGuestToDelete) {
      try {
        await roomService.removeGuestFromRoom(selectedGuestToDelete.roomNumber, selectedGuestToDelete.userId);
        fetchRooms();
        showNotification('Guest removed successfully');
      } catch (err) {
        showNotification('Failed to remove guest', 'error');
      } finally {
        setShowDeleteGuestConfirmation(false);
        setSelectedGuestToDelete(null);
      }
    }
  };

  const calculateTotalPaidForMonth = (guest, month, paymentType) => {
    if (!guest) return 0;
    
    if (paymentType === 'rent') {
      // For rent, only consider payments from the specified month
      const rentPayments = guest.rent_history?.filter(p => 
        p.month === month && p.payment_type === 'rent') || [];
      return rentPayments.reduce((sum, p) => sum + (parseInt(p.amount) || 0), 0);
    } else {
      // For security deposits, consider all security payments as it's a one-time deposit
      const securityPayments = guest.security_history?.filter(p => 
        p.payment_type === 'security') || [];
      return securityPayments.reduce((sum, p) => sum + (parseInt(p.amount) || 0), 0);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const amount = parseInt(paymentFormData.amount);
      const paymentType = paymentFormData.payment_type;

      // For security deposit, use current month
      const month = paymentType === 'rent' ?
        paymentFormData.month :
        new Date().toISOString().slice(0, 7); // Current month for security

      // Calculate total amount already paid
      const totalPaid = calculateTotalPaidForMonth(
        selectedGuest,
        paymentType === 'rent' ? month : null,  // Pass null for security to get all security payments
        paymentType
      );

      // Get required amount based on payment type
      const requiredAmount = paymentType === 'rent' ?
        parseInt(selectedRoom.rent_amount) :
        parseInt(selectedRoom.security_deposit);

      // Validate payment amount
      if (amount <= 0) {
        showNotification('Payment amount must be greater than 0', 'error');
        return;
      }

      // Debug logging for overpayment check
      console.log('Payment Type:', paymentType);
      console.log('Total Paid:', totalPaid);
      console.log('Amount:', amount);
      console.log('Required Amount:', requiredAmount);
      console.log('Will Overpay:', totalPaid + amount > requiredAmount);

      // Additional debugging for rent payments
      if (paymentType === 'rent') {
        console.log('Rent-specific debug:');
        console.log('Month:', month);
        console.log('Guest rent_history:', selectedGuest.rent_history);
        console.log('Filtered rent payments for month:', selectedGuest.rent_history?.filter(p => p.month === month && p.payment_type === 'rent') || []);
      }

      // Check for overpayment
      if (totalPaid + amount > requiredAmount) {
        // Show overpayment confirmation modal instead of window.confirm
        setOverpaymentDetails({
          requiredAmount,
          totalPaid,
          newPayment: amount,
          totalAfter: totalPaid + amount,
          paymentType
        });
        setPendingPaymentAmount(amount);
        setShowOverpaymentConfirmModal(true);
        return; // Wait for user confirmation
      }

      const paymentData = {
        ...paymentFormData,
        month, // Use calculated month
        payment_type: paymentType,
        notes: paymentType === 'security' ?
          `Security deposit payment: ₹${amount} (Total paid: ₹${totalPaid + amount})` :
          paymentFormData.notes
      };

      await roomService.addPayment(
        selectedRoom.room_number,
        selectedGuest.user_id,
        paymentData
      );

      // Show appropriate success message
      let successMessage;
      if (totalPaid + amount >= requiredAmount) {
        successMessage = `${paymentType === 'rent' ? 'Rent' : 'Security deposit'} payment completed successfully. Full amount received.`;
      } else {
        const remaining = requiredAmount - (totalPaid + amount);
        successMessage = `Partial payment recorded successfully. Remaining amount: ₹${remaining}`;
      }

      showNotification(successMessage, 'success');
      setShowPaymentForm(false);
      resetPaymentForm();
      fetchRooms();
    } catch (err) {
      showNotification('Failed to add payment', 'error');
    }
  };

  const resetRoomForm = () => {
    const defaultType = '1-sharing';
    setRoomFormData({
      room_number: '',
      room_type: defaultType,
      capacity: capacities[defaultType],
      rent_amount: rentAmounts[defaultType],
      security_deposit: securityAmounts[defaultType],
      status: 'available'
    });
    setEditingRoom(null);
  };

  const resetGuestForm = () => {
    setGuestFormData({
      user_id: '',
      username: '',
      phone: '',
      email: '',
      aadhar: '',
      date_of_joining: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      rent_paid: false,
      security_paid: false,
      rent_amount_paid: 0, // Set initial amount to 0
      security_amount_paid: 0, // Set initial amount to 0
      rent_payment_method: 'UPI',  
      security_payment_method: 'UPI'  
    });
  };

  const resetPaymentForm = () => {
    setPaymentFormData({
      payment_type: 'rent',
      month: '',
      amount: '',
      payment_method: 'UPI',
      notes: ''
    });
  };

  const openRoomForm = (room = null) => {
    if (room) {
      // Editing existing room
      setEditingRoom(room);
      setRoomFormData({
        room_number: room.room_number,
        room_type: room.room_type,
        capacity: room.capacity,
        rent_amount: room.rent_amount,
        security_deposit: room.security_deposit,
        status: room.status
      });
    } else {
      // Creating new room
      const defaultType = '1-sharing';
      setEditingRoom(null);
      setRoomFormData({
        room_number: '',
        room_type: defaultType,
        capacity: capacities[defaultType],
        rent_amount: rentAmounts[defaultType],
        security_deposit: securityAmounts[defaultType],
        status: 'available'
      });
    }
    setShowRoomForm(true);
  };

  const openGuestForm = (room) => {
    setSelectedRoom(room);
    setGuests(room.guests || []);
    // Calculate next user_id for this specific room (room-specific sequential IDs)
    const roomGuests = room.guests || [];
    const maxId = roomGuests.length > 0 ? Math.max(...roomGuests.map(g => parseInt(g.user_id) || 0)) : 0;
    // Reset form and set only user_id and current date
    setGuestFormData({
      user_id: (maxId + 1).toString(),
      username: '',
      phone: '',
      email: '',
      aadhar: '',
      date_of_joining: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      rent_paid: true,
      security_paid: true,
      rent_amount_paid: room.rent_amount,
      security_amount_paid: room.security_deposit,
      rent_payment_method: 'UPI',
      security_payment_method: 'UPI'
    });
    setSuccess('');
    setError('');
    setShowGuestForm(true);
  };

  const openPaymentForm = (room, guest) => {
    setSelectedRoom(room);
    setSelectedGuest(guest);
    setShowPaymentForm(true);
  };

  const showNotification = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotificationModal(true);
  };

  const renderRoomCard = (room) => (
    <div key={room.room_number} className={`p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Room {room.room_number}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          room.status === 'occupied' ? 'bg-green-100 text-green-800' :
          room.status === 'available' ? 'bg-blue-100 text-blue-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {room.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <p><strong>Type:</strong> {room.room_type}</p>
        <p><strong>Capacity:</strong> {room.capacity}</p>
        <p><strong>Occupancy:</strong> {room.current_occupancy}/{room.capacity}</p>
        <p><strong>Rent:</strong> ₹{room.rent_amount}</p>
        <p><strong>Security:</strong> ₹{room.security_deposit}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {userRole === 'admin' && (
          <>
            <button
              onClick={() => openRoomForm(room)}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteRoom(room.room_number)}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition"
            >
              Delete
            </button>
          </>
        )}
        <button
          onClick={() => openGuestForm(room)}
          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
        >
          Manage Guests ({room.guests?.length || 0})
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Room Management</h1>
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
            {userRole === 'admin' && (
              <button
                onClick={() => openRoomForm()}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Add Room
              </button>
            )}
            <UserInfo />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
            <div
              className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:scale-105`}
              onClick={() => setFilters({status: '', room_type: '', search: ''})}
            >
              <h3 className="text-lg font-semibold">Total Rooms</h3>
              <p className="text-2xl font-bold text-blue-600">{statistics.total_rooms}</p>
            </div>
            <div
              className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:scale-105`}
              onClick={() => setFilters({status: 'occupied', room_type: '', search: ''})}
            >
              <h3 className="text-lg font-semibold">Occupied</h3>
              <p className="text-2xl font-bold text-green-600">{statistics.occupied_rooms}</p>
            </div>
            <div
              className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:scale-105`}
              onClick={() => setFilters({status: 'available', room_type: '', search: ''})}
            >
              <h3 className="text-lg font-semibold">Available</h3>
              <p className="text-2xl font-bold text-blue-600">{statistics.available_rooms}</p>
            </div>
            <div
              className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:scale-105`}
              onClick={() => setFilters({status: 'occupied', room_type: '', search: ''})}
            >
              <h3 className="text-lg font-semibold">Total Guests</h3>
              <p className="text-2xl font-bold text-indigo-600">{filteredGuests}</p>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow hover:shadow-lg transition-shadow duration-200 hover:scale-105`}>
              <h3 className="text-lg font-semibold">Total Revenue</h3>
              <p className="text-2xl font-bold text-purple-600">₹{filteredRevenue}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Search rooms..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            <select
              value={filters.status}
              onChange={(e) => {
                const value = e.target.value;
                setFilters({...filters, status: value});
                if (value === 'maintenance') {
                  showNotification('No rooms are currently under maintenance.', 'info');
                }
              }}
              className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <select
              value={filters.room_type}
              onChange={(e) => setFilters({...filters, room_type: e.target.value})}
              className={`p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="">All Types</option>
              <option value="1-sharing">1-Sharing</option>
              <option value="2-sharing">2-Sharing</option>
              <option value="3-sharing">3-Sharing</option>
              <option value="4-sharing">4-Sharing</option>
            </select>
            {userRole === 'admin' && (
              <button
                onClick={() => setFilters({status: '', room_type: '', search: ''})}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
              >
                Clear
              </button>
            )}
            {userRole === 'admin' && (
              <button
                onClick={() => openRoomForm()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Add Room
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">Loading...</div>
        )}

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.length === 0 && filters.status === 'maintenance' ? (
            <div className={`col-span-full p-8 rounded-lg text-center ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No Maintenance Required</h3>
              <p>No rooms are currently under maintenance.</p>
            </div>
          ) : filteredRooms.length === 0 && (filters.room_type || filters.search) ? (
            <div className={`col-span-full p-8 rounded-lg text-center ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No Rooms Available</h3>
              <p className="mb-4">No rooms found for "{filters.room_type || filters.search}". Add a new room to get started.</p>
              {userRole === 'admin' && (
                <button
                  onClick={() => openRoomForm()}
                  className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition"
                >
                  Add Room
                </button>
              )}
            </div>
          ) : (
            paginatedRooms.map(renderRoomCard)
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-6 space-x-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Room Form Modal */}
        {showRoomForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg shadow-lg max-w-md w-full mx-4 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{editingRoom ? 'Edit Room' : 'Add Room'}</h2>
                <button
                  onClick={() => setShowRoomForm(false)}
                  className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleRoomSubmit}>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Room Number"
                    value={roomFormData.room_number}
                    onChange={(e) => setRoomFormData({...roomFormData, room_number: e.target.value})}
                    className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    required
                  />
                  <select
                    value={roomFormData.room_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      // Always update all values when room type changes
                      setRoomFormData({
                        ...roomFormData,
                        room_type: newType,
                        capacity: capacities[newType],
                        rent_amount: rentAmounts[newType],
                        security_deposit: securityAmounts[newType]
                      });
                    }}
                    className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="1-sharing">1-Sharing</option>
                    <option value="2-sharing">2-Sharing</option>
                    <option value="3-sharing">3-Sharing</option>
                    <option value="4-sharing">4-Sharing</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Capacity"
                    value={roomFormData.capacity}
                    onChange={(e) => setRoomFormData({...roomFormData, capacity: parseInt(e.target.value)})}
                    className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Rent Amount"
                    value={roomFormData.rent_amount}
                    onChange={(e) => setRoomFormData({...roomFormData, rent_amount: parseInt(e.target.value)})}
                    className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Security Deposit"
                    value={roomFormData.security_deposit}
                    onChange={(e) => setRoomFormData({...roomFormData, security_deposit: parseInt(e.target.value)})}
                    className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    required
                  />
                  <select
                    value={roomFormData.status}
                    onChange={(e) => setRoomFormData({...roomFormData, status: e.target.value})}
                    className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="flex space-x-2 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
                  >
                    {editingRoom ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRoomForm(false)}
                    className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Guest Management Modal */}
        {showGuestForm && selectedRoom && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Manage Guests - Room {selectedRoom.room_number}</h2>
                <button
                  onClick={() => setShowGuestForm(false)}
                  className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Add Guest Form */}
                <div className="flex-1 overflow-y-auto pr-4">
                  <h3 className="text-lg font-semibold mb-4">Add New Guest</h3>
                  <form onSubmit={handleAddGuest}>
                    <div className="space-y-4">
                      <input
                        type="number"
                        placeholder="User ID"
                        value={guestFormData.user_id}
                        onChange={(e) => setGuestFormData({...guestFormData, user_id: e.target.value})}
                        className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        required
                        min="1"
                        step="1"
                      />
                      <input
                        type="text"
                        placeholder="Username"
                        value={guestFormData.username}
                        onChange={(e) => setGuestFormData({...guestFormData, username: e.target.value})}
                        className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        required
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={guestFormData.email}
                        onChange={(e) => setGuestFormData({...guestFormData, email: e.target.value})}
                        className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        required
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={guestFormData.phone}
                        onChange={(e) => setGuestFormData({...guestFormData, phone: e.target.value})}
                        className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Aadhar Number"
                        value={guestFormData.aadhar}
                        onChange={(e) => setGuestFormData({...guestFormData, aadhar: e.target.value})}
                        className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        required
                      />
                      <input
                        type="date"
                        placeholder="Date of Joining"
                        value={guestFormData.date_of_joining}
                        onChange={(e) => setGuestFormData({...guestFormData, date_of_joining: e.target.value})}
                        className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        required
                      />
                      <div className="space-y-4">
                        <div className="flex space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={guestFormData.rent_paid}
                              onChange={(e) => setGuestFormData({
                                ...guestFormData,
                                rent_paid: e.target.checked,
                                rent_amount_paid: e.target.checked ? '' : '',
                                rent_payment_method: e.target.checked ? 'UPI' : ''
                              })}
                              className="mr-2"
                            />
                            Rent Paid
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={guestFormData.security_paid}
                              onChange={(e) => setGuestFormData({
                                ...guestFormData,
                                security_paid: e.target.checked,
                                security_amount_paid: e.target.checked ? '' : '',
                                security_payment_method: e.target.checked ? 'UPI' : ''
                              })}
                              className="mr-2"
                            />
                            Security Paid
                          </label>
                        </div>
                        
                        {/* Payment Summary */}
                        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <h4 className="font-medium mb-3">Payment Information</h4>
                          <div className="space-y-2 text-sm">
                            <p><strong>Room Type:</strong> {selectedRoom.room_type}</p>
                            <p><strong>Monthly Rent Required:</strong> ₹{selectedRoom.rent_amount}</p>
                            <p><strong>Security Deposit Required:</strong> ₹{selectedRoom.security_deposit}</p>
                            {(guestFormData.rent_paid || guestFormData.security_paid) && (
                              <>
                                <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>
                                <div className="space-y-1">
                                  {guestFormData.rent_paid && (
                                    <>
                                      <p><strong>Rent Amount Paying:</strong> ₹{guestFormData.rent_amount_paid || 0}</p>
                                      {guestFormData.rent_amount_paid && (
                                        <p className={parseInt(guestFormData.rent_amount_paid) < rentAmounts[selectedRoom.room_type] ? 
                                          'text-yellow-500' : 'text-green-500'}>
                                          <strong>Rent Balance:</strong> ₹{rentAmounts[selectedRoom.room_type] - (parseInt(guestFormData.rent_amount_paid) || 0)}
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {guestFormData.security_paid && (
                                    <>
                                      <p><strong>Security Amount Paying:</strong> ₹{guestFormData.security_amount_paid || 0}</p>
                                      {guestFormData.security_amount_paid && (
                                        <p className={parseInt(guestFormData.security_amount_paid) < securityAmounts[selectedRoom.room_type] ? 
                                          'text-yellow-500' : 'text-green-500'}>
                                          <strong>Security Balance:</strong> ₹{securityAmounts[selectedRoom.room_type] - (parseInt(guestFormData.security_amount_paid) || 0)}
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                      </div>
                      {guestFormData.rent_paid && (
                        <>
                          <div className="relative">
                            <input
                              type="number"
                              placeholder="Rent Amount Paid"
                              value={guestFormData.rent_amount_paid}
                              onChange={(e) => setGuestFormData({...guestFormData, rent_amount_paid: e.target.value})}
                              className={`w-full p-2 pl-8 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                              required
                            />
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          </div>
                          <select
                            value={guestFormData.rent_payment_method || 'Cash'}
                            onChange={(e) => setGuestFormData({...guestFormData, rent_payment_method: e.target.value})}
                            className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </>
                      )}
                      {guestFormData.security_paid && (
                        <>
                          <div className="relative">
                            <input
                              type="number"
                              placeholder="Security Amount Paid"
                              value={guestFormData.security_amount_paid}
                              onChange={(e) => setGuestFormData({...guestFormData, security_amount_paid: e.target.value})}
                              className={`w-full p-2 pl-8 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                              required
                            />
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                          </div>
                          <select
                            value={guestFormData.security_payment_method || 'Cash'}
                            onChange={(e) => setGuestFormData({...guestFormData, security_payment_method: e.target.value})}
                            className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </>
                      )}
                      <div className="flex space-x-2 sticky bottom-0 bg-inherit pt-4">
                        <button
                          type="submit"
                          className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
                        >
                          Add Guest
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowGuestForm(false)}
                          className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Current Guests */}
                <div className="flex-1 overflow-y-auto pl-4 border-l border-gray-300 dark:border-gray-600">
                  <h3 className="text-lg font-semibold mb-4">Current Guests ({guests.length})</h3>
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {guests.map((guest, index) => (
                      <div key={index} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{guest.username}</h4>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openPaymentForm(selectedRoom, guest)}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700 transition"
                            >
                              Add Payment
                            </button>
                            <button
                              onClick={() => handleRemoveGuest(selectedRoom.room_number, guest.user_id)}
                              className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700 transition"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="text-sm space-y-1">
                          <p><strong>User ID:</strong> {guest.user_id}</p>
                          <p><strong>Email:</strong> {guest.email}</p>
                          <p><strong>Phone:</strong> {guest.phone}</p>
                          <p><strong>Joined:</strong> {guest.date_of_joining}</p>
                          {(() => {
                            const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                            const currentMonthShort = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
                            const currentMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

                            // Get rent payments and security payments separately
                            const rentPayments = guest.rent_history || [];
                            const securityPayments = guest.security_history || [];

                            // Filter rent payments for current month and calculate total
                            const currentMonthRentPayments = rentPayments.filter(p => p.month === currentMonthKey);
                            const totalRentPaidCurrentMonth = currentMonthRentPayments.reduce((sum, payment) => sum + parseInt(payment.amount || 0), 0);

                            // Calculate security total only from security-type payments
                            const totalSecurityAmount = securityPayments
                                .filter(p => p.payment_type === 'security')
                                .reduce((sum, payment) => sum + parseInt(payment.amount || 0), 0);

                            // Get required amounts from the room
                            const requiredRent = parseInt(selectedRoom.rent_amount);
                            const requiredSecurity = parseInt(selectedRoom.security_deposit);
                            
                            // Track separate totals
                            const monthlyRentTotal = rentPayments
                                .filter(p => p.payment_type === 'rent' && p.month === currentMonthKey)
                                .reduce((sum, payment) => sum + parseInt(payment.amount || 0), 0);
                            const securityDepositTotal = securityPayments
                                .filter(p => p.payment_type === 'security')
                                .reduce((sum, payment) => sum + parseInt(payment.amount || 0), 0);

                            // Calculate status and balance for rent
                            const rentStatus = totalRentPaidCurrentMonth >= requiredRent ? 'full' : totalRentPaidCurrentMonth > 0 ? 'partial' : 'pending';
                            const rentBalance = Math.max(0, requiredRent - totalRentPaidCurrentMonth);

                            // Calculate status and balance for security
                            const securityStatus = totalSecurityAmount >= requiredSecurity ? 'full' : totalSecurityAmount > 0 ? 'partial' : 'pending';
                            const securityBalance = Math.max(0, requiredSecurity - totalSecurityAmount);

                            // Get latest payments
                            // Filter and calculate rent payments for current month only
                            const totalRentPaid = rentPayments
                                .filter(p => p.payment_type === 'rent' && p.month === currentMonthKey)
                                .reduce((sum, payment) => sum + parseInt(payment.amount || 0), 0);

                            // Calculate security deposit total from security payments only
                            const totalSecurityPaid = securityPayments
                                .filter(p => p.payment_type === 'security')
                                .reduce((sum, payment) => sum + parseInt(payment.amount || 0), 0);

                            // Get latest payments for both types
                            const latestRentPayment = rentPayments
                                .filter(p => p.payment_type === 'rent' && p.month === currentMonthKey)
                                .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0] || null;

                            const latestSecurityPayment = securityPayments.length > 0
                              ? securityPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0]
                              : null;

                            const getStatusColor = (status) => {
                              switch (status) {
                                case 'full': return 'text-green-600 dark:text-green-400';
                                case 'partial': return 'text-yellow-600 dark:text-yellow-400';
                                default: return 'text-red-600 dark:text-red-400';
                              }
                            };

                            return (
                              <>
                                <div className="border-b dark:border-gray-600 pb-2 mb-2">
                                  <h4 className="font-semibold mb-2">Rent Payments</h4>
                                  
                                  {/* Current Month Information */}
                                  <p><strong>Current Month:</strong> {currentMonth} ({currentMonthShort})</p>
                                  
                                  {/* Rent Status */}
                                  <div className="mt-2">
                                    <p className="flex items-center justify-between">
                                      <strong>Status: </strong>
                                      <span className={`px-2 py-1 rounded-full text-sm ${
                                        rentStatus === 'full' 
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                          : rentStatus === 'partial'
                                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      }`}>
                                        {rentStatus === 'full' ? 'Paid' : rentStatus === 'partial' ? 'Partial' : 'Pending'}
                                      </span>
                                    </p>
                                  </div>

                                  {/* Amount Information */}
                                  <div className="mt-2 space-y-1">
                                    <p>
                                      <strong>Required Amount:</strong> ₹{requiredRent}
                                    </p>
                                    <p>
                                      <strong>Amount Paid:</strong> ₹{totalRentPaidCurrentMonth}
                                    </p>
                                    {rentStatus !== 'full' && (
                                      <p className="text-red-600 dark:text-red-400">
                                        <strong>Balance:</strong> ₹{rentBalance}
                                      </p>
                                    )}
                                  </div>

                                  {/* Rent Payment History */}
                                  {rentPayments.length > 0 && (
                                    <div className="mt-3">
                                      <p className="font-semibold mb-2">Rent Payment History</p>
                                      <div className="max-h-40 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        {rentPayments
                                          .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                                          .map((payment, idx) => (
                                          <div key={idx} className={`p-3 ${
                                            idx !== 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''
                                          }`}>
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="text-sm font-medium">
                                                ₹{payment.amount}
                                              </div>
                                              <div className={`text-xs px-2 py-1 rounded-full ${
                                                payment.payment_method === 'UPI' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                                                payment.payment_method === 'Cash' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                payment.payment_method === 'Bank Transfer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                                'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                                              }`}>
                                                {payment.payment_method || 'N/A'}
                                              </div>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {new Date(payment.payment_date).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </div>
                                            {payment.notes && (
                                              <div className="mt-1 text-xs italic text-gray-600 dark:text-gray-400">
                                                {payment.notes}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2">
                                  <h4 className="font-semibold mb-2">Security Deposit</h4>
                                  <p>
                                    <strong>Status: </strong>
                                    <span className={getStatusColor(securityStatus)}>
                                      {securityStatus === 'full' ? 'Paid' : securityStatus === 'partial' ? 'Partial' : 'Pending'}
                                    </span>
                                  </p>
                                  <p><strong>Required Amount:</strong> ₹{requiredSecurity}</p>
                                  <p><strong>Amount Paid:</strong> ₹{totalSecurityAmount}</p>
                                  {securityStatus !== 'full' && (
                                    <p className="text-red-600 dark:text-red-400">
                                      <strong>Balance:</strong> ₹{securityBalance}
                                    </p>
                                  )}
                                  {securityPayments.length > 0 && (
                                    <div className="mt-3">
                                      <p className="font-semibold mb-2">Security Payment History</p>
                                      <div className="max-h-40 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        {securityPayments
                                          .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                                          .map((payment, idx) => (
                                          <div key={idx} className={`p-3 ${
                                            idx !== 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''
                                          }`}>
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="text-sm font-medium">
                                                ₹{payment.amount}
                                              </div>
                                              <div className={`text-xs px-2 py-1 rounded-full ${
                                                payment.payment_method === 'UPI' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                                                payment.payment_method === 'Cash' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                payment.payment_method === 'Bank Transfer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                                'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                                              }`}>
                                                {payment.payment_method || 'N/A'}
                                              </div>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {new Date(payment.payment_date).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </div>
                                            {payment.notes && (
                                              <div className="mt-1 text-xs italic text-gray-600 dark:text-gray-400">
                                                {payment.notes}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="mt-2 pt-2 border-t dark:border-gray-600">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <strong>Total Payments:</strong> {rentPayments.length + securityPayments.length} 
                                    ({rentPayments.length} rent + {securityPayments.length} security)
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    <strong>Total Amount Paid:</strong> ₹{monthlyRentTotal + securityDepositTotal}
                                    {` (₹${monthlyRentTotal} rent + ₹${securityDepositTotal} security)`}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Form Modal */}
        {showPaymentForm && selectedRoom && selectedGuest && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div 
              className={`rounded-xl shadow-2xl max-w-2xl w-full mx-4 transform transition-all duration-300 scale-100 opacity-100 
              ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}
            >
              {/* Header with improved styling */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Add Payment</h2>
                  <p className="text-blue-100 text-sm">{selectedGuest.username} - Room {selectedRoom.room_number}</p>
                </div>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors duration-200 text-white"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddPayment} className="flex flex-col h-[85vh]">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  {/* Payment Type Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      onClick={() => setPaymentFormData({
                        ...paymentFormData,
                        payment_type: 'rent',
                        amount: '',
                        month: new Date().toISOString().slice(0, 7)
                      })}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 
                        ${paymentFormData.payment_type === 'rent' 
                          ? (isDarkMode ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-blue-100 ring-2 ring-blue-400')
                          : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-lg font-semibold ${paymentFormData.payment_type === 'rent' 
                          ? 'text-white' 
                          : isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Rent Payment
                        </span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                          ${paymentFormData.payment_type === 'rent'
                            ? 'border-white bg-blue-600'
                            : isDarkMode ? 'border-gray-400' : 'border-gray-400'}`}>
                          {paymentFormData.payment_type === 'rent' && 
                            <div className="w-2 h-2 rounded-full bg-white"></div>}
                        </div>
                      </div>
                      <p className={`text-sm ${paymentFormData.payment_type === 'rent' 
                        ? 'text-blue-100' 
                        : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Monthly room rent payment
                      </p>
                    </div>

                    <div 
                      onClick={() => setPaymentFormData({
                        ...paymentFormData,
                        payment_type: 'security',
                        amount: selectedRoom.security_deposit,
                        month: new Date().toISOString().slice(0, 7)
                      })}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105
                        ${paymentFormData.payment_type === 'security' 
                          ? (isDarkMode ? 'bg-green-600 ring-2 ring-green-400' : 'bg-green-100 ring-2 ring-green-400')
                          : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-lg font-semibold ${paymentFormData.payment_type === 'security' 
                          ? 'text-white' 
                          : isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          Security Deposit
                        </span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                          ${paymentFormData.payment_type === 'security'
                            ? 'border-white bg-green-600'
                            : isDarkMode ? 'border-gray-400' : 'border-gray-400'}`}>
                          {paymentFormData.payment_type === 'security' && 
                            <div className="w-2 h-2 rounded-full bg-white"></div>}
                        </div>
                      </div>
                      <p className={`text-sm ${paymentFormData.payment_type === 'security' 
                        ? 'text-green-100' 
                        : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        One-time security deposit
                      </p>
                    </div>
                  </div>

                  {/* Month (only for rent payments) */}
                  {paymentFormData.payment_type === 'rent' ? (
                    <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                      <label className="block text-sm font-medium mb-2">Payment Month</label>
                      <input
                        type="month"
                        value={paymentFormData.month}
                        onChange={(e) => setPaymentFormData({...paymentFormData, month: e.target.value})}
                        className={`w-full p-3 border rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500 outline-none
                          ${isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-650' 
                            : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                        required
                      />
                    </div>
                  ) : (
                    // For security payments, show total paid and remaining with scrollable history
                    <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                      <h4 className="font-medium mb-3">Security Deposit Status</h4>
                      {(() => {
                        const securityPayments = selectedGuest.security_history || [];
                        const totalSecurityPaid = calculateTotalPaidForMonth(selectedGuest, null, 'security');
                        const securityRequired = selectedRoom.security_deposit;
                        const remaining = Math.max(0, securityRequired - totalSecurityPaid);
                        
                        return (
                          <>
                            <div className="flex justify-between mb-3">
                              <div>
                                <p className="text-sm font-medium">Total Required</p>
                                <p className="text-lg font-semibold">₹{securityRequired}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">Already Paid</p>
                                <p className="text-lg font-semibold">₹{totalSecurityPaid}</p>
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">Payment Progress</span>
                                <span>{Math.min(Math.round((totalSecurityPaid / securityRequired) * 100), 100)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    totalSecurityPaid >= securityRequired ? 'bg-green-600' : 'bg-green-600'
                                  }`}
                                  style={{ width: `${Math.min((totalSecurityPaid / securityRequired) * 100, 100)}%` }}
                                />
                              </div>
                            </div>

                            {remaining > 0 && (
                              <div className={`p-3 rounded-lg mb-3 ${
                                isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'
                              }`}>
                                <div className="flex items-center">
                                  <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.732-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                  </svg>
                                  <span className="font-medium">Remaining Balance: ₹{remaining}</span>
                                </div>
                              </div>
                            )}

                            {/* Scrollable Payment History */}
                            {securityPayments.length > 0 && (
                              <div className="mt-3">
                                <p className="font-medium mb-2">Payment History</p>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar rounded-lg bg-white/5">
                                  {securityPayments
                                    .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                                    .map((payment, idx) => (
                                      <div key={idx} 
                                        className={`p-3 ${idx !== 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''} 
                                          ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-medium">₹{payment.amount}</span>
                                          <span className={`text-xs px-2 py-1 rounded-full ${
                                            payment.payment_method === 'UPI' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                                            payment.payment_method === 'Cash' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                            payment.payment_method === 'Bank Transfer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                            'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                                          }`}>
                                            {payment.payment_method || 'N/A'}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {new Date(payment.payment_date).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                        {payment.notes && (
                                          <div className="mt-1 text-xs italic text-gray-600 dark:text-gray-400">
                                            {payment.notes}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Amount Input with Modern Styling */}
                  <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                    <label className="block text-sm font-medium mb-2">Payment Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder={paymentFormData.payment_type === 'security' 
                          ? `Security Deposit: ₹${selectedRoom.security_deposit}`
                          : `Rent Amount: ₹${selectedRoom.rent_amount}`}
                        value={paymentFormData.amount}
                        onChange={(e) => {
                          const newAmount = parseInt(e.target.value) || '';
                          setPaymentFormData({...paymentFormData, amount: newAmount});
                        }}
                        className={`w-full p-3 pl-10 border rounded-lg transition-all duration-200 
                          ${isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white focus:bg-gray-650' 
                            : 'bg-white border-gray-300 focus:bg-gray-50'}
                          focus:ring-2 ${paymentFormData.payment_type === 'rent' 
                            ? 'focus:ring-blue-500' 
                            : 'focus:ring-green-500'}
                          outline-none text-lg font-medium`}
                        required
                        min="1"
                      />
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-medium">₹</span>
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = paymentFormData.payment_type === 'rent'
                            ? selectedRoom.rent_amount - calculateTotalPaidForMonth(selectedGuest, paymentFormData.month, 'rent')
                            : selectedRoom.security_deposit - calculateTotalPaidForMonth(selectedGuest, null, 'security');
                          setPaymentFormData({...paymentFormData, amount: Math.max(0, remaining)});
                        }}
                        className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1.5 rounded-lg 
                          text-sm font-medium transition-all duration-200 hover:scale-105
                          ${paymentFormData.payment_type === 'rent'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'}
                          ${isDarkMode && 'opacity-90 hover:opacity-100'}`}
                      >
                        Set Remaining
                      </button>
                    </div>
                  </div>

                  {/* Payment Method with Modern UI */}
                  <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                    <label className="block text-sm font-medium mb-2">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['UPI', 'Cash', 'Bank Transfer', 'Cheque'].map((method) => (
                        <div
                          key={method}
                          onClick={() => setPaymentFormData({...paymentFormData, payment_method: method})}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-between
                            ${paymentFormData.payment_method === method
                              ? (isDarkMode 
                                ? `${paymentFormData.payment_type === 'rent' ? 'bg-blue-600' : 'bg-green-600'} ring-2 ring-white/30` 
                                : `${paymentFormData.payment_type === 'rent' ? 'bg-blue-100' : 'bg-green-100'} ring-2 ring-current`)
                              : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')}`}
                        >
                          <span className={`font-medium ${paymentFormData.payment_method === method 
                            ? (isDarkMode ? 'text-white' : `${paymentFormData.payment_type === 'rent' ? 'text-blue-700' : 'text-green-700'}`)
                            : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                            {method}
                          </span>
                          {paymentFormData.payment_method === method && (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes with Modern Styling */}
                  <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                    <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                    <textarea
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData({...paymentFormData, notes: e.target.value})}
                      placeholder="Add any additional notes about the payment..."
                      className={`w-full p-3 border rounded-lg transition-all duration-200 
                        ${isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white focus:bg-gray-650' 
                          : 'bg-white border-gray-300 focus:bg-gray-50'}
                        focus:ring-2 ${paymentFormData.payment_type === 'rent' 
                          ? 'focus:ring-blue-500' 
                          : 'focus:ring-green-500'}
                        outline-none resize-none`}
                      rows="3"
                    />
                  </div>
                </div>

                {/* Compact Payment Info Box */}
                <div className={`mt-4 p-4 rounded-lg ${
                  paymentFormData.payment_type === 'rent'
                    ? 'bg-blue-50 dark:bg-blue-900'
                    : 'bg-green-50 dark:bg-green-900'
                }`}>
                  {(() => {
                    const paymentType = paymentFormData.payment_type;
                    const requiredAmount = paymentType === 'rent' ? 
                      parseInt(selectedRoom.rent_amount) : 
                      parseInt(selectedRoom.security_deposit);
                    
                    const totalPaid = calculateTotalPaidForMonth(
                      selectedGuest, 
                      paymentFormData.month, 
                      paymentType
                    );

                    const currentAmount = parseInt(paymentFormData.amount) || 0;
                    const newTotal = totalPaid + currentAmount;
                    const remaining = Math.max(0, requiredAmount - totalPaid);
                    const isOverpaying = newTotal > requiredAmount;

                    return (
                      <div className="space-y-3">
                        {/* Header with Required Amount */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d={paymentType === 'rent' 
                                  ? "M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"
                                  : "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622"
                                }
                              />
                            </svg>
                            <span className="text-sm font-medium">
                              {paymentType === 'rent' ? 'Monthly Rent' : 'Security Deposit Required'}
                            </span>
                          </div>
                          <span className="text-lg font-semibold">₹{requiredAmount}</span>
                        </div>

                        {/* Payment Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">Progress</span>
                            <span className="font-medium">{Math.min(Math.round((newTotal / requiredAmount) * 100), 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                newTotal >= requiredAmount ? 'bg-green-600' : 'bg-yellow-600'
                              }`}
                              style={{ width: `${Math.min((newTotal / requiredAmount) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Payment Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-white/50 dark:bg-black/20 p-2 rounded">
                            <span className="text-gray-600 dark:text-gray-400">Already Paid</span>
                            <p className="font-semibold">₹{totalPaid}</p>
                          </div>
                          <div className="bg-white/50 dark:bg-black/20 p-2 rounded">
                            <span className="text-gray-600 dark:text-gray-400">Remaining</span>
                            <p className="font-semibold">₹{remaining}</p>
                          </div>
                          {currentAmount > 0 && (
                            <>
                              <div className="bg-white/50 dark:bg-black/20 p-2 rounded">
                                <span className="text-gray-600 dark:text-gray-400">New Payment</span>
                                <p className="font-semibold">₹{currentAmount}</p>
                              </div>
                              <div className="bg-white/50 dark:bg-black/20 p-2 rounded">
                                <span className="text-gray-600 dark:text-gray-400">Total After</span>
                                <p className="font-semibold">₹{newTotal}</p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Warning for Overpayment */}
                        {isOverpaying && (
                          <div className="flex items-center space-x-2 text-sm bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 p-2 rounded">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.732-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <span>Exceeds required amount by ₹{newTotal - requiredAmount}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Action Buttons with Modern Styling */}
                <div className="sticky bottom-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 backdrop-blur-sm shadow-lg">
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowPaymentForm(false)}
                      className="flex-1 px-6 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600
                        hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200
                        text-gray-700 dark:text-gray-300 font-medium transform hover:scale-105"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200 
                        transform hover:scale-105 text-white flex items-center justify-center space-x-2
                        ${paymentFormData.payment_type === 'rent'
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                          : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                        }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d={paymentFormData.payment_type === 'rent' 
                            ? "M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"  // Currency circle for rent
                            : "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"  // Shield check for security
                          } 
                        />
                      </svg>
                      <span>
                        Add {paymentFormData.payment_type === 'rent' ? 'Rent Payment' : 'Security Deposit'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

{/* Overpayment Confirmation Modal */}
{showOverpaymentConfirmModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className={`p-6 rounded-lg shadow-lg max-w-md w-full mx-4 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Overpayment Confirmation</h2>
        <button
          onClick={() => setShowOverpaymentConfirmModal(false)}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          You are about to pay more than the required amount. This will be recorded as an overpayment.
        </p>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-4">
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Total Required</p>
              <p className="text-lg font-semibold">₹{overpaymentDetails?.requiredAmount}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Already Paid</p>
              <p className="text-lg font-semibold">₹{overpaymentDetails?.totalPaid}</p>
            </div>
          </div>
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-sm font-medium">New Payment</p>
              <p className="text-lg font-semibold">₹{pendingPaymentAmount}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Total After Payment</p>
              <p className="text-lg font-semibold">₹{overpaymentDetails?.totalAfter}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              Overpayment Amount: ₹{overpaymentDetails?.totalAfter - overpaymentDetails?.requiredAmount}
            </p>
          </div>
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => setShowOverpaymentConfirmModal(false)}
          className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            if (pendingPaymentAmount === null) {
              setShowOverpaymentConfirmModal(false);
              return;
            }
            const paymentType = paymentFormData.payment_type;
            const month = paymentType === 'rent' ?
              paymentFormData.month :
              new Date().toISOString().slice(0, 7);
            const totalPaid = overpaymentDetails.totalPaid;
            const paymentData = {
              payment_type: paymentType,
              month: month,
              amount: pendingPaymentAmount,
              payment_method: paymentFormData.payment_method,
              notes: paymentType === 'security' ?
                `Security deposit payment: ₹${pendingPaymentAmount} (Total paid: ₹${totalPaid + pendingPaymentAmount})` :
                paymentFormData.notes
            };
            try {
              await roomService.addPayment(
                selectedRoom.room_number,
                selectedGuest.user_id,
                paymentData
              );
              showNotification('Payment added successfully', 'success');
              setShowPaymentForm(false);
              resetPaymentForm();
              fetchRooms();
            } catch (err) {
              showNotification('Failed to add payment', 'error');
            }
            setPaymentFormData({
              payment_type: 'rent',
              month: '',
              amount: '',
              payment_method: 'UPI',
              notes: ''
            });
            setPendingPaymentAmount(null);
            setShowOverpaymentConfirmModal(false);
          }}
          className="flex-1 bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700 transition"
        >
          Confirm Overpayment
        </button>
      </div>
    </div>
  </div>
)}
{/* Notification Modal */}
{showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg shadow-xl p-6 w-full max-w-md mx-4 border-l-4 ${
            notificationType === 'success' ? 'border-green-500' : 'border-red-500'
          } ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex items-center mb-4">
              <div className={`flex-shrink-0 ${
                notificationType === 'success' ? 'text-green-500' : 'text-red-500'
              }`}>
                {notificationType === 'success' ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2} fill="none" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h2 className={`ml-3 text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>{notificationType === 'success' ? 'Success!' : 'Error!'}</h2>
            </div>
            <p className={`mb-4 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>{notificationMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNotificationModal(false)}
                className={`px-4 py-2 rounded-lg transition duration-200 font-medium ${
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg shadow-xl p-6 w-full max-w-md mx-4 ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
          }`}>
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 text-red-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className={`ml-3 text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Confirm Delete</h2>
            </div>
            <p className={`mb-4 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Are you sure you want to delete Room {selectedRoomToDelete}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 rounded-lg transition duration-200 font-medium bg-gray-600 text-white hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRoom}
                className="px-4 py-2 rounded-lg transition duration-200 font-medium bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Guest Confirmation Modal */}
      {showDeleteGuestConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg shadow-xl p-6 w-full max-w-md mx-4 ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
          }`}>
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 text-red-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className={`ml-3 text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Confirm Remove Guest</h2>
            </div>
            <p className={`mb-4 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Are you sure you want to remove this guest from Room {selectedGuestToDelete?.roomNumber}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteGuestConfirmation(false)}
                className="px-4 py-2 rounded-lg transition duration-200 font-medium bg-gray-600 text-white hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteGuest}
                className="px-4 py-2 rounded-lg transition duration-200 font-medium bg-red-600 text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;
