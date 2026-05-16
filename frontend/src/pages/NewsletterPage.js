import NewsletterManager from '../components/NewsletterManager';

export default function NewsletterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Newsletter</h1>
        <p className="text-muted-foreground">Manage email campaigns, subscribers, and mailing lists</p>
      </div>
      
      <NewsletterManager />
    </div>
  );
}
