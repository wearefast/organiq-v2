import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, Search, FileText, Users, BarChart3, Zap, Map,
  TrendingUp, Lightbulb, BookOpen, CheckCircle,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '18', label: 'AI Agents' },
  { value: '4', label: 'Pipeline Phases' },
  { value: '3', label: 'Keyword Methods' },
  { value: '4', label: 'Report Types' },
];

const PHASES = [
  {
    num: 'Phase 1', label: 'Intelligence & Audit',
    color: '#8B5CF6', bg: 'bg-violet-900/20', border: 'border-violet-500/30',
    steps: ['Business Profile & Discovery', 'Seed Keyword Generation', 'GEO + Technical Site Audit',
      'AI Search Intelligence', 'SERP & Niche Landscape Map', 'Competitor Identification',
      'Competitor Gap Analysis', 'Search Demand & Seasonality'],
  },
  {
    num: 'Phase 2', label: 'Keyword Research',
    color: '#3B82F6', bg: 'bg-blue-900/20', border: 'border-blue-500/30',
    steps: ['Client Baseline Consolidation', 'Method 01 — Competitor Pages',
      'Method 02 — Seed Expansion', 'Method 03 — Content Gap Import', 'Consolidated Keyword Taxonomy'],
  },
  {
    num: 'Phase 3', label: 'Strategy & Planning',
    color: '#F59E0B', bg: 'bg-amber-900/20', border: 'border-amber-500/30',
    steps: ['Final Strategy Verdict & Roadmap', 'Topical Map & Content Calendar'],
  },
  {
    num: 'Phase 4', label: 'Content Production',
    color: '#10B981', bg: 'bg-emerald-900/20', border: 'border-emerald-500/30',
    steps: ['SEO-Optimized Content Brief', 'Full Article Draft', 'Image Suggestions & Assets'],
  },
];

const FEATURES = [
  { icon: CheckCircle, title: 'Human-in-the-Loop Approval', tag: 'Control',
    desc: 'Every AI output pauses for your review. Approve, revise, or reject each step before the pipeline continues. No uncontrolled automation.' },
  { icon: Search, title: '3-Method Keyword Research', tag: 'Discovery',
    desc: 'Competitor pages, seed expansion, and content gap import — three independent methods merged into a single scored keyword taxonomy.' },
  { icon: Map, title: 'Topical Map Builder', tag: 'Strategy',
    desc: 'Cluster your keywords into hierarchical pillar–cluster maps with a content calendar aligned to search demand and your business goals.' },
  { icon: FileText, title: 'Brief → Article Pipeline', tag: 'Content',
    desc: 'Generate SEO-optimized briefs from your topical map, then produce full-length articles. Every piece grounded in your keyword data.' },
  { icon: BarChart3, title: 'PDF Strategy Reports', tag: 'Reports',
    desc: 'Auto-generate presentation-ready PDFs — full strategy, AI visibility, keyword research, and content plan reports from your workflow data.' },
  { icon: Zap, title: 'On-Demand AI Agents', tag: 'AI Chat',
    desc: 'Ask anything about your project. AI consultants with full project context give structured recommendations and cite the data they used.' },
];

