// Knowledge Base content — structured articles for MediNova DME platform
// Each section maps to a feature area. `feature` = feature toggle key(s) required to show it.
// `null` = always visible. Array = show if ANY toggle is enabled.

export const KB_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'BookOpen',
    feature: null,
    category: 'core',
    description: 'System overview, navigation, and first steps.',
    articles: [
      {
        id: 'system-overview',
        title: 'System Overview',
        readTime: '4 min',
        sections: [
          { heading: 'What is MediNova DME?', text: 'MediNova DME is an all-in-one practice management platform for Durable Medical Equipment (DME) suppliers. It handles the full patient lifecycle — from intake and insurance verification, to order management, billing, and compliance monitoring.' },
          { heading: 'Who Uses This System?', bullets: ['Super Admin / Admin — full access to all modules and settings', 'Sales Managers & Sales Reps — patient intake, order creation, lead management', 'Doctors — patient records, telehealth visits, order signing', 'Store Owners — business settings, analytics, billing overview'] },
          { heading: 'Navigation', text: 'The left sidebar contains your primary navigation. Items are role-based and feature-gated — you only see what your role and active features allow. The sidebar can be collapsed by clicking the arrow at the top.' },
          { type: 'tip', text: 'Bookmark your most-used pages. The Dashboard is always your starting point after login.' },
        ],
      },
      {
        id: 'user-roles',
        title: 'User Roles & Permissions',
        readTime: '3 min',
        sections: [
          { heading: 'Role Overview', text: 'Every user in the system is assigned a role that determines what they can see and do. Roles are hierarchical — Super Admin has the broadest access.' },
          { heading: 'Role Definitions', bullets: [
            'super_admin — Full system access, including all settings, user management, and feature toggles',
            'admin — Full operational access; can manage users, orders, patients, and most settings',
            'sales_manager — Manages sales team, leads, patients, and orders; cannot modify system settings',
            'sales_rep — Creates patient requests, manages assigned leads and orders',
            'doctor — Views patient records, signs orders, conducts telehealth visits',
            'store_owner — Business-level access with analytics and billing focus',
          ]},
          { type: 'warning', text: 'Only Super Admin can create or modify other admin-level accounts. Always use the principle of least privilege when assigning roles.' },
        ],
      },
      {
        id: 'feature-toggles',
        title: 'Feature Toggles (Dev Settings)',
        readTime: '2 min',
        sections: [
          { heading: 'What are Feature Toggles?', text: 'Feature toggles let admins enable or disable entire modules (Telehealth, Analytics, Campaigns, etc.) without removing them from the system. When a feature is off, its menu items and pages are hidden from all users.' },
          { heading: 'Accessing Dev Settings', steps: ['Navigate to Dev Settings from the Admin Settings menu', 'Locate the Features Manager section', 'Toggle any feature on or off using the switches', 'Changes take effect immediately — no restart required'] },
          { heading: 'Which Features are Toggle-Controlled?', bullets: ['Telehealth / Video Conferencing', 'Analytics Dashboard', 'Marketing Campaigns', 'Lead Intake Hub', 'Online Orders', 'Appointment Scheduling', 'OfficeAlly Integration', 'Phone Dialer', 'Fax Center', 'Doctors Directory', 'Patient Portal'] },
          { type: 'tip', text: 'This Knowledge Base itself is feature-toggle aware — sections for disabled features are automatically hidden from the left navigation.' },
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: 'LayoutDashboard',
    feature: null,
    category: 'core',
    description: 'Understanding your metrics and daily snapshot.',
    articles: [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What You See on the Dashboard', text: 'The Dashboard is your daily command center. It shows real-time KPIs across patients, orders, revenue, and lead activity — all at a glance.' },
          { heading: 'Key Metric Cards', bullets: ['Total Patients — cumulative patient records in the system', 'Active Orders — orders currently in processing or fulfillment', 'Patient Requests (Leads) — open intake submissions waiting for follow-up', 'Monthly Revenue — billed amounts for the current calendar month'] },
          { heading: 'Recent Activity Feed', text: 'The activity feed shows the last 20 events across the system — new patients, order status changes, support tickets, and lead submissions. Use this to stay on top of daily workflow without navigating to each module.' },
          { type: 'tip', text: 'Check the Dashboard first thing each morning. Patient Requests that are more than 48 hours old should be prioritized immediately.' },
        ],
      },
    ],
  },
  {
    id: 'patients',
    title: 'Patients',
    icon: 'Users',
    feature: null,
    category: 'core',
    description: 'Managing patient records, insurance, and history.',
    articles: [
      {
        id: 'patients-overview',
        title: 'Patient Management Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What is the Patients Module?', text: 'The Patients module is the central hub for all patient demographic and clinical information. Every order, document, and insurance verification links back to a patient record.' },
          { heading: 'Patient Record Contents', bullets: ['Demographics — name, DOB, address, contact info', 'Insurance — primary and secondary payer details, member ID, group number', 'Diagnosis codes (ICD-10) and prescribing physician', 'Linked orders, documents, and support tickets', 'Audit trail of all changes'] },
        ],
      },
      {
        id: 'add-patient',
        title: 'Adding a New Patient',
        readTime: '2 min',
        sections: [
          { heading: 'Steps to Add a Patient', steps: ['Navigate to Patients in the left sidebar', 'Click the "Add Patient" button (top right)', 'Enter required fields: First/Last Name, Date of Birth, Gender', 'Add insurance information under the Insurance tab', 'Enter the prescribing physician\'s NPI or name', 'Click Save — the patient record is created immediately'] },
          { type: 'tip', text: 'Always verify insurance eligibility immediately after creating a patient record. Use the Insurance Verification module to run a real-time eligibility check.' },
          { heading: 'Required vs. Optional Fields', bullets: ['Required: First name, Last name, Date of birth, Gender', 'Strongly recommended: Primary insurance, ICD-10 diagnosis code, Physician NPI', 'Optional: Secondary insurance, preferred pharmacy, referring physician'] },
        ],
      },
      {
        id: 'insurance-on-patient',
        title: 'Managing Patient Insurance',
        readTime: '3 min',
        sections: [
          { heading: 'Adding Insurance', text: 'Insurance details are entered on the Insurance tab of the patient record. You can add both a primary and secondary payer. For Medicare patients, always use the Medicare Beneficiary Identifier (MBI) — not the legacy HICN.' },
          { heading: 'Medicare vs. Medicaid', bullets: ['Medicare Part B covers most DME — use the patient\'s MBI', 'Medicaid coverage varies by state — verify prior authorization requirements', 'Secondary payers (Medigap, commercial) go in the Secondary Insurance field'] },
          { type: 'warning', text: 'Never bill Medicare for items that are not listed on the Fee Schedule or DMEPOS Competitive Bidding Contract. Verify HCPCS code coverage before creating an order.' },
        ],
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders',
    icon: 'ClipboardList',
    feature: null,
    category: 'core',
    description: 'Creating, fulfilling, and tracking DME orders.',
    articles: [
      {
        id: 'orders-overview',
        title: 'Orders Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What is an Order?', text: 'An order in MediNova represents a DME supply request for a specific patient. Orders track the full lifecycle from creation through delivery and billing.' },
          { heading: 'Order Statuses', bullets: ['Pending — order created, awaiting physician signature or documentation', 'Active — order is confirmed and in fulfillment', 'Completed — items delivered and billing submitted', 'Cancelled — order voided before delivery'] },
        ],
      },
      {
        id: 'create-order',
        title: 'Creating an Order',
        readTime: '4 min',
        sections: [
          { heading: 'Before You Create an Order', bullets: ['Patient record must exist with insurance on file', 'A valid Written Order (prescription) from a physician is required', 'ICD-10 diagnosis codes must be documented', 'For Prior Authorization items — PA must be approved before ordering'] },
          { heading: 'Order Creation Steps', steps: ['Go to Orders and click "New Order"', 'Search for and select the patient', 'Select the HCPCS code(s) for the equipment', 'Enter the prescribing physician\'s NPI', 'Attach the Written Order document', 'Set the delivery date and delivery address', 'Submit for fulfillment'] },
          { type: 'tip', text: 'Check the CMS Prior Authorization list before submitting. Items like Power Wheelchairs (E1390 class), CPAP/BiPAP, and certain orthotics require a PA before delivery or Medicare will deny the claim.' },
          { heading: 'Face-to-Face Requirement', text: 'Many DME items require a Face-to-Face examination by the ordering physician within 6 months before the order. This is documented in the Written Order. Missing F2F documentation is one of the top reasons for Medicare claim denials.' },
        ],
      },
      {
        id: 'order-billing',
        title: 'Billing & Reimbursement',
        readTime: '4 min',
        sections: [
          { heading: 'Medicare Billing Basics', text: 'Medicare Part B DME claims are submitted to one of four regional DME MACs (Medicare Administrative Contractors). Your MAC is determined by the patient\'s state of residence, not your business location.' },
          { heading: 'DME MAC Regions', bullets: ['Jurisdiction A (CGS) — CT, DE, MA, ME, MD, NH, NJ, NY, PA, RI, VT, DC', 'Jurisdiction B (CGS) — IL, IN, KY, MI, MN, OH, WI', 'Jurisdiction C (Noridian) — AK, AZ, CA, HI, ID, MT, NV, ND, OR, SD, WA, WY, Guam, etc.', 'Jurisdiction D (Noridian) — AL, AR, CO, FL, GA, LA, MS, NM, NC, OK, SC, TN, TX, UT, VA, WV'] },
          { heading: 'Common Denial Reasons', bullets: ['Missing or invalid Written Order', 'Face-to-Face examination not documented', 'Prior Authorization not obtained', 'HCPCS code not covered under Competitive Bidding contract', 'Claim submitted past timely filing deadline (1 year from date of service)'] },
          { type: 'warning', text: 'Never deliver equipment before obtaining a valid Written Order. Backdating orders is Medicare fraud and may result in exclusion from the Medicare program.' },
        ],
      },
    ],
  },
  {
    id: 'leads',
    title: 'Patient Requests',
    icon: 'UserPlus',
    feature: null,
    category: 'core',
    description: 'Managing inbound patient intake requests.',
    articles: [
      {
        id: 'leads-overview',
        title: 'Patient Requests Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What are Patient Requests?', text: 'Patient Requests (leads) are inbound inquiries from patients or referral sources who need DME equipment. They arrive via your public intake form and are routed into the system for follow-up.' },
          { heading: 'Lead Workflow', steps: ['Request received — appears in Patient Requests list', 'Assign to a sales rep', 'Contact patient, verify insurance eligibility', 'Convert to a full patient record', 'Create an order once documentation is complete'] },
          { type: 'tip', text: 'Respond to all new leads within 24 hours. DME referrals are time-sensitive — patients often contact multiple suppliers simultaneously.' },
        ],
      },
      {
        id: 'lead-actions',
        title: 'Working a Lead',
        readTime: '3 min',
        sections: [
          { heading: 'Key Lead Actions', bullets: ['View — see all submitted patient information and equipment request', 'Assign — assign lead to a specific sales rep or team member', 'Print — print the intake form for fax or physical file', 'Fax — fax the intake summary directly to a physician office', 'Convert — create a full patient record from the lead', 'Archive — mark as inactive if not qualified'] },
          { heading: 'Faxing a Lead', steps: ['Open the lead record', 'Click the Fax button', 'Enter the destination fax number (typically physician office)', 'Confirm and send — transmission confirmation is logged automatically'] },
        ],
      },
    ],
  },
  {
    id: 'support-tickets',
    title: 'Support Tickets',
    icon: 'Ticket',
    feature: null,
    category: 'core',
    description: 'Creating and managing internal support cases.',
    articles: [
      {
        id: 'tickets-overview',
        title: 'Support Tickets Overview',
        readTime: '2 min',
        sections: [
          { heading: 'What are Support Tickets?', text: 'Support Tickets track internal issues, patient complaints, equipment problems, or billing disputes that require follow-up and resolution.' },
          { heading: 'Ticket Statuses', bullets: ['Open — ticket is active and awaiting resolution', 'In Progress — assigned and actively being worked', 'Resolved — issue resolved, pending confirmation', 'Closed — fully resolved and archived'] },
          { heading: 'Creating a Ticket', steps: ['Go to Support Tickets', 'Click "New Ticket"', 'Enter a clear title and description of the issue', 'Select priority (Low / Medium / High / Critical)', 'Link to a patient record if applicable', 'Assign to the appropriate team member', 'Click Submit'] },
        ],
      },
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    icon: 'FileText',
    feature: null,
    category: 'core',
    description: 'Uploading, organizing, and sharing patient documents.',
    articles: [
      {
        id: 'documents-overview',
        title: 'Document Management Overview',
        readTime: '3 min',
        sections: [
          { heading: 'Document Types in DME', bullets: ['Written Orders / Prescriptions — required for every DME order', 'Certificate of Medical Necessity (CMN) — required for certain items', 'Prior Authorization approvals', 'Delivery Tickets — proof of delivery signed by patient', 'Insurance Cards / EOBs', 'ABN (Advance Beneficiary Notice) — required when Medicare may deny'] },
          { heading: 'Uploading Documents', steps: ['Navigate to Documents or open a patient record', 'Click "Upload Document"', 'Select the file (PDF, JPG, PNG supported)', 'Select document type from the dropdown', 'Link to a patient and/or order if applicable', 'Click Save'] },
          { type: 'warning', text: 'Keep all Written Orders and CMNs on file for a minimum of 7 years. Medicare audits can go back 3 years, and OIG investigations have no statute of limitations for fraud.' },
          { heading: 'ABN Requirements', text: 'An Advance Beneficiary Notice (ABN) must be given to patients BEFORE delivering any item that Medicare may deny. If Medicare denies and no ABN was signed, you cannot bill the patient. The ABN must be specific — it cannot be a blanket form.' },
        ],
      },
    ],
  },
  {
    id: 'compliance',
    title: 'CMS Compliance & Updates',
    icon: 'Shield',
    feature: null,
    category: 'core',
    description: 'Staying current with CMS rules, regulations, and compliance requirements.',
    articles: [
      {
        id: 'compliance-overview',
        title: 'CMS Compliance Overview',
        readTime: '4 min',
        sections: [
          { heading: 'Why Compliance Matters', text: 'CMS (Centers for Medicare & Medicaid Services) is the primary governing body for DME suppliers who bill Medicare and Medicaid. Failure to comply with CMS rules can result in claim denials, payment recoupment, exclusion from Medicare, and civil monetary penalties.' },
          { heading: 'Key CMS Compliance Areas', bullets: ['DMEPOS Supplier Standards — 30 standards all suppliers must meet at all times', 'Accreditation — must be accredited by a CMS-approved organization (ACHC, CHAP, Joint Commission, BOC)', 'Prior Authorization — required for power wheelchairs, certain respiratory equipment, and other DMEPOS items', 'Competitive Bidding — if operating in a CBA, must have a contract to deliver covered items to Medicare beneficiaries', 'Face-to-Face & Written Orders — documentation must be obtained before delivery', 'RAC Audits — Recovery Audit Contractors can audit claims; maintain complete documentation for all billed items'] },
          { heading: 'Using the Compliance News Feed', steps: ['Navigate to Stay Up To Date in the left menu', 'The CMS Compliance panel on the right shows live updates from the Federal Register', 'Final Rules (red border) require immediate attention — they have effective compliance dates', 'Proposed Rules (amber) are open for public comment — monitor these to prepare', 'Use the search bar with Enter/Go to search any HCPCS code, regulation topic, or CMS program'] },
          { type: 'tip', text: 'Set a calendar reminder to check the compliance panel weekly. Final Rules often have 30-60 day implementation windows. Missing an effective date can result in claim denials that are not retractable.' },
        ],
      },
      {
        id: 'prior-auth',
        title: 'Prior Authorization Requirements',
        readTime: '5 min',
        sections: [
          { heading: 'What Requires Prior Authorization?', text: 'CMS maintains a Master List of items that may require Prior Authorization (PA) before delivery to Medicare beneficiaries. Items are placed on the list based on high improper payment rates. PA is MANDATORY for items on the Required PA list.' },
          { heading: 'Common PA-Required Categories', bullets: ['Power Wheelchairs (Group 2 & 3) — K0856, K0857, K0858, K0860, K0861', 'Pressure Reducing Support Surfaces (Group 2 & 3)', 'Osteogenesis Stimulators', 'Transcutaneous Electrical Nerve Stimulators (TENS)', 'Selected respiratory equipment in certain CBAs'] },
          { heading: 'PA Submission Process', steps: ['Obtain physician Written Order with clinical documentation', 'Complete the appropriate Prior Authorization Request form', 'Submit through the applicable DME MAC portal or clearinghouse', 'Wait for determination (typically 10 business days)', 'Document the PA approval number on the order and claim', 'Deliver item only after PA is approved'] },
          { type: 'warning', text: 'Do NOT deliver PA-required equipment before receiving an approved PA. Medicare will deny 100% of claims for required PA items delivered without prior approval, and you cannot bill the patient.' },
        ],
      },
    ],
  },
  {
    id: 'stay-up-to-date',
    title: 'Stay Up To Date',
    icon: 'Newspaper',
    feature: null,
    category: 'core',
    description: 'Healthcare resources, Medicare data, and CMS news.',
    articles: [
      {
        id: 'stay-overview',
        title: 'Stay Up To Date Overview',
        readTime: '2 min',
        sections: [
          { heading: 'What\'s in This Section?', bullets: ['HealthCare.gov Articles — educational insurance and coverage content', 'HealthCare.gov Glossary — definitions of healthcare terms', 'CMS Medicare Data — DME supplier and referring provider lookup tables', 'CMS Compliance News Panel — live feed of CMS regulatory updates'] },
          { heading: 'CMS Compliance News Panel', text: 'The right-side panel pulls live data from the Federal Register and displays the latest CMS rules, proposed rules, and notices relevant to DME suppliers. Articles are sorted by priority — Final Rules first, then Proposed Rules, then Notices.' },
          { heading: 'Deep Search', text: 'Type any keyword in the search box and press Enter (or click Go) to run a live search against the Federal Register. You can search by HCPCS code (e.g., "E1390"), topic ("competitive bidding"), or regulation ("prior authorization 2026").' },
        ],
      },
    ],
  },

  // ── FEATURE-GATED SECTIONS ─────────────────────────────────────────────────

  {
    id: 'telehealth',
    title: 'Telehealth',
    icon: 'Video',
    feature: 'video_conferencing',
    category: 'features',
    description: 'Conducting secure video telehealth visits with patients.',
    articles: [
      {
        id: 'telehealth-overview',
        title: 'Telehealth Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What is the Telehealth Module?', text: 'The Telehealth module enables secure, browser-based video consultations between providers and patients using WebRTC technology. No external software or download is required — patients join via a simple meeting link.' },
          { heading: 'Who Can Use Telehealth?', bullets: ['Create meetings: Admin, Super Admin, Sales Rep, Sales Manager, Doctor', 'Join meetings: Anyone with a valid meeting link (including patients)'] },
          { heading: 'Gemini Clinical Assistant', text: 'During a telehealth session, providers can use the AI Diagnostic panel powered by Gemini. Enter patient symptoms and receive clinical insights and potential differential diagnoses to assist in the consultation.' },
          { type: 'tip', text: 'Telehealth visits for DME qualification require proper documentation. Ensure the physician documents the Face-to-Face encounter in the medical record immediately after the visit.' },
        ],
      },
      {
        id: 'start-meeting',
        title: 'Starting a Telehealth Meeting',
        readTime: '3 min',
        sections: [
          { heading: 'Creating a Meeting', steps: ['Navigate to Telehealth in the left menu', 'Click "New Meeting"', 'Enter a meeting title (e.g., "John Smith - Equipment Evaluation")', 'Click Create', 'Copy the patient join link', 'Send the link to the patient via email, text, or the patient portal'] },
          { heading: 'Joining as Host', steps: ['Open the meeting from the Telehealth list', 'Click "Join as Host"', 'Allow browser camera and microphone permissions when prompted', 'Wait for the patient to connect', 'Use controls at the bottom: Mute, Camera, Screen Share, End Call'] },
          { heading: 'Screen Sharing', text: 'Click the Screen Share button to share your screen or a specific browser tab with the patient. This is useful for showing insurance coverage documents, equipment catalogs, or CMS coverage policies. Click Stop Sharing to return to camera view.' },
          { type: 'warning', text: 'All telehealth visits for Medicare-covered DME must comply with CMS telehealth policies. Ensure you are using compliant platforms and documenting visits in the medical record per your state\'s requirements.' },
        ],
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: 'BarChart3',
    feature: 'analytics_dashboard',
    category: 'features',
    description: 'Business intelligence, revenue trends, and performance metrics.',
    articles: [
      {
        id: 'analytics-overview',
        title: 'Analytics Dashboard Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What Can You Track?', bullets: ['Revenue trends — monthly and quarterly billing totals', 'Order volume — new, active, and completed orders over time', 'Lead conversion rates — how many patient requests become active patients', 'Top equipment categories — which HCPCS codes drive the most revenue', 'Staff performance — orders and leads by assigned team member'] },
          { heading: 'Using Analytics for Compliance', text: 'Analytics can surface compliance risks. A sudden drop in a specific equipment category may indicate a billing denial pattern. Track your claim acceptance rate by HCPCS code to identify documentation gaps before they become audit targets.' },
          { type: 'tip', text: 'Run monthly analytics reviews with your billing team. Compare revenue per HCPCS code to the CMS Fee Schedule to verify you\'re not systematically over or under-billing.' },
        ],
      },
    ],
  },
  {
    id: 'campaigns',
    title: 'Marketing Campaigns',
    icon: 'Megaphone',
    feature: 'marketing_campaigns',
    category: 'features',
    description: 'Email and outreach campaigns to patients and referral sources.',
    articles: [
      {
        id: 'campaigns-overview',
        title: 'Marketing Campaigns Overview',
        readTime: '2 min',
        sections: [
          { heading: 'Campaign Types', bullets: ['Patient re-engagement — reach out to patients with expiring equipment or upcoming recertifications', 'Referral source outreach — target physician offices and case managers who refer patients', 'Educational newsletters — keep your patient base informed about coverage changes'] },
          { heading: 'Creating a Campaign', steps: ['Navigate to Campaigns', 'Click "New Campaign"', 'Select campaign type and target audience', 'Compose your message', 'Schedule or send immediately'] },
          { type: 'warning', text: 'All marketing to Medicare beneficiaries must comply with CMS marketing guidelines. You cannot offer gifts, free items, or other inducements to beneficiaries. Violations can result in OIG exclusion.' },
        ],
      },
    ],
  },
  {
    id: 'lead-intake',
    title: 'Lead Intake Hub',
    icon: 'Key',
    feature: 'lead_intake_hub',
    category: 'features',
    description: 'Public intake form configuration and lead routing.',
    articles: [
      {
        id: 'lead-intake-overview',
        title: 'Lead Intake Hub Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What is the Lead Intake Hub?', text: 'The Lead Intake Hub manages your public-facing patient intake forms. Patients or their caregivers can complete a DME request form on your website, which routes directly into the Patient Requests queue.' },
          { heading: 'Intake Form Fields', bullets: ['Patient demographics (name, DOB, contact)', 'Equipment requested (described in plain language)', 'Insurance information (payer name, member ID)', 'Physician name and contact', 'Delivery address preference'] },
          { heading: 'Configuring the Intake Form', steps: ['Go to Admin Settings > Lead Intake', 'Enable the intake form for your location page(s)', 'Customize required fields', 'Copy the embed code or direct link', 'Paste into your website or location page'] },
        ],
      },
    ],
  },
  {
    id: 'fax-center',
    title: 'Fax Center',
    icon: 'Phone',
    feature: 'fax_center',
    category: 'features',
    description: 'Sending and receiving faxes directly within the platform.',
    articles: [
      {
        id: 'fax-center-overview',
        title: 'Fax Center Overview',
        readTime: '3 min',
        sections: [
          { heading: 'Why Fax Still Matters in DME', text: 'Fax remains the primary document exchange method in healthcare. Physicians send Written Orders by fax, insurance companies send PA approvals by fax, and DME suppliers fax CMNs and referral requests. The Fax Center lets you send and receive faxes without a physical fax machine.' },
          { heading: 'Sending a Fax', steps: ['Navigate to Fax Center', 'Click "New Fax"', 'Enter the recipient fax number', 'Upload the document to fax (PDF recommended)', 'Add a cover page message (optional)', 'Click Send', 'A transmission confirmation is logged with timestamp'] },
          { heading: 'Common Fax Recipients in DME', bullets: ['Physician offices — to request Written Orders and CMNs', 'Insurance payers — to submit PA requests and supporting documentation', 'DME MAC offices — for billing inquiries and appeals', 'Home Health Agencies — for coordination of care'] },
          { type: 'tip', text: 'Save frequently used physician and payer fax numbers as contacts to speed up future transmissions. Always follow up a fax with a phone call confirmation for time-sensitive documents.' },
        ],
      },
    ],
  },
  {
    id: 'insurance-verify',
    title: 'Insurance Verification',
    icon: 'ShieldCheck',
    feature: ['availity_integration', 'waystar_integration', 'officeally_integration'],
    category: 'features',
    description: 'Real-time eligibility checks via Availity, Waystar, or OfficeAlly.',
    articles: [
      {
        id: 'insurance-verify-overview',
        title: 'Insurance Verification Overview',
        readTime: '4 min',
        sections: [
          { heading: 'Why Verify Insurance?', text: 'Insurance verification before delivering DME is critical to avoid claim denials. You need to confirm: (1) the patient is covered on the date of service, (2) the specific HCPCS code(s) are covered benefits, (3) no prior authorization is required, and (4) any deductibles or co-insurance that must be collected.' },
          { heading: 'Available Clearinghouses', bullets: ['Availity — largest healthcare clearinghouse, supports all major payers including Medicare and Medicaid', 'Waystar — enterprise-grade claims management and eligibility platform', 'OfficeAlly — cost-effective option with strong Medicare and commercial payer connectivity'] },
          { heading: 'Running an Eligibility Check', steps: ['Open the patient record', 'Navigate to the Insurance tab', 'Click "Verify Eligibility"', 'Select the service type (DME/Prosthetics)', 'Enter the date of service', 'Submit — results return in seconds', 'Review: active coverage, deductibles met, co-insurance, PA requirements'] },
          { type: 'tip', text: 'Always run eligibility on the specific date of service, not on the order creation date. Patient coverage can change between when an order is created and when equipment is delivered.' },
          { type: 'warning', text: 'Eligibility verification does NOT guarantee payment. It confirms coverage but not medical necessity. Always obtain proper documentation (Written Order, F2F, PA if required) regardless of eligibility results.' },
        ],
      },
    ],
  },
  {
    id: 'doctors',
    title: 'Doctors Directory',
    icon: 'Stethoscope',
    feature: 'doctors_directory',
    category: 'features',
    description: 'Managing physician contacts and NPI lookups.',
    articles: [
      {
        id: 'doctors-overview',
        title: 'Doctors Directory Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What is the Doctors Directory?', text: 'The Doctors Directory maintains a searchable database of referring and prescribing physicians. Each doctor record includes their NPI, specialty, contact information, and fax number for ordering.' },
          { heading: 'NPI Lookup', text: 'Use the built-in NPI search to look up any physician by name, NPI number, or location. Data is sourced from the NPPES (National Plan and Provider Enumeration System) maintained by CMS.' },
          { heading: 'Why Physician Records Matter', bullets: ['Medicare requires the ordering physician\'s NPI on all DME claims', 'Non-participating physicians or those excluded from Medicare cannot sign DME orders', 'Having accurate fax numbers speeds up the Written Order request process'] },
          { heading: 'Adding a Doctor', steps: ['Go to Doctors Directory', 'Click "Add Doctor" or use "Import from NPI"', 'Enter NPI — the system auto-populates name, specialty, and address', 'Add direct fax number and preferred contact method', 'Save to directory'] },
          { type: 'tip', text: 'Check the OIG Exclusion List before accepting orders from a physician. If the physician is excluded from Medicare, any claims based on their orders will be denied and may be considered fraudulent.' },
        ],
      },
    ],
  },
  {
    id: 'communication',
    title: 'Communication Hub',
    icon: 'PhoneCall',
    feature: 'phone_dialer',
    category: 'features',
    description: 'Integrated phone calls, SMS, and communication history.',
    articles: [
      {
        id: 'comm-overview',
        title: 'Communication Hub Overview',
        readTime: '3 min',
        sections: [
          { heading: 'What is the Communication Hub?', text: 'The Communication Hub integrates phone calling and SMS into the platform via Telnyx. Make and receive calls, send texts to patients, and view full communication history — all without leaving MediNova.' },
          { heading: 'Making a Call', steps: ['Click the Phone icon in the sidebar footer to open the dialer', 'Enter or search for a patient/contact phone number', 'Click Call — a browser-based phone call connects immediately', 'All calls are logged to the patient record automatically'] },
          { heading: 'Sending SMS', steps: ['Open a patient record', 'Click the SMS button next to their phone number', 'Type your message', 'Send — delivery confirmation is shown in the conversation thread'] },
          { type: 'warning', text: 'HIPAA requires that any SMS or call containing PHI (Protected Health Information) be conducted securely. Never leave voicemails containing specific diagnosis or insurance details. Always get patient consent for text communications.' },
        ],
      },
    ],
  },

  // ── ADMIN SECTION ─────────────────────────────────────────────────────────

  {
    id: 'admin',
    title: 'Administration',
    icon: 'Settings',
    feature: null,
    category: 'admin',
    description: 'System settings, user management, and configuration.',
    articles: [
      {
        id: 'admin-overview',
        title: 'Administration Overview',
        readTime: '3 min',
        sections: [
          { heading: 'Admin Settings Sections', bullets: ['General — company name, address, logo, contact details', 'Users — invite, edit, and deactivate user accounts', 'Branding — customize colors, logos, and white-label settings', 'Location Pages — manage generated DME location pages for SEO', 'Dev Settings — feature toggles, integration keys, developer tools', 'Chat Monitor — live patient chat management'] },
          { heading: 'Managing Users', steps: ['Go to Admin Settings > Users', 'Click "Invite User"', 'Enter their email and select their role', 'They receive an email invitation to set their password', 'To deactivate: find the user and toggle their status to Inactive'] },
          { heading: 'Branding & White-Label', text: 'Super Admins can customize the platform branding under Admin Settings > Branding. This includes the company logo, accent colors, and display name. These changes affect all users in your organization.' },
        ],
      },
      {
        id: 'location-pages',
        title: 'Location Pages (SEO)',
        readTime: '3 min',
        sections: [
          { heading: 'What are Location Pages?', text: 'Location Pages are auto-generated SEO landing pages for each city or service area your DME business operates in. These pages help patients find you via local search terms like "DME supplier in Houston TX".' },
          { heading: 'Generating a Location Page', steps: ['Go to Admin Settings > Location Pages', 'Click "Generate New Page"', 'Enter the target city, state, and service area', 'The system generates a fully-optimized page with your branding', 'Publish to make it live on your domain'] },
          { heading: 'Product Catalog on Location Pages', text: 'Each location page automatically displays your DME product catalog for that service area. Products are organized by category (Power Wheelchairs, Oxygen, CPAP, Orthotics, etc.) with the appropriate category icons and descriptions.' },
        ],
      },
    ],
  },
];

// ── Helper: flat article search ─────────────────────────────────────────────
export function searchArticles(query, enabledFeatures) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const section of KB_SECTIONS) {
    // Check if section is visible
    if (section.feature) {
      const features = Array.isArray(section.feature) ? section.feature : [section.feature];
      const enabled = features.some(f => enabledFeatures[f]);
      if (!enabled) continue;
    }
    for (const article of section.articles) {
      const titleMatch = article.title.toLowerCase().includes(q);
      const contentText = article.sections
        .map(s => [s.text || '', s.heading || '', ...(s.bullets || []), ...(s.steps || []), s.tip || '', s.warning || ''].join(' '))
        .join(' ')
        .toLowerCase();
      if (titleMatch || contentText.includes(q)) {
        results.push({ article, section, score: titleMatch ? 2 : 1 });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}
