const CITIES = [
  'London', 'New York', 'Singapore',
  'Dubai', 'Chennai', 'Frankfurt',
  'Tokyo', 'Paris', 'Lagos',
  'Madrid', 'Milan', 'Mumbai',
];

// Desktop-only (>=1000px, matching auth.css's breakpoint) — hidden entirely on
// smaller viewports, same as the mockup.
export function AuthRightPanel() {
  return (
    <aside className="relative hidden items-center overflow-hidden bg-ink p-12 text-bg min-[1000px]:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse at top right, color-mix(in oklab, var(--accent) 35%, transparent), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative max-w-[520px]">
        <span className="text-eyebrow text-white/60">Trusted by professionals in</span>

        <div className="mb-12 mt-6 grid grid-cols-3 gap-x-6 gap-y-2.5 font-mono text-[11px] tracking-[0.14em] text-white/50">
          {CITIES.map((city) => (
            <div key={city}>{city}</div>
          ))}
        </div>

        <div className="my-12 border-y border-white/[0.12] py-8">
          <blockquote className="mb-6 text-[22px] font-normal leading-[1.35] tracking-[-0.015em] text-white">
            &ldquo;The right clients finally found me. Expertly tripled my inbound in 60
            days.&rdquo;
          </blockquote>
          <figcaption className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">
              MC
            </div>
            <div>
              <div className="font-medium text-white">Marcus Chen</div>
              <div className="font-mono text-[10px] text-white/55">
                Senior Tax Advisor · Singapore
              </div>
            </div>
          </figcaption>
        </div>

        <div className="flex gap-8">
          <div>
            <b className="block text-stat text-white">20+</b>
            <span className="text-[10px] capitalize tracking-[0.1em] text-white/50">
              Verified experts
            </span>
          </div>
          <div>
            <b className="block text-stat text-white">20+</b>
            <span className="text-[10px] capitalize tracking-[0.1em] text-white/50">
              Countries
            </span>
          </div>
          <div>
            <b className="block text-stat text-white">100+</b>
            <span className="text-[10px] capitalize tracking-[0.1em] text-white/50">
              Consultations
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
