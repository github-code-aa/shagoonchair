// Authentication configuration
export const AUTH_CONFIG = {
    CORRECT_PIN: '841425',
    SESSION_KEY: 'authenticated',
    REDIRECT_PATHS: {
        LOGIN: '/login',
        BILLS: '/bills',
        BILLS_NEW: '/bills/new',
        INVOICE: '/invoice',
        HOME: '/'
    },
    // Use localStorage instead of sessionStorage for persistent authentication
    STORAGE_TYPE: 'localStorage'
};
