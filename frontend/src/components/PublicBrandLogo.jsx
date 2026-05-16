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
          alt="MediNova Medical Supplies logo"
          className="h-[70px] max-w-[230px] object-contain"
          data-testid={`${testIdPrefix}-image`}
        />
      ) : (
        <>
          <img src="/images/medinova/logo.webp" alt="MediNova Medical Supplies" className="h-[55px] max-w-[230px] object-contain" />
        </>
      )}
    </a>
  );
};