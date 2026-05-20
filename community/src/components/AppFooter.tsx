import { Link } from 'react-router-dom';

export default function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-cream border-t border-taupe/30 mt-20">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-8 items-start">
          <div>
            <h3 className="font-display text-espresso uppercase tracking-[0.1em] text-base">
              The Pupper Club
            </h3>
            <p className="text-sm text-espresso/70 mt-2 leading-relaxed max-w-sm">
              A small, trusted circle of verified neighbours who show up for
              each other &mdash; and for the pets they love.
            </p>
          </div>
          <div>
            <h4 className="text-sm text-espresso font-bold uppercase tracking-[0.08em] mb-2">Location</h4>
            <p className="text-sm text-espresso/70 leading-relaxed">Port Moody, BC</p>
          </div>
          <div>
            <h4 className="text-sm text-espresso font-bold uppercase tracking-[0.08em] mb-2">Support</h4>
            <div className="flex flex-col items-start gap-2">
              <Link to="/contact" className="btn-blue-outline inline-flex" style={{ padding: '8px 18px', fontSize: 12 }}>
                Contact us
              </Link>
              <Link to="/donate" className="btn-blue inline-flex" style={{ padding: '8px 18px', fontSize: 12 }}>
                Say Thanks!
              </Link>
            </div>
            <p className="text-xs text-taupe mt-3 leading-relaxed max-w-[14rem]">
              Donations are optional &mdash; they help cover hosting and
              keep the platform improving.
            </p>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-taupe/30">
          <p className="text-xs text-taupe">
            &copy; {year} The Pupper Club. All rights reserved.
            &nbsp;|&nbsp;
            <a href="https://thepupperclub.ca/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-espresso transition-colors">Privacy Policy</a>
            &nbsp;|&nbsp;
            <a href="https://thepupperclub.ca/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-espresso transition-colors">Terms of Service</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
