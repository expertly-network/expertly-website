// The six member benefits (the dial in MemberBenefits), in order; Technology leads.
// TODO(content): confirm the outcomes with the founders before launch.

export type Vertical = {
  title: string;
  /** Short label for the orbit. */
  label: string;
  /** One-line headline. The user benefits show it; the member dial deliberately doesn't. */
  promise?: string;
  outcomes: readonly string[];
  /** Two paragraphs the member dial shows in place of the outcomes checklist. */
  description?: readonly [string, string];
  /** Phones: a two-line version of `description`, written short rather than clamped. */
  summary?: string;
  /** How GrowXQ delivers this benefit. A channel with `href` is live and links to it; `soon` marks
   *  one not built yet (shown muted, never linked). Live without `href` = live but nothing to open. */
  channels?: readonly Channel[];
  /** A one-line invite with a link (e.g. asking vendors to pitch). Member dial: a second paragraph,
   *  larger screens only. User cards: a line under the points. */
  aside?: { text: string; linkLabel: string; href: string };
};

/** `action: 'search'` opens the site's AI search modal instead of following a link. */
export type Channel = { name: string; href?: string; action?: 'search'; soon?: boolean };

// Shared channel entries, so one channel reads the same under every benefit it serves.
const CH = {
  articles: { name: 'Library', href: '/articles' },
  podcast: { name: 'Podcast', soon: true },
  aiSearch: { name: 'AI search', action: 'search' },
  webinars: { name: 'Webinars', soon: true },
  newsletter: { name: 'Newsletter', href: '#newsletter' },
  members: { name: 'Member directory', href: '/members' },
  peerConnect: { name: 'Peer connect', soon: true },
  consultations: { name: 'Consultations', href: '/consultations' },
  events: { name: 'Events', href: '/events' },
  learnings: { name: 'AI learnings', href: '/learnings' },
  infrastructure: { name: 'AI infrastructure', soon: true },
  tools: { name: 'Tools', href: '/perks' },
  talent: { name: 'Talent', soon: true },
} satisfies Record<string, Channel>;

export const VERTICALS: readonly Vertical[] = [
  {
    title: 'Technology',
    label: 'Technology',
    channels: [CH.learnings, CH.webinars, CH.infrastructure],
    summary: 'AI for faster day-to-day work in your practice, plus space to experiment.',
    description: [
      'Make your day-to-day work faster with AI built around your practice area. Learn to automate routine tasks and optimise your workflows through short videos, recorded sessions, webinars, live seminars and one-to-one consultations.',
      'AI learnings focus on the work you do every day in your field, so each lesson saves you time you can feel. AI infrastructure gives you a hands-on space to test tools and workflows before you commit.',
    ],
    outcomes: [
      'Automate routine tasks and optimise workflows in your practice area',
      'Learn through videos, webinars, live seminars and one-to-one consultations',
      'Experiment on AI infrastructure we provide',
    ],
  },
  {
    title: 'Reach and visibility',
    label: 'Reach',
    channels: [CH.articles, CH.podcast, CH.aiSearch, CH.webinars, CH.members],
    summary: 'Share your thinking, show client testimonials, and get found.',
    description: [
      'Be visible to the clients who need you. Share your expertise through articles and podcasts, keep your client testimonials up to date on your verified profile, and show up in AI search when someone looks for your specialisation.',
      'Your verified profile is deepened by a short AI interview about your work, so it reflects what you actually do, not just a job title. Your articles and testimonials give clients a clearer picture of your work before they reach out.',
    ],
    outcomes: [
      'Share your expertise through articles and podcasts',
      'Keep client testimonials up to date on your verified profile',
      'Show up in AI search for your specialisation',
    ],
  },
  {
    title: 'Networking',
    label: 'Networking',
    channels: [CH.peerConnect, CH.consultations, CH.events],
    summary: 'Cross-border referrals and peers in your focus area.',
    description: [
      'Get your work referred across borders, by peers who know what you do. Grow your network beyond the four walls of your own firm, with professionals who share your standards and understand where your expertise fits.',
      'When you want a sounding board, ideate with people in your focus area who understand the problems you are solving. Connect with peers beyond your usual circle.',
    ],
    outcomes: [
      'Get your work referred across borders',
      'Expand your network beyond your four walls',
      'Ideate with people in your focus area',
    ],
  },
  {
    title: 'Learning',
    label: 'Learning',
    channels: [CH.articles, CH.podcast, CH.webinars, CH.newsletter],
    summary: 'Articles, podcasts, webinars and a newsletter to keep you sharp.',
    description: [
      'Stay ahead in your practice area without losing billable hours. Catch up on rule changes, new approaches and what peers are seeing through articles, podcasts, webinars led by practitioners, and a newsletter that brings what matters to your inbox.',
      'Learning here is built around the work you already do, so it fits alongside your client work rather than competing with it.',
    ],
    outcomes: [
      'Catch up on rule changes and new approaches in your practice area',
      'Read articles, join webinars led by practitioners and listen to podcasts',
      'Get what matters in your inbox with the newsletter',
    ],
  },
  {
    title: 'Curated tools',
    label: 'Tools',
    channels: [CH.tools],
    aside: {
      text: 'Building a tool for professionals?',
      linkLabel: 'Pitch it to us',
      href: 'mailto:ask@growxq.com?subject=Tool%20pitch',
    },
    summary: 'Hand-picked tools at better prices, for faster day-to-day work.',
    description: [
      'Work smarter with tools hand-picked for your practice, at better prices than you would get alone. Each one is chosen to make your day-to-day work faster and more efficient.',
      'Every vendor relationship is disclosed, so you can judge each tool on its merits and decide for yourself whether it suits your practice.',
    ],
    outcomes: [
      'Access curated tools for your practice',
      'Better pricing on selected tools',
      'Improve your day-to-day productivity and efficiency',
    ],
  },
  {
    title: 'Talent',
    label: 'Talent',
    channels: [CH.talent],
    summary: 'Finding the right talent is hard. We are working to bridge that gap.',
    description: [
      'Finding the right talent is one of the hardest challenges practising professionals face today. GrowXQ is working to bridge that gap, connecting you with people who already understand the work.',
      'From filing season to a large transaction, get support that is useful from the first day rather than after weeks of onboarding.',
    ],
    outcomes: ['Find people who already understand the work', 'Add capacity for peak periods'],
  },
];

