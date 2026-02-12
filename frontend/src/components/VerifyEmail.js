import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import authService from '../api/authService';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setStatus('error');
      setMessage('No verification token provided.');
      setLoading(false);
    }
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await authService.verifyEmail(token);
      setStatus('success');
      setMessage('Email verified successfully! Redirecting to login page...');

      // Clear any existing tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('rememberedUsername');
      localStorage.removeItem('rememberedPassword');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', {
          state: {
            message: 'Email verified successfully! You can now log in.',
            showResendForm: false
          }
        });
      }, 3000);
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');

      if (error.response?.status === 400) {
        if (error.response?.data?.detail?.includes('expired')) {
          setMessage('Verification link has expired. Please request a new verification email.');
        } else {
          setMessage(error.response?.data?.detail || 'Invalid verification link. Please request a new one.');
        }
      } else {
        setMessage('Failed to verify email. Please try again or request a new verification link.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    // This would need the user's email, so we'll redirect to login with a message
    navigate('/login', {
      state: {
        message: 'Please enter your email to resend verification link.',
        showResendForm: true
      }
    });
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className={`max-w-md w-full space-y-8 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      } p-8 rounded-xl shadow-2xl`}>
        <div className="text-center">
          <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
            status === 'success'
              ? 'bg-green-100'
              : status === 'error'
              ? 'bg-red-100'
              : 'bg-blue-100'
          }`}>
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            ) : status === 'success' ? (
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          <h2 className={`mt-6 text-3xl font-extrabold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {loading ? 'Verifying Email' : status === 'success' ? 'Email Verified!' : 'Verification Failed'}
          </h2>

          <p className={`mt-2 text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {loading ? 'Please wait while we verify your email...' : message}
          </p>
        </div>

        {!loading && (
          <div className="mt-8 space-y-4">
            {status === 'success' ? (
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Go to Login
              </button>
            ) : (
              <>
                <button
                  onClick={handleResendVerification}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Resend Verification Email
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Back to Login
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
