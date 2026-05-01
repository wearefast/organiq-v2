'use client';

import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import type {
  AuditDetailResponse,
  KeywordResearchData,
  CompetitorData,
  SerpCandidateData,
  PageSpeedMetricsData,
  ContentGapData,
} from '../services/audit.service';

/* ═══════════════════════════════════════════════════════════
   Design Tokens
   ═══════════════════════════════════════════════════════════ */

const C = {
  navy: '#071932',
  navyLight: '#102447',
  red: '#DA304F',
  redDark: '#AE213E',
  redPale: '#FCF4F6',
  text: '#111827',
  body: '#4B5563',
  muted: '#9CA3AF',
  border: '#E8EAF0',
  surface: '#F8F9FC',
  white: '#FFFFFF',
  teal: '#10B981',
  tealBg: '#ECFDF5',
  amber: '#F59E0B',
  amberBg: '#FFFBEB',
  indigo: '#6366F1',
  indigoBg: '#EEF2FF',
  rowAlt: '#FAFAFB',
};

/* ═══════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  /* ── Page layouts ── */
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.5,
    color: C.text,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    backgroundColor: C.white,
  },
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: C.navy,
    padding: 0,
  },

  /* ── Footer ── */
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  footerText: {
    fontSize: 7,
    color: C.muted,
  },

  /* ── Section headers ── */
  sectionHeader: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.red,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 9,
    color: C.muted,
    marginTop: 3,
  },
  subTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.text,
    marginBottom: 10,
    marginTop: 20,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },

  /* ── Tables ── */
  tableContainer: {
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.25,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.25,
    borderBottomColor: '#F3F4F6',
    backgroundColor: C.rowAlt,
  },
  th: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: {
    fontSize: 8,
    color: C.body,
    lineHeight: 1.4,
  },
  tdBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.text,
    lineHeight: 1.4,
  },

  /* ── Cards ── */
  card: {
    marginBottom: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 6,
    backgroundColor: C.white,
  },
  cardTinted: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 6,
    backgroundColor: C.surface,
  },

  /* ── Stats ── */
  statLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: C.text,
    lineHeight: 1.3,
  },
  statDescription: {
    fontSize: 8,
    color: C.body,
    lineHeight: 1.5,
    marginTop: 2,
  },

  /* ── Pills ── */
  pill: {
    fontSize: 7,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 10,
    backgroundColor: C.surface,
    color: C.body,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },

  /* ── Multi-column ── */
  twoCol: {
    flexDirection: 'row',
    gap: 16,
  },
  col: {
    flex: 1,
  },
});

/* ═══════════════════════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════════════════════ */

function PageFooter({ section }: { section: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Calibrate Commerce — SEO, AEO & GEO Audit Report</Text>
      <Text style={s.footerText}>{section}</Text>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function SubTitle({ children }: { children: string }) {
  return <Text style={s.subTitle}>{children}</Text>;
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statDescription}>{value}</Text>
    </View>
  );
}

function MetricCard({ label, value, color, subtitle }: { label: string; value: string; color: string; subtitle?: string }) {
  return (
    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 16 }]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { fontSize: 24, color, marginTop: 4 }]}>{value}</Text>
      {subtitle && <Text style={[s.footerText, { marginTop: 4 }]}>{subtitle}</Text>}
    </View>
  );
}

