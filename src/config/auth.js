// Authentication configuration
export const AUTH_CONFIG = {
    REDIRECT_PATHS: {
        LOGIN: '/login',
        BILLS: '/bills',
        BILLS_NEW: '/bills/new',
        INVOICE: '/invoice',
        HOME: '/'
    },
    API_PATHS: {
        LOGIN: '/api/auth/login',
        LOGOUT: '/api/auth/logout',
        SESSION: '/api/auth/session'
    }
};
