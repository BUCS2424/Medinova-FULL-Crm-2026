import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LocationDetailPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      // Normalize slug: always use the durable-medical-equipment-in-{slug}.html format
      const base = slug
        .replace(/\.html$/, '')
        .replace(/^durable-medical-equipment-in-/, '');
      const pageSlug = `durable-medical-equipment-in-${base}.html`;

      fetch(`${API_URL}/api/pages/location/${pageSlug}`)
        .then(res => {
          if (!res.ok) throw new Error('Page not found');
          return res.text();
        })
        .then(html => {
          // Replace the entire document with the location page HTML
          document.open();
          document.write(html);
          document.close();
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [slug]);

  if (!loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600 mb-4">This location page could not be loaded.</p>
          <a href="/locations" className="inline-block text-[#0055CC] hover:text-[#00A3E0] font-semibold transition-colors">
            View All Coverage Areas
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin w-8 h-8 border-4 border-[#0055CC] border-t-transparent rounded-full" />
    </div>
  );
}
