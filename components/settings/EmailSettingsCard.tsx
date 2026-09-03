"use client";

import * as React from "react";

import {
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Status =
  | {
      kind: "idle";
      message: string;
    }
  | {
      kind: "success";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    };

export function EmailSettingsCard() {
  const [sending, setSending] =
    React.useState(false);

  const [status, setStatus] =
    React.useState<Status>({
      kind: "idle",
      message:
        "Sends only to the currently signed-in NOVA account.",
    });

  async function sendTest() {
    if (sending) return;

    setSending(true);

    setStatus({
      kind: "idle",
      message:
        "Sending a test email through Resend…",
    });

    try {
      const response = await fetch(
        "/api/email/test",
        {
          method: "POST",
        },
      );

      const result =
        (await response.json()) as {
          error?: string;
          email?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to send test email.",
        );
      }

      setStatus({
        kind: "success",
        message: result.email
          ? `Test email sent to ${result.email}.`
          : "Test email sent successfully.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to send test email.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />

          Resend Transactional Email
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-[16px] border bg-muted/20 p-4 text-sm text-muted-foreground">
          Supabase Auth uses Resend through SMTP.
          NOVA itself uses the Resend API for
          receipts and other transactional emails.
          The API key stays server-side and is
          never exposed to the browser.
        </div>

        <div
          className={`flex items-start gap-3 rounded-[16px] border p-4 text-sm ${
            status.kind === "success"
              ? "border-emerald-500/25 bg-emerald-500/10"
              : status.kind === "error"
                ? "border-destructive/25 bg-destructive/10"
                : "bg-background"
          }`}
        >
          {status.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : status.kind === "error" ? (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}

          <span>{status.message}</span>
        </div>

        <Button
          type="button"
          onClick={sendTest}
          disabled={sending}
        >
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}

          {sending
            ? "Sending…"
            : "Send test email"}
        </Button>
      </CardContent>
    </Card>
  );
}