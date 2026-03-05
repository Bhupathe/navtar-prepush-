import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';

import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import BookingPage from './pages/Booking/BookingPage'; 
import VideoConsultation from './pages/VideoConsultation';
import ProtectedRoute from './components/common/ProtectedRoute';

import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminRoute from './components/common/SuperAdminRoute';
import useRoleAssignment from './hooks/useRoleAssignment';

function App() {
  useRoleAssignment();

  return (
    <AuthProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/booking"
            element={
              <ProtectedRoute>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consultation"
            element={
              <ProtectedRoute>
                <VideoConsultation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <SuperAdminRoute>
                <AdminDashboard />
              </SuperAdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
