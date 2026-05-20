export default function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="max-w-5xl mx-auto mt-20 pt-8 border-t border-taupe/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-taupe">
        <p>&copy; {year} The Pupper Club &mdash; Community.</p>
        <nav className="flex items-center gap-5">
          <a
            href="https://thepupperclub.ca/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-espresso transition-colors"
          >
            Privacy
          </a>
          <a
            href="https://thepupperclub.ca/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-espresso transition-colors"
          >
            Terms
          </a>
          <a
            href="https://thepupperclub.ca/contact.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-espresso transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
