function showAuthModal(form) {
    document.getElementById('authModal').style.display = 'block';
    switchAuthForm(form);
}
function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}
function switchAuthForm(form) {
    if (form === 'login') {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
}
window.onclick = function(event) {
    const modal = document.getElementById('authModal');
    if (event.target === modal) {
        closeAuthModal();
    }
}
async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const result = await apiRequest('/api/auth/login', 'POST', {
        username,
        password
    });
    if (result.success) {
        if (result.token) {
            localStorage.setItem('token', result.token);
        }
        showNotification('Вход выполнен успешно', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);
    } else {
        showNotification(result.message || 'Ошибка входа', 'error');
    }
}
async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    if (password !== passwordConfirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    const result = await apiRequest('/api/auth/register', 'POST', {
        username,
        email,
        password
    });
    if (result.success) {
        if (result.token) {
            localStorage.setItem('token', result.token);
        }
        showNotification('Регистрация успешна! Добро пожаловать', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);
    } else {
        showNotification(result.message || 'Ошибка регистрации', 'error');
    }
}
(async function() {
    const result = await apiRequest('/api/auth/verify');
    if (result.success) {
        updateNavForLoggedIn(result.user);
        const ctaSection = document.getElementById('cta-section');
        if (ctaSection) {
            ctaSection.style.display = 'none';
        }
    }
})();
function updateNavForLoggedIn(user) {
    const authButtons = document.querySelector('.nav-auth');
    if (authButtons) {
        const themeBtn = authButtons.querySelector('.theme-toggle-btn');
        authButtons.innerHTML = '';
        if (themeBtn) {
            authButtons.appendChild(themeBtn);
        }
        const userSpan = document.createElement('span');
        userSpan.className = 'nav-username';
        userSpan.textContent = `👤 ${user.username}`;
        const dashboardLink = document.createElement('a');
        dashboardLink.href = '/dashboard';
        dashboardLink.className = 'btn btn-primary btn-sm';
        dashboardLink.textContent = 'Мой кабинет';
        authButtons.appendChild(userSpan);
        authButtons.appendChild(dashboardLink);
    }
    document.querySelectorAll('.hero-slide .hero-actions button').forEach(btn => {
        if (btn.textContent.includes('Войти')) {
            btn.style.display = 'none';
        }
        if (btn.textContent.includes('Начать') || btn.textContent.includes('Попробовать') || btn.textContent.includes('Создать доску')) {
            btn.onclick = () => window.location.href = '/dashboard';
        }
    });
}
let currentSlide = 0;
const slides = document.querySelectorAll('.hero-slide');
const dots = document.querySelectorAll('.dot');
let slideInterval;
function showSlide(n) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    currentSlide = (n + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}
function nextSlide() {
    showSlide(currentSlide + 1);
    resetAutoSlide();
}
function prevSlide() {
    showSlide(currentSlide - 1);
    resetAutoSlide();
}
function goToSlide(n) {
    showSlide(n);
    resetAutoSlide();
}
function resetAutoSlide() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        showSlide(currentSlide + 1);
    }, 5000);
}
slideInterval = setInterval(() => {
    showSlide(currentSlide + 1);
}, 5000);
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -100px 0px'
};
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('section-visible');
            const children = entry.target.querySelectorAll('.feature-card, .step, .stat-card');
            children.forEach((child, index) => {
                setTimeout(() => {
                    child.style.opacity = '1';
                    child.style.transform = 'translateY(0)';
                }, index * 100);
            });
        }
    });
}, observerOptions);
document.querySelectorAll('.features, .how-it-works, .cta').forEach(section => {
    section.classList.add('section-hidden');
    observer.observe(section);
});

const scrollAnimateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});


