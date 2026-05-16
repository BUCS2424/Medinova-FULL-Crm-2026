import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  ExternalLink, Phone, BookOpen, Shield, FileText, 
  Heart, Scale, HelpCircle, Building2, Users, 
  ChevronDown, ChevronUp, Search, MapPin, ArrowRight,
  CheckCircle2, AlertCircle, Stethoscope, Landmark
} from 'lucide-react';
import { PublicBrandLogo } from '../components/PublicBrandLogo';
import { PublicMobileMenu } from '../components/PublicMobileMenu';

const SITE_DOMAIN = "https://dmepros.com";

const resourceCategories = [
  {
    id: 'official-medicare',
    title: 'Official Medicare & CMS Resources',
    icon: Landmark,
    color: 'from-navy-700 to-navy-800',
    description: 'Authoritative information directly from the Centers for Medicare & Medicaid Services.',
    resources: [
      { title: 'Medicare.gov', url: 'https://www.medicare.gov/', description: 'Official U.S. government site for Medicare. Find plans, check coverage, and manage your benefits.' },
      { title: 'Medicare Coverage of DME', url: 'https://www.medicare.gov/coverage/durable-medical-equipment-dme-coverage', description: 'Learn exactly what durable medical equipment Medicare Part B covers and your cost-sharing.' },
      { title: 'Medicare & You Handbook', url: 'https://www.medicare.gov/publications/10050-Medicare-and-You.pdf', description: 'The official annual Medicare handbook with complete coverage information, rights, and protections.' },
      { title: 'Find & Compare Medicare Plans', url: 'https://www.medicare.gov/plan-compare/', description: 'Compare Medicare Advantage, Supplement, and Part D drug plans available in your area.' },
      { title: 'CMS DMEPOS Supplier Standards', url: 'https://www.cms.gov/Outreach-and-Education/Medicare-Learning-Network-MLN/MLNProducts/DMEPOSQuality/DMEPOSQualBooklet-905709.html', description: 'Official CMS requirements that all Medicare DME suppliers must meet to participate in the program.' },
      { title: 'Medicare Rights & Protections', url: 'https://www.medicare.gov/claims-appeals/your-medicare-rights', description: 'Understand your rights as a Medicare beneficiary, including how to appeal decisions.' },
      { title: '1-800-MEDICARE', url: 'tel:18006334227', description: 'Call 1-800-633-4227 (TTY: 1-877-486-2048) for help with Medicare questions 24/7.', isPhone: true },
    ]
  },
  {
    id: 'eligibility-enrollment',
    title: 'Eligibility & Enrollment',
    icon: CheckCircle2,
    color: 'from-lime-500 to-emerald-600',
    description: 'Resources to help you understand Medicare eligibility, enrollment periods, and sign-up.',
    resources: [
      { title: 'Medicare Eligibility Overview', url: 'https://www.medicare.gov/basics/get-started-with-medicare/medicare-basics/parts-of-medicare', description: 'Learn about Medicare Parts A, B, C, and D — what each covers and how they work together.' },
      { title: 'Medicare Enrollment Periods', url: 'https://www.medicare.gov/basics/get-started-with-medicare/sign-up/when-does-medicare-coverage-start', description: 'Initial enrollment, general enrollment, and special enrollment periods explained.' },
      { title: 'Social Security Administration', url: 'https://www.ssa.gov/medicare/', description: 'Apply for Medicare through the SSA. Also handles Medicare premium payments and eligibility.' },
      { title: 'Medicare Savings Programs', url: 'https://www.medicare.gov/basics/costs/help/medicare-savings-programs', description: 'State programs that help pay Medicare premiums, deductibles, and coinsurance if you qualify.' },
      { title: 'Extra Help with Drug Costs', url: 'https://www.ssa.gov/benefits/medicare/prescriptionhelp.html', description: 'The Low-Income Subsidy (LIS) program helps cover Part D prescription drug costs.' },
    ]
  },
  {
    id: 'patient-rights',
    title: 'Patient Rights & Advocacy',
    icon: Scale,
    color: 'from-navy-600 to-slate-700',
    description: 'Know your rights as a patient and Medicare beneficiary. Access advocacy organizations.',
    resources: [
      { title: 'Medicare Rights Center', url: 'https://www.medicarerights.org/', description: 'National nonprofit consumer service organization providing free Medicare counseling and advocacy.' },
      { title: 'State Health Insurance Assistance Program (SHIP)', url: 'https://www.shiphelp.org/', description: 'Free, unbiased one-on-one Medicare counseling in every state. Funded by the federal government.' },
      { title: 'Medicare Ombudsman', url: 'https://www.cms.gov/center/special-topic/ombudsman/medicare-beneficiary-ombudsman-home', description: 'Helps resolve issues and ensures Medicare beneficiaries receive proper information and services.' },
      { title: 'Beneficiary & Family Centered Care Quality Improvement (BFCC-QIO)', url: 'https://qioprogram.org/beneficiary-family-centered-care-quality-improvement-organizations', description: 'File complaints about quality of care or premature hospital discharge.' },
      { title: 'Office of Inspector General (OIG)', url: 'https://oig.hhs.gov/', description: 'Report suspected Medicare fraud, waste, or abuse. Call 1-800-HHS-TIPS.' },
      { title: 'AARP Medicare Information', url: 'https://www.aarp.org/health/medicare-insurance/', description: 'Guides, tools, and expert advice on Medicare plans, enrollment, and coverage.' },
    ]
  },
  {
    id: 'dme-education',
    title: 'DME Education & Coverage',
    icon: BookOpen,
    color: 'from-lime-600 to-lime-700',
    description: 'Understand how Medicare covers durable medical equipment and what you need to qualify.',
    resources: [
      { title: 'What Qualifies as DME?', url: 'https://www.medicare.gov/coverage/durable-medical-equipment-dme-coverage', description: 'Equipment must be durable, medically necessary, prescribed by a doctor, and appropriate for home use.' },
      { title: 'Prior Authorization for DME', url: 'https://www.cms.gov/research-statistics-data-and-systems/monitoring-programs/medicare-ffs-compliance-programs/prior-authorization-initiatives', description: 'Some DME items require prior authorization. Learn which items and how the process works.' },
      { title: 'Medicare Part B Cost Sharing', url: 'https://www.medicare.gov/your-medicare-costs/part-b-costs', description: 'Medicare typically pays 80% of the approved amount. Understand your 20% coinsurance responsibility.' },
      { title: 'DME Competitive Bidding Program', url: 'https://www.cms.gov/Medicare/Medicare-Fee-for-Service-Payment/DMEPOSCompetitiveBid', description: 'How Medicare uses competitive bidding to set prices for certain DME items in specific areas.' },
      { title: 'Appeals Process for Denied Claims', url: 'https://www.medicare.gov/claims-appeals/file-an-appeal/appeals-for-items-medical-equipment', description: 'Step-by-step guide to appealing a denied Medicare claim for durable medical equipment.' },
    ]
  },
  {
    id: 'health-conditions',
    title: 'Health Conditions & Equipment Guides',
    icon: Stethoscope,
    color: 'from-sky-500 to-navy-700',
    description: 'Learn about common conditions treated with DME and what equipment may help.',
    resources: [
      { title: 'NIH - Back Pain Information', url: 'https://www.ninds.nih.gov/health-information/disorders/back-pain', description: 'National Institutes of Health guide to understanding back pain causes, treatments, and when to use bracing.' },
      { title: 'NIH - Osteoarthritis (Knee/Joint)', url: 'https://www.niams.nih.gov/health-topics/osteoarthritis', description: 'Learn about osteoarthritis, the most common form of arthritis, and how bracing and mobility aids help.' },
      { title: 'CDC - Diabetes & DME', url: 'https://www.cdc.gov/diabetes/', description: 'CDC resources on diabetes management, including glucose monitors and diabetic supplies covered by Medicare.' },
      { title: 'American Lung Association', url: 'https://www.lung.org/', description: 'Resources on COPD, asthma, and respiratory conditions that may qualify for oxygen and CPAP equipment.' },
      { title: 'AOTA - Fall Prevention', url: 'https://www.aota.org/practice/practice-essentials/fall-prevention', description: 'American Occupational Therapy Association resources on fall prevention and bathroom safety equipment.' },
      { title: 'Wound Care Resources', url: 'https://www.woundsource.com/', description: 'Educational resource for wound care management, including Medicare-covered wound care supplies.' },
    ]
  },
  {
    id: 'financial-assistance',
    title: 'Financial Assistance Programs',
    icon: Heart,
    color: 'from-emerald-500 to-lime-600',
    description: 'Programs that can help reduce your out-of-pocket costs for medical equipment.',
    resources: [
      { title: 'Medicaid.gov', url: 'https://www.medicaid.gov/', description: 'If you qualify for both Medicare and Medicaid (dual-eligible), Medicaid may cover your Medicare cost-sharing.' },
      { title: 'BenefitsCheckUp', url: 'https://www.benefitscheckup.org/', description: 'National Council on Aging tool to find benefits programs you may qualify for — food, medicine, utilities, and more.' },
      { title: 'Patient Advocate Foundation', url: 'https://www.patientadvocate.org/', description: 'Free case management and financial aid for patients struggling with chronic or life-threatening conditions.' },
      { title: 'NeedyMeds', url: 'https://www.needymeds.org/', description: 'Database of patient assistance programs, free/low-cost clinics, and discount drug programs.' },
      { title: 'Hill-Burton Free Care', url: 'https://www.hrsa.gov/get-health-care/affordable/hill-burton', description: 'Certain hospitals and facilities must provide free or reduced-cost care. Check if you qualify.' },
    ]
  },
  {
    id: 'state-resources',
    title: 'State-by-State Resources',
    icon: MapPin,
    color: 'from-sky-500 to-cyan-600',
    description: 'Find Medicare assistance specific to your state, including SHIP offices and state programs.',
    resources: [
      { title: 'Find Your State SHIP Office', url: 'https://www.shiphelp.org/about-medicare/find-local-medicare-help', description: 'Free Medicare counseling available in every state through the SHIP program. Find your local office.' },
      { title: 'State Medicaid Agencies', url: 'https://www.medicaid.gov/about-us/contact-us/index.html', description: 'Contact your state Medicaid agency to learn about dual-eligible benefits and state assistance programs.' },
      { title: 'Area Agencies on Aging', url: 'https://eldercare.acl.gov/', description: 'The Eldercare Locator connects older adults and caregivers with local aging resources. Call 1-800-677-1116.' },
      { title: 'State Insurance Departments', url: 'https://content.naic.org/state-insurance-departments', description: 'File complaints about insurance issues or get information about Medicare Supplement (Medigap) policies.' },
      { title: 'Veterans Benefits (VA)', url: 'https://www.va.gov/health-care/about-va-health-benefits/va-health-care-and-other-insurance/', description: 'If you\'re a veteran, you may be eligible for VA health benefits in addition to Medicare.' },
    ]
  },
  {
    id: 'fraud-protection',
    title: 'Fraud Prevention & Reporting',
    icon: Shield,
    color: 'from-navy-700 to-slate-800',
    description: 'Protect yourself from Medicare fraud and know how to report suspicious activity.',
    resources: [
      { title: 'Senior Medicare Patrol (SMP)', url: 'https://www.smpresource.org/', description: 'National network that empowers Medicare beneficiaries to prevent, detect, and report healthcare fraud.' },
      { title: 'OIG Fraud Reporting', url: 'https://oig.hhs.gov/fraud/report-fraud/', description: 'Report suspected Medicare fraud, waste, or abuse to the Office of Inspector General.' },
      { title: 'FTC - Medicare Scams', url: 'https://consumer.ftc.gov/articles/medicare-scams', description: 'Federal Trade Commission advice on recognizing and avoiding common Medicare scams.' },
      { title: 'Medicare Fraud Strike Force', url: 'https://www.justice.gov/criminal-fraud/health-care-fraud-unit', description: 'Department of Justice team dedicated to fighting Medicare fraud across the country.' },
    ]
  },
];

