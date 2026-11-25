// The six member benefits (the dial in MemberBenefits), in order; Technology leads.
// Technology is the one area being built now; the other five are marked Coming soon.
// TODO(content): confirm the outcomes with the founders before launch.

export type Vertical = {
  title: string;
  /** Short label for the orbit. */
  label: string;
  status: string;
  promise: string;
  outcomes: readonly string[];
};

export const VERTICALS: readonly Vertical[] = [
  {
    title: 'Technology',
    label: 'Technology',
    status: 'Starting first',
    promise: 'AI tools sorted by the work you do, each reviewed through our process.',
    outcomes: [
      'Find a tool for the job in front of you, from tax research to reporting',
      'Read a security and data-handling note before you try one',
      'Get discounted deals for tools that increase efficiency and optimise workflows',
    ],
  },
  {
    title: 'Reach and visibility',
    label: 'Reach',
    status: 'Coming soon',
    promise: 'Be found and trusted by the people who need your expertise.',
    outcomes: [
      'Publish articles under your own name',
      'A verified profile, enhanced by robust profiling via an AI interview about your work',
      'A relevant match any time a user searches for your specialisation',
    ],
  },
  {
    title: 'Networking',
    label: 'Networking',
    status: 'Coming soon',
    promise: 'Know verified peers in other countries.',
    outcomes: [
      'Get your work referred across borders',
      'Expand your network beyond your four walls',
      'Ideate with people in your focus area',
    ],
  },
  {
    title: 'Training',
    label: 'Training',
    status: 'Coming soon',
    promise: 'Learn AI and optimise your workflows, one step at a time.',
    outcomes: [
      'Develop AI skills with short, digestible videos',
      'Get ready-to-use prompts and plugins',
      'Watch videos to sharpen skills in other focus areas',
    ],
  },
  {
    title: 'Perks and products',
    label: 'Perks',
    status: 'Coming soon',
    promise: 'Member-only products and better pricing.',
    outcomes: [
      'Products only members can access',
      'Better pricing on some tools and services',
      'Every vendor relationship disclosed',
    ],
  },
  {
    title: 'Recruiting',
    label: 'Recruiting',
    status: 'Coming soon',
    promise: 'Extra hands when the busy season hits.',
    outcomes: ['Match with available talent', 'Add capacity for peak periods'],
  },
];

// What a free user account gets (the stack in UserBenefits). Facts are from the FAQ: browsing is
// free, contact details and full articles and events need a free account, members set their own
// availability and fee range, and engagements are agreed directly with the member.
export const USER_BENEFITS: readonly Vertical[] = [
  {
    title: 'Accessibility',
    label: 'Accessibility',
    status: 'Live',
    promise: 'Go straight to a reviewed finance, tax or legal professional.',
    outcomes: [
      'Search by service, specialisation and location',
      'Every expert is vetted by our team before becoming a member',
      'A user account gives access to their full credentials and experience',
    ],
  },
  {
    title: 'Consultations',
    label: 'Consultations',
    status: 'Live',
    promise: 'Take the next step with the expert you found.',
    outcomes: [
      'Request a consultation from their profile',
      'Members show their availability and fee range upfront',
      'You agree terms directly with the expert',
    ],
  },
  {
    title: 'Articles',
    label: 'Articles',
    status: 'Live',
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
    status: 'Live',
    promise: 'Briefings, webinars and conferences in one calendar.',
    outcomes: [
      'Covers online and in-person events, worldwide',
      'Plan your travel in advance',
      'Includes courses and certifications across borders',
    ],
  },
  {
    title: 'Training',
    label: 'Training',
    status: 'Coming soon',
    promise: 'Learn from the practitioners themselves.',
    outcomes: ['Practical sessions from members', 'Short enough to fit between tasks'],
  },
  {
    title: 'Products and tools',
    label: 'Products',
    status: 'Coming soon',
    promise: 'Partner products and tools at preferred rates.',
    outcomes: [
      'Offers open to every user',
      'Some products are for members only',
      'Every vendor relationship disclosed',
    ],
  },
];
