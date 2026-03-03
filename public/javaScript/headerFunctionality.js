"use strict";
// This file contains the JavaScript code for the 
// frontend functionality of the header section of the website.

//This section of the file is for the hamburger menu functionality
const hamburgerBar = document.getElementById("hamburgerBar");
const navigationMenu = document.getElementById("navMenu");

// Function to toggle the hamburger menu
hamburgerBar.addEventListener("click", showHamburgerMenu);
// Add event listener to the document to remove show class when clicking outside the menu
document.addEventListener("click", (event) => {
    if (navigationMenu.classList.contains("show") &&
        !hamburgerBar.contains(event.target) &&
        !navigationMenu.contains(event.target)
    ) {
        navigationMenu.classList.remove("show");
        hamburgerBar.classList.remove("close");
    }
});
// Function to show the hamburger menu
function showHamburgerMenu() {
    hamburgerBar.classList.toggle('close');
    navigationMenu.classList.toggle('show');

}

//Section for header page navigation functionality
const headerPageLinks = document.querySelectorAll(".headerNavLinks");

// Block ALL nav links when not logged in — redirect to login page
headerPageLinks.forEach(item => {
    item.addEventListener("click", event => {
        if (item.classList.contains("disabled")) {
            event.preventDefault();
            window.location.href = '/loginOrRegister';
        }
    });
});

/**
 * Updates header navigation links based on login state.
 * When not logged in: Home, About Us, Dashboard, and Profile are all disabled.
 * When logged in: all links are enabled.
 */
function updateHeaderLinks(isLogin) {
    const allLinks = ['homeLink', 'aboutUsLink', 'dashboardLink', 'profileLink'];
    allLinks.forEach(id => {
        const link = document.getElementById(id);
        if (link) {
            if (!isLogin) {
                link.classList.add('disabled');
            } else {
                link.classList.remove('disabled');
            }
        }
    });
}

//Section to handle logo click functionality
const logo = document.getElementById("logo");
// Function to redirect to the home page when the logo is clicked
logo.addEventListener("click", () => {
    window.location.href = "/";
});


window.addEventListener('DOMContentLoaded', () => {
    const encoded = sessionStorage.getItem('session');
    let isLogin = false;

    if (encoded) {
        try {
            const session = JSON.parse(atob(encoded));
            isLogin = session.loggedIn === true;
        } catch (error) {
            console.error("Invalid session data");
            sessionStorage.removeItem('session');
            window.location.pathname = '/loginOrRegister';
        }
    }

    updateHeaderLinks(isLogin);

})