function splitIntoColumns<T>(arr: T[], cols: number): T[][] {
  const perCol = Math.ceil(arr.length / cols);
  const result: T[][] = [];
  for (let i = 0; i < cols; i++) {
    result.push(arr.slice(i * perCol, (i + 1) * perCol));
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   COVER PAGE
   ═══════════════════════════════════════════════════════════ */

function CoverPage({ audit }: { audit: AuditDetailResponse }) {
  const domain = (() => { try { return new URL(audit.websiteUrl).hostname; } catch { return audit.websiteUrl; } })();
  const date = new Date(audit.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Page size="A4" style={s.coverPage}>
      {/* Subtle background band */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, backgroundColor: C.navyLight, opacity: 0.4 }} />

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        {/* Logo */}
        <Image src="/calibrate-commerce-logo-mark.png" style={{ width: 120, height: 120, marginBottom: 48 }} />

        {/* Accent divider */}
        <View style={{ width: 60, height: 2, backgroundColor: C.red, marginBottom: 32 }} />

        {/* Report type */}
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica', color: C.red, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 40, textAlign: 'center' }}>
          SEO, AEO & GEO Audit Report
        </Text>

        {/* Brand name */}
        <Text style={{ fontSize: 36, fontFamily: 'Helvetica-Bold', color: C.white, textAlign: 'center', marginBottom: 10 }}>
          {audit.siteName || domain}
        </Text>

        {/* URL */}
        <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 60 }}>
          {audit.websiteUrl}
        </Text>

        {/* Meta info */}
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Generated</Text>
            <Text style={{ fontSize: 10, color: C.white, fontFamily: 'Helvetica-Bold' }}>{date}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#374151' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Seed Keywords</Text>
            <Text style={{ fontSize: 10, color: C.white, fontFamily: 'Helvetica-Bold' }}>{audit.seedKeywords.length}</Text>
          </View>
        </View>
      </View>

      {/* Bottom branding */}
      <View style={{ paddingBottom: 32, alignItems: 'center' }}>
        <Text style={{ fontSize: 8, color: '#4B5563', letterSpacing: 1 }}>POWERED BY CALIBRATE COMMERCE</Text>
      </View>
    </Page>
  );
}

/* ═══════════════════════════════════════════════════════════
   OVERVIEW PAGE
   ═══════════════════════════════════════════════════════════ */

function OverviewPages({ audit }: { audit: AuditDetailResponse }) {
  const { pipeline } = audit;
  const domain = (() => { try { return new URL(audit.websiteUrl).hostname; } catch { return audit.websiteUrl; } })();

  return (
    <Page size="A4" style={s.page} wrap>
      <PageFooter section={domain} />
      <SectionHeader title="Overview" subtitle="Business profile, website analysis, and strategic positioning" />

      {/* Business Profile */}
      {pipeline.businessProfile && (
        <View style={s.card} wrap={false}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 12 }}>Business Profile</Text>
          <StatBlock label="Brand Identity" value={pipeline.businessProfile.brandIdentity} />
          <StatBlock label="Target Market" value={pipeline.businessProfile.targetMarket} />
          <StatBlock label="Geography" value={pipeline.businessProfile.geography} />
          <StatBlock label="Tone of Voice" value={pipeline.businessProfile.toneOfVoice} />
          <View style={{ marginTop: 4 }}>
            <Text style={s.statLabel}>Services</Text>
            <View style={[s.pillRow, { marginTop: 6 }]}>
              {pipeline.businessProfile.services.map(svc => (
                <Text key={svc} style={s.pill}>{svc}</Text>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Deep Read */}
      {pipeline.deepRead && (
        <View style={s.card} wrap={false}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 12 }}>Deep Read Analysis</Text>
          <StatBlock label="What They Sell" value={pipeline.deepRead.whatTheySell} />
          <StatBlock label="Who They Serve" value={pipeline.deepRead.whoTheyServe} />
          <StatBlock label="How They Position" value={pipeline.deepRead.howTheyPosition} />
          <StatBlock label="What Makes Them Different" value={pipeline.deepRead.whatMakesThemDifferent} />
        </View>
      )}

      {/* Seed Keywords */}
      {audit.seedKeywords.length > 0 && (
        <View style={s.cardTinted} wrap={false}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 10 }}>Seed Keywords</Text>
          <View style={s.pillRow}>
            {audit.seedKeywords.map(kw => (
              <Text key={kw} style={[s.pill, { backgroundColor: C.redPale, color: C.red, borderColor: '#F3D3DA' }]}>{kw}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Website Crawl */}
      {pipeline.scrape && (
        <View style={s.card} wrap={false}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 12 }}>Website Crawl</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ width: '33%', marginBottom: 10 }}>
              <Text style={s.statLabel}>Page Title</Text>
              <Text style={[s.td, { marginTop: 2 }]}>{pipeline.scrape.title || '—'}</Text>
            </View>
            <View style={{ width: '33%', marginBottom: 10 }}>
              <Text style={s.statLabel}>H1 Tags</Text>
              <Text style={[s.statValue, { marginTop: 2 }]}>{pipeline.scrape.h1s.length}</Text>
            </View>
            <View style={{ width: '33%', marginBottom: 10 }}>
              <Text style={s.statLabel}>Internal Links</Text>
              <Text style={[s.statValue, { marginTop: 2 }]}>{pipeline.scrape.internalLinkCount}</Text>
            </View>
            <View style={{ width: '33%', marginBottom: 10 }}>
              <Text style={s.statLabel}>Image Alt Coverage</Text>
              <Text style={[s.statValue, { marginTop: 2, color: pipeline.scrape.imageAltCoverage >= 80 ? C.teal : C.amber }]}>{pipeline.scrape.imageAltCoverage}%</Text>
            </View>
            <View style={{ width: '33%', marginBottom: 10 }}>
              <Text style={s.statLabel}>Schema Markup</Text>
              <Text style={[s.statValue, { marginTop: 2, color: pipeline.scrape.schemaMarkupPresent ? C.teal : C.amber }]}>{pipeline.scrape.schemaMarkupPresent ? 'Detected' : 'Missing'}</Text>
            </View>
            <View style={{ width: '33%', marginBottom: 10 }}>
              <Text style={s.statLabel}>Meta Description</Text>
              <Text style={[s.statValue, { marginTop: 2, color: pipeline.scrape.metaDescription ? C.teal : C.amber }]}>{pipeline.scrape.metaDescription ? 'Present' : 'Missing'}</Text>
            </View>
          </View>
        </View>
      )}
    </Page>
  );
}

