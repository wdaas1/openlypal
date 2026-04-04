type PushNotificationPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const payload: PushNotificationPayload = {
    to: token,
    title,
    body,
    data: data ?? {},
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[push-notifications] Failed to send push notification:", response.status, text);
    }
  } catch (error) {
    console.error("[push-notifications] Error sending push notification:", error);
  }
}
