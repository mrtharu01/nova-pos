"use client";

import * as React from "react";

import type {
  RealtimeChannel,
} from "@supabase/supabase-js";

import {
  QRCodeSVG,
} from "qrcode.react";

import {
  Check,
  Copy,
  Link2,
  Loader2,
  Radio,
  Smartphone,
  Unplug,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  remoteScannerTopic,
  type ProductScanBroadcast,
  type RemoteScanResult,
} from "@/lib/remote-scanner/protocol";


/* ============================================================
   TYPES
============================================================ */

type ScannerSession = {
  id: string;
  pair_token: string;
  expires_at: string;
};

type BroadcastMessage = {
  payload?: ProductScanBroadcast;
};

type RealtimeSubscribeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR";

type RealtimeSubscribeError =
  Error | null | undefined;


/* ============================================================
   HELPERS
============================================================ */

function getPublicBaseUrl() {
  const configured =
    process.env
      .NEXT_PUBLIC_NOVA_PUBLIC_URL
      ?.trim()
      .replace(/\/+$/, "");

  if (configured) {
    return configured;
  }

  if (
    typeof window !== "undefined"
  ) {
    return window.location.origin;
  }

  return "";
}


function scannerPresenceExists(
  channel: RealtimeChannel,
) {
  const state =
    channel.presenceState() as Record<
      string,
      Array<
        Record<string, unknown>
      >
    >;

  return Object.values(state)
    .flat()
    .some(
      (presence) =>
        presence.role ===
        "scanner",
    );
}


/* ============================================================
   COMPONENT
============================================================ */

