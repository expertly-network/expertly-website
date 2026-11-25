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
      'See how we review tools and what each listing went through',
    ],
  },
  {
    title: 'Reach and visibility',
    label: 'Reach',
    status: 'Coming soon',
    promise: 'Get found and trusted by the people who need you.',
    outcomes: [
      'Publish articles under your own name',
      'A verified profile, backed by an AI interview about your real work',
      'Content built to be found in search',
    ],
  },
  {
    title: 'Networking',
    label: 'Networking',
    status: 'Coming soon',
    promise: 'Know verified peers in other countries.',
    outcomes: [
      'Refer work across borders',
      'Find overflow help when you are full',
      'Talk to people who do the same work',
    ],
  },
  {
    title: 'Training',
    label: 'Training',
    status: 'Coming soon',
    promise: 'Learn AI and better workflows in small steps.',
    outcomes: ['Short videos you can watch between tasks', 'Ready-to-use prompts', 'Step-by-step guides'],
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
    title: 'Hiring',
    label: 'Hiring',
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
    title: 'Find an expert',
    label: 'Experts',
    status: 'Live',
    promise: 'Go straight to a reviewed finance or tax professional.',
    outcomes: [
      'Search by service, specialisation and location',
      'Every member is reviewed by our team before listing',
      'A free account shows their contact details',
    ],
  },
  {
    title: 'Articles',
    label: 'Articles',
    status: 'Live',
    promise: 'Read how practitioners think, under their own names.',
    outcomes: [
      'Tax, M&A, compliance and more',
      'Written and signed by members',
      'Headlines are open; a free account reads them in full',
    ],
  },
  {
    title: 'Events',
    label: 'Events',
    status: 'Live',
    promise: 'Briefings, webinars and conferences in one calendar.',
    outcomes: ['Online and in person, worldwide', 'Browse by month', 'A free account shows the full details'],
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
