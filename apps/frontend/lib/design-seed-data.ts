// Seed content ported verbatim from design/static_html/assets/members.js
// (window.EXPERTLY_MEMBERS / EXPERTLY_ARTICLES / EXPERTLY_PRACTICE_AREAS).
//
// This is the prototype's own placeholder data, not real backend data — there's no Member
// Directory or Articles-frontend backend wired up yet (see docs/build-prompts.md). Porting it
// literally (rather than inventing new placeholder copy) is what makes the homepage actually
// match design/static_html/index.html, which itself renders from these same arrays. Replace
// with real API calls once the relevant session (build-prompts.md sessions 2, 4-5, 10) lands.

export interface SeedMember {
  id: string;
  name: string;
  initials: string;
  title: string;
  firm: string;
  location: string;
  practice: string;
  verified: boolean;
  img: string;
}

export const SEED_MEMBERS: SeedMember[] = [
  { id: 'mukesh-kumar-m', name: 'Mukesh Kumar M', initials: 'MK', title: 'Co-Founder', firm: 'M2K Advisors', location: 'Chennai, India', practice: 'M&A Tax', verified: true, img: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { id: 'shreyans-maloo', name: 'Shreyans Maloo', initials: 'SM', title: 'Senior Advisor', firm: 'Independent', location: 'Chennai, India', practice: 'Transfer Pricing', verified: true, img: 'https://randomuser.me/api/portraits/men/45.jpg' },
  { id: 'swetha-prasad', name: 'Swetha A', initials: 'SA', title: 'Partner', firm: 'M2K Advisors', location: 'Chennai, India', practice: 'M&A Tax', verified: true, img: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 'priya-venkatesh', name: 'Priya Venkatesh', initials: 'PV', title: 'GST & Indirect Tax Director', firm: 'Venkatesh & Co.', location: 'Hyderabad, India', practice: 'Indirect Tax', verified: true, img: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { id: 'marcus-chen', name: 'Marcus Chen', initials: 'MC', title: 'Senior Tax Advisor', firm: 'Chen Advisory', location: 'Singapore', practice: 'Cross-Border Tax', verified: true, img: 'https://randomuser.me/api/portraits/men/52.jpg' },
  { id: 'amara-osei', name: 'Amara Osei', initials: 'AO', title: 'Corporate Counsel', firm: 'Osei Legal', location: 'Accra, Ghana', practice: 'Corporate Law', verified: true, img: 'https://randomuser.me/api/portraits/women/90.jpg' },
  { id: 'fatima-al-hassan', name: 'Fatima Al-Hassan', initials: 'FA', title: 'Compliance Director', firm: 'Gulf Advisory Partners', location: 'Dubai, UAE', practice: 'Compliance', verified: true, img: 'https://randomuser.me/api/portraits/women/57.jpg' },
  { id: 'james-okafor', name: 'James Okafor', initials: 'JO', title: 'M&A Partner', firm: 'Okafor & Partners', location: 'Lagos, Nigeria', practice: 'M&A', verified: true, img: 'https://randomuser.me/api/portraits/men/76.jpg' },
  { id: 'elena-volkova', name: 'Elena Volkova', initials: 'EV', title: 'IP & Technology Counsel', firm: 'Volkova Law', location: 'London, UK', practice: 'IP & Tech', verified: true, img: 'https://randomuser.me/api/portraits/women/12.jpg' },
  { id: 'diego-martinez', name: 'Diego Martínez', initials: 'DM', title: 'Transfer Pricing Lead', firm: 'Martinez Consultores', location: 'Madrid, Spain', practice: 'Transfer Pricing', verified: true, img: 'https://randomuser.me/api/portraits/men/18.jpg' },
  { id: 'hiroshi-tanaka', name: 'Hiroshi Tanaka', initials: 'HT', title: 'Banking & Finance Partner', firm: 'Tanaka Kawasaki', location: 'Tokyo, Japan', practice: 'Banking & Finance', verified: true, img: 'https://randomuser.me/api/portraits/men/23.jpg' },
  { id: 'nadia-hassan', name: 'Nadia Hassan', initials: 'NH', title: 'Arbitration Counsel', firm: 'Cairo Chambers', location: 'Cairo, Egypt', practice: 'Dispute Resolution', verified: true, img: 'https://randomuser.me/api/portraits/women/29.jpg' },
  { id: 'oliver-schmidt', name: 'Oliver Schmidt', initials: 'OS', title: 'Capital Markets Partner', firm: 'Schmidt Frankfurt', location: 'Frankfurt, Germany', practice: 'Capital Markets', verified: true, img: 'https://randomuser.me/api/portraits/men/41.jpg' },
  { id: 'isabella-rossi', name: 'Isabella Rossi', initials: 'IR', title: 'Restructuring Advisor', firm: 'Rossi Milano', location: 'Milan, Italy', practice: 'Restructuring', verified: true, img: 'https://randomuser.me/api/portraits/women/33.jpg' },
  { id: 'rajiv-menon', name: 'Rajiv Menon', initials: 'RM', title: 'Valuation Expert', firm: 'Menon Partners', location: 'Mumbai, India', practice: 'Valuation', verified: true, img: 'https://randomuser.me/api/portraits/men/61.jpg' },
  { id: 'claire-dubois', name: 'Claire Dubois', initials: 'CD', title: 'Antitrust Counsel', firm: 'Dubois Paris', location: 'Paris, France', practice: 'Antitrust', verified: true, img: 'https://randomuser.me/api/portraits/women/20.jpg' },
  { id: 'ahmed-khoury', name: 'Ahmed Khoury', initials: 'AK', title: 'Private Equity Advisor', firm: 'Khoury Capital', location: 'Beirut, Lebanon', practice: 'Private Equity', verified: true, img: 'https://randomuser.me/api/portraits/men/85.jpg' },
  { id: 'sophie-anderson', name: 'Sophie Anderson', initials: 'SA', title: 'Securities Lawyer', firm: 'Anderson Legal', location: 'New York, USA', practice: 'Securities', verified: true, img: 'https://randomuser.me/api/portraits/women/8.jpg' },
];

export const SEED_PRACTICE_AREAS = [
  { name: 'M&A Tax', count: 47, img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=200&q=70' },
  { name: 'Transfer Pricing', count: 38, img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=200&q=70' },
  { name: 'Corporate Law', count: 62, img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=200&q=70' },
  { name: 'Capital Markets', count: 29, img: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=200&q=70' },
  { name: 'IP & Technology', count: 34, img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=200&q=70' },
  { name: 'Banking & Finance', count: 41, img: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?auto=format&fit=crop&w=200&q=70' },
  { name: 'Dispute Resolution', count: 33, img: 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=200&q=70' },
  { name: 'Private Equity', count: 26, img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=200&q=70' },
  { name: 'Antitrust', count: 18, img: 'https://images.unsplash.com/photo-1593115057322-e94b77572f20?auto=format&fit=crop&w=200&q=70' },
  { name: 'Restructuring', count: 22, img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=200&q=70' },
  { name: 'Indirect Tax', count: 31, img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=200&q=70' },
  { name: 'Compliance', count: 44, img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=200&q=70' },
];

export const SEED_ARTICLES = [
  { id: 'stamp-duty-mergers', title: 'Navigating Stamp Duty on Mergers and Restructuring: A State-by-State Guide', category: 'Direct Tax', readTime: '3 min', date: 'APR 14, 2026', author: 'mukesh-kumar-m', image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=70' },
  { id: 'uae-corporate-tax', title: 'Understanding UAE Corporate Tax: What Companies Need to Know', category: 'Direct Tax', readTime: '3 min', date: 'APR 12, 2026', author: 'fatima-al-hassan', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=70' },
  { id: 'singapore-tax-rebate', title: "Understanding Singapore's Enhanced Corporate Income Tax Rebate for YA 2026", category: 'Corporate Law', readTime: '3 min', date: 'APR 10, 2026', author: 'marcus-chen', image: 'https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=1200&q=70' },
  { id: 'us-tariff-refunds', title: 'Understanding US Tariff Refunds: Insights Post-Supreme Court Ruling', category: 'Indirect Tax', readTime: '3 min', date: 'APR 08, 2026', author: 'sophie-anderson', image: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&w=1200&q=70' },
  { id: 'companies-amendment-bill', title: 'Understanding the Companies Amendment Bill: Key Changes for All Companies', category: 'Corporate Law', readTime: '2 min', date: 'APR 05, 2026', author: 'swetha-prasad', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=70' },
];

export const SEED_EVENTS = [
  { id: 'ipt-sales-tax-school', title: 'IPT 2026 Sales Tax School II', desc: 'Second sales & use tax school, deepening SALT skills.', start: 'APR 20', end: 'APR 24', city: 'Atlanta, GA', country: 'United States', format: 'In Person', category: 'Tax' },
  { id: 'asil-120th', title: 'American Society of International Law 120th Annual Meeting', desc: '120th Annual Meeting with keynotes and substantive panels.', start: 'APR 22', end: 'APR 25', city: 'Washington, DC', country: 'United States', format: 'In Person', category: 'International Law' },
  { id: 'acca-link-up', title: 'ACCA Link Up: Financial Services', desc: 'Sector-specific networking for members in the FS industry.', start: 'APR 22', end: null, city: 'London', country: 'United Kingdom', format: 'In Person', category: 'Networking' },
  { id: 'iba-annual', title: 'IBA Annual Conference 2026', desc: "The world's largest gathering of international lawyers.", start: 'MAY 03', end: 'MAY 07', city: 'Seoul', country: 'South Korea', format: 'In Person', category: 'Legal' },
];

export const SEED_TESTIMONIALS = {
  members: [
    { q: "Expertly gave me access to a calibre of clients I simply couldn't reach anywhere else. Every enquiry is from someone who genuinely values expert advice.", who: 'priya-venkatesh' },
    { q: 'My inbound consultation requests tripled within 60 days of going live. The right clients finally found me.', who: 'marcus-chen' },
    { q: "Publishing articles on Expertly built my professional brand faster than anything else I've tried.", who: 'amara-osei' },
    { q: 'The network events alone justify the membership. Connections that would have taken years to build.', who: 'fatima-al-hassan' },
  ],
  clients: [
    { q: 'We replaced six months of RFPs with one afternoon on Expertly. Found the right M&A counsel in Chennai by Tuesday, signed by Friday.', who: 'oliver-schmidt' },
    { q: 'The rate transparency alone is worth the membership. No surprises, no hourly creep, no mystery partners billing us.', who: 'elena-volkova' },
    { q: "Finally, a network where 'verified' actually means something. Every expert we've engaged delivered on the first conversation.", who: 'claire-dubois' },
  ],
} as const;

// well-known firms (design/static_html/assets/home.js's initFirmsBand) + every unique
// non-independent firm from SEED_MEMBERS.
export const SEED_FIRMS = [
  'Deloitte', 'PwC', 'EY', 'KPMG', 'Baker McKenzie', 'Clifford Chance', 'Linklaters', 'Allen & Overy',
  ...Array.from(new Set(SEED_MEMBERS.map((m) => m.firm).filter((f) => f !== 'Independent'))),
];

export function findMember(id: string): SeedMember | undefined {
  return SEED_MEMBERS.find((m) => m.id === id);
}
