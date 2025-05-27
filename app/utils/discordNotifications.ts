export type NotificationEvent =
  | { type: "RESUME_REVIEW_STARTED"; email: string }
  | { type: "UNAUTHORIZED_ACCESS_ATTEMPT"; email: string }
  | { type: "RESUME_AI_FEEDBACK"; email: string };

const formatDiscordMessage = (event: NotificationEvent): string => {
  switch (event.type) {
    case "RESUME_REVIEW_STARTED":
      return `🔍 Resume validation started for ${event.email}`;
    case "UNAUTHORIZED_ACCESS_ATTEMPT":
      return `⚠️ Unauthorized access attempt from ${event.email}`;
    case "RESUME_AI_FEEDBACK":
      return `🤖 AI feedback generated for ${event.email}'s resume`;
    default:
      return "Unknown event";
  }
};

export async function sendDiscordNotification(
  event: NotificationEvent
): Promise<void> {
  try {
    const message = formatDiscordMessage(event);
    await fetch("/api/discord-notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
    });
  } catch (error) {
    console.error("Failed to send Discord notification:", error);
  }
}
