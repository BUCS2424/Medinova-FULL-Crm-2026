import { Shield } from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';
import { cn } from '@/lib/utils';

export const PublicBrandLogo = ({
  href = '/',
  subtitle = 'Medicare DME Supplier',
  testIdPrefix = 'public-brand-logo',
  className = '',
}) => {
  const { branding, versionedLogoUrl } = useBranding();
  const targetHref = branding.logo_link_url || href;

  return (
    <a
      href={targetHref}
      className={cn('flex items-center gap-3 group', className)}
      data-testid={`${testIdPrefix}-link`}
    >
      {versionedLogoUrl ? (
        <img
          src={versionedLogoUrl}
          alt="DME PROS logo"
          className="h-[70px] max-w-[230px] object-contain"
          data-testid={`${testIdPrefix}-image`}
        />
      ) : (
        <>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center shadow-lg shadow-lime-500/20 transition-transform group-hover:scale-105">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div data-testid={`${testIdPrefix}-fallback`}>
            <div className="text-xl font-extrabold text-slate-900 leading-none">DME PROS</div>
            <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
          </div>
        </>
      )}
    </a>
  );
};