/* ═══════════════════════════════════════════════════════════
   KEYWORDS & TOPICS PAGES
   ═══════════════════════════════════════════════════════════ */

function KeywordsPages({ data, seedExpansions }: { data: KeywordResearchData; seedExpansions: string[] }) {
  const THRESHOLD = 25;

  return (
    <Page size="A4" style={s.page} wrap>
      <PageFooter section="Keywords & Topics" />
      <SectionHeader title="Keywords & Topics" subtitle={`${data.coreKeywords.length} core keywords, ${data.moneyKeywords.length} money keywords, ${data.primaryTopics.length} topic clusters`} />

      {/* Core Keywords */}
      {data.coreKeywords.length > 0 && (
        <View>
          <SubTitle>{`Core Keywords (${data.coreKeywords.length})`}</SubTitle>
          {data.coreKeywords.length > THRESHOLD ? (
            <View style={s.twoCol}>
              {splitIntoColumns(data.coreKeywords, 2).map((col, ci) => (
                <View key={ci} style={[s.col, s.tableContainer]}>
                  <View style={s.tableHeader}>
                    <Text style={[s.th, { width: '45%' }]}>Keyword</Text>
                    <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>Vol</Text>
                    <Text style={[s.th, { width: '15%', textAlign: 'right' }]}>KD</Text>
                    <Text style={[s.th, { width: '20%' }]}>Conf</Text>
                  </View>
                  {col.map((kw, i) => (
                    <View key={kw.keyword} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                      <Text style={[s.tdBold, { width: '45%' }]}>{kw.keyword}</Text>
                      <Text style={[s.td, { width: '20%', textAlign: 'right' }]}>{kw.volume?.toLocaleString() ?? '—'}</Text>
                      <Text style={[s.td, { width: '15%', textAlign: 'right' }]}>{kw.difficulty ?? '—'}</Text>
                      <Text style={[s.td, { width: '20%' }]}>{kw.confidence}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={s.tableContainer}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: '28%' }]}>Keyword</Text>
                <Text style={[s.th, { width: '12%', textAlign: 'right' }]}>Volume</Text>
                <Text style={[s.th, { width: '10%', textAlign: 'right' }]}>KD</Text>
                <Text style={[s.th, { width: '14%' }]}>Confidence</Text>
                <Text style={[s.th, { width: '36%' }]}>Reason</Text>
              </View>
              {data.coreKeywords.map((kw, i) => (
                <View key={kw.keyword} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tdBold, { width: '28%' }]}>{kw.keyword}</Text>
                  <Text style={[s.td, { width: '12%', textAlign: 'right' }]}>{kw.volume?.toLocaleString() ?? '—'}</Text>
                  <Text style={[s.td, { width: '10%', textAlign: 'right' }]}>{kw.difficulty ?? '—'}</Text>
                  <Text style={[s.td, { width: '14%' }]}>{kw.confidence}</Text>
                  <Text style={[s.td, { width: '36%' }]}>{kw.reason}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Money Keywords */}
      {data.moneyKeywords.length > 0 && (
        <View>
          <SubTitle>{`Money Keywords (${data.moneyKeywords.length})`}</SubTitle>
          {data.moneyKeywords.length > THRESHOLD ? (
            <View style={s.twoCol}>
              {splitIntoColumns(data.moneyKeywords, 2).map((col, ci) => (
                <View key={ci} style={[s.col, s.tableContainer]}>
                  <View style={s.tableHeader}>
                    <Text style={[s.th, { width: '45%' }]}>Keyword</Text>
                    <Text style={[s.th, { width: '18%', textAlign: 'right' }]}>Vol</Text>
                    <Text style={[s.th, { width: '15%', textAlign: 'right' }]}>KD</Text>
                    <Text style={[s.th, { width: '22%' }]}>Intent</Text>
                  </View>
                  {col.map((kw, i) => (
                    <View key={kw.keyword} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                      <Text style={[s.tdBold, { width: '45%' }]}>{kw.keyword}</Text>
                      <Text style={[s.td, { width: '18%', textAlign: 'right' }]}>{kw.volume?.toLocaleString() ?? '—'}</Text>
                      <Text style={[s.td, { width: '15%', textAlign: 'right' }]}>{kw.difficulty ?? '—'}</Text>
                      <Text style={[s.td, { width: '22%' }]}>{kw.intent}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={s.tableContainer}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: '28%' }]}>Keyword</Text>
                <Text style={[s.th, { width: '12%', textAlign: 'right' }]}>Volume</Text>
                <Text style={[s.th, { width: '10%', textAlign: 'right' }]}>KD</Text>
                <Text style={[s.th, { width: '20%' }]}>Intent</Text>
                <Text style={[s.th, { width: '30%' }]}>Mapped Service</Text>
              </View>
              {data.moneyKeywords.map((kw, i) => (
                <View key={kw.keyword} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tdBold, { width: '28%' }]}>{kw.keyword}</Text>
                  <Text style={[s.td, { width: '12%', textAlign: 'right' }]}>{kw.volume?.toLocaleString() ?? '—'}</Text>
                  <Text style={[s.td, { width: '10%', textAlign: 'right' }]}>{kw.difficulty ?? '—'}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{kw.intent}</Text>
                  <Text style={[s.td, { width: '30%' }]}>{kw.mappedService}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Topic Clusters */}
      {data.primaryTopics.length > 0 && (
        <View>
          <SubTitle>{`Topic Clusters (${data.primaryTopics.length})`}</SubTitle>
          {data.primaryTopics.map(topic => (
            <View key={topic.pillar} style={[s.cardTinted, { marginBottom: 8 }]} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>{topic.pillar}</Text>
                <Text style={{ fontSize: 8, color: C.indigo, fontFamily: 'Helvetica-Bold' }}>~{topic.estimatedTotalVolume.toLocaleString()} vol</Text>
              </View>
              <View style={s.pillRow}>
                {topic.clusterKeywords.map(ck => (
                  <Text key={ck} style={s.pill}>{ck}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Niche Entities */}
      {data.nicheEntities.length > 0 && (
        <View>
          <SubTitle>{`Niche Entities (${data.nicheEntities.length})`}</SubTitle>
          <View style={s.tableContainer}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: '18%' }]}>Type</Text>
              <Text style={[s.th, { width: '28%' }]}>Entity</Text>
              <Text style={[s.th, { width: '54%' }]}>Relevance</Text>
            </View>
            {data.nicheEntities.map((ent, i) => (
              <View key={ent.entity} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, { width: '18%', color: C.red, fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }]}>{ent.type}</Text>
                <Text style={[s.tdBold, { width: '28%' }]}>{ent.entity}</Text>
                <Text style={[s.td, { width: '54%' }]}>{ent.relevance}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Core Topics */}
      {data.coreTopics && data.coreTopics.length > 0 && (
        <View>
          <SubTitle>{`Core Topics (${data.coreTopics.length})`}</SubTitle>
          {data.coreTopics.map(ct => (
            <View key={ct.topicName} style={[s.cardTinted, { marginBottom: 8 }]} wrap={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>{ct.topicName}</Text>
                <Text style={[s.pill, { backgroundColor: C.indigoBg, color: C.indigo, borderColor: '#C7D2FE' }]}>{ct.type}</Text>
                <Text style={[s.pill, { backgroundColor: C.redPale, color: C.red, borderColor: '#F3D3DA' }]}>{ct.intent}</Text>
              </View>
              {ct.mappedTo && <Text style={[s.td, { marginBottom: 4 }]}>Mapped to: {ct.mappedTo}</Text>}
              {ct.relatedTerms.length > 0 && (
                <View style={s.pillRow}>
                  {ct.relatedTerms.map(term => (
                    <Text key={term} style={s.pill}>{term}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Seed Expansions */}
      {seedExpansions.length > 0 && (
        <View>
          <SubTitle>{`Seed Expansions (${seedExpansions.length})`}</SubTitle>
          <View style={s.pillRow}>
            {seedExpansions.map(kw => (
              <Text key={kw} style={[s.pill, { backgroundColor: C.indigoBg, color: C.indigo, borderColor: '#C7D2FE' }]}>{kw}</Text>
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPETITORS PAGES
   ═══════════════════════════════════════════════════════════ */

function CompetitorsPages({ competitors, serpCandidates }: { competitors: CompetitorData; serpCandidates: SerpCandidateData[] | null }) {
  return (
    <Page size="A4" style={s.page} wrap>
      <PageFooter section="Competitors" />
      <SectionHeader title="Competitors" subtitle={`${competitors.directCompetitors.length} direct, ${competitors.organicCompetitors.length} organic competitors identified`} />

      {/* Summary Cards */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
        <MetricCard label="Direct Competitors" value={String(competitors.directCompetitors.length)} color={C.red} subtitle="Same service, same market" />
        <MetricCard label="Organic Competitors" value={String(competitors.organicCompetitors.length)} color={C.indigo} subtitle="Authority & related content" />
      </View>

      {/* Direct Competitors */}
      {competitors.directCompetitors.length > 0 && (
        <View>
          <SubTitle>Direct Competitors</SubTitle>
          <View style={s.tableContainer}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: '28%' }]}>Domain</Text>
              <Text style={[s.th, { width: '72%' }]}>Reason</Text>
            </View>
            {competitors.directCompetitors.map((c, i) => (
              <View key={c.domain} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tdBold, { width: '28%' }]}>{c.domain}</Text>
                <Text style={[s.td, { width: '72%' }]}>{c.reason}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Organic Competitors */}
      {competitors.organicCompetitors.length > 0 && (
        <View>
          <SubTitle>Organic Competitors</SubTitle>
          <View style={s.tableContainer}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: '28%' }]}>Domain</Text>
              <Text style={[s.th, { width: '72%' }]}>Reason</Text>
            </View>
            {competitors.organicCompetitors.map((c, i) => (
              <View key={c.domain} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tdBold, { width: '28%' }]}>{c.domain}</Text>
                <Text style={[s.td, { width: '72%' }]}>{c.reason}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* SERP Discovery */}
      {serpCandidates && serpCandidates.length > 0 && (
        <View>
          <SubTitle>{`SERP Discovery (${serpCandidates.length} domains)`}</SubTitle>
          <View style={s.tableContainer}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: '30%' }]}>Domain</Text>
              <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>Appearances</Text>
              <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>Avg Position</Text>
              <Text style={[s.th, { width: '30%' }]}>Sample URL</Text>
            </View>
            {serpCandidates.map((c, i) => (
              <View key={c.domain} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tdBold, { width: '30%' }]}>{c.domain}</Text>
                <Text style={[s.td, { width: '20%', textAlign: 'right' }]}>{c.occurrences}</Text>
                <Text style={[s.td, { width: '20%', textAlign: 'right' }]}>#{c.avgPosition}</Text>
                <Text style={[s.td, { width: '30%', fontSize: 7 }]}>{c.sampleUrls[0] || '—'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONTENT GAP PAGES
   ═══════════════════════════════════════════════════════════ */

function ContentGapPages({ data }: { data: ContentGapData }) {
  const sorted = [...data.keywords].sort((a, b) => b.opportunity - a.opportunity);
  const THRESHOLD = 25;

  return (
    <Page size="A4" style={s.page} wrap>
      <PageFooter section="Content Gap" />
      <SectionHeader title="Content Gap" subtitle={`${data.summary.totalGapKeywords} keywords your competitors rank for that you don't`} />

      {/* Summary Cards */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
        <MetricCard label="Gap Keywords" value={String(data.summary.totalGapKeywords)} color={C.red} />
        <MetricCard label="Missed Traffic/mo" value={formatTraffic(data.summary.estimatedMissedTraffic)} color={C.indigo} />
        <MetricCard label="Avg Difficulty" value={`${data.summary.avgDifficulty}/100`} color={C.amber} />
      </View>

      {/* Gap Keywords Table */}
      <SubTitle>{`Gap Keywords (${sorted.length})`}</SubTitle>
      {sorted.length > THRESHOLD ? (
        <View style={s.twoCol}>
          {splitIntoColumns(sorted, 2).map((col, ci) => (
            <View key={ci} style={[s.col, s.tableContainer]}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: '38%' }]}>Keyword</Text>
                <Text style={[s.th, { width: '16%', textAlign: 'right' }]}>Vol</Text>
                <Text style={[s.th, { width: '12%', textAlign: 'right' }]}>KD</Text>
                <Text style={[s.th, { width: '18%' }]}>Intent</Text>
                <Text style={[s.th, { width: '16%', textAlign: 'right' }]}>Opp</Text>
              </View>
              {col.map((kw, i) => (
                <View key={kw.keyword} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tdBold, { width: '38%' }]}>{kw.keyword}</Text>
                  <Text style={[s.td, { width: '16%', textAlign: 'right' }]}>{kw.volume.toLocaleString()}</Text>
                  <Text style={[s.td, { width: '12%', textAlign: 'right' }]}>{kw.difficulty}</Text>
                  <Text style={[s.td, { width: '18%' }]}>{kw.intent}</Text>
                  <Text style={[s.td, { width: '16%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.indigo }]}>{kw.opportunity}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={s.tableContainer}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: '24%' }]}>Keyword</Text>
            <Text style={[s.th, { width: '11%', textAlign: 'right' }]}>Volume</Text>
            <Text style={[s.th, { width: '8%', textAlign: 'right' }]}>KD</Text>
            <Text style={[s.th, { width: '14%' }]}>Intent</Text>
            <Text style={[s.th, { width: '10%' }]}>Funnel</Text>
            <Text style={[s.th, { width: '18%' }]}>Content Type</Text>
            <Text style={[s.th, { width: '15%', textAlign: 'right' }]}>Opportunity</Text>
          </View>
          {sorted.map((kw, i) => (
            <View key={kw.keyword} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tdBold, { width: '24%' }]}>{kw.keyword}</Text>
              <Text style={[s.td, { width: '11%', textAlign: 'right' }]}>{kw.volume.toLocaleString()}</Text>
              <Text style={[s.td, { width: '8%', textAlign: 'right' }]}>{kw.difficulty}</Text>
              <Text style={[s.td, { width: '14%' }]}>{kw.intent}</Text>
              <Text style={[s.td, { width: '10%' }]}>{kw.funnel}</Text>
              <Text style={[s.td, { width: '18%' }]}>{kw.contentType}</Text>
              <Text style={[s.td, { width: '15%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.indigo }]}>{kw.opportunity}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Topic Groups */}
      {data.topicGroups.length > 0 && (
        <View>
          <SubTitle>{`Topic Clusters (${data.topicGroups.length})`}</SubTitle>
          {data.topicGroups.map(group => (
            <View key={group.topic} style={[s.cardTinted, { marginBottom: 8 }]} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>{group.topic}</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: C.indigo, fontFamily: 'Helvetica-Bold' }}>~{group.totalVolume.toLocaleString()} vol</Text>
                  <Text style={{ fontSize: 7, color: C.body }}>KD: {group.avgDifficulty}</Text>
                  <Text style={[s.pill, { backgroundColor: C.indigoBg, color: C.indigo, borderColor: '#C7D2FE', fontSize: 6 }]}>{group.dominantFunnel}</Text>
                </View>
              </View>
              <View style={s.pillRow}>
                {group.keywords.map(kw => (
                  <Text key={kw} style={s.pill}>{kw}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

/* ═══════════════════════════════════════════════════════════
   PERFORMANCE PAGES
   ═══════════════════════════════════════════════════════════ */

function PerformancePages({ data, scrape }: { data: { mobile: PageSpeedMetricsData; desktop: PageSpeedMetricsData }; scrape: AuditDetailResponse['pipeline']['scrape'] }) {
  const scoreColor = (v: number) => v >= 90 ? C.teal : v >= 50 ? C.amber : C.red;
  const cwvLabel = (value: number, good: number, mid: number) => value <= good ? 'Good' : value <= mid ? 'Needs Improvement' : 'Poor';
  const cwvColor = (value: number, good: number, mid: number) => value <= good ? C.teal : value <= mid ? C.amber : C.red;

  return (
    <Page size="A4" style={s.page} wrap>
      <PageFooter section="Performance" />
      <SectionHeader title="Performance" subtitle="PageSpeed scores, Core Web Vitals, and on-page SEO signals" />

      {/* Score Cards */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
        {(['mobile', 'desktop'] as const).map(device => {
          const m = data[device];
          return (
            <View key={device} style={[s.card, { flex: 1 }]}>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 14, textAlign: 'center' }}>
                {device === 'mobile' ? 'Mobile' : 'Desktop'}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {[
                  { label: 'Performance', value: m.performanceScore },
                  { label: 'SEO', value: m.seoScore },
                  { label: 'Accessibility', value: m.accessibilityScore },
                ].map(score => (
                  <View key={score.label} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 26, fontFamily: 'Helvetica-Bold', color: scoreColor(score.value) }}>{score.value}</Text>
                    <Text style={[s.statLabel, { marginTop: 4, fontSize: 7 }]}>{score.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Core Web Vitals */}
      <SubTitle>Core Web Vitals (Mobile)</SubTitle>
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'LCP', desc: 'Largest Contentful Paint', value: `${(data.mobile.lcp / 1000).toFixed(2)}s`, raw: data.mobile.lcp, good: 2500, mid: 4000 },
          { label: 'CLS', desc: 'Cumulative Layout Shift', value: data.mobile.cls.toFixed(3), raw: data.mobile.cls, good: 0.1, mid: 0.25 },
          { label: 'TBT', desc: 'Total Blocking Time', value: `${data.mobile.fid}ms`, raw: data.mobile.fid, good: 200, mid: 600 },
        ].map(cwv => (
          <View key={cwv.label} style={[s.card, { flex: 1, paddingVertical: 16 }]}>
            <Text style={[s.statLabel, { textAlign: 'center' }]}>{cwv.label}</Text>
            <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: cwvColor(cwv.raw, cwv.good, cwv.mid), textAlign: 'center', marginTop: 6 }}>{cwv.value}</Text>
            <Text style={{ fontSize: 7, color: cwvColor(cwv.raw, cwv.good, cwv.mid), textAlign: 'center', marginTop: 4, fontFamily: 'Helvetica-Bold' }}>{cwvLabel(cwv.raw, cwv.good, cwv.mid)}</Text>
            <Text style={{ fontSize: 7, color: C.muted, textAlign: 'center', marginTop: 4 }}>{cwv.desc}</Text>
          </View>
        ))}
      </View>

      {/* On-Page SEO Signals */}
      {scrape && (
        <View>
          <SubTitle>On-Page SEO Signals</SubTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Meta Description', present: !!scrape.metaDescription, detail: scrape.metaDescription ? 'Present' : 'Missing' },
              { label: 'Schema Markup', present: scrape.schemaMarkupPresent, detail: scrape.schemaMarkupPresent ? 'Detected' : 'Not found' },
              { label: 'H1 Tag', present: scrape.h1s.length > 0, detail: scrape.h1s.length > 0 ? `${scrape.h1s.length} found` : 'Missing' },
              { label: 'Image Alt Tags', present: scrape.imageAltCoverage >= 80, detail: `${scrape.imageAltCoverage}% coverage` },
            ].map(signal => (
              <View key={signal.label} style={{ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 6, backgroundColor: signal.present ? C.tealBg : C.amberBg, borderWidth: 0.5, borderColor: signal.present ? '#A7F3D0' : '#FDE68A' }}>
                <Text style={{ fontSize: 12, color: signal.present ? C.teal : C.amber }}>{signal.present ? '✓' : '!'}</Text>
                <View>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: signal.present ? '#065F46' : '#92400E' }}>{signal.label}</Text>
                  <Text style={{ fontSize: 7, color: C.muted, marginTop: 1 }}>{signal.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN DOCUMENT
   ═══════════════════════════════════════════════════════════ */

export function AuditReportDocument({ audit }: { audit: AuditDetailResponse }) {
  const { pipeline } = audit;

  return (
    <Document title={`SEO Audit - ${audit.siteName || audit.websiteUrl}`} author="Calibrate Commerce">
      <CoverPage audit={audit} />
      <OverviewPages audit={audit} />
      {pipeline.keywordResearch && (
        <KeywordsPages data={pipeline.keywordResearch} seedExpansions={audit.seedExpansions} />
      )}
      {pipeline.competitors && (
        <CompetitorsPages competitors={pipeline.competitors} serpCandidates={pipeline.serpCandidates} />
      )}
      {pipeline.contentGap && (
        <ContentGapPages data={pipeline.contentGap} />
      )}
      {pipeline.pageSpeed && (
        <PerformancePages data={pipeline.pageSpeed} scrape={pipeline.scrape} />
      )}
    </Document>
  );
}

/* ═══════════════════════════════════════════════════════════
   DOWNLOAD HELPER
   ═══════════════════════════════════════════════════════════ */

export async function downloadAuditPdf(audit: AuditDetailResponse) {
  const blob = await pdf(<AuditReportDocument audit={audit} />).toBlob();
  const domain = (() => { try { return new URL(audit.websiteUrl).hostname; } catch { return 'audit'; } })();
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${domain}-seo-audit-${date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Utility ── */

function formatTraffic(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