// What a free user account gets (the stack in UserBenefits). Facts are from the FAQ: browsing is
// free, contact details and full articles and events need a free account, members set their own
// availability and fee range, and engagements are agreed directly with the member.
export const USER_BENEFITS: readonly Vertical[] = [
  {
    title: 'Verified experts',
    label: 'Verified experts',
    promise: 'Go straight to a verified finance, tax or legal professional.',
    outcomes: [
      'Search by service, specialisation and location',
      'Every expert is vetted by our team before becoming a member',
      'A user account gives access to their full credentials and experience',
    ],
  },
  {
    title: 'Consultations',
    label: 'Consultations',
    promise: 'Take the next step with the expert you found.',
    outcomes: [
      'Request a consultation from their profile',
      'Members show their availability and fee range upfront',
      'GrowXQ takes zero cut: you agree terms directly with the expert',
    ],
  },
  {
    title: 'Library',
    label: 'Library',
    promise: 'Read how practitioners think.',
    outcomes: [
      'Get expertise-focused articles: M&A, finance, TP and much more',
      'Find relevant answers to your questions',
      'Headlines are for everyone; only users get to read them in full',
    ],
  },
  {
    title: 'Events',
    label: 'Events',
    promise: 'Briefings, webinars and conferences in one calendar.',
    outcomes: [
      'Covers online and in-person events, worldwide',
      'Plan your travel in advance',
      'Includes courses and certifications across borders',
    ],
  },
  {
    title: 'Technology',
    label: 'Technology',
    promise: 'Keep yourself upgraded with the latest technology.',
    outcomes: [
      'Learn practical technology through short videos',
      'Join webinars as they launch',
      'Keep your skills current, at your own pace',
    ],
  },
  {
    title: 'Products and tools',
    label: 'Products',
    promise: 'Partner products and tools at preferred rates.',
    outcomes: ['Offers open to every user', 'Some products are for members only'],
    aside: {
      text: 'Have a product for professionals?',
      linkLabel: 'Pitch it to us',
      href: 'mailto:ask@growxq.com?subject=Tool%20pitch',
    },
  },
];
