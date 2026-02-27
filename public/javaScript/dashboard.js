
window.addEventListener('DOMContentLoaded', () => {
    if(window.location.pathname === '/dashboard'){
        const encoded = sessionStorage.getItem('session');
        
        if (!encoded) {
            // No session found
            return window.location.pathname = '/loginOrRegister';
        }

        try {
            const session = JSON.parse(atob(encoded));

            if (session.loggedIn === true) {
                return; // Allow access
            } else {
                // LoggedIn flag is false or missing
                sessionStorage.removeItem('session');
                return window.location.pathname = '/loginOrRegister';
            }
        } catch (error) {
            console.error("Invalid session data");
            sessionStorage.removeItem('session');
            return window.location.pathname = '/loginOrRegister';
        }
    }
});