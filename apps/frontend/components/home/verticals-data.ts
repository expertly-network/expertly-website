// The six member benefits (the dial in MemberBenefits), in order; Technology leads.
// The first three member benefits are live; the remaining three are coming soon.
// TODO(content): confirm the outcomes with the founders before launch.

export type Vertical = {
  title: string;
  /** Short label for the orbit. */
  label: string;
  status: 'Live' | 'Coming soon';
  /** One-line headline. The user benefits show it; the member dial deliberately doesn't. */
  promise?: string;
  outcomes: readonly string[];
  /** Two paragraphs the member dial shows in place of the outcomes checklist. */
  description?: readonly [string, string];
  /** Phones: a two-line version of `description`, written short rather than clamped. */
  summary?: string;
};

export const VERTICALS: readonly Vertical[] = [
  {
    title: 'Technology',
    label: 'Technology',
    status: 'Live',
    summary: 'The right tools, each with a security note and member discounts.',
    description: [
      'Find the right tool for the job in front of you, from tax research to reporting. Every tool comes with a plain-language note on security and data handling, so you know exactly what you are signing up for before you try it.',
      'As a member, you can also get discounted deals on tools that make your practice more efficient and your workflows simpler. Choose what fits the work you do every day.',
    ],
    outcomes: [
      'Find a tool for the job in front of you, from tax research to reporting',
      'Read a security and data-handling note before you try one',
      'Get discounted deals for tools that increase efficiency and optimise workflows',
    ],
  },
  {
    title: 'Reach and visibility',
    label: 'Reach',
    status: 'Live',
    summary: 'Publish under your name and appear in searches for your field.',
    description: [
      'Publish articles under your own name and build a body of work that clients can read. Your verified profile is deepened by a short AI interview about your work, so it reflects what you actually do, not just a job title.',
      'When someone searches for your specialisation, your profile can appear as a relevant match. Your articles give them a clearer picture of your work before they reach out.',
    ],
    outcomes: [
      'Publish articles under your own name',
      'A verified profile, enhanced by robust profiling via an AI interview about your work',
      'A relevant match any time a user searches for your specialisation',
    ],
  },
  {
    title: 'Networking',
    label: 'Networking',
    status: 'Live',
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
    title: 'Training',
    label: 'Training',
    status: 'Coming soon',
    summary: 'Short AI videos with ready-to-use prompts and plugins.',
    description: [
      'Build your AI skills with short, digestible videos you can watch between client work. Each one comes with ready-to-use prompts and plugins, so you can take an idea from a lesson and try it in your practice.',
      'Beyond AI, you can sharpen your skills in other focus areas too. The videos are made for practitioners who want to keep learning alongside their client work.',
    ],
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
    summary: 'Member-only products, better pricing, every vendor disclosed.',
    description: [
      'Get access to products that only members can use, and better pricing on selected tools and services. Every vendor relationship is disclosed, so you always know who we work with and why an offer is in front of you.',
      'That way you can judge every perk on its merits, not on who is behind it. Consider whether an offer suits your practice, and decide for yourself if it is worth using.',
    ],
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
    summary: 'Match with available talent and add capacity for peak periods.',
    description: [
      'Match with available talent when your practice needs more hands. Add capacity for peak periods, from filing season to a large transaction, without committing to a permanent hire every time work gets busy.',
      'Find people who already understand the work, so the extra capacity is useful from the first day rather than after weeks of onboarding. Get support when work calls for it.',
    ],
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
