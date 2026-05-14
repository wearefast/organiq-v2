import Link from 'next/link';
import { Search, Key, FileText, Users, ArrowRight } from 'lucide-react';

const STEPS = [
  { num: '01', title: 'Submit your URL', desc: 'Tell us your domain and a sentence about your business.' },
  { num: '02', title: 'AI runs 15-step analysis', desc: 'Crawl, score, gap-analyse, profile, cluster — fully automated.' },
  { num: '03', title: 'Get your audit report', desc: 'A premium, shareable report with concrete next steps.' },
];

const FEATURES = [
  { icon: Search, title: 'Audit Engine', desc: 'Crawls, scores and benchmarks your site against direct & organic competitors in minutes.' },
  { icon: Key, title: 'Keyword Research', desc: 'Three-method pipeline: competitor pages, seed expansion, content gap import — with strategist gates.' },
  { icon: FileText, title: 'Content Generation', desc: 'Topical map → brief → article. Every step approval-gated, every output editable.' },
  { icon: Users, title: 'Lead Intelligence', desc: 'Every public audit becomes a qualified lead with full business context attached.' },
];

const TESTIMONIALS = [
  { quote: 'We replaced three tools and a freelancer with Calibrate. The audit alone closes deals.', name: 'Priya Patel', role: 'Founder, Lumen Studio', initials: 'PP' },
  { quote: "The keyword pipeline is the only tool I've used that respects strategist judgment at every step.", name: 'Tom Reilly', role: 'Head of SEO, OrbitFit', initials: 'TR' },
  { quote: 'We push 12 articles a month through Calibrate. Briefs are sharper than what we used to write by hand.', name: 'Jonas Weber', role: 'Marketing Lead, Northstar', initials: 'JW' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">C</span>
            <span className="text-sm font-semibold text-white">Calibrate Commerce</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/#features" className="hidden text-sm text-white/60 transition-colors hover:text-white sm:block">Features</Link>
            <Link href="/#how" className="hidden text-sm text-white/60 transition-colors hover:text-white sm:block">How it works</Link>
            <Link href="/login" className="text-sm text-white/60 transition-colors hover:text-white">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center bg-gradient-hero px-6 pb-24 pt-32 text-center">
        <p className="mb-6 inline-flex items-center rounded-pill border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/70">
          PULSE · THE ORGANIC VISIBILITY ENGINE
        </p>
        <h1 className="max-w-3xl text-[40px] font-extrabold leading-[1.08] text-white sm:text-[56px]">
          Your organic visibility,<br />
          <span className="bg-gradient-to-r from-[#E98395] to-[#DA304F] bg-clip-text text-transparent">engineered</span>
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60">
          A free, deeply personalized SEO, GEO and AEO audit — followed by a full strategist platform for keyword research, topical mapping and content production.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/audit"
            className="inline-flex h-12 items-center gap-2 rounded-pill bg-[#DA304F] px-8 text-sm font-semibold text-white shadow-lg shadow-[#DA304F]/25 transition-all hover:shadow-xl hover:shadow-[#DA304F]/30 hover:brightness-110"
          >
            Get your free audit
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-pill border border-white/20 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            See the platform
          </Link>
        </div>
        <p className="mt-5 text-xs text-white/35">Free · No credit card · Results in 2 minutes</p>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-zinc-800 bg-zinc-950 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-[28px] font-bold text-zinc-100">From URL to roadmap in three steps</h2>
          <p className="mt-3 text-center text-sm text-zinc-400">No setup, no integrations. Just paste your domain.</p>
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-lg font-bold text-[#DA304F]">
                  {num}
                </div>
                <h3 className="text-[15px] font-semibold text-zinc-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-zinc-900 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-[28px] font-bold text-zinc-100">Everything a modern SEO team needs</h2>
          <p className="mt-3 text-center text-sm text-zinc-400">A connected workflow — from discovery to publication.</p>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 transition-colors hover:border-zinc-700">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                  <Icon className="h-5 w-5 text-[#DA304F]" />
                </div>
                <h3 className="text-[15px] font-semibold text-zinc-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-zinc-800 bg-zinc-950 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-[28px] font-bold text-zinc-100">Trusted by growth teams</h2>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role, initials }) => (
              <div key={name} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm leading-relaxed text-zinc-400">&ldquo;{quote}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-200">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{name}</p>
                    <p className="text-xs text-zinc-500">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-zinc-900 px-6 py-20 text-center">
        <h2 className="text-[28px] font-bold text-white">See where you actually stand. In 2 minutes.</h2>
        <p className="mt-3 text-sm text-white/50">Free, comprehensive, and surprisingly specific.</p>
        <Link
          href="/audit"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-pill bg-[#DA304F] px-8 text-sm font-semibold text-white shadow-lg shadow-[#DA304F]/25 transition-all hover:brightness-110"
        >
          Get your free audit
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-xs text-white/30">No signup required</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-[9px] font-bold text-white">C</span>
            <span className="text-xs text-zinc-500">Calibrate Commerce</span>
          </div>
          <p className="text-xs text-zinc-500">© {new Date().getFullYear()} Calibrate Commerce. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
