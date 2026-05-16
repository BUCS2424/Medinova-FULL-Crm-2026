import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CampaignPage() {
  const { slug } = useParams();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    // Track the visit
    fetch(`${API_URL}/api/campaigns/track/${slug}`, { method: 'POST' }).catch(() => {});

    // Fetch campaign data then load the source page HTML with UTM params
    fetch(`${API_URL}/api/campaigns/page/${slug}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => {
        const campaign = data.campaign;
        const params = new URLSearchParams();
        if (campaign.utm_source) params.set('utm_source', campaign.utm_source);
        if (campaign.utm_medium) params.set('utm_medium', campaign.utm_medium);
        if (campaign.utm_campaign) params.set('utm_campaign', campaign.utm_campaign || slug);
        const qs = params.toString() ? `?${params.toString()}` : '';

        // Fetch the actual landing page HTML and render it inline
        let sourceUrl = `${API_URL}/api/pages/landing`;
        if (campaign.source_type === 'product' && data.source_data?.product) {
          sourceUrl = `${API_URL}/api/pages/landing`; // Still use landing for products
        }

        fetch(sourceUrl)
          .then(r => r.text())
          .then(html => {
            // Inject campaign title and UTM into the HTML
            let modified = html;

            // Update the page title
            if (campaign.title) {
              modified = modified.replace(/<title>[^<]*<\/title>/, `<title>${campaign.title} | DME PROS</title>`);
            }

            // Inject UTM params into all form submissions
            const utmScript = `<script>
              window.__CAMPAIGN_UTM = ${JSON.stringify({
                utm_source: campaign.utm_source || '',
                utm_medium: campaign.utm_medium || '',
                utm_campaign: campaign.utm_campaign || slug,
                campaign_slug: slug
              })};
            </script>`;
            modified = modified.replace('</head>', `${utmScript}</head>`);

            // Replace the entire document
            document.open();
            document.write(modified);
            document.close();
          })
          .catch(() => setError(true));
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600">This campaign page is no longer active.</p>
          <a href="/" className="mt-4 inline-block text-lime-600 hover:text-lime-700 font-medium">Go to Homepage</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
    </div>
  );
}
