// Shared navigation JS for all pages
(function () {
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobile-menu');
  const body = document.body;

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
      body.classList.toggle('menu-open');
    });

    document.querySelectorAll('.mobile-nav-link, .mobile-cta').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('open');
        mobileMenu.classList.remove('open');
        body.classList.remove('menu-open');
      });
    });
  }

  // About dropdown (click/tap toggle, alongside the CSS hover reveal)
  document.querySelectorAll('.nav-dropdown-trigger').forEach(trigger => {
    const dropdown = trigger.closest('.nav-dropdown');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !dropdown.classList.contains('open');
      document.querySelectorAll('.nav-dropdown.open').forEach(d => {
        d.classList.remove('open');
        d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      });
      if (opening) {
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.nav-dropdown.open').forEach(d => {
      d.classList.remove('open');
      d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.nav-dropdown.open').forEach(d => {
        d.classList.remove('open');
        d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // Sticky header scroll effect
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }
})();
