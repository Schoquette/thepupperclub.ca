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
