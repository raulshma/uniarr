export { default as WebhookNotifications } from "./WebhookNotifications/WebhookNotifications";
export type { WebhookNotificationsProps } from "./WebhookNotifications/WebhookNotifications";

// Re-export webhook service and types
export {
  webhookService,
  WebhookService,
} from "@/services/webhooks/WebhookService";
export type {
  WebhookEvent,
  WebhookNotification,
  WebhookConfig,
} from "@/services/webhooks/WebhookService";