const educationTopics = [
  {
    title: 'Understanding Medicare Part B Coverage for DME',
    content: `Medicare Part B (Medical Insurance) covers medically necessary durable medical equipment (DME) that your doctor prescribes for use in your home. For equipment to qualify as DME under Medicare, it must:\n\n- Be durable (able to withstand repeated use)\n- Be used for a medical purpose\n- Not be useful to someone who isn't sick or injured\n- Be expected to last at least 3 years\n- Be appropriate for use in the home\n\nMedicare typically pays 80% of the Medicare-approved amount after you meet your Part B deductible. You're responsible for the remaining 20% coinsurance.`
  },
  {
    title: 'Prior Authorization Requirements',
    content: `Some DME items require prior authorization before Medicare will cover them. This means your supplier must get approval from Medicare before providing the equipment. Items that commonly require prior authorization include:\n\n- Power wheelchairs and scooters\n- Certain types of hospital beds\n- Oxygen equipment\n- Some orthotic devices\n- CPAP/BiPAP machines\n\nYour DME supplier handles all prior authorization paperwork on your behalf, coordinating with your physician to ensure proper documentation.`
  },
  {
    title: 'Your Rights as a Medicare Beneficiary',
    content: `As a Medicare beneficiary receiving DME, you have important rights:\n\n- Right to receive a written notice before Medicare stops paying for your care\n- Right to appeal a decision about your DME coverage\n- Right to receive quality equipment that meets your needs\n- Right to detailed information about charges and coverage\n- Right to choose your DME supplier\n- Right to file a complaint about your DME supplier\n\nIf you believe your rights have been violated, contact 1-800-MEDICARE (1-800-633-4227).`
  },
  {
    title: 'How to Get DME Through Medicare',
    content: `To receive Medicare-covered DME, follow these steps:\n\n1. Get a prescription from your doctor stating medical necessity\n2. Ensure your supplier is enrolled in Medicare and accredited\n3. Your supplier will verify your coverage and obtain any needed authorizations\n4. Receive your equipment and sign delivery documentation\n5. Pay any applicable deductible and coinsurance\n\nA quality DME supplier simplifies this process — they coordinate with your doctor, verify coverage, and handle all paperwork so you can focus on your health.`
  },
];

