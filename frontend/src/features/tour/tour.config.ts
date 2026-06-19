/**
 * Tour step definitions for the guided first-time user tour.
 *
 * Each section corresponds to a route pattern. TourProvider watches
 * pathname changes and fires the matching section's steps via Driver.js.
 *
 * Steps use `element` (CSS selector via data-tour attribute) for highlighting.
 * When element is null the step shows as a centered modal popover.
 */

export interface TourStep {
  element: string | null;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
  };
}

export interface TourSection {
  key: string;
  /** Human-readable label for the TourProgress checklist. */
  label: string;
  /** Pathname pattern — checked with startsWith or exact match */
  matchPath: (pathname: string) => boolean;
  steps: TourStep[];
}

export const TOUR_SECTIONS: TourSection[] = [
  // ── 1. Workspaces ─────────────────────────────────────────────────────────
  {
    key: 'workspaces',
    label: 'Workspaces',
    matchPath: (p) => p === '/workspaces',
    steps: [
      {
        element: null,
        popover: {
          title: 'Welcome to ORGANIQ 👋',
          description:
            'This short tour walks you through every feature. It takes about 2 minutes and you can skip it at any time.',
        },
      },
      {
        element: '[data-tour="new-workspace-btn"]',
        popover: {
          title: 'Create your first Workspace',
          description:
            'A Workspace represents a client or website. Click "New Workspace" to create one — give it a name and domain.',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  },

  // ── 2. Projects ───────────────────────────────────────────────────────────
  {
    key: 'projects',
    label: 'Projects',
    matchPath: (p) => /^\/workspaces\/[^/]+\/projects$/.test(p),
    steps: [
      {
        element: '[data-tour="new-project-btn"]',
        popover: {
          title: 'Add a Project',
          description:
            'Projects live inside a Workspace. Each project maps to a single domain. Click "New Project" to set one up.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="project-grid"]',
        popover: {
          title: 'Your Projects',
          description:
            'Once created, projects appear here. Click any project card to open it and start running analysis.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 3. Project Overview ───────────────────────────────────────────────────
  {
    key: 'project-overview',
    label: 'Project Overview',
    matchPath: (p) => /\/projects\/[^/]+\/overview$/.test(p),
    steps: [
      {
        element: '[data-tour="business-profile"]',
        popover: {
          title: 'Business Profile',
          description:
            'ORGANIQ automatically analyzes your domain and builds a Business Profile — covering industry, competitors, ICP, and tone of voice. This feeds every downstream feature.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="refresh-card"]',
        popover: {
          title: 'Keep it fresh',
          description:
            'When your website or strategy changes, hit Refresh to re-analyze the business profile. ORGANIQ will suggest when a refresh is due.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 4. Workflow ───────────────────────────────────────────────────────────
  {
    key: 'workflow',
    label: 'Workflow',
    matchPath: (p) => /\/projects\/[^/]+\/workflows$/.test(p),
    steps: [
      {
        element: '[data-tour="start-run-btn"]',
        popover: {
          title: 'Run the AI Workflow',
          description:
            'The Workflow is ORGANIQ\'s 18-step AI pipeline. It runs keyword research, topical mapping, competitor analysis, and content briefing in one click.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="runs-table"]',
        popover: {
          title: 'Run History',
          description:
            'Every run is saved here with its status, credits used, and a full artifact trail. Click any run to inspect every step\'s reasoning and output.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 5. Prompt Visibility ──────────────────────────────────────────────────
  {
    key: 'prompt-visibility',
    label: 'Prompt Visibility',
    matchPath: (p) => /\/ai-search\/visibility$/.test(p),
    steps: [
      {
        element: '[data-tour="add-prompt-btn"]',
        popover: {
          title: 'Track Your Brand in AI Answers',
          description:
            'Add prompts that your customers ask AI engines. ORGANIQ checks daily whether your brand appears in the answer — and how prominently.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="tracked-prompts"]',
        popover: {
          title: 'Visibility Results',
          description:
            'See your brand mention rate, position, and competitor appearances across ChatGPT, Perplexity, Claude, and Gemini.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 6. LLM Traffic ───────────────────────────────────────────────────────
  {
    key: 'llm-traffic',
    label: 'LLM Traffic',
    matchPath: (p) => /\/ai-search\/traffic$/.test(p),
    steps: [
      {
        element: '[data-tour="traffic-chart"]',
        popover: {
          title: 'AI Search Traffic',
          description:
            'See how many sessions originate from AI engines like ChatGPT or Perplexity — broken down by engine, page, and time range.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 7. LLM Audit ─────────────────────────────────────────────────────────
  {
    key: 'llm-audit',
    label: 'LLM Audit',
    matchPath: (p) => /\/ai-search\/llm-audit$/.test(p),
    steps: [
      {
        element: '[data-tour="audit-results"]',
        popover: {
          title: 'LLM Crawlability Audit',
          description:
            'Check how well AI bots can index and cite your pages. Issues found here can suppress your brand from AI answers.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 8. Keywords ───────────────────────────────────────────────────────────
  {
    key: 'keywords',
    label: 'Keywords',
    matchPath: (p) => /\/keywords$/.test(p),
    steps: [
      {
        element: '[data-tour="keywords-table"]',
        popover: {
          title: 'Keyword Ledger',
          description:
            'Every keyword discovered by the Workflow lands here — with volume, difficulty, intent, and funnel stage. Approve keywords to move them into content briefs.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 9. Topical Map ────────────────────────────────────────────────────────
  {
    key: 'topical-map',
    label: 'Topical Map',
    matchPath: (p) => /\/topical-map$/.test(p),
    steps: [
      {
        element: '[data-tour="topical-map"]',
        popover: {
          title: 'Topical Map',
          description:
            'Your content strategy visualized as pillars and clusters. This map is generated by the Workflow and drives your content calendar.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 10. Content / Articles ────────────────────────────────────────────────
  {
    key: 'content',
    label: 'Content',
    matchPath: (p) => /\/content\/articles$/.test(p),
    steps: [
      {
        element: '[data-tour="articles-list"]',
        popover: {
          title: 'Content Pipeline',
          description:
            'Articles generated from your keyword briefs appear here — from Draft through Review, Approved, and Published. Each article includes an SEO score and word count.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 11. Agents ────────────────────────────────────────────────────────────
  {
    key: 'agents',
    label: 'Agents',
    matchPath: (p) => /\/agents$/.test(p),
    steps: [
      {
        element: '[data-tour="agent-chat"]',
        popover: {
          title: 'On-Demand AI Agents',
          description:
            'Ask any SEO or content question and an AI agent answers using your project data — keywords, competitors, business profile, and live GSC metrics.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 12. Analytics ─────────────────────────────────────────────────────────
  {
    key: 'analytics',
    label: 'Analytics',
    matchPath: (p) => /\/analytics$/.test(p),
    steps: [
      {
        element: '[data-tour="gsc-section"]',
        popover: {
          title: 'Google Search Console',
          description:
            'Connect your GSC account to pull real click, impression, and position data directly into ORGANIQ — powering decay alerts and content scoring.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 13. Forums ────────────────────────────────────────────────────────────
  {
    key: 'forums',
    label: 'Forums',
    matchPath: (p) => /\/content\/forums$/.test(p),
    steps: [
      {
        element: '[data-tour="forum-opportunities"]',
        popover: {
          title: 'Forum Opportunities',
          description:
            'ORGANIQ scans Reddit and other forums for questions your brand can answer. Each opportunity shows score, subreddit, and suggested response angle.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },

  // ── 14. Reports ───────────────────────────────────────────────────────────
  {
    key: 'reports',
    label: 'Reports',
    matchPath: (p) => /\/reports$/.test(p),
    steps: [
      {
        element: '[data-tour="reports-list"]',
        popover: {
          title: 'Reports',
          description:
            'Generate and download PDF or HTML reports summarizing workflow runs, keyword performance, and content pipeline status — great for client deliverables.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
];

export const TOUR_STORAGE_KEYS = {
  active: 'pulse_tour_active',
  completed: 'pulse_tour_completed_sections',
  dismissed: 'pulse_tour_dismissed',
} as const;

/** Section keys that map to project-level nav items (used for dot indicators). */
export const PROJECT_NAV_TOUR_SECTIONS = new Set([
  'project-overview',
  'workflow',
  'prompt-visibility',
  'llm-traffic',
  'llm-audit',
  'keywords',
  'topical-map',
  'content',
  'agents',
  'analytics',
  'forums',
  'reports',
]);
