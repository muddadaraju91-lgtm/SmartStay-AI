const ApiResponse = require('../utils/apiResponse');

const errorMiddleware = (err, req, res, next) => {
    console.error('API Error Execution:', err);

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle database connection errors explicitly
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        statusCode = 503;
        message = 'Database service is unavailable. Please ensure your MySQL server is running.';
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        statusCode = 500;
        message = 'Database authentication failed. Please check your DB_USER and DB_PASSWORD credentials in the backend .env file.';
    } else if (err.code === 'ER_BAD_DB_ERROR') {
        statusCode = 500;
        message = 'Database "smartstay_db" does not exist. Please run the SQL schema creation scripts.';
    }

    const errors = process.env.NODE_ENV === 'development' ? err.stack : null;

    return ApiResponse.error(res, message, statusCode, errors);
};

module.exports = errorMiddleware;
