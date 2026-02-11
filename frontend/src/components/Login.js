import React, { useState, useEffect, useRef } from 'react';
import authService from '../api/authService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLoading } from '../contexts/LoadingContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const [usernameValid, setUsernameValid] = useState(null);
  const [passwordValid, setPasswordValid] = useState(null);
  const [activeSide, setActiveSide] = useState('initial'); // 'initial', 'left', or 'right'
  const [inputFocused, setInputFocused] = useState(false); // Track if username or password input is focused
  const [notification, setNotification] = useState(''); // Success notification
  const [showResendForm, setShowResendForm] = useState(false); // Show resend verification form
  const [resendEmail, setResendEmail] = useState(''); // Email for resend verification
  const [resendLoading, setResendLoading] = useState(false); // Loading state for resend
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isLoading, startLoading, stopLoading } = useLoading();
  const canvasRef = useRef(null);

  useEffect(() => {
    // Check for remembered credentials
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    const rememberedPassword = localStorage.getItem('rememberedPassword');

    if (rememberedUsername && rememberedPassword) {
      setUsername(rememberedUsername);
      setPassword(rememberedPassword);
      setRememberMe(true);
    }

    // Check for existing tokens and try to refresh
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken && !localStorage.getItem('access_token')) {
      handleTokenRefresh(refreshToken);
    }

    // Check for state from navigation (e.g., from VerifyEmail component)
    if (location.state?.message) {
      setNotification(location.state.message);
      setShowResendForm(location.state.showResendForm || false);
    }

    // Initialize animated background
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const particles = [];
      const particleCount = 100;

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 5 + 2,
          opacity: Math.random() * 0.7 + 0.2
        });
      }

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
          particle.x += particle.vx;
          particle.y += particle.vy;

          if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = isDarkMode ? `rgba(255, 255, 255, ${particle.opacity})` : `rgba(59, 130, 246, ${particle.opacity})`;
          ctx.fill();
        });

        requestAnimationFrame(animate);
      };

      animate();
    }
  }, [isDarkMode, location.state]);

  const handleTokenRefresh = async (refreshToken) => {
    try {
      const response = await authService.refreshToken(refreshToken);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      navigate('/dashboard');
    } catch (err) {
      // Token refresh failed, clear tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    startLoading();

    try {
      const response = await authService.login(username, password);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username);
        localStorage.setItem('rememberedPassword', password);
      } else {
        localStorage.removeItem('rememberedUsername');
        localStorage.removeItem('rememberedPassword');
      }

      setNotification(`Login successful! Welcome back ${username} 😊`);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500); // Delay navigation to show notification
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      stopLoading();
    }
  };

  const toggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSideClick = (side) => {
    if (activeSide === side) {
      setActiveSide('initial');
    } else {
      setActiveSide(side);
    }
  };

  const handleResendVerification = async (e) => {
    e.preventDefault();
    setResendLoading(true);

    try {
      const response = await authService.resendVerification(resendEmail);
      setNotification('Verification email sent successfully! Please check your email.');
      setShowResendForm(false);
      setResendEmail('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend verification email');
      setShowResendForm(false);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className={`min-h-screen relative transition-colors duration-300 fade-in ${
      isDarkMode
        ? 'bg-gray-900 bg-opacity-70'
        : 'bg-blue-100 bg-opacity-70'
    }`}>
      {/* Animated Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      {/* Header with Home and Theme Toggle */}
      <div className="absolute top-4 right-4 flex items-center space-x-4 z-20">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full shadow-lg transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-700 bg-opacity-90 text-yellow-400 hover:bg-gray-600'
              : 'bg-white bg-opacity-90 text-gray-800 hover:bg-gray-50'
          }`}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        <button
          onClick={() => navigate('/')}
          className={`p-3 rounded-full shadow-lg transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-700 bg-opacity-90 text-white hover:bg-gray-600'
              : 'bg-white bg-opacity-90 text-gray-800 hover:bg-gray-50'
          }`}
          title="Go to Homepage"
        >
          🏠
        </button>
      </div>

      {/* Left Side - PG Information */}
      <div
        onClick={() => {
          if (!inputFocused) {
            handleSideClick('left');
          }
        }}
        className={`absolute left-0 top-0 w-1/2 h-full flex flex-col items-center justify-center p-12 cursor-pointer transition-transform duration-700 ease-in-out ${
          activeSide === 'left' || activeSide === 'right' ? 'transform translate-x-full' : 'transform translate-x-0'
        } ${isDarkMode ? 'bg-gray-800 bg-opacity-70' : 'bg-white bg-opacity-70'}`}
        style={{ zIndex: activeSide === 'left' ? 10 : 5 }}
      >
        {/* Subtle solid light border for separation */}
        <div className={`absolute right-0 top-0 bottom-0 w-px ${
          isDarkMode
            ? 'bg-gray-400'
            : 'bg-gray-300'
        }`}></div>
        {/* Clear layout container */}
        <div className={`w-full max-w-lg min-h-[500px] p-8 rounded-2xl shadow-xl ${
          isDarkMode
            ? 'bg-gray-800 bg-opacity-70 border border-white border-opacity-50'
            : 'bg-white bg-opacity-70 border border-black border-opacity-50'
        }`}>
          <div className="max-w-md mx-auto text-center">
            <div className="mb-8">
              <h1 className={`text-4xl font-bold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Welcome to K-Royals PG
              </h1>
              <p className={`text-lg ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Your comfortable home away from home
              </p>
            </div>

          <div className={`p-6 rounded-lg shadow-lg ${
            isDarkMode ? 'bg-gray-700 bg-opacity-70' : 'bg-gray-50 bg-opacity-70'
          }`}>
            <h3 className={`text-xl font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              PG Owner Information
            </h3>
            <div className={`space-y-3 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">Owner: Rajesh Kumar</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>owner@pgmanagement.com</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>123 Main Street, City</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <p className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              "Experience comfort and convenience with our modern facilities and 24/7 support."
            </p>
          </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div
        onClick={() => {
          if (!inputFocused) {
            handleSideClick('right');
          }
        }}
        className={`absolute right-0 top-0 w-1/2 h-full flex items-center justify-center p-12 cursor-pointer transition-transform duration-700 ease-in-out ${
          activeSide === 'left' || activeSide === 'right' ? 'transform -translate-x-full' : 'transform translate-x-0'
        } ${isDarkMode ? 'bg-gray-900 bg-opacity-70' : 'bg-gray-50 bg-opacity-70'}`}
        style={{ zIndex: activeSide === 'right' ? 10 : 5 }}
      >
        {/* Clear layout container */}
        <div className={`w-full max-w-lg min-h-[500px] p-8 rounded-2xl shadow-xl ${
          isDarkMode
            ? 'bg-gray-800 bg-opacity-70 border border-white border-opacity-50'
            : 'bg-white bg-opacity-70 border border-black border-opacity-50'
        }`}>
          <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className={`text-3xl font-extrabold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Sign in to your account
            </h2>
            <p className={`mt-2 text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Or{' '}
              <button
                onClick={() => navigate('/signup')}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                create a new account
              </button>
            </p>
          </div>

          {/* Success Notification */}
          {notification && (
            <div className={`mb-6 px-4 py-3 rounded-xl border ${
              isDarkMode
                ? 'bg-green-900/50 border-green-700 text-green-200'
                : 'bg-green-50 border-green-200 text-green-700'
            } slide-in-down`}>
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {notification}
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Error or Resend Form */}
            {showResendForm ? (
              <div className={`border px-4 py-3 rounded slide-in-up ${
                isDarkMode
                  ? 'bg-blue-900 border-blue-700 text-blue-200'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-medium">Resend Verification Email</h3>
                  <button
                    onClick={() => {
                      setShowResendForm(false);
                      setError('Email not verified. Please check your email for the verification link.');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleResendVerification} className="space-y-3">
                  <div>
                    <label htmlFor="resend-email" className="block text-sm font-medium">
                      Email Address
                    </label>
                    <input
                      id="resend-email"
                      type="email"
                      required
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="Enter your email"
                      className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                  >
                    {resendLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </div>
                    ) : (
                      'Send Verification Email'
                    )}
                  </button>
                </form>
              </div>
            ) : error ? (
              <div className={`border px-4 py-3 rounded slide-in-up ${
                isDarkMode
                  ? 'bg-red-900 border-red-700 text-red-200'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {error}
                    {error.includes('Email not verified') && (
                      <div className="mt-2">
                        <button
                          onClick={() => setShowResendForm(true)}
                          className="text-sm underline hover:no-underline focus:outline-none"
                        >
                          Click here to resend verification email
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setError('')}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className={`block text-sm font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Username
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Enter username"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className={`block text-sm font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Password
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Enter password"
                    className={`block w-full pl-10 pr-10 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleShowPassword();
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M2 2l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className={`ml-2 block text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-900'
                  }`} onClick={(e) => e.stopPropagation()}>
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
            </div>



            <div>
              <button
                type="submit"
                onClick={(e) => e.stopPropagation()}
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
