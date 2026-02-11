import React from 'react';
import { useLoading } from '../contexts/LoadingContext';

const GlobalLoadingSpinner = () => {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="text-gray-700">Loading...</span>
      </div>
    </div>
  );
};

export default GlobalLoadingSpinner;
