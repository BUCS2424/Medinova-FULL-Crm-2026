import { useBranding } from '../contexts/BrandingContext';
import { cn } from '@/lib/utils';

export const PublicBrandLogo = ({
  href = '/',
  testIdPrefix = 'public-brand-logo',
  className = '',
  imgClassName = 'h-[70px] max-w-[230px] object-contain',
}) => {
  const { branding, versionedLogoUrl } = useBranding();
  const targetHref = branding.logo_link_url || href;
  const logoSrc = versionedLogoUrl || branding.logo_url || '/images/medinova/logo.webp';

  return (
    <a
      href={targetHref}
      className={cn('flex items-center gap-3 group', className)}
      data-testid={`${testIdPrefix}-link`}
    >
      <img
        src={logoSrc}
        alt="MediNova Medical Supplies logo"
        className={imgClassName}
        data-testid={`${testIdPrefix}-image`}
      />
    </a>
  );
};
