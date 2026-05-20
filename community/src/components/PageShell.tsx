import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppNav from '@/components/AppNav';
import AppFooter from '@/components/AppFooter';

interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  children: ReactNode;
  /** Path the back button should navigate to. If omitted, uses history.back(). */
  back?: string;
  /** Breadcrumb trail rendered just above the content. The last entry is the current page (no link). */
  crumbs?: Crumb[];
  /** Tighten or widen the content column. Default 'narrow' (max-w-2xl) matches existing screens. */
  width?: 'narrow' | 'wide';
}

export default function PageShell({ children, back, crumbs, width = 'narrow' }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const mainMax = width === 'wide' ? 'max-w-4xl' : 'max-w-2xl';

  const onBack = () => {
    if (back) navigate(back);
    else navigate(-1);
  };

  const isRoot = location.pathname === '/home';

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />

      <main className="flex-1 px-6 sm:px-8 py-10 w-full">
        <div className={`${mainMax} mx-auto w-full`}>
          {(!isRoot && (back !== undefined || crumbs?.length)) && (
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              {back !== undefined ? (
                <button
                  onClick={onBack}
                  className="text-sm text-taupe hover:text-espresso transition-colors inline-flex items-center gap-1"
                >
                  <span aria-hidden>&larr;</span>
                  <span>Back</span>
                </button>
              ) : <span />}
              {crumbs && crumbs.length > 0 && (
                <ol className="flex items-center gap-2 text-xs text-taupe flex-wrap">
                  {crumbs.map((c, i) => {
                    const isLast = i === crumbs.length - 1;
                    return (
                      <li key={`${c.label}-${i}`} className="flex items-center gap-2">
                        {c.to && !isLast ? (
                          <Link to={c.to} className="hover:text-espresso transition-colors">{c.label}</Link>
                        ) : (
                          <span className={isLast ? 'text-espresso' : ''}>{c.label}</span>
                        )}
                        {!isLast && <span aria-hidden>/</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}

          {children}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
