/**
 * CoverageAreaPage — public coverage area pages served as HTML from backend.
 *
 * Route shapes:
 *   /coverage-areas                          → index
 *   /coverage-areas/:product_slug            → state listing
 *   /coverage-areas/:product_slug/:page_slug → individual location page
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CoverageAreaPage() {
  const { product_slug, page_slug } = useParams();
  const navigate = useNavigate();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setHtml('');

    let backendUrl;
    if (page_slug) {
      backendUrl = `${API_URL}/api/coverage-areas/${product_slug}/${page_slug}`;
    } else if (product_slug) {
      backendUrl = `${API_URL}/api/coverage-areas/${product_slug}`;
    } else {
      backendUrl = `${API_URL}/api/coverage-areas`;
    }

    axios.get(backendUrl, {
      headers: { Accept: 'text/html' },
      responseType: 'text',
    })
      .then(res => {
        setHtml(res.data);
        setLoading(false);
      })
      .catch(err => {
        if (err.response?.status === 404) {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [product_slug, page_slug]);

  useEffect(() => {
    const handleClick = (e) => {
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('/coverage-areas')) {
        e.preventDefault();
        navigate(href);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#3d6b5a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <h1 className="text-2xl font-bold text-slate-900">Page Not Found</h1>
        <Link to="/coverage-areas" className="text-[#3d6b5a] underline">Back to Coverage Areas</Link>
      </div>
    );
  }

  return (
    <div
      style={{ width: '100%', minHeight: '100vh' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
