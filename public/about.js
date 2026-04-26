// Initialize Lucide Icons
lucide.createIcons();

// Theme Handling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'solarized-dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
}

// Fade-in Intersection Observer
function initAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(element => {
        observer.observe(element);
    });
}

// Run initializers
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAnimations();
});
