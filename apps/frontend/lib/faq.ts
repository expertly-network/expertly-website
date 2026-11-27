// The questions on the /faq page, in two groups: joining as a member, and using GrowXQ as a client.

export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQ_MEMBERSHIP: readonly FaqEntry[] = [
  {
    q: 'What is GrowXQ?',
    a: 'GrowXQ is a growth platform for independent practitioners and mid-size firms in finance and tax. It brings together AI tools we review for you, practical training, reach and a global network, so a small practice gets the capability of a big one. Some parts are live today and others are on the way, and each is marked with its status. We disclose every vendor relationship.',
  },
  {
    q: 'Why trust a new platform?',
    a: 'We disclose every vendor relationship. Members decide what gets listed. Nothing is marked live until it is.',
  },
  {
    q: 'What does membership cost?',
    a: 'Membership is a flat $699/year, with zero commission on any work you win. Occasionally, we offer promotional discount codes for new members - keep an eye on our website and social media channels for such offers.',
  },
  {
    q: 'Who can join GrowXQ?',
    a: "GrowXQ is open to practising finance and tax professionals across the world with at least five years of experience (applications below that are not accepted). Law professionals can also apply. Members with 5 to 12 years join as Budding Professionals and those with more than 12 as Seasoned Professionals; our team confirms the tier on the strength of each member's experience and work.",
  },
  {
    q: 'What types of professionals are on GrowXQ?',
    a: 'Members come from tax, M&A, transfer pricing, restructuring and related finance disciplines.',
  },
  {
    q: 'How are members onboarded?',
    a: 'Every member goes through a selection process before being onboarded and listed in the directory. We review professional credentials, years of experience, and areas of specialisation, and take feedback from fellow professionals before granting membership. The process typically takes 5 to 7 business days from application to approval.',
  },
  {
    q: 'How do I apply for membership?',
    a: "Click 'Apply for membership' on our website and complete the application form. We review all applications and notify you by email within 5 business days.",
  },
  {
    q: 'Can I publish articles on GrowXQ?',
    a: 'Yes - members can publish articles through the member portal. Articles are reviewed before going live and becoming visible to the public, helping you build your professional brand and reach a targeted audience of peers and potential clients.',
  },
  {
    q: 'Can firms or organisations join GrowXQ?',
    a: 'Membership on GrowXQ is individual-based, not firm-based. Each professional joins on their own merits, credentials, and experience - independent of the firm or organisation they work for. This means your profile, reputation, articles, and network on GrowXQ belong entirely to you. If you move firms, set up your own practice, or change roles, your membership and everything you have built on the platform stays with you.',
  },
];

export const FAQ_CLIENTS: readonly FaqEntry[] = [
  {
    q: 'Is GrowXQ free to browse?',
    a: "Yes. Anyone can browse the member directory, view article headlines, and view event headlines without signing up. Full contact details of members, consultation requests, and full article and event details require registering a free account as a 'User'.",
  },
  {
    q: 'What is the difference between a User and a Member?',
    a: 'A User is a person who has created a free account on GrowXQ but is not a member. A User can view member contact details, place consultation requests, read full articles, and view all event details - but cannot post a profile or write articles. A Member can create a profile, be searchable on the platform, write articles, and more.',
  },
  {
    q: 'Can I request a consultation with a member?',
    a: 'Yes. Registered users and members can send consultation requests directly to any member. Members set their own availability and fee range - so you will always know exactly what to expect upfront before committing.',
  },
  {
    q: 'What does the Verified badge actually mean?',
    a: "The Verified badge is awarded only to profiles we have manually reviewed and approved. Verification covers professional credentials, qualifications, and years of experience as declared in the member's profile. If any section of a profile does not display the Verified badge, that information is either under review or has not yet been verified by the GrowXQ team.",
  },
  {
    q: 'How does GrowXQ handle complaints or concerns about a member?',
    a: "All members are required to maintain good standing with their respective professional bodies as a condition of membership. If you have a genuine concern about a member's conduct on the platform, you may submit a complaint through the platform and it will be reviewed by the GrowXQ compliance team. We take the integrity of our network seriously and will take appropriate action where warranted.",
  },
  {
    q: 'Are consultations handled on the platform?',
    a: 'No. GrowXQ acts as a discovery and connection directory. Once you connect with an expert, you schedule, agree on terms, and conduct your engagement offline or on your preferred systems directly with the practitioner.',
  },
  {
    q: 'Is my search activity private?',
    a: 'Yes. Your search queries, directory browsing, and page history are completely confidential. Members are never notified when you view their profiles or read their articles unless you choose to contact them directly.',
  },
];
