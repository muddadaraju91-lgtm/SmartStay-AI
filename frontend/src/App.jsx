import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Register from './pages/Register';
import SearchHostels from './pages/SearchHostels';
import HostelDetails from './pages/HostelDetails';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import AddHostel from './pages/AddHostel';

// Secure Private Route Guard
const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return null;
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Secure Role Route Guard
const RoleRoute = ({ children, allowedRoles }) => {
    const { user, isAuthenticated, loading } = useAuth();
    if (loading) return null;
    
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!allowedRoles.includes(user?.role)) {
        return <Navigate to="/" replace />;
    }
    
    return children;
};

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <AppLayout>
                    <Routes>
                        {/* Public Views */}
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        {/* Student / Common Secure Views */}
                        <Route path="/search" element={
                            <PrivateRoute>
                                <SearchHostels />
                            </PrivateRoute>
                        } />
                        
                        <Route path="/hostels/:id" element={
                            <PrivateRoute>
                                <HostelDetails />
                            </PrivateRoute>
                        } />

                        <Route path="/my-bookings" element={
                            <PrivateRoute>
                                <MyBookings />
                            </PrivateRoute>
                        } />

                        <Route path="/profile" element={
                            <PrivateRoute>
                                <Profile />
                            </PrivateRoute>
                        } />

                        {/* Owner / Admin Dashboard Views */}
                        <Route path="/dashboard" element={
                            <RoleRoute allowedRoles={['owner', 'admin']}>
                                <Dashboard />
                            </RoleRoute>
                        } />

                        <Route path="/add-hostel" element={
                            <RoleRoute allowedRoles={['owner']}>
                                <AddHostel />
                            </RoleRoute>
                        } />

                        {/* Catch-all redirect */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AppLayout>
            </Router>
        </AuthProvider>
    );
}
