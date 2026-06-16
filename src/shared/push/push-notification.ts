import { prisma } from "../infra/database/prisma.js";

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushToUsers(userIds: number[], message: PushMessage): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    sound: "default" as const,
  }));

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    // Push failures must never break the main flow
    console.error("[Push] Failed to send push notification:", err);
  }
}

export async function sendPushToCompanyInspectors(companyId: number, message: PushMessage): Promise<void> {
  const inspectors = await prisma.user.findMany({
    where: {
      companyId,
      role: { isCompanyAdmin: false },
      pushTokens: { some: {} },
    },
    select: { id: true },
  });
  if (inspectors.length === 0) return;
  await sendPushToUsers(inspectors.map((i) => i.id), message);
}
