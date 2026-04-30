import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-hero px-8 py-24 text-center">
        <p className="mb-4 inline-flex items-center rounded-pill border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
          SEO · GEO · AEO — Powered by AI
        </p>
        <h1 className="max-w-3xl text-[40px] font-extrabold leading-[1.1] text-white sm:text-[56px]">
          Calibrate Commerce
        </h1>
        <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-white/70">
          Your Organic Visibility Engine — discover content gaps, track traffic loss, and get competitor insights in minutes.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/audit"
            className="inline-flex h-12 items-center rounded-pill bg-[#DA304F] px-8 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
          >
            Get your free audit
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center rounded-pill border border-white/30 bg-white/10 px-8 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            Go to dashboard
          </Link>
        </div>

        {/* Social proof row */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/50">
          {['Ahrefs', 'SerpAPI', 'OpenAI', 'Google PageSpeed'].map((tool) => (
            <span key={tool} className="text-xs font-medium uppercase tracking-widest">{tool}</span>
          ))}
        </div>
      </main>

      {/* Feature strip */}
      <section className="border-t border-[#E8EAF0] bg-white px-8 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            { title: 'Technical SEO', body: 'On-page signals, Core Web Vitals, schema coverage, and crawl health.' },
            { title: 'Content Gap Analysis', body: "Discover what your competitors rank for that you don't yet cover." },
            { title: 'AEO + GEO Readiness', body: 'Optimise for AI engines and local geographic intent signals.' },
          ].map(({ title, body }) => (
            <div key={title}>
              <div className="mb-3 h-1 w-8 rounded-pill bg-[#DA304F]" />
              <h3 className="text-[16px] font-semibold text-[#111827]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