const faqs = [
  { q: 'What is considered Durable Medical Equipment (DME)?', a: 'DME includes items like wheelchairs, walkers, hospital beds, oxygen equipment, back braces, knee braces, CPAP machines, and other medical devices prescribed by your doctor for home use. The equipment must be medically necessary and expected to last at least 3 years.' },
  { q: 'How much does Medicare pay for DME?', a: 'Medicare Part B typically covers 80% of the Medicare-approved amount for DME after you meet your annual Part B deductible. You pay the remaining 20% as coinsurance. If you have a Medicare Supplement (Medigap) plan, it may cover some or all of your coinsurance.' },
  { q: 'Do I need a prescription for DME?', a: 'Yes. Medicare requires a written prescription (also called a Certificate of Medical Necessity) from your treating physician. The prescription must state the medical reason for the equipment and confirm it is needed for use in your home.' },
  { q: 'Can I use any DME supplier?', a: 'No. You must use a Medicare-enrolled and accredited DME supplier. Using a non-enrolled supplier means Medicare will not cover the equipment. Always verify your supplier is enrolled at Medicare.gov or by calling 1-800-MEDICARE.' },
  { q: 'What if Medicare denies coverage for my equipment?', a: 'You have the right to appeal. The appeals process has five levels, starting with a redetermination by the Medicare Administrative Contractor (MAC). Your DME supplier can help you through the appeals process.' },
  { q: 'Does Medicare cover equipment repairs and replacements?', a: 'Yes, Medicare covers reasonable repairs to medically necessary DME. Replacement is covered when equipment is lost, stolen, irreparably damaged, or has reached the end of its reasonable useful lifetime — typically 5 years for most items.' },
];

function ExpandableSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left">
        <span className="font-semibold text-gray-900">{title}</span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );
}

export default function MedicareResourcesPage() {
  const [expandedCat, setExpandedCat] = useState('official-medicare');
  const menuItems = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'products', label: 'Products', href: '/products' },
    { key: 'service-areas', label: 'Coverage Areas', href: '/locations' },
    { key: 'resources', label: 'Medicare Resources', href: '/medicare-resources' },
    { key: 'login', label: 'Patient Login', href: '/login' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Medicare DME Resources & Education | MediNova Medical Supplies</title>
        <meta
          name="description"
          content="Explore trusted Medicare DME resources, patient rights information, state help programs, and educational guides curated by MediNova Medical Supplies."
        />
        <link rel="canonical" href={`${SITE_DOMAIN}/medicare-resources`} />
        <meta property="og:title" content="Medicare DME Resources & Education | MediNova Medical Supplies" />
        <meta
          property="og:description"
          content="Explore trusted Medicare DME resources, patient rights information, state help programs, and educational guides curated by MediNova Medical Supplies."
        />
        <meta property="og:url" content={`${SITE_DOMAIN}/medicare-resources`} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Medicare DME Resources & Education | MediNova Medical Supplies" />
        <meta
          name="twitter:description"
          content="Explore trusted Medicare DME resources, patient rights information, state help programs, and educational guides curated by MediNova Medical Supplies."
        />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Medicare DME Resources & Education',
            url: `${SITE_DOMAIN}/medicare-resources`,
            description:
              'Trusted Medicare DME resources, patient rights information, state help programs, and educational guides curated by MediNova Medical Supplies.',
            publisher: {
              '@type': 'Organization',
              name: 'MediNova Medical Supplies',
              url: SITE_DOMAIN,
            },
          })}
        </script>
      </Helmet>
      {/* Top Bar */}
      <div className="bg-navy-700 text-white py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-sm">
          <a href="tel:2488864363" className="flex items-center gap-2 hover:text-lime-400">
            <Phone className="w-4 h-4" /><span className="font-medium">(248) 886-4-DME</span>
          </a>
          <a href="/" className="flex items-center gap-2 hover:text-lime-400">Back to Home</a>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <PublicBrandLogo testIdPrefix="medicare-resources-header-logo" />
          <nav className="hidden lg:flex items-center gap-6 text-sm">
            <a href="/products" className="text-gray-600 hover:text-navy-700 font-medium">Products</a>
            <a href="/locations/" className="text-gray-600 hover:text-navy-700 font-medium">Coverage Areas</a>
            <a href="/medicare-resources" className="text-navy-700 font-semibold">Resources</a>
            <a href="/#contact" className="bg-gradient-to-r from-lime-500 to-lime-600 text-white px-5 py-2 rounded-xl font-medium shadow-md">Contact Us</a>
          </nav>
          <div className="lg:hidden">
            <PublicMobileMenu
              pageKey="medicare-resources"
              items={menuItems}
              title="Resource Navigation"
              description="Jump between educational content, public pages, and contact options without leaving the page."
              primaryHref="/#contact"
              primaryLabel="Contact Us"
            />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50/30 py-16 md:py-24 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl"></div>
        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 border border-primary-200 rounded-full text-primary-700 text-sm font-medium mb-6">
              <BookOpen className="w-4 h-4" />Patient Education & Resources
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-navy-700 mb-6">
              Medicare DME <span className="text-primary-500">Resources & Education</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              Your comprehensive guide to understanding Medicare coverage for durable medical equipment. Access official resources, learn your rights, and find help in your state.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links Bar */}
      <div className="bg-slate-50 border-b border-gray-200 py-3 sticky top-[65px] z-40">
        <div className="max-w-7xl mx-auto px-4 flex gap-3 overflow-x-auto pb-1">
          {resourceCategories.map(cat => (
            <a key={cat.id} href={`#${cat.id}`} className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:border-lime-300 hover:text-lime-700 transition-colors">
              {cat.title.split(' ').slice(0, 3).join(' ')}
            </a>
          ))}
        </div>
      </div>

      {/* Resource Categories */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 space-y-12">
          {resourceCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.id} id={cat.id} className="scroll-mt-32">
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-12 h-12 bg-gradient-to-br ${cat.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{cat.title}</h2>
                    <p className="text-gray-500 mt-1">{cat.description}</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cat.resources.map((res, i) => (
                    <a key={i} href={res.url} target="_blank" rel="noopener noreferrer"
                       className="group block p-5 bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:border-lime-200 transition-all" data-testid={`resource-${cat.id}-${i}`}>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 group-hover:text-lime-600 transition-colors pr-2">{res.title}</h3>
                        {res.isPhone ? <Phone className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{res.description}</p>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 bg-primary-50/40">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-lime-100 text-lime-700 rounded-full text-sm font-medium mb-4">Patient Education</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Understanding Your Medicare DME Coverage</h2>
            <p className="text-gray-600">Essential information every Medicare beneficiary should know about durable medical equipment.</p>
          </div>
          <div className="space-y-4">
            {educationTopics.map((topic, i) => (
              <ExpandableSection key={i} title={topic.title} defaultOpen={i === 0}>
                <div className="pt-4 text-gray-600 leading-relaxed whitespace-pre-line text-sm">{topic.content}</div>
              </ExpandableSection>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-4">Frequently Asked Questions</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Common Medicare DME Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <ExpandableSection key={i} title={faq.q}>
                <p className="pt-4 text-gray-600 leading-relaxed text-sm">{faq.a}</p>
              </ExpandableSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary-50 via-white to-primary-50/40 border-y border-primary-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-navy-700 mb-6">Need Help Understanding Your Coverage?</h2>
          <p className="text-gray-600 text-lg mb-8">Our specialists are ready to answer your questions and help you get the Medicare-covered equipment you need.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:2488864363" className="bg-gradient-to-r from-lime-500 to-lime-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg inline-flex items-center justify-center gap-2">
              <Phone className="w-5 h-5" />(248) 886-4-DME
            </a>
            <a href="/#contact" className="border-2 border-gray-200 bg-white text-navy-700 px-8 py-4 text-lg font-semibold rounded-xl inline-flex items-center justify-center gap-2 hover:border-primary-200 hover:bg-primary-50 transition-colors">
              Request Information <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="bg-gray-50 border-t border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              The information provided on this page is for educational purposes only and is not intended as legal or medical advice. Medicare coverage is subject to eligibility requirements and may vary. For specific questions about your coverage, contact Medicare directly at 1-800-MEDICARE (1-800-633-4227) or visit <a href="https://www.medicare.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Medicare.gov</a>.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-navy-900 to-navy-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div><h3 className="text-xl font-bold mb-4">MediNova Medical Supplies</h3><p className="text-gray-400 text-sm">Medicare-accredited DME supplier serving patients nationwide.</p></div>
            <div><h4 className="font-semibold mb-4">Quick Links</h4><ul className="space-y-2 text-gray-400 text-sm"><li><a href="/" className="hover:text-white">Home</a></li><li><a href="/products" className="hover:text-white">Products</a></li><li><a href="/locations/" className="hover:text-white">Coverage Areas</a></li><li><a href="/medicare-resources" className="hover:text-lime-400 text-lime-400">Medicare Resources</a></li></ul></div>
            <div><h4 className="font-semibold mb-4">Contact</h4><ul className="space-y-2 text-gray-400 text-sm"><li><a href="tel:2488864363" className="hover:text-white">(248) 886-4-DME</a></li><li><a href="mailto:info@dmepros.com" className="hover:text-white">info@dmepros.com</a></li></ul></div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2025 MediNova Medical Supplies. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