const REPORT_TYPES = [
  { name: 'Full Strategy Report', desc: 'Complete SEO strategy from discovery through roadmap', color: 'text-violet-400', bg: 'bg-violet-900/20' },
  { name: 'AI Visibility Report', desc: 'GEO, AEO, and AI search citability analysis', color: 'text-blue-400', bg: 'bg-blue-900/20' },
  { name: 'Keyword Research Report', desc: 'Scored keyword taxonomy with search demand data', color: 'text-amber-400', bg: 'bg-amber-900/20' },
  { name: 'Content Plan Report', desc: 'Content calendar with topical map and priorities', color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
];

const INTEGRATIONS = [
  'Ahrefs v3', 'DataForSEO', 'Serper.dev', 'Firecrawl', 'PageSpeed / CrUX',
  'Google Search Console', 'Anthropic Claude', 'OpenAI',
];

const PROBLEMS = [
  'Manually pulling data from 5+ tools just to start a strategy',
  'No structured workflow — every project starts from scratch',
  'Months between keyword research and published content',
  'No AI visibility audit — missing GEO and AEO opportunities',
  'Reporting takes longer than the strategy itself',
  'Losing institutional knowledge when team members change',
];

const FOR_WHO = [
  { role: 'SEO Agencies', icon: Users,
    desc: 'Deliver white-label strategy reports and content plans at scale. Replaces your entire research stack.' },
  { role: 'In-house SEO Teams', icon: TrendingUp,
    desc: 'Accelerate keyword research and content production. Go from brief to article in hours, not weeks.' },
  { role: 'Consultants', icon: Lightbulb,
    desc: 'Produce comprehensive strategy documents in hours. Impress clients with depth and data-backed recommendations.' },
  { role: 'Content Teams', icon: BookOpen,
    desc: 'Generate briefs grounded in keyword data and topical maps. Never write blindly again.' },
];

const TESTIMONIALS = [
  { quote: 'We replaced three tools and a freelancer. The audit alone closes deals.', name: 'Priya Patel', role: 'Founder, Lumen Studio', initials: 'PP' },
  { quote: "The keyword pipeline is the only tool I've used that respects strategist judgment at every step.", name: 'Tom Reilly', role: 'Head of SEO, OrbitFit', initials: 'TR' },
  { quote: 'We push 12 articles a month through ORGANIQ. Briefs are sharper than what we used to write by hand.', name: 'Jonas Weber', role: 'Marketing Lead, Northstar', initials: 'JW' },
];

// ─── Section Components ───────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950 px-6 pb-24 pt-32 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-20">
        <div className="h-[500px] w-[900px] rounded-full bg-[#DA304F]/6 blur-[140px]" />
      </div>
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-8">
          <Image src="/logo-with-text.png" alt="ORGANIQ" width={200} height={44} className="mx-auto" />
        </div>
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#DA304F]" />
          <span className="text-xs text-zinc-400">SEO · GEO · AEO — all in one pipeline</span>
        </div>
        <h1 className="mx-auto max-w-4xl text-[42px] font-extrabold leading-[1.07] tracking-tight text-white sm:text-[60px]">
          Turn any domain into a<br />
          <span className="bg-gradient-to-r from-[#E98395] to-[#DA304F] bg-clip-text text-transparent">
            complete SEO strategy
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-[18px] leading-relaxed text-zinc-400">
          18 specialized AI agents crawl, audit, research, and write — with your approval at every step. From URL to content calendar in hours, not weeks.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/audit" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#DA304F] px-8 text-sm font-semibold text-white shadow-lg shadow-[#DA304F]/25 transition-all hover:brightness-110">
            Get your free audit <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-8 text-sm font-semibold text-white transition-colors hover:bg-zinc-800">
            Sign in to platform
          </Link>
        </div>
        <p className="mt-5 text-xs text-zinc-600">Free · No credit card · Results in 2 minutes</p>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map(({ value, label }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 py-5 text-center">
              <div className="text-3xl font-extrabold text-white">{value}</div>
              <div className="mt-1 text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-950 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#DA304F]">The problem</p>
            <h2 className="text-[28px] font-bold leading-tight text-white sm:text-[34px]">
              Manual SEO strategy is<br />
              <span className="text-zinc-400">slow, fragmented, and expensive</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Most teams cobble together 5+ tools, spend weeks on research, and still miss AI search opportunities. There&apos;s no structured workflow — and every project starts from scratch.
            </p>
          </div>
          <div className="space-y-3">
            {PROBLEMS.map((p) => (
              <div key={p} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-900/40 text-xs font-bold text-red-400">✗</span>
                <span className="text-sm text-zinc-400">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PipelineSection() {
  return (
    <section id="pipeline" className="border-b border-zinc-800 bg-zinc-900 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[#DA304F]">The pipeline</p>
        <h2 className="text-center text-[28px] font-bold text-white sm:text-[34px]">18 agents. 4 phases. Zero gaps.</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-zinc-400">
          Every step is executed by a specialized AI agent using real data from Ahrefs, DataForSEO, and more. You review and approve before moving on.
        </p>
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {PHASES.map(({ num, label, color, bg, border, steps }) => (
            <div key={num} className={`rounded-xl border ${border} ${bg} p-6`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: `${color}22`, color }}>
                  {steps.length}
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{num}</p>
                  <h3 className="text-[14px] font-semibold text-white">{label}</h3>
                </div>
              </div>
              <ul className="space-y-2">
                {steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-2.5 text-sm text-zinc-400">
                    <span className="w-4 flex-shrink-0 text-right text-[10px] font-mono" style={{ color }}>{String(i + 1).padStart(2, '0')}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="border-b border-zinc-800 bg-zinc-950 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[#DA304F]">Platform</p>
        <h2 className="text-center text-[28px] font-bold text-white sm:text-[34px]">Everything your SEO team needs</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-zinc-400">A connected workflow — from discovery to publication, with data at every step.</p>
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, tag }) => (
            <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-700">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                  <Icon className="h-5 w-5 text-[#DA304F]" />
                </div>
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500">{tag}</span>
              </div>
              <h3 className="text-[14px] font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportsSection() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-900 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#DA304F]">Reports</p>
            <h2 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">Presentation-ready PDFs, generated automatically</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Every workflow run produces exportable PDF reports. Share with clients, stakeholders, or your team — no manual formatting required.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REPORT_TYPES.map(({ name, desc, color, bg }) => (
              <div key={name} className={`rounded-xl border border-zinc-800 ${bg} p-5`}>
                <h3 className={`mb-1.5 text-[13px] font-semibold ${color}`}>{name}</h3>
                <p className="text-xs leading-relaxed text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationsSection() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-950 px-6 py-14">
      <div className="mx-auto max-w-5xl text-center">
        <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-zinc-600">Powered by industry-leading data sources</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {INTEGRATIONS.map((name) => (
            <span key={name} className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-400">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForWhoSection() {
  return (
    <section id="for-who" className="border-b border-zinc-800 bg-zinc-900 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[#DA304F]">Built for</p>
        <h2 className="text-center text-[28px] font-bold text-white sm:text-[34px]">Who uses ORGANIQ?</h2>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FOR_WHO.map(({ role, icon: Icon, desc }) => (
            <div key={role} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800">
                <Icon className="h-6 w-6 text-[#DA304F]" />
              </div>
              <h3 className="text-[14px] font-semibold text-zinc-100">{role}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const STEPS = [
    { num: '01', title: 'Submit your URL', desc: 'Tell us your domain and a brief description of your business. No setup, no integrations required.' },
    { num: '02', title: '18 AI agents run the pipeline', desc: 'Crawl, audit, research, and analyze — fully automated using Ahrefs, DataForSEO, Serper, and more.' },
    { num: '03', title: 'Review, approve, and ship', desc: 'Human-in-the-loop at every step. Export PDF reports or push content directly to production.' },
  ];
  return (
    <section id="how" className="border-b border-zinc-800 bg-zinc-950 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[#DA304F]">How it works</p>
        <h2 className="text-center text-[28px] font-bold text-zinc-100 sm:text-[34px]">From URL to roadmap in three steps</h2>
        <p className="mt-3 text-center text-sm text-zinc-400">No setup, no integrations. Just paste your domain.</p>
        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-lg font-bold text-[#DA304F]">{num}</div>
              <h3 className="text-[15px] font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-900 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-[28px] font-bold text-zinc-100">Trusted by growth teams</h2>
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role, initials }) => (
            <div key={name} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
              <p className="text-sm leading-relaxed text-zinc-400">&ldquo;{quote}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-200">{initials}</div>
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
  );
}

function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-zinc-900 px-6 py-24 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[300px] w-[600px] rounded-full bg-[#DA304F]/8 blur-[100px]" />
      </div>
      <div className="relative">
        <h2 className="text-[32px] font-bold text-white sm:text-[40px]">See where you actually stand.</h2>
        <p className="mt-3 text-sm text-zinc-500">Free, comprehensive, and surprisingly specific. In 2 minutes.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/audit" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#DA304F] px-8 text-sm font-semibold text-white shadow-lg shadow-[#DA304F]/25 transition-all hover:brightness-110">
            Get your free audit <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center rounded-full border border-zinc-700 px-8 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800">
            Sign in to platform
          </Link>
        </div>
        <p className="mt-5 text-xs text-zinc-600">No signup required for the free audit</p>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/">
            <Image src="/logo-with-text.png" alt="ORGANIQ" width={120} height={26} />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/#pipeline" className="hidden text-sm text-white/60 transition-colors hover:text-white sm:block">Pipeline</Link>
            <Link href="/#features" className="hidden text-sm text-white/60 transition-colors hover:text-white sm:block">Features</Link>
            <Link href="/#how" className="hidden text-sm text-white/60 transition-colors hover:text-white sm:block">How it works</Link>
            <Link href="/login" className="text-sm text-white/60 transition-colors hover:text-white">Sign in</Link>
            <Link href="/audit" className="hidden h-8 items-center gap-1.5 rounded-full bg-[#DA304F] px-4 text-xs font-semibold text-white hover:brightness-110 sm:inline-flex">
              Free audit <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </nav>

      <HeroSection />
      <ProblemSection />
      <PipelineSection />
      <FeaturesSection />
      <ReportsSection />
      <IntegrationsSection />
      <ForWhoSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CtaSection />

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-[9px] font-bold text-white">O</span>
            <span className="text-xs text-zinc-500">ORGANIQ — SEO · GEO · AEO platform</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <Link href="/audit" className="hover:text-zinc-400">Free Audit</Link>
            <Link href="/login" className="hover:text-zinc-400">Sign In</Link>
            <span>© {new Date().getFullYear()} ORGANIQ</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


