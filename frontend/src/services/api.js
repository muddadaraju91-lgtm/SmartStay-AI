const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_BASE_URL = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;

// Set auth header helper
export const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Generic Fetch Request Helper
export const apiRequest = async (endpoint, options = {}) => {
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...options.headers
        };

        const config = {
            method: 'GET',
            ...options,
            headers
        };

        // If body is passed, stringify it unless it is FormData
        if (config.body) {
            if (config.body instanceof FormData) {
                delete config.headers['Content-Type'];
            } else {
                config.body = JSON.stringify(config.body);
            }
        }

        // Axios emulation using native fetch to keep bundle light and clean
        const response = await fetch(url, config);
        const json = await response.json();

        if (!response.ok) {
            // Handle JWT token expiration globally
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Optional: window.location.href = '/login';
            }
            throw new Error(json.message || 'Something went wrong');
        }

        return json;
    } catch (err) {
        console.error(`API Error on ${endpoint}:`, err.message);
        throw err;
    }
};

// Specific API Services
export const authService = {
    login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
    register: (details) => apiRequest('/auth/register', { method: 'POST', body: details }),
    getProfile: () => apiRequest('/auth/profile')
};

export const hostelService = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/hostels?${query}`);
    },
    getById: (id) => apiRequest(`/hostels/${id}`),
    create: (data) => apiRequest('/hostels', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/hostels/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/hostels/${id}`, { method: 'DELETE' }),
    verify: (id, isVerified) => apiRequest(`/hostels/${id}/verify`, { method: 'PUT', body: { isVerified } }),
    getRecommendations: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/hostels/recommendations?${query}`);
    }
};

export const roomService = {
    getByHostel: (hostelId) => apiRequest(`/rooms?hostelId=${hostelId}`),
    create: (data) => apiRequest('/rooms', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/rooms/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/rooms/${id}`, { method: 'DELETE' })
};

export const bookingService = {
    create: (data) => apiRequest('/bookings', { method: 'POST', body: data }),
    getAll: () => apiRequest('/bookings'),
    updateStatus: (id, status) => apiRequest(`/bookings/${id}/status`, { method: 'PUT', body: { status } })
};

export const paymentService = {
    createOrder: (bookingId) => apiRequest('/payments/order', { method: 'POST', body: { bookingId } }),
    verifyPayment: (data) => apiRequest('/payments/verify', { method: 'POST', body: data })
};

export const reviewService = {
    create: (data) => apiRequest('/reviews', { method: 'POST', body: data }),
    getByHostel: (hostelId) => apiRequest(`/reviews?hostelId=${hostelId}`),
    delete: (id) => apiRequest(`/reviews/${id}`, { method: 'DELETE' })
};

export const analyticsService = {
    getDashboard: () => apiRequest('/analytics/dashboard')
};
