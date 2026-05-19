import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { PromptService } from '../../shared/prompt/prompt.service';
import { reports, workflowRuns, workflowContext, projects } from '../../db/schema';
import { PdfGeneratorService } from './pdf/pdf-generator.service';

interface ReportSection {
  title: string;
  content: string;
  level: number;
}

const REPORT_TYPE_TEMPLATES: Record<string, string> = {
  full_strategy: 'reports/full-strategy.template.md',
  ai_visibility: 'reports/ai-visibility.template.md',
  keyword_research: 'reports/keyword-research.template.md',
  content_plan: 'reports/content-plan.template.md',
};

const REPORT_TYPE_TITLES: Record<string, string> = {
  full_strategy: 'Full SEO Strategy Report',
  ai_visibility: 'AI & GEO Visibility Report',
  keyword_research: 'Keyword Research Report',
  content_plan: 'Content Plan Report',
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly promptService: PromptService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  async findAllByProject(projectId: string) {
    return this.db.db.query.reports.findMany({
      where: eq(reports.projectId, projectId),
      orderBy: (r, { desc: d }) => [d(r.createdAt)],
    });
  }

  async findById(id: string, projectId: string) {
    const report = await this.db.db.query.reports.findFirst({
      where: and(eq(reports.id, id), eq(reports.projectId, projectId)),
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  /**
   * Generate a report by:
   * 1. Loading the workflow context (all step artifacts)
   * 2. Interpolating the report template with context
   * 3. Sending to Python sidecar for PDF generation
   * 4. Storing the report record + PDF base64
   */
  async generate(
    projectId: string,
    workflowRunId: string,
    type: 'full_strategy' | 'ai_visibility' | 'keyword_research' | 'content_plan',
  ) {
    // Validate the workflow run exists and belongs to project
    const run = await this.db.db.query.workflowRuns.findFirst({
      where: and(
        eq(workflowRuns.id, workflowRunId),
        eq(workflowRuns.projectId, projectId),
      ),
    });
    if (!run) throw new NotFoundException('Workflow run not found');

    // Load project info
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) throw new NotFoundException('Project not found');

    // Load workflow context (all step artifacts stored as key-value pairs)
    const contextRows = await this.db.db.query.workflowContext.findMany({
      where: eq(workflowContext.workflowRunId, workflowRunId),
    });

    const context: Record<string, unknown> = {};
    for (const row of contextRows) {
      context[row.key] = row.value;
    }

    // Add project-level metadata
    context.domain = project.domain;
    context.country = project.country;
    context.language = project.language;
    context.industry = project.industry ?? '';
    context.generatedAt = new Date().toISOString();

    // Load and interpolate the template
    const templatePath = REPORT_TYPE_TEMPLATES[type];
    if (!templatePath) {
      throw new NotFoundException(`Unknown report type: ${type}`);
    }

    const template = await this.promptService.loadRubric(templatePath);
    const sections = this.parseTemplateSections(template, context);

    const title = REPORT_TYPE_TITLES[type] ?? 'Report';

    // Generate PDF locally
    const pdfResponse = await this.pdfGenerator.generate({
      title,
      projectDomain: project.domain,
      reportType: type,
      generatedAt: new Date().toISOString(),
      sections,
      metadata: {
        country: project.country,
        language: project.language,
        industry: project.industry ?? 'N/A',
        workflow_run: workflowRunId,
      },
    });

    // Store report record
    const [report] = await this.db.db
      .insert(reports)
      .values({
        projectId,
        workflowRunId,
        type,
        title,
        filePath: pdfResponse.pdfBase64, // Store base64 in filePath for now
        generatedAt: new Date(),
      })
      .returning();

    this.logger.log(`Generated ${type} report: ${report.id} (${pdfResponse.pageCount} pages, ${pdfResponse.fileSizeBytes} bytes)`);

    return {
      ...report,
      pageCount: pdfResponse.pageCount,
      fileSizeBytes: pdfResponse.fileSizeBytes,
    };
  }

  /**
   * Download the PDF for a report (returns base64 string stored in filePath).
   */
  async download(id: string, projectId: string): Promise<{ base64: string; title: string }> {
    const report = await this.findById(id, projectId);
    if (!report.filePath) {
      throw new NotFoundException('Report PDF not available');
    }
    return { base64: report.filePath, title: report.title };
  }

  async remove(id: string, projectId: string) {
    await this.findById(id, projectId);
    await this.db.db
      .delete(reports)
      .where(and(eq(reports.id, id), eq(reports.projectId, projectId)));
    return { deleted: true };
  }

  /**
   * Parse a markdown template into sections, interpolating {{variables}}.
   */
  private parseTemplateSections(
    template: string,
    context: Record<string, unknown>,
  ): ReportSection[] {
    const sections: ReportSection[] = [];
    const lines = template.split('\n');
    let currentTitle = '';
    let currentLevel = 2;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Match heading lines
      const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
      if (headingMatch) {
        // Save previous section
        if (currentTitle) {
          sections.push({
            title: currentTitle,
            content: this.interpolateText(currentContent.join('\n').trim(), context),
            level: currentLevel,
          });
        }
        currentLevel = headingMatch[1].length;
        currentTitle = this.interpolateText(headingMatch[2], context);
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentTitle) {
      sections.push({
        title: currentTitle,
        content: this.interpolateText(currentContent.join('\n').trim(), context),
        level: currentLevel,
      });
    }

    return sections;
  }

  /**
   * Simple {{variable}} interpolation supporting dot-notation.
   */
  private interpolateText(text: string, context: Record<string, unknown>): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const value = this.resolvePath(context, path.trim());
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });
  }

  private resolvePath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

}
