import { ArrowRight, Menu, Phone } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { PublicBrandLogo } from './PublicBrandLogo';

export const PublicMobileMenu = ({
  pageKey,
  items,
  title = 'Explore MediNova',
  description = 'Medicare-covered medical equipment with nationwide delivery and support.',
  primaryHref = '/#contact',
  primaryLabel = 'Get Started',
  secondaryHref = 'tel:7279667767',
  secondaryLabel = '(727) 966-7767',
}) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
          aria-label="Open mobile menu"
          data-testid={`${pageKey}-mobile-menu-trigger`}
        >
          <Menu className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[86vw] max-w-[360px] border-l border-slate-200 bg-white/95 px-6 py-6 backdrop-blur"
        data-testid={`${pageKey}-mobile-menu-sheet`}
      >
        <SheetHeader className="space-y-4 text-left">
          <PublicBrandLogo testIdPrefix={`${pageKey}-mobile-menu-logo`} />
          <div>
            <SheetTitle className="text-slate-900">{title}</SheetTitle>
            <SheetDescription className="text-sm text-slate-500">
              {description}
            </SheetDescription>
          </div>
        </SheetHeader>

        <nav
          className="mt-8 flex flex-col gap-2"
          aria-label="Mobile navigation"
          data-testid={`${pageKey}-mobile-menu-nav`}
        >
          {items.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="flex items-center justify-between rounded-2xl border border-transparent bg-slate-100/70 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-lime-200 hover:bg-lime-50 hover:text-lime-700"
              data-testid={`${pageKey}-mobile-menu-link-${item.key}`}
            >
              <span>{item.label}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          ))}
        </nav>

        <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
          <a
            href={secondaryHref}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 transition-colors hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
            data-testid={`${pageKey}-mobile-menu-secondary-cta`}
          >
            <Phone className="w-4 h-4" />
            {secondaryLabel}
          </a>
          <a
            href={primaryHref}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-500 to-lime-600 px-4 py-3 font-semibold text-white shadow-lg shadow-lime-500/20 transition-transform hover:scale-[1.01] hover:from-lime-600 hover:to-lime-700"
            data-testid={`${pageKey}-mobile-menu-primary-cta`}
          >
            {primaryLabel}
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
};