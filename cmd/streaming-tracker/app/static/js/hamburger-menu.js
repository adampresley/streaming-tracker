document.addEventListener('DOMContentLoaded', function() {
    const hamburgerButton = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.nav-menu');
    const overlay = document.querySelector('.mobile-menu-overlay');

    if (!hamburgerButton || !navMenu || !overlay) {
        return;
    }

    function toggleMenu() {
        const isActive = hamburgerButton.classList.contains('active');

        if (isActive) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    function openMenu() {
        hamburgerButton.classList.add('active');
        navMenu.classList.add('active');
        overlay.classList.add('active');
        hamburgerButton.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeMenu() {
        hamburgerButton.classList.remove('active');
        navMenu.classList.remove('active');
        overlay.classList.remove('active');
        hamburgerButton.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = ''; // Restore background scrolling
    }

    // Toggle menu when hamburger button is clicked
    hamburgerButton.addEventListener('click', toggleMenu);

    // Close menu when overlay is clicked
    overlay.addEventListener('click', closeMenu);

    // Close menu when a navigation link is clicked (mobile)
    navMenu.addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            closeMenu();
        }
    });

    // Close menu when pressing Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && hamburgerButton.classList.contains('active')) {
            closeMenu();
        }
    });

    // Close menu when window is resized to desktop size
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && hamburgerButton.classList.contains('active')) {
            closeMenu();
        }
    });
});
