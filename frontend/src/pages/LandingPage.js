import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Helmet } from 'react-helmet-async';

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#0055CC] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50" data-testid="landing-root-wrapper">
      <Helmet>
        <title>MediNova Medical Supplies | Quality Medical Equipment Delivered Free</title>
        <meta
          name="description"
          content="MediNova Medical Supplies delivers Medicare-covered durable medical equipment nationwide with fast eligibility checks, doctor coordination, and free delivery."
        />
        <link rel="canonical" href="https://medinovadme.com" />
        <meta property="og:title" content="MediNova Medical Supplies | Quality Medical Equipment Delivered Free" />
        <meta
          property="og:description"
          content="Medicare-covered durable medical equipment with nationwide delivery, streamlined paperwork, and expert support."
        />
        <meta property="og:url" content="https://medinovadme.com" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="MediNova Medical Supplies" />
        <meta
          property="og:image"
          content="https://customer-assets.emergentagent.com/job_7965af6d-d9f9-48a9-9447-d2e9a0ead878/artifacts/e812a763_durable-medical-equipment-wheelchair.jpg"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MediNova Medical Supplies | Quality Medical Equipment Delivered Free" />
        <meta
          name="twitter:description"
          content="Medicare-covered durable medical equipment with nationwide delivery, streamlined paperwork, and expert support."
        />
        <meta
          name="twitter:image"
          content="https://customer-assets.emergentagent.com/job_7965af6d-d9f9-48a9-9447-d2e9a0ead878/artifacts/e812a763_durable-medical-equipment-wheelchair.jpg"
        />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'MedicalBusiness',
            name: 'MediNova Medical Supplies',
            url: 'https://medinovadme.com',
            telephone: '+1-727-966-7767',
            areaServed: {
              '@type': 'Country',
              name: 'United States',
            },
            description:
              'Medicare-covered durable medical equipment with nationwide delivery, streamlined paperwork, and expert support.',
          })}
        </script>
      </Helmet>
      <iframe
        src="/landing.html"
        title="MediNova Landing"
        className="w-full h-full border-0"
        data-testid="landing-root-iframe"
      />
    </div>
  );
}
