// Initialize Lucide Icons
lucide.createIcons();

// Theme Handling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'solarized-dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
}

// Accordion Logic
function initAccordion() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const currentItem = header.parentElement;
            const isActive = currentItem.classList.contains('active');
            
            // Close all items
            document.querySelectorAll('.accordion-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Toggle current item
            if (!isActive) {
                currentItem.classList.add('active');
            }
        });
    });
}

// Run initializers
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAccordion();
});
