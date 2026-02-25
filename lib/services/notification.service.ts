// Notification service — stub for future implementation
// This will be extended to support email, in-app, and push notifications

export interface NotificationPayload {
  type: 'task_assigned' | 'task_comment' | 'task_status_changed' | 'task_due_soon'
  recipientId: string
  actorId: string
  entityId: string
  entityType: 'task' | 'project'
  message: string
  metadata?: Record<string, unknown>
}

export const notificationService = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_payload: NotificationPayload): Promise<void> {
    // TODO: implement notification delivery (email, websocket, etc.)
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendBulk(_payloads: NotificationPayload[]): Promise<void> {
    // TODO: implement bulk notification delivery
  },
}
