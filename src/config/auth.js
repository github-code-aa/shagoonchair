// Authentication configuration
export const AUTH_CONFIG = {
    CORRECT_PIN: '841425',
    SESSION_KEY: 'authenticated',
    REDIRECT_PATHS: {
        LOGIN: '/login',
        BILL: '/bill',
        HOME: '/'
    },
    // Use localStorage instead of sessionStorage for persistent authentication
    STORAGE_TYPE: 'localStorage'
};
