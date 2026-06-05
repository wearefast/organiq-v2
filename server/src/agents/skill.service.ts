import { Injectable, Logger } from '@nestjs/common';
import { existsSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface CachedSkill {
  content: string;
  mtime: number;
}

@Injectable()
export class SkillService {
  private readonly logger = new Logger(SkillService.name);
  private readonly skillsDir: string;
  private readonly cache = new Map<string, CachedSkill>();

  constructor() {
    this.skillsDir = this.resolveSkillsDir();
  }

  private resolveSkillsDir(): string {
    const candidates = [
      join(process.cwd(), 'src', 'skills'),
      join(process.cwd(), 'server', 'src', 'skills'),
      join(__dirname, '..', 'skills'),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  }

  /**
   * Load skill content from server/src/skills/{skillId}/skill.md.
   * Returns null if the skill file does not exist (some steps have no skill).
   * Cache entries are validated against the file's mtime on each call so that
   * skill edits take effect without a server restart (same pattern as PromptService).
   */
  async loadSkill(skillId: string | undefined): Promise<string | null> {
    if (!skillId) return null;

    const filePath = join(this.skillsDir, skillId, 'skill.md');
    if (!existsSync(filePath)) {
      this.logger.warn(`Skill file not found: ${filePath}`);
      return null;
    }

    const currentMtime = statSync(filePath).mtimeMs;
    const cached = this.cache.get(skillId);
    if (cached !== undefined && cached.mtime === currentMtime) {
      return cached.content;
    }

    const content = await readFile(filePath, 'utf-8');
    this.cache.set(skillId, { content, mtime: currentMtime });
    this.logger.debug(`Loaded skill: ${skillId}`);
    return content;
  }
}