document.addEventListener('DOMContentLoaded', async () => {
    const animateElements = document.querySelectorAll(
        '.scroll-animate, .scroll-animate-left, .scroll-animate-right, .scroll-animate-scale'
    );
    
    animateElements.forEach(el => {
        scrollAnimateObserver.observe(el);
    });

    async function checkIfLoggedIn() {
        try {
            const result = await apiRequest('/api/auth/verify');
            return result.success;
        } catch (error) {
            return false;
        }
    }

  
    
    const landingPage = document.querySelector('.landing-page');
    if (!landingPage) {
        console.error('Landing page not found!');
        return;
    }
    
    let isLoggedIn = false;
    try {
        isLoggedIn = await checkIfLoggedIn();
    } catch (error) {
        console.error('Auth check failed:', error);
    }
    
    if (isLoggedIn) {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const dashboardBtn = document.getElementById('dashboardBtn');
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (dashboardBtn) dashboardBtn.style.display = 'inline-block';
    }
    
    let allSections = Array.from(landingPage.children);
    
    console.log('Total sections found:', allSections.length);
    
    if (isLoggedIn) {
        const ctaSection = document.getElementById('cta-section');
        if (ctaSection) {
            ctaSection.remove();
            allSections = Array.from(landingPage.children);
            console.log('CTA removed, sections now:', allSections.length);
        }
    }
    
    let currentSectionIndex = 0;
    let isAnimating = false;
    let touchStartY = 0;
    
    const sectionNav = document.createElement('div');
    sectionNav.className = 'section-nav';
    allSections.forEach((section, index) => {
        const dot = document.createElement('div');
        dot.className = 'section-nav-dot';
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSection(index));
        sectionNav.appendChild(dot);
    });
    document.body.appendChild(sectionNav);
    
    if (allSections.length > 0) {
        allSections[0].classList.add('active');
        console.log('First section activated:', allSections[0].className);
    }
    
    function goToSection(index) {
        if (isAnimating || index < 0 || index >= allSections.length) return;
        if (index === currentSectionIndex) return;
        
        isAnimating = true;
        
        
        allSections[currentSectionIndex].classList.remove('active');
        
        
        allSections[index].classList.add('active');
        
        const dots = sectionNav.querySelectorAll('.section-nav-dot');
        dots[currentSectionIndex].classList.remove('active');
        dots[index].classList.add('active');
        
        currentSectionIndex = index;
        
        setTimeout(() => {
            isAnimating = false;
        }, 1000);
    }
    
    function nextSection() {
        if (currentSectionIndex < allSections.length - 1) {
            goToSection(currentSectionIndex + 1);
        }
    }
    
    function prevSection() {
        if (currentSectionIndex > 0) {
            goToSection(currentSectionIndex - 1);
        }
    }
    
    let scrollTimeout;
    landingPage.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        if (isAnimating) return;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (e.deltaY > 0) {
                nextSection();
            } else {
                prevSection();
            }
        }, 50);
    }, { passive: false });
    
    landingPage.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    landingPage.addEventListener('touchend', (e) => {
        if (isAnimating) return;
        
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        
        if (Math.abs(diff) > 50) { 
            if (diff > 0) {
                nextSection(); 
            } else {
                prevSection(); 
            }
        }
    }, { passive: true });
    
    document.addEventListener('keydown', (e) => {
        if (isAnimating) return;
        
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            e.preventDefault();
            nextSection();
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            prevSection();
        } else if (e.key === 'Home') {
            e.preventDefault();
            goToSection(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            goToSection(allSections.length - 1);
        }
    });

    const featuresSlider = document.getElementById('featuresSlider');
    
    if (featuresSlider) {
        const featureCards = featuresSlider.querySelectorAll('.feature-card');
        
        featureCards.forEach(card => {
            const clone = card.cloneNode(true);
            featuresSlider.appendChild(clone);
        });
        
        let currentPosition = 0;
        const cardWidth = 100 / 6;
        const speed = 0.015;
        
        function animateSlider() {
            currentPosition -= speed;
            
            if (Math.abs(currentPosition) >= 100) {
                currentPosition = 0;
            }
            
            featuresSlider.style.transform = `translateX(${currentPosition}%)`;
            requestAnimationFrame(animateSlider);
        }
        
        animateSlider();
    }
});
