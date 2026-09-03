import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export function getEmailFromAddress() {
  return (
    process.env.NOVA_EMAIL_FROM?.trim() ||
    "NOVA POS <onboarding@resend.dev>"
  );
}

export function getEmailReplyTo() {
  const value = process.env.NOVA_EMAIL_REPLY_TO?.trim();

  return value || undefined;
}