export function RemoteScannerControl({
  onScan,
}: {
  onScan: (
    value: string,
  ) => RemoteScanResult;
}) {
  const {
    business,
    demo,
  } =
    useCurrentBusiness();

  const supabase =
    React.useMemo(
      () =>
        demo
          ? null
          : createClient(),
      [demo],
    );

  const onScanRef =
    React.useRef(onScan);

  const channelRef =
    React.useRef<RealtimeChannel | null>(
      null,
    );


  /* ============================================================
     STATE
  ============================================================ */

  const [
    dialogOpen,
    setDialogOpen,
  ] =
    React.useState(false);

  const [
    creating,
    setCreating,
  ] =
    React.useState(false);

  const [
    session,
    setSession,
  ] =
    React.useState<ScannerSession | null>(
      null,
    );

  const [
    phoneConnected,
    setPhoneConnected,
  ] =
    React.useState(false);

  const [
    realtimeConnected,
    setRealtimeConnected,
  ] =
    React.useState(false);

  const [
    error,
    setError,
  ] =
    React.useState<string | null>(
      null,
    );

  const [
    copied,
    setCopied,
  ] =
    React.useState(false);

  const [
    lastScan,
    setLastScan,
  ] =
    React.useState<string | null>(
      null,
    );


  /* ============================================================
     KEEP SCAN CALLBACK CURRENT
  ============================================================ */

  React.useEffect(() => {
    onScanRef.current =
      onScan;
  }, [onScan]);


  /* ============================================================
     PAIRING URL
  ============================================================ */

  const pairUrl =
    React.useMemo(() => {
      if (!session) {
        return "";
      }

      const base =
        getPublicBaseUrl();

      return `${base}/remote-scanner/${session.pair_token}`;
    }, [session]);


  const localhostWarning =
    React.useMemo(() => {
      if (!pairUrl) {
        return false;
      }

      try {
        const url =
          new URL(pairUrl);

        return (
          url.hostname ===
            "localhost" ||
          url.hostname ===
            "127.0.0.1"
        );
      } catch {
        return false;
      }
    }, [pairUrl]);


  /* ============================================================
     REMOVE REALTIME CONNECTION
  ============================================================ */

  const removeRealtimeChannel =
    React.useCallback(() => {
      const channel =
        channelRef.current;

      if (!channel) {
        return;
      }

      channelRef.current =
        null;

      setRealtimeConnected(
        false,
      );

      setPhoneConnected(
        false,
      );

      if (supabase) {
        void supabase.removeChannel(
          channel,
        );
      }
    }, [supabase]);


  /* ============================================================
     REALTIME CONNECTION
  ============================================================ */

  React.useEffect(() => {
    if (
      !session ||
      !supabase
    ) {
      return;
    }

    removeRealtimeChannel();

    const topic =
      remoteScannerTopic(
        session.pair_token,
      );

    const channel =
      supabase.channel(
        topic,
        {
          config: {
            broadcast: {
              ack: true,
            },

            presence: {
              key:
                `pos-${session.id}`,
            },
          },
        },
      );

    channelRef.current =
      channel;


    /* ==========================
       PRESENCE
    ========================== */

    function updatePresence() {
      setPhoneConnected(
        scannerPresenceExists(
          channel,
        ),
      );
    }


    channel
      .on(
        "presence",
        {
          event: "sync",
        },
        updatePresence,
      )

      .on(
        "presence",
        {
          event: "join",
        },
        updatePresence,
      )

      .on(
        "presence",
        {
          event: "leave",
        },
        updatePresence,
      )


      /* ==========================
         REMOTE PRODUCT SCAN
      ========================== */

      .on(
        "broadcast",
        {
          event:
            "product_scan",
        },
        (
          message: BroadcastMessage,
        ) => {
          const payload =
            message.payload;

          if (
            !payload ||
            typeof payload.value !==
              "string" ||
            typeof payload.requestId !==
              "string" ||
            typeof payload.scannerId !==
              "string"
          ) {
            return;
          }

          let result:
            RemoteScanResult;

          try {
            result =
              onScanRef.current(
                payload.value,
              );
          } catch (cause) {
            console.error(
              "Remote scanner product handling failed:",
              cause,
            );

            result = {
              accepted: false,

              message:
                "NOVA could not process this scan.",
            };
          }


          /* ==========================
             SAVE LAST SUCCESSFUL SCAN
          ========================== */

          if (
            result.accepted
          ) {
            setLastScan(
              result.label ??
                payload.value,
            );
          }


          /* ==========================
             SEND RESULT BACK TO PHONE
          ========================== */

          void channel.send({
            type: "broadcast",

            event:
              "scan_result",

            payload: {
              requestId:
                payload.requestId,

              scannerId:
                payload.scannerId,

              accepted:
                result.accepted,

              label:
                result.label,

              message:
                result.message,
            },
          });
        },
      )


      /* ==========================
         SUBSCRIBE
      ========================== */

      .subscribe(
        async (
          status: RealtimeSubscribeStatus,
          subscribeError?: RealtimeSubscribeError,
        ) => {
          if (
            status ===
            "SUBSCRIBED"
          ) {
            setRealtimeConnected(
              true,
            );

            setError(null);

            await channel.track({
              role: "pos",

              online_at:
                new Date().toISOString(),
            });

            return;
          }


          if (
            status ===
              "CHANNEL_ERROR" ||
            status ===
              "TIMED_OUT"
          ) {
            console.error(
              "Remote scanner realtime error:",
              status,
              subscribeError,
            );

            setRealtimeConnected(
              false,
            );

            setError(
              "The remote scanner realtime connection failed.",
            );
          }


          if (
            status ===
            "CLOSED"
          ) {
            setRealtimeConnected(
              false,
            );

            setPhoneConnected(
              false,
            );
          }
        },
      );


    /* ==========================================================
       SESSION EXPIRATION TIMER
    ========================================================== */

    const expiresAt =
      new Date(
        session.expires_at,
      ).getTime();

    const remaining =
      Math.max(
        0,
        expiresAt -
          Date.now(),
      );

    const expiryTimer =
      window.setTimeout(
        () => {
          setError(
            "This phone scanner session has expired.",
          );

          removeRealtimeChannel();

          setSession(null);
        },
        remaining,
      );


    /* ==========================================================
       CLEANUP
    ========================================================== */

    return () => {
      window.clearTimeout(
        expiryTimer,
      );

      if (
        channelRef.current ===
        channel
      ) {
        channelRef.current =
          null;
      }

      void channel.untrack();

      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    session,
    supabase,
    removeRealtimeChannel,
  ]);


  /* ============================================================
     CREATE PAIRING SESSION
  ============================================================ */

  async function createSession() {
    if (
      !supabase ||
      !business?.id ||
      creating
    ) {
      return;
    }

    setCreating(true);

    setError(null);

    setLastScan(null);

    try {
      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser();


      if (
        userError ||
        !userData.user
      ) {
        throw new Error(
          "You must be signed in to connect a phone scanner.",
        );
      }


      /* ========================================================
         CLOSE EXISTING ACTIVE SESSIONS
      ======================================================== */

      const now =
        new Date().toISOString();

      const {
        error:
          closeExistingError,
      } =
        await supabase
          .from(
            "remote_scanner_sessions",
          )
          .update({
            status:
              "closed",

            closed_at:
              now,
          })
          .eq(
            "created_by",
            userData.user.id,
          )
          .eq(
            "status",
            "active",
          );


      if (
        closeExistingError
      ) {
        console.warn(
          "Could not automatically close previous scanner sessions:",
          closeExistingError,
        );
      }


      /* ========================================================
         CREATE NEW SESSION
      ======================================================== */

      const expiresAt =
        new Date(
          Date.now() +
            8 *
              60 *
              60 *
              1000,
        ).toISOString();


      const {
        data,
        error:
          insertError,
      } =
        await supabase
          .from(
            "remote_scanner_sessions",
          )
          .insert({
            business_id:
              business.id,

            expires_at:
              expiresAt,
          })
          .select(
            "id,pair_token,expires_at",
          )
          .single();


      if (
        insertError
      ) {
        throw insertError;
      }


      if (!data) {
        throw new Error(
          "NOVA could not create the scanner session.",
        );
      }


      const nextSession =
        data as ScannerSession;


      setSession(
        nextSession,
      );

      setDialogOpen(
        true,
      );
    } catch (cause) {
      console.error(
        "Unable to create remote scanner session:",
        cause,
      );


      if (
        cause instanceof
        Error
      ) {
        setError(
          cause.message,
        );
      } else if (
        cause &&
        typeof cause ===
          "object" &&
        "message" in cause &&
        typeof (
          cause as {
            message?: unknown;
          }
        ).message ===
          "string"
      ) {
        setError(
          (
            cause as {
              message: string;
            }
          ).message,
        );
      } else {
        setError(
          "Unable to create the phone scanner session.",
        );
      }
    } finally {
      setCreating(
        false,
      );
    }
  }


  /* ============================================================
     DISCONNECT
  ============================================================ */

  async function disconnect() {
    const activeSession =
      session;

    removeRealtimeChannel();

    setSession(null);

    setPhoneConnected(false);

    setDialogOpen(false);

    setLastScan(null);


    if (
      !activeSession ||
      !supabase
    ) {
      return;
    }


    const {
      error:
        updateError,
    } =
      await supabase
        .from(
          "remote_scanner_sessions",
        )
        .update({
          status:
            "closed",

          closed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          activeSession.id,
        );


    if (
      updateError
    ) {
      console.error(
        "Unable to close remote scanner session:",
        updateError,
      );
    }
  }


  /* ============================================================
     COPY PAIR LINK
  ============================================================ */

  async function copyPairLink() {
    if (!pairUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        pairUrl,
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        1200,
      );
    } catch {
      setError(
        "Unable to copy the pairing link.",
      );
    }
  }


  /* ============================================================
     DEMO MODE
  ============================================================ */

  if (demo) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className="h-11 rounded-xl"
      >
        <Smartphone className="mr-2 h-4 w-4" />

        Phone Scanner
      </Button>
    );
  }


  /* ============================================================
     UI
  ============================================================ */

  return (
    <>
      <Button
        type="button"
        variant={
          phoneConnected
            ? "secondary"
            : "outline"
        }
        className="h-11 rounded-xl"
        disabled={
          creating ||
          !business?.id
        }
        onClick={() => {
          if (session) {
            setDialogOpen(
              true,
            );

            return;
          }

          void createSession();
        }}
      >
        {creating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : phoneConnected ? (
          <Wifi className="mr-2 h-4 w-4 text-emerald-600" />
        ) : (
          <Smartphone className="mr-2 h-4 w-4" />
        )}

        <span className="hidden lg:inline">
          {phoneConnected
            ? "Phone Connected"
            : "Connect Phone"}
        </span>
      </Button>


      {/* ========================================================
          DIALOG
      ======================================================== */}

      <Dialog
        isOpen={
          dialogOpen
        }
        onClose={() =>
          setDialogOpen(
            false,
          )
        }
        title="Remote Phone Scanner"
        description="Use your phone camera as a wireless scanner while the full POS stays on this laptop."
        className="max-w-xl"
      >
        {!session ? (
          <div className="py-8 text-center">
            <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />

            <p className="mt-4 text-sm text-muted-foreground">
              No scanner session is
              currently active.
            </p>

            <Button
              type="button"
              className="mt-5 rounded-[14px]"
              onClick={() =>
                void createSession()
              }
              disabled={
                creating
              }
            >
              {creating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              Create Scanner Session
            </Button>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ======================
                STATUS
            ======================= */}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[16px] border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Realtime
                </p>

                <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  {realtimeConnected ? (
                    <>
                      <Radio className="h-4 w-4 text-emerald-600" />
                      Ready
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-amber-600" />
                      Connecting…
                    </>
                  )}
                </div>
              </div>


              <div className="rounded-[16px] border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Phone
                </p>

                <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  {phoneConnected ? (
                    <>
                      <Wifi className="h-4 w-4 text-emerald-600" />
                      Connected
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      Waiting
                    </>
                  )}
                </div>
              </div>
            </div>


            {/* ======================
                PAIRING QR
            ======================= */}

            <div className="rounded-[24px] border bg-muted/20 p-3">
              <div className="rounded-[16px] bg-white p-6 text-center text-black">
                <QRCodeSVG
                  value={
                    pairUrl
                  }
                  size={
                    230
                  }
                  level="M"
                  marginSize={
                    4
                  }
                  className="mx-auto"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />

                <p className="mt-4 text-sm font-bold">
                  Scan once with your
                  phone camera
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  The phone opens only
                  the NOVA scanner
                  companion.
                </p>
              </div>
            </div>


            {/* ======================
                PAIR URL
            ======================= */}

            <div className="flex gap-2 rounded-[16px] border bg-muted/20 p-2">
              <div className="min-w-0 flex-1 px-2 py-2">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {pairUrl}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-[12px]"
                onClick={() =>
                  void copyPairLink()
                }
                aria-label="Copy pairing link"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>


            {/* ======================
                LOCALHOST WARNING
            ======================= */}

            {localhostWarning && (
              <div className="rounded-[16px] border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                This pairing link uses
                localhost. Your phone
                cannot open your
                laptop&apos;s
                localhost.

                Deploy NOVA to HTTPS
                or set{" "}
                <code className="font-mono font-semibold">
                  NEXT_PUBLIC_NOVA_PUBLIC_URL
                </code>{" "}
                to your HTTPS NOVA
                address.
              </div>
            )}


            {/* ======================
                ERROR
            ======================= */}

            {error && (
              <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </div>
            )}


            {/* ======================
                LAST SCAN
            ======================= */}

            {lastScan && (
              <div className="rounded-[16px] border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Last Remote Scan
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {lastScan}
                </p>
              </div>
            )}


            {/* ======================
                ACTIONS
            ======================= */}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-[14px]"
                onClick={() =>
                  void copyPairLink()
                }
              >
                <Link2 className="mr-2 h-4 w-4" />

                Copy Link
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="flex-1 rounded-[14px]"
                onClick={() =>
                  void disconnect()
                }
              >
                <Unplug className="mr-2 h-4 w-4" />

                Disconnect
              </Button>
            </div>


            <p className="text-center text-[11px] leading-5 text-muted-foreground">
              Pairing expires
              automatically after
              eight hours.
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}