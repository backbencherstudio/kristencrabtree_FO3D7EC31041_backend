export interface NotificationPayload {
  title: string;
  body: string;
  image?: string;
  data?: Record<string, string>;
}

// Options to save notification to DB
export interface NotificationOptions {
  senderId?: string; // who triggered it (optional)
  receiverId: string; // who receives it
  type: string; // e.g. 'journal_created', 'dig_unlocked'
  entityId?: string; // related record id
}

export interface SingleNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

export interface MultiNotificationResult {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  results: SingleNotificationResult[];
}
