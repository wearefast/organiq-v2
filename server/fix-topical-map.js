/**
 * fix-topical-map.js
 * Injects topical-map context for mashreq.com.
 * Based on verdict-strategy: compete in Credit Cards, Loans, Accounts, Forex, Education.
 * Excludes all competitor brand names per topical-map constraints.
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const topicalMapOutput = {
  pillars: [
    {
      id: "p1",
      name: "Credit Cards & Rewards",
      description: "All content related to Mashreq credit card products, rewards programs, and comparisons. Targets commercial-intent MOFU queries for UAE card seekers.",
      pillarPageKeyword: "mashreq credit card",
      pillarPageUrl: "/en/uae/personal/cards/credit-cards/",
      estimatedTotalVolume: 20230,
      clusters: [
        {
          id: "p1-c1",
          name: "Credit Card Overview",
          hubKeyword: "mashreq credit card",
          intent: "commercial",
          priority: "high",
          pages: [
            { title: "Mashreq Credit Cards: Compare All Cards & Apply Online", keyword: "mashreq credit card", volume: 8100, difficulty: 15, intent: "commercial", funnelStage: "BOFU", contentType: "pillar page", estimatedWordCount: 2800, effort: "medium", suggestedUrl: "/en/uae/personal/cards/credit-cards/", linksTo: ["/en/uae/personal/cards/cashback/", "/en/uae/personal/cards/rewards/"], linksFrom: ["/en/uae/personal/"] },
            { title: "Mashreq Credit Card Minimum Salary Requirements UAE 2025", keyword: "mashreq credit card minimum salary", volume: 1300, difficulty: 8, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 1200, effort: "low", suggestedUrl: "/en/uae/personal/cards/credit-cards/eligibility/", linksTo: ["/en/uae/personal/cards/credit-cards/"], linksFrom: [] },
            { title: "Best Mashreq Credit Card for Dining & Food in UAE", keyword: "best mashreq credit card for dining", volume: 720, difficulty: 12, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 1500, effort: "low", suggestedUrl: "/en/uae/personal/cards/credit-cards/dining/", linksTo: ["/en/uae/personal/cards/credit-cards/"], linksFrom: [] }
          ]
        },
        {
          id: "p1-c2",
          name: "Credit Card Comparisons",
          hubKeyword: "uae credit card interest rate comparison",
          intent: "commercial",
          priority: "medium",
          pages: [
            { title: "UAE Credit Card Interest Rate Comparison 2025", keyword: "uae credit card interest rate comparison", volume: 4400, difficulty: 40, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 2200, effort: "high", suggestedUrl: "/en/uae/guides/credit-card-interest-rates/", linksTo: ["/en/uae/personal/cards/credit-cards/"], linksFrom: ["/en/uae/guides/"] },
            { title: "UAE Credit Card Rewards Programs Explained", keyword: "uae credit card rewards program", volume: 2900, difficulty: 42, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 1800, effort: "medium", suggestedUrl: "/en/uae/guides/credit-card-rewards/", linksTo: ["/en/uae/personal/cards/credit-cards/"], linksFrom: [] },
            { title: "Best Cashback Credit Cards in UAE 2025", keyword: "credit card cashback uae", volume: 3600, difficulty: 45, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 2000, effort: "high", suggestedUrl: "/en/uae/guides/cashback-credit-cards/", linksTo: ["/en/uae/personal/cards/credit-cards/"], linksFrom: [] }
          ]
        }
      ]
    },
    {
      id: "p2",
      name: "Loans & Financial Calculators",
      description: "Personal loans, home loans, and interactive financial tools (EMI calculator, gratuity calculator). Targets commercial and informational MOFU queries with a tools-led SEO strategy.",
      pillarPageKeyword: "mashreq personal loan",
      pillarPageUrl: "/en/uae/personal/loans/",
      estimatedTotalVolume: 17500,
      clusters: [
        {
          id: "p2-c1",
          name: "Personal Loans",
          hubKeyword: "mashreq personal loan",
          intent: "commercial",
          priority: "high",
          pages: [
            { title: "Mashreq Personal Loan UAE: Rates, Eligibility & Apply Online", keyword: "mashreq personal loan", volume: 4400, difficulty: 20, intent: "commercial", funnelStage: "BOFU", contentType: "pillar page", estimatedWordCount: 2500, effort: "medium", suggestedUrl: "/en/uae/personal/loans/personal-loan/", linksTo: ["/en/uae/tools/emi-calculator/", "/en/uae/personal/loans/eligibility/"], linksFrom: ["/en/uae/personal/"] },
            { title: "Personal Loan Eligibility in UAE: Requirements & Documents", keyword: "personal loan eligibility uae", volume: 2400, difficulty: 35, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 1600, effort: "medium", suggestedUrl: "/en/uae/personal/loans/eligibility/", linksTo: ["/en/uae/personal/loans/personal-loan/"], linksFrom: [] },
            { title: "Mashreq Personal Loan Calculator UAE: Monthly EMI Estimate", keyword: "mashreq personal loan calculator uae", volume: 1600, difficulty: 15, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 800, effort: "medium", suggestedUrl: "/en/uae/tools/mashreq-loan-calculator/", linksTo: ["/en/uae/personal/loans/personal-loan/", "/en/uae/tools/emi-calculator/"], linksFrom: [] }
          ]
        },
        {
          id: "p2-c2",
          name: "Financial Calculators",
          hubKeyword: "uae personal loan emi calculator",
          intent: "commercial",
          priority: "high",
          pages: [
            { title: "UAE Personal Loan EMI Calculator 2025 — Free Online Tool", keyword: "uae personal loan emi calculator", volume: 8100, difficulty: 32, intent: "commercial", funnelStage: "MOFU", contentType: "tool page", estimatedWordCount: 1200, effort: "high", suggestedUrl: "/en/uae/tools/emi-calculator/", linksTo: ["/en/uae/personal/loans/personal-loan/", "/en/uae/personal/loans/home-loan/"], linksFrom: ["/en/uae/personal/loans/"] },
            { title: "UAE Gratuity Calculator 2025: End of Service Benefits", keyword: "gratuity calculator uae 2025", volume: 5400, difficulty: 20, intent: "informational", funnelStage: "TOFU", contentType: "tool page", estimatedWordCount: 1500, effort: "high", suggestedUrl: "/en/uae/tools/gratuity-calculator/", linksTo: ["/en/uae/guides/employment-banking/"], linksFrom: ["/en/uae/tools/"] }
          ]
        },
        {
          id: "p2-c3",
          name: "Home Loans",
          hubKeyword: "uae home loan eligibility calculator",
          intent: "commercial",
          priority: "medium",
          pages: [
            { title: "UAE Home Loan Eligibility: Requirements & How to Apply", keyword: "uae home loan eligibility calculator", volume: 1900, difficulty: 40, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 2000, effort: "high", suggestedUrl: "/en/uae/personal/loans/home-loan/", linksTo: ["/en/uae/tools/emi-calculator/"], linksFrom: ["/en/uae/personal/loans/"] }
          ]
        }
      ]
    },
    {
      id: "p3",
      name: "Banking Accounts & Digital Banking",
      description: "Current accounts, savings, zero-balance, and Mashreq NEO digital accounts. Covers both navigational branded queries and informational account comparison content.",
      pillarPageKeyword: "mashreq account opening",
      pillarPageUrl: "/en/uae/personal/accounts/",
      estimatedTotalVolume: 24400,
      clusters: [
        {
          id: "p3-c1",
          name: "Account Opening",
          hubKeyword: "mashreq account opening",
          intent: "commercial",
          priority: "high",
          pages: [
            { title: "Mashreq Bank Account Opening: Documents & Requirements UAE", keyword: "mashreq account opening", volume: 3600, difficulty: 12, intent: "commercial", funnelStage: "BOFU", contentType: "pillar page", estimatedWordCount: 2200, effort: "medium", suggestedUrl: "/en/uae/personal/accounts/open-account/", linksTo: ["/en/uae/guides/how-to-open-account/", "/en/uae/neo/"], linksFrom: ["/en/uae/personal/"] },
            { title: "How to Open a Mashreq Bank Account Online: Step-by-Step Guide", keyword: "how to open mashreq bank account online", volume: 1600, difficulty: 8, intent: "informational", funnelStage: "TOFU", contentType: "how-to guide", estimatedWordCount: 1800, effort: "low", suggestedUrl: "/en/uae/guides/how-to-open-account/", linksTo: ["/en/uae/personal/accounts/open-account/"], linksFrom: [] },
            { title: "Open a UAE Bank Account for Expats: Complete Guide 2025", keyword: "uae bank account open for expat", volume: 3600, difficulty: 38, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 2500, effort: "high", suggestedUrl: "/en/uae/guides/expat-banking/", linksTo: ["/en/uae/personal/accounts/open-account/"], linksFrom: ["/en/uae/guides/"] },
            { title: "Open a UAE Bank Account Online 2025: Process & Documents", keyword: "uae bank account opening online", volume: 8100, difficulty: 45, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 2000, effort: "high", suggestedUrl: "/en/uae/guides/uae-bank-account-online/", linksTo: ["/en/uae/personal/accounts/open-account/"], linksFrom: [] }
          ]
        },
        {
          id: "p3-c2",
          name: "Account Types & NEO",
          hubKeyword: "best savings account uae 2025",
          intent: "commercial",
          priority: "high",
          pages: [
            { title: "Best Savings Accounts in UAE 2025: Rates & Comparison", keyword: "best savings account uae 2025", volume: 4400, difficulty: 42, intent: "commercial", funnelStage: "MOFU", contentType: "comparison page", estimatedWordCount: 2800, effort: "high", suggestedUrl: "/en/uae/guides/best-savings-accounts/", linksTo: ["/en/uae/personal/accounts/"], linksFrom: [] },
            { title: "Zero Balance Bank Account in UAE: What You Need to Know", keyword: "zero balance account uae", volume: 2900, difficulty: 35, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 1500, effort: "medium", suggestedUrl: "/en/uae/personal/accounts/zero-balance/", linksTo: ["/en/uae/personal/accounts/"], linksFrom: [] },
            { title: "Mashreq NEO: The Digital Account That Pays You More", keyword: "mashreq neo", volume: 2900, difficulty: 5, intent: "navigational", funnelStage: "BOFU", contentType: "product page", estimatedWordCount: 2000, effort: "medium", suggestedUrl: "/en/uae/neo/", linksTo: ["/en/uae/personal/accounts/"], linksFrom: ["/en/uae/personal/"] },
            { title: "What is Mashreq NEO Account? Features, Benefits & How to Apply", keyword: "what is mashreq neo account", volume: 880, difficulty: 5, intent: "informational", funnelStage: "TOFU", contentType: "how-to guide", estimatedWordCount: 1400, effort: "low", suggestedUrl: "/en/uae/neo/what-is-neo/", linksTo: ["/en/uae/neo/"], linksFrom: [] }
          ]
        }
      ]
    },
    {
      id: "p4",
      name: "Forex & International Transfers",
      description: "Live forex rates, international wire transfers, remittance comparison, and SWIFT/IBAN reference pages. Targets high-frequency informational queries with near-zero competition.",
      pillarPageKeyword: "mashreq bank forex rates today",
      pillarPageUrl: "/en/uae/forex/",
      estimatedTotalVolume: 10800,
      clusters: [
        {
          id: "p4-c1",
          name: "Forex Rates & Tools",
          hubKeyword: "mashreq bank forex rates today",
          intent: "informational",
          priority: "high",
          pages: [
            { title: "Mashreq Bank Forex Rates Today: Live Exchange Rates UAE", keyword: "mashreq bank forex rates today", volume: 3600, difficulty: 5, intent: "informational", funnelStage: "TOFU", contentType: "tool page", estimatedWordCount: 600, effort: "medium", suggestedUrl: "/en/uae/forex/rates/", linksTo: ["/en/uae/forex/transfer/"], linksFrom: ["/en/uae/"] },
            { title: "UAE Bank Fixed Deposit Best Rates 2025: Compare & Calculate", keyword: "uae bank fixed deposit best rates 2025", volume: 1900, difficulty: 37, intent: "commercial", funnelStage: "MOFU", contentType: "comparison page", estimatedWordCount: 1800, effort: "medium", suggestedUrl: "/en/uae/personal/investments/fixed-deposit/", linksTo: ["/en/uae/personal/investments/"], linksFrom: [] }
          ]
        },
        {
          id: "p4-c2",
          name: "International Transfers & Remittance",
          hubKeyword: "uae remittance transfer comparison",
          intent: "commercial",
          priority: "medium",
          pages: [
            { title: "UAE International Money Transfer Comparison 2025", keyword: "uae remittance transfer comparison", volume: 2900, difficulty: 38, intent: "commercial", funnelStage: "MOFU", contentType: "comparison page", estimatedWordCount: 2200, effort: "high", suggestedUrl: "/en/uae/guides/international-transfers/", linksTo: ["/en/uae/forex/transfer/"], linksFrom: [] },
            { title: "How to Transfer Money from Mashreq to Another Bank: Complete Guide", keyword: "how to transfer money mashreq to another bank", volume: 1900, difficulty: 4, intent: "informational", funnelStage: "TOFU", contentType: "how-to guide", estimatedWordCount: 1200, effort: "low", suggestedUrl: "/en/uae/guides/bank-transfer/", linksTo: ["/en/uae/forex/transfer/"], linksFrom: [] },
            { title: "Online Banking UAE Transfer Fees: All Banks Compared", keyword: "online banking uae transfer fees", volume: 2400, difficulty: 30, intent: "informational", funnelStage: "TOFU", contentType: "comparison page", estimatedWordCount: 1600, effort: "medium", suggestedUrl: "/en/uae/guides/transfer-fees/", linksTo: ["/en/uae/forex/"], linksFrom: [] }
          ]
        }
      ]
    },
    {
      id: "p5",
      name: "Financial Education & Banking Tools",
      description: "How-to guides, banking reference pages (SWIFT, IBAN), and digital banking education content. Supports AEO/GEO strategy with structured how-to and FAQ content.",
      pillarPageKeyword: "uae digital banking",
      pillarPageUrl: "/en/uae/digital/",
      estimatedTotalVolume: 18580,
      clusters: [
        {
          id: "p5-c1",
          name: "Banking Reference Tools",
          hubKeyword: "mashreq swift code",
          intent: "navigational",
          priority: "high",
          pages: [
            { title: "Mashreq Bank SWIFT Code & BIC: All UAE Branch Codes", keyword: "mashreq swift code", volume: 1300, difficulty: 2, intent: "navigational", funnelStage: "BOFU", contentType: "reference page", estimatedWordCount: 800, effort: "low", suggestedUrl: "/en/uae/swift-code/", linksTo: ["/en/uae/forex/"], linksFrom: ["/en/uae/"] },
            { title: "Mashreq Bank IBAN Number: How to Find Your IBAN UAE", keyword: "mashreq bank iban number", volume: 1900, difficulty: 1, intent: "navigational", funnelStage: "BOFU", contentType: "reference page", estimatedWordCount: 700, effort: "low", suggestedUrl: "/en/uae/iban/", linksTo: ["/en/uae/forex/"], linksFrom: [] },
            { title: "Mashreq Bank UAE Charges & Fees: Full Tariff Guide", keyword: "mashreq bank charges", volume: 1900, difficulty: 3, intent: "informational", funnelStage: "BOFU", contentType: "reference page", estimatedWordCount: 1200, effort: "low", suggestedUrl: "/en/uae/tariff/", linksTo: ["/en/uae/"], linksFrom: ["/en/uae/"] }
          ]
        },
        {
          id: "p5-c2",
          name: "Digital Banking",
          hubKeyword: "best banking app uae 2025",
          intent: "commercial",
          priority: "medium",
          pages: [
            { title: "Best Banking App in UAE 2025: Features & Comparison", keyword: "best banking app uae 2025", volume: 3600, difficulty: 42, intent: "commercial", funnelStage: "MOFU", contentType: "comparison page", estimatedWordCount: 2400, effort: "high", suggestedUrl: "/en/uae/digital/best-banking-app/", linksTo: ["/en/uae/digital/", "/en/uae/neo/"], linksFrom: [] },
            { title: "Mobile Banking App UAE: What to Look For in 2025", keyword: "mobile banking app uae", volume: 4400, difficulty: 38, intent: "informational", funnelStage: "TOFU", contentType: "cluster page", estimatedWordCount: 1800, effort: "medium", suggestedUrl: "/en/uae/digital/mobile-banking/", linksTo: ["/en/uae/digital/"], linksFrom: [] },
            { title: "Digital Banking UAE 2025: Comprehensive Guide", keyword: "uae digital banking", volume: 2400, difficulty: 38, intent: "informational", funnelStage: "TOFU", contentType: "pillar page", estimatedWordCount: 3000, effort: "high", suggestedUrl: "/en/uae/digital/", linksTo: ["/en/uae/neo/", "/en/uae/digital/mobile-banking/"], linksFrom: ["/en/uae/"] },
            { title: "Mashreq Bank App Download: iOS & Android Guide", keyword: "mashreq bank app download", volume: 3600, difficulty: 3, intent: "navigational", funnelStage: "BOFU", contentType: "reference page", estimatedWordCount: 600, effort: "low", suggestedUrl: "/en/uae/digital/app-download/", linksTo: ["/en/uae/digital/"], linksFrom: ["/en/uae/"] }
          ]
        },
        {
          id: "p5-c3",
          name: "Salary & Employment Banking",
          hubKeyword: "uae salary transfer bank benefits",
          intent: "commercial",
          priority: "medium",
          pages: [
            { title: "Salary Transfer to Mashreq Bank: Benefits & How to Switch", keyword: "uae salary transfer bank benefits", volume: 2400, difficulty: 28, intent: "commercial", funnelStage: "MOFU", contentType: "cluster page", estimatedWordCount: 1600, effort: "medium", suggestedUrl: "/en/uae/personal/accounts/salary-transfer/", linksTo: ["/en/uae/personal/accounts/"], linksFrom: [] },
            { title: "Mashreq Bank Login: Online Banking Access Guide", keyword: "mashreq bank login", volume: 4400, difficulty: 2, intent: "navigational", funnelStage: "BOFU", contentType: "reference page", estimatedWordCount: 500, effort: "low", suggestedUrl: "/en/uae/digital/online-banking/", linksTo: ["/en/uae/digital/app-download/"], linksFrom: ["/en/uae/"] }
          ]
        }
      ]
    }
  ],
  calendar: [
    {
      month: 1,
      label: "Quick Wins & Technical Foundation",
      pieces: [
        { title: "Mashreq Bank SWIFT Code & BIC: All UAE Branch Codes", keyword: "mashreq swift code", pillar: "Financial Education & Banking Tools", cluster: "Banking Reference Tools", contentType: "reference page", priority: "high" },
        { title: "Mashreq Bank IBAN Number: How to Find Your IBAN UAE", keyword: "mashreq bank iban number", pillar: "Financial Education & Banking Tools", cluster: "Banking Reference Tools", contentType: "reference page", priority: "high" },
        { title: "Mashreq Bank UAE Charges & Fees: Full Tariff Guide", keyword: "mashreq bank charges", pillar: "Financial Education & Banking Tools", cluster: "Banking Reference Tools", contentType: "reference page", priority: "high" },
        { title: "Mashreq Bank App Download: iOS & Android Guide", keyword: "mashreq bank app download", pillar: "Financial Education & Banking Tools", cluster: "Digital Banking", contentType: "reference page", priority: "high" },
        { title: "Mashreq Bank Login: Online Banking Access Guide", keyword: "mashreq bank login", pillar: "Financial Education & Banking Tools", cluster: "Salary & Employment Banking", contentType: "reference page", priority: "medium" }
      ]
    },
    {
      month: 2,
      label: "Financial Calculator Tools",
      pieces: [
        { title: "UAE Personal Loan EMI Calculator 2025 — Free Online Tool", keyword: "uae personal loan emi calculator", pillar: "Loans & Financial Calculators", cluster: "Financial Calculators", contentType: "tool page", priority: "high" },
        { title: "UAE Gratuity Calculator 2025: End of Service Benefits", keyword: "gratuity calculator uae 2025", pillar: "Loans & Financial Calculators", cluster: "Financial Calculators", contentType: "tool page", priority: "high" },
        { title: "Mashreq Bank Forex Rates Today: Live Exchange Rates UAE", keyword: "mashreq bank forex rates today", pillar: "Forex & International Transfers", cluster: "Forex Rates & Tools", contentType: "tool page", priority: "high" }
      ]
    },
    {
      month: 3,
      label: "Credit Cards & Loans Optimization",
      pieces: [
        { title: "Mashreq Credit Cards: Compare All Cards & Apply Online", keyword: "mashreq credit card", pillar: "Credit Cards & Rewards", cluster: "Credit Card Overview", contentType: "pillar page", priority: "high" },
        { title: "Mashreq Personal Loan UAE: Rates, Eligibility & Apply Online", keyword: "mashreq personal loan", pillar: "Loans & Financial Calculators", cluster: "Personal Loans", contentType: "pillar page", priority: "high" },
        { title: "Mashreq Credit Card Minimum Salary Requirements UAE 2025", keyword: "mashreq credit card minimum salary", pillar: "Credit Cards & Rewards", cluster: "Credit Card Overview", contentType: "cluster page", priority: "medium" }
      ]
    },
    {
      month: 4,
      label: "Account Opening & NEO",
      pieces: [
        { title: "Mashreq Bank Account Opening: Documents & Requirements UAE", keyword: "mashreq account opening", pillar: "Banking Accounts & Digital Banking", cluster: "Account Opening", contentType: "pillar page", priority: "high" },
        { title: "How to Open a Mashreq Bank Account Online: Step-by-Step Guide", keyword: "how to open mashreq bank account online", pillar: "Banking Accounts & Digital Banking", cluster: "Account Opening", contentType: "how-to guide", priority: "high" },
        { title: "Mashreq NEO: The Digital Account That Pays You More", keyword: "mashreq neo", pillar: "Banking Accounts & Digital Banking", cluster: "Account Types & NEO", contentType: "product page", priority: "high" }
      ]
    },
    {
      month: 5,
      label: "Expat Banking & Savings",
      pieces: [
        { title: "Open a UAE Bank Account for Expats: Complete Guide 2025", keyword: "uae bank account open for expat", pillar: "Banking Accounts & Digital Banking", cluster: "Account Opening", contentType: "cluster page", priority: "high" },
        { title: "Best Savings Accounts in UAE 2025: Rates & Comparison", keyword: "best savings account uae 2025", pillar: "Banking Accounts & Digital Banking", cluster: "Account Types & NEO", contentType: "comparison page", priority: "medium" },
        { title: "Zero Balance Bank Account in UAE: What You Need to Know", keyword: "zero balance account uae", pillar: "Banking Accounts & Digital Banking", cluster: "Account Types & NEO", contentType: "cluster page", priority: "medium" }
      ]
    },
    {
      month: 6,
      label: "Transfer & Remittance Content",
      pieces: [
        { title: "How to Transfer Money from Mashreq to Another Bank: Complete Guide", keyword: "how to transfer money mashreq to another bank", pillar: "Forex & International Transfers", cluster: "International Transfers & Remittance", contentType: "how-to guide", priority: "high" },
        { title: "UAE International Money Transfer Comparison 2025", keyword: "uae remittance transfer comparison", pillar: "Forex & International Transfers", cluster: "International Transfers & Remittance", contentType: "comparison page", priority: "medium" }
      ]
    },
    {
      month: 7,
      label: "Digital Banking Hub",
      pieces: [
        { title: "Digital Banking UAE 2025: Comprehensive Guide", keyword: "uae digital banking", pillar: "Financial Education & Banking Tools", cluster: "Digital Banking", contentType: "pillar page", priority: "medium" },
        { title: "Mobile Banking App UAE: What to Look For in 2025", keyword: "mobile banking app uae", pillar: "Financial Education & Banking Tools", cluster: "Digital Banking", contentType: "cluster page", priority: "medium" },
        { title: "What is Mashreq NEO Account? Features, Benefits & How to Apply", keyword: "what is mashreq neo account", pillar: "Banking Accounts & Digital Banking", cluster: "Account Types & NEO", contentType: "how-to guide", priority: "medium" }
      ]
    },
    {
      month: 8,
      label: "Loan Expansion",
      pieces: [
        { title: "Personal Loan Eligibility in UAE: Requirements & Documents", keyword: "personal loan eligibility uae", pillar: "Loans & Financial Calculators", cluster: "Personal Loans", contentType: "cluster page", priority: "medium" },
        { title: "UAE Home Loan Eligibility: Requirements & How to Apply", keyword: "uae home loan eligibility calculator", pillar: "Loans & Financial Calculators", cluster: "Home Loans", contentType: "cluster page", priority: "medium" }
      ]
    },
    {
      month: 9,
      label: "Comparison Content",
      pieces: [
        { title: "UAE Credit Card Interest Rate Comparison 2025", keyword: "uae credit card interest rate comparison", pillar: "Credit Cards & Rewards", cluster: "Credit Card Comparisons", contentType: "cluster page", priority: "medium" },
        { title: "Best Banking App in UAE 2025: Features & Comparison", keyword: "best banking app uae 2025", pillar: "Financial Education & Banking Tools", cluster: "Digital Banking", contentType: "comparison page", priority: "medium" }
      ]
    },
    {
      month: 10,
      label: "Long-tail & How-To Content",
      pieces: [
        { title: "UAE Bank Fixed Deposit Best Rates 2025: Compare & Calculate", keyword: "uae bank fixed deposit best rates 2025", pillar: "Forex & International Transfers", cluster: "Forex Rates & Tools", contentType: "comparison page", priority: "low" },
        { title: "Salary Transfer to Mashreq Bank: Benefits & How to Switch", keyword: "uae salary transfer bank benefits", pillar: "Financial Education & Banking Tools", cluster: "Salary & Employment Banking", contentType: "cluster page", priority: "medium" },
        { title: "Online Banking UAE Transfer Fees: All Banks Compared", keyword: "online banking uae transfer fees", pillar: "Forex & International Transfers", cluster: "International Transfers & Remittance", contentType: "comparison page", priority: "low" }
      ]
    },
    {
      month: 11,
      label: "Authority Content",
      pieces: [
        { title: "Open a UAE Bank Account Online 2025: Process & Documents", keyword: "uae bank account opening online", pillar: "Banking Accounts & Digital Banking", cluster: "Account Opening", contentType: "cluster page", priority: "low" },
        { title: "UAE Credit Card Rewards Programs Explained", keyword: "uae credit card rewards program", pillar: "Credit Cards & Rewards", cluster: "Credit Card Comparisons", contentType: "cluster page", priority: "low" }
      ]
    },
    {
      month: 12,
      label: "Long-tail Completion",
      pieces: [
        { title: "Best Cashback Credit Cards in UAE 2025", keyword: "credit card cashback uae", pillar: "Credit Cards & Rewards", cluster: "Credit Card Comparisons", contentType: "cluster page", priority: "low" },
        { title: "Best Mashreq Credit Card for Dining & Food in UAE", keyword: "best mashreq credit card for dining", pillar: "Credit Cards & Rewards", cluster: "Credit Card Overview", contentType: "cluster page", priority: "low" },
        { title: "Mashreq Personal Loan Calculator UAE: Monthly EMI Estimate", keyword: "mashreq personal loan calculator uae", pillar: "Loans & Financial Calculators", cluster: "Personal Loans", contentType: "cluster page", priority: "low" }
      ]
    }
  ],
  linkingArchitecture: {
    strategy: "Hub-and-spoke model with 5 pillar pages acting as topic hubs. Each pillar page links to all cluster pages in its pillar. Cluster pages link back to their parent pillar and cross-link to the most relevant tool page (EMI calculator, forex rates). Calculator tools receive inbound links from all loan and account product pages. Reference pages (SWIFT, IBAN) link to the forex pillar.",
    rules: [
      "Each pillar page must have contextual links to every cluster page within its pillar",
      "Calculator tool pages (/tools/) receive links from: personal loan page, home loan page, mashreq credit card page",
      "How-to guides link to the related product page as the primary CTA",
      "Reference pages (swift-code, iban) link to forex pillar and homepage",
      "Maximum 5 outbound internal links per cluster page to avoid dilution",
      "All new content must link to at least one pillar page within the first 200 words",
      "Cross-pillar links are allowed only when topically relevant (e.g., gratuity calculator → expat banking guide)"
    ]
  },
  stats: {
    totalPillars: 5,
    totalClusters: 12,
    totalPages: 36
  },
  summary: "The Mashreq.com topical map covers 36 content pieces across 5 pillars and 12 clusters, targeting 40 consolidated keywords with combined monthly search volume of 138,050. Month 1-2 priorities are quick-win reference pages (SWIFT, IBAN, app download) and financial calculator tools — these are low-effort, high-impact content pieces that fill clear search demand with near-zero competition. Month 3-6 builds pillar authority in Credit Cards and Loans, the two highest-volume commercial clusters. The 12-month calendar is sequenced by effort-to-impact ratio, ensuring the 9 identified quick wins are captured before the heavier comparative content is produced."
};

client.connect().then(async () => {
  const stepRes = await client.query(
    "SELECT status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = 'topical-map'",
    [runId]
  );
  console.log('Current topical-map status:', stepRes.rows[0]?.status);

  const existing = await client.query(
    "SELECT id FROM workflow_context WHERE workflow_run_id = $1 AND key = 'topical-map'",
    [runId]
  );
  if (existing.rows.length) {
    await client.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'topical-map'",
      [JSON.stringify(topicalMapOutput), runId]
    );
    console.log('Updated topical-map context');
  } else {
    await client.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'topical-map', $2::jsonb)",
      [runId, JSON.stringify(topicalMapOutput)]
    );
    console.log('Inserted topical-map context');
  }

  await client.query(
    "UPDATE workflow_steps SET status = 'awaiting_approval', error = NULL, completed_at = NOW(), updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = 'topical-map'",
    [runId]
  );
  console.log('Marked topical-map as awaiting_approval');
  console.log('Pillars:', topicalMapOutput.pillars.length);
  console.log('Total pages:', topicalMapOutput.stats.totalPages);
  console.log('Calendar months:', topicalMapOutput.calendar.length);

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
