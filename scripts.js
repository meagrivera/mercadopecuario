// Scroll suave para navegación (solo enlaces internos)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (!href || href === "#") return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// Menú responsive accesible
const toggleBtn = document.querySelector('.menu-toggle');
const navMenuUl = document.querySelector('#nav-menu ul');

function updateAriaExpanded(open) {
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleMenu() {
  if (!navMenuUl) return;
  const isOpen = navMenuUl.classList.toggle('show');
  updateAriaExpanded(isOpen);
}

if (toggleBtn) {
  toggleBtn.addEventListener('click', toggleMenu);
}

// Cerrar el menú al seleccionar un enlace (móvil)
if (navMenuUl) {
  navMenuUl.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && navMenuUl.classList.contains('show')) {
      navMenuUl.classList.remove('show');
      updateAriaExpanded(false);
    }
  });
}

