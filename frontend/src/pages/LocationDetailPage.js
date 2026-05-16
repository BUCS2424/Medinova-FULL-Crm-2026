import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LocationDetailPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      const pageSlug = slug.endsWith('.html') ? slug : `${slug}.html`;
      // Fetch the HTML from the backend API and replace the entire page
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
          <p className="text-gray-600">This location page could not be loaded.</p>
          <a href="/locations" className="mt-4 inline-block text-lime-600 hover:text-lime-700 font-medium">
            View All Service Areas
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin w-8 h-8 border-4 border-lime-500 border-t-transparent rounded-full" />
    </div>
  );
}
