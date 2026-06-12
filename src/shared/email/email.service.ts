import { Resend } from "resend";
import { env } from "../config/env.js";

export async function sendTempPasswordEmail(
  to: string,
  userName: string,
  tempPassword: string,
): Promise<void> {
  if (env.NODE_ENV === "test") return;

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Acesso temporário — CheckObra",
    text: [
      `Olá ${userName},`,
      "",
      "Seu administrador redefiniu sua senha de acesso ao CheckObra.",
      "",
      `Senha temporária: ${tempPassword}`,
      "",
      "Você será solicitado a criar uma nova senha no próximo login.",
      "Não compartilhe esta senha.",
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  token: string,
): Promise<void> {
  if (env.NODE_ENV === "test") return;

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Redefinição de senha — CheckObra",
    text: [
      `Olá ${userName},`,
      "",
      "Recebemos uma solicitação de redefinição de senha para sua conta.",
      "",
      "Toque no link abaixo para criar uma nova senha (válido por 1 hora):",
      "",
      `checkobra://reset-password?token=${token}`,
      "",
      "Se não foi você, ignore este email. Sua senha não será alterada.",
    ].join("\n"),
  });
}
