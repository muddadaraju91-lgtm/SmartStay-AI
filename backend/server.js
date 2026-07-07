const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorMiddleware = require('./middleware/errorMiddleware');
const { startExpiryScheduler } = require('./services/bookingExpiryService');

// Load configurations
dotenv.config();

// ─── Startup Environment Validation ──────────────────────────────────────────
// Fail fast before registering any routes so misconfiguration is immediately
// visible in deployment logs rather than silently creating insecure tokens.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('\n╔══════════════════════════════════════════════════════════╗');
    console.error('║  FATAL: JWT_SECRET environment variable is not set.      ║');
    console.error('║                                                          ║');
    console.error('║  Generate a safe secret and add it to your .env file:   ║');
    console.error('║    openssl rand -hex 32                                  ║');
    console.error('╚══════════════════════════════════════════════════════════╝\n');
    process.exit(1);
}
if (JWT_SECRET.length < 32) {
    console.error('\n╔══════════════════════════════════════════════════════════╗');
    console.error('║  FATAL: JWT_SECRET is too short (minimum 32 characters). ║');
    console.error('║                                                          ║');
    console.error('║  Generate a safe secret and add it to your .env file:   ║');
    console.error('║    openssl rand -hex 32                                  ║');
    console.error('╚══════════════════════════════════════════════════════════╝\n');
    process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Headers (helmet) ────────────────────────────────────────────────
// Must be first — sets X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.
app.use(helmet());

// ─── Rate Limiters ───────────────────────────────────────────────────────────
// All limits are configurable via environment variables so they can be tightened
// in production without a code change (see .env.example for the var names).

// Auth limiter — strict, protects credential endpoints from brute-force.
// Default: 10 requests per 15 minutes per IP.
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_WINDOW_MS  || '900000'),  // 15 min
    max:      parseInt(process.env.AUTH_RATE_MAX        || '10'),
    standardHeaders: true,   // sets RateLimit-* headers (RFC 6585)
    legacyHeaders:   false,  // disable deprecated X-RateLimit-* headers
    message: {
        success: false,
        message: 'Too many attempts from this IP. Please try again after 15 minutes.'
    }
});

// General API limiter — generous, guards against abusive crawlers / scripts.
// Default: 300 requests per 15 minutes per IP.
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.API_RATE_WINDOW_MS   || '900000'),  // 15 min
    max:      parseInt(process.env.API_RATE_MAX         || '300'),
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
        success: false,
        message: 'Too many requests from this IP. Please slow down.'
    }
});

// Apply auth limiter first (more specific paths before the catch-all).
// These two routes are applied before express.json() so the limiter fires
// even on malformed payloads.
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// General limiter covers every remaining /api/* route.
app.use('/api', apiLimiter);
// ─────────────────────────────────────────────────────────────────────────────

// Enable security configurations
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
    // In development: allow any localhost / 127.0.0.1 origin regardless of port,
    // so Vite's auto-incrementing port (5173, 5174, …) never causes a CORS block.
    // In production: restrict to CLIENT_URL only — no localhost origins are accepted.
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin) return callback(null, true);

        if (isDev) {
            // Accept any localhost or 127.0.0.1 origin in dev
            const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            return callback(null, isLocal);
        }

        // Production: exact match against CLIENT_URL
        const allowed = process.env.CLIENT_URL;
        return callback(null, origin === allowed);
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root health-check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// Import and bind route handlers
const authRoutes = require('./routes/authRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const collegeRoutes = require('./routes/collegeRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/colleges', collegeRoutes);

// Centralized Catch-All Error Handler Middleware
app.use(errorMiddleware);

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`SmartStay AI server is active on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
        // Start the background job that auto-cancels abandoned pending bookings
        // and restores their held vacancy slots.
        startExpiryScheduler();
    });
}

module.exports = app;

