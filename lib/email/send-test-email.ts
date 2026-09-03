import {
  getEmailFromAddress,
  getEmailReplyTo,
  getResendClient,
} from "@/lib/email/resend";

import { novaEmailTemplate } from "@/lib/email/templates/nova-email";

export async function sendNovaTestEmail(to: string) {
  const resend = getResendClient();

  return resend.emails.send({
    from: getEmailFromAddress(),

    to: [to],

    replyTo: getEmailReplyTo(),

    subject: "NOVA POS email connection verified",

    html: novaEmailTemplate({
      eyebrow: "System Test",

      title: "Email Connection Verified",

      message:
        "Your NOVA POS transactional email system is connected successfully and ready to send secure system emails.",

      details: [
        {
          label: "Email Provider",
          value: "Resend",
        },
        {
          label: "Status",
          value: "Connected",
        },
        {
          label: "Environment",
          value: "NOVA POS",
        },
      ],

      footer: "NOVA POS · BUSINESS SYSTEMS",
    }),
  });
}