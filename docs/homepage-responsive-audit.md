# Home page responsive audit

Scope: `/` only, including the shared shell where it appears on this route. November 8, 2026.

## Section-by-section review

| Area | Finding and resulting treatment |
| --- | --- |
| Mobile header | The top bar (below 1024px, every page) is dark ink with the light-on-dark logo and a white menu icon, matching the desktop sidebar over the hero. Menu and close targets are 44px on `/`. |
| Hero | Headline wraps evenly (no forced break; `text-wrap: balance`), with the green line kept on its own. Orbit slots without a member photo are small glowing points, and the available photos are spread evenly across the slots. The GrowXQ mark sits at the centre (replacing "20k+ Practitioners"). Phones (CSS-swapped at `sm`, no hydration flash): the full headline as three single-row lines — "The Right Finance, Tax & Law Expert" / "Isn't Out of Reach," / green "They're Already in Our Network." — at `clamp(20px, 6.3vw, 30px)`, and a one-line intro "Search, verify and meet senior practitioners directly." at `clamp(12px, 3.45vw, 15px)`. Desktop keeps the full intro. Orbit ring lines render beneath the member photos. Phones: 24px side gutter with the headline capped at 380px and the intro at 340px so centred text never runs edge to edge; 34–38px headline; CTAs side by side; a larger orbit (0.6× under 400px, 0.66× up to 640px, outer ring ~360–395px wide); the stats row sits below the orbit (label "Experts" in place of "Verified Experts"); from 640px up it sits under the CTAs. Photos ride a zero-sized counter-spin wrapper so they stay exactly on their ring. Reduced-motion visitors receive the completed headline and counters without waiting for animation. |
| Statistics | Kept the requested centered four-column mobile row and existing desktop alignment. |
| Intelligent search | 40px mobile section padding. The three-item checklist is hidden on phones (the demo shows those result types right below), and the demo panel is 320px tall instead of 440px. Retains the real input, illustrative demo, and signed-in search behavior. |
| Floating search | On `/`, appears only after the actual hero has passed, rather than at a fixed 620px scroll position. Adds the mobile label “Ask GrowXQ”; still hides near the footer. Other routes retain their previous behavior. |
| Search dialog | On `/`, provides a visible 44px mobile close control and a 16px input to avoid small-input zoom on phones. Desktop and other routes retain their existing presentation. |
| Member network | Two mobile marquee rows in a full-bleed band, four desktop rows. Re-buckets the full dataset rather than dropping items from hidden rows. Keeps readable portraits and cards. |
| Practice areas | One mobile marquee row (all categories re-bucketed into it) in a full-bleed band. Long labels wrap. Desktop keeps its existing dimensions. |
| Marquee interaction | Pauses while hovered or containing keyboard focus. With reduced motion, stopped rows can be scrolled horizontally to reach the remaining items. |
| Firm strip | One firm appears once as a static tile instead of being repeated sixteen times. Multiple firms use one mobile marquee row and the existing desktop rows. |
| Latest articles | Phones show a news-style list of the newest four (practice area, headline, author · date, 72px cover on the right) with an inline "View all →" on the heading row; the intro paragraph is hidden. Desktop keeps the featured card + numbered list. |
| Events | Phone upcoming-event cards are a swipeable snap row (next card peeks in) with an inline "All events →"; intro paragraph hidden. Desktop calendar unchanged. |
| Testimonials | Native horizontal scroll with snap points, a next-card preview, a swipe hint, and keyboard-focusable region. Audience buttons remain available; changing audience resets the scroll region. Desktop keeps its grid. |
| Two ways in | Phones show the two paths as a swipeable snap row; intro paragraph hidden; tighter lists. Desktop unchanged. |
| Joining steps | Phones show a vertical timeline: numbered accent dots joined by a line, no card chrome. Desktop retains its four-card layout. |
| Newsletter | Tighter mobile card padding, gaps and input height. Preserved stacked controls and dropdown overflow. This remains a non-live signup feature; see content decisions below. |
| FAQ | Mobile audience controls show membership or client questions; each answer remains expandable. Desktop still shows both groups. |
| Footer | Reviewed existing mobile wrapping, smaller logo, and spacing. No layout change needed. |
| Loading and missing data | Existing streamed sections and independent error handling remain. Skeleton spacing follows the shorter mobile section rhythm. |

## Second pass — November 8, 2026

Goal: a lighter, app-like phone page. All home sections use 40px (`py-10`) mobile padding instead of 56px. Page height at 375px went from ~11,150px to ~8,250px. No horizontal overflow at 320 / 375 / 430 / 700px; 1440px layout unchanged. Patterns are documented in `docs/design-system.md` → "Phone-width patterns".

## Validation and limits

- Frontend typecheck and targeted navigation tests pass. Tests cover hero-dependent floating-search visibility, footer hiding, unchanged non-home behavior, and FAQ interaction.
- The local home page responds successfully; responsive markup and generated CSS were checked during this pass and the preceding mobile-layout pass.
- Native Chrome showed the footer and lower FAQ at a 375 × 812 emulated viewport. A complete visual and interaction review was **not** achieved: the browser session changed during review, and the isolated browser connection was unavailable.
- Still required: uninterrupted visual checks of the whole page at 375px and 1440px, plus 320px/430px edge widths; touch swipe, mobile menu, search keyboard/close behavior, newsletter dropdowns, and reduced-motion rendering.
- Changes are local. No deployment or backend/API contract changes were made.

## Content and product decisions left unchanged

- Testimonials are explicitly marked as marketing placeholders in their source. Real approved testimonials are needed before treating them as customer evidence.
- Newsletter submission currently reports that subscriptions are not live. Connecting it or replacing the signup form with a coming-soon message is a separate product decision.
- The hero uses hardcoded statistics (“20+ Verified Experts” etc.; the conflicting “20k+ Practitioners” orbit figure was replaced by the logo mark). The newsletter claims 4,200+ readers (now shown on desktop only). These numbers need confirmation; this layout pass did not invent replacement figures.
- The shared mobile drawer's focus containment and scroll locking merit a separate shell-wide accessibility pass. This change only adjusts home-page tap targets to avoid changing navigation behavior across other routes.

## Files changed in the combined home-page pass

- `apps/frontend/app/(shell)/page.tsx`
- `apps/frontend/components/home/{AiSearchTeaser,CategoriesMarquee,DualCta,EventsTeaser,Faq,FeaturedMembers,FirmsBand,LatestArticles,Marquee,MembershipTiers,MobileViewAll,Newsletter,SearchModal,StellarOrbitHero,Testimonials,UpcomingEvents}.tsx`
- `apps/frontend/components/layout/{Footer,MobileDrawer}.tsx`, `apps/frontend/components/Logo.tsx`
- `docs/design-system.md`
- `apps/frontend/components/home/HomeNavigation.test.tsx`
- `apps/frontend/components/layout/MobileDrawer.tsx`
- `apps/frontend/components/search/FloatingSearch.tsx`

Shared-component presentation changes are conditional on `/`. No shared colour, typography, or radius tokens were changed.
