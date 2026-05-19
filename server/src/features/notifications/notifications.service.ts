import { Injectable } from '@nestjs/common';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { notifications } from '../../db/schema';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  /** Get notifications for an org (unread first, most recent) */
  async findByOrganization(organizationId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const conditions = [eq(notifications.organizationId, organizationId)];
    if (opts.unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }

    return this.db.db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: [desc(notifications.createdAt)],
      limit: Math.min(opts.limit ?? 50, 200),
    });
  }

  /** Get unread count for an org */
  async getUnreadCount(organizationId: string): Promise<number> {
    const [result] = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.organizationId, organizationId), isNull(notifications.readAt)));

    return result?.count ?? 0;
  }

  /** Mark a single notification as read */
  async markAsRead(notificationId: string): Promise<void> {
    await this.db.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, notificationId));
  }

  /** Mark all notifications for an org as read */
  async markAllAsRead(organizationId: string): Promise<void> {
    await this.db.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.organizationId, organizationId), isNull(notifications.readAt)));
  }

  /** Delete a notification */
  async delete(notificationId: string): Promise<void> {
    await this.db.db
      .delete(notifications)
      .where(eq(notifications.id, notificationId));
  }
}
