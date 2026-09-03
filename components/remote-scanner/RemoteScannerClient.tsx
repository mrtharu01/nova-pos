"use client";

import * as React from "react";

import type {
  RealtimeChannel,
} from "@supabase/supabase-js";

import {
  CheckCircle2,
  Loader2,
  Monitor,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  Scanner,
} from "@/components/ui/scanner";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  remoteScannerTopic,
  type ScanResultBroadcast,
} from "@/lib/remote-scanner/protocol";

/* ============================================================
   TYPES
============================================================ */

type SessionLookup = {
  session_id: string;
  business_name: string;
  expires_at: string;
};

type ScanFeedback = {
  type:
    | "waiting"
    | "success"
    | "error";

  message: string;
};

type BroadcastMessage = {
  payload?: ScanResultBroadcast;
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

function getScannerId() {
  const key =
    "nova_remote_scanner_id";

  const existing =
    window.localStorage.getItem(
      key,
    );

  if (existing) {
    return existing;
  }

  const next =
    crypto.randomUUID();

  window.localStorage.setItem(
    key,
    next,
  );

  return next;
}

function posPresenceExists(
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
        "pos",
    );
}

/* ============================================================
   COMPONENT
============================================================ */

export function RemoteScannerClient({
  pairToken,
}: {
  pairToken: string;
}) {
  const supabase =
    React.useMemo(
      () => createClient(),
      [],
    );

  const channelRef =
    React.useRef<RealtimeChannel | null>(
      null,
    );

  const scannerIdRef =
    React.useRef<string | null>(
      null,
    );

  const [
    lookupLoading,
    setLookupLoading,
  ] =
    React.useState(true);

  const [
    session,
    setSession,
  ] =
    React.useState<SessionLookup | null>(
      null,
    );

  const [
    invalid,
    setInvalid,
  ] =
    React.useState(false);

  const [
    subscribed,
    setSubscribed,
  ] =
    React.useState(false);

  const [
    posConnected,
    setPosConnected,
  ] =
    React.useState(false);

  const [
    feedback,
    setFeedback,
  ] =
    React.useState<ScanFeedback | null>(
      null,
    );

  /* ============================================================
     CREATE / LOAD SCANNER DEVICE ID
  ============================================================ */

  React.useEffect(() => {
    scannerIdRef.current =
      getScannerId();
  }, []);

  /* ============================================================
     VALIDATE PAIRING TOKEN
  ============================================================ */

  React.useEffect(() => {
    let cancelled =
      false;

    async function validate() {
      setLookupLoading(
        true,
      );

      setInvalid(
        false,
      );

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "resolve_remote_scanner_session",
          {
            p_pair_token:
              pairToken,
          },
        );

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Remote scanner pairing validation failed:",
          error,
        );

        setInvalid(
          true,
        );

        setLookupLoading(
          false,
        );

        return;
      }

      const rows =
        data as
          | SessionLookup[]
          | null;

      const row =
        rows?.[0];

      if (!row) {
        setInvalid(
          true,
        );

        setLookupLoading(
          false,
        );

        return;
      }

      const expiresAt =
        new Date(
          row.expires_at,
        ).getTime();

      if (
        expiresAt <=
        Date.now()
      ) {
        setInvalid(
          true,
        );

        setLookupLoading(
          false,
        );

        return;
      }

      setSession(
        row,
      );

      setLookupLoading(
        false,
      );
    }

    void validate();

    return () => {
      cancelled = true;
    };
  }, [
    pairToken,
    supabase,
  ]);

  /* ============================================================
     CONNECT PHONE TO LAPTOP REALTIME CHANNEL
  ============================================================ */

  React.useEffect(() => {
    if (
      !session ||
      !scannerIdRef.current
    ) {
      return;
    }

    const scannerId =
      scannerIdRef.current;

    const channel =
      supabase.channel(
        remoteScannerTopic(
          pairToken,
        ),
        {
          config: {
            broadcast: {
              ack: true,
            },

            presence: {
              key:
                `scanner-${scannerId}`,
            },
          },
        },
      );

    channelRef.current =
      channel;

    /* =========================================================
       PRESENCE
    ========================================================= */

    function updatePresence() {
      setPosConnected(
        posPresenceExists(
          channel,
        ),
      );
    }

    channel
      .on(
        "presence",
        {
          event:
            "sync",
        },
        updatePresence,
      )

      .on(
        "presence",
        {
          event:
            "join",
        },
        updatePresence,
      )

      .on(
        "presence",
        {
          event:
            "leave",
        },
        updatePresence,
      )

      /* =======================================================
         RECEIVE RESULT FROM LAPTOP
      ======================================================= */

      .on(
        "broadcast",
        {
          event:
            "scan_result",
        },
        (
          message: BroadcastMessage,
        ) => {
          const payload =
            message.payload;

          if (
            !payload
          ) {
            return;
          }

          if (
            payload.scannerId !==
            scannerId
          ) {
            return;
          }

          if (
            payload.accepted
          ) {
            setFeedback({
              type:
                "success",

              message:
                payload.label
                  ? `${payload.label} added to laptop cart`
                  : "Product added to laptop cart",
            });

            if (
              "vibrate" in
              navigator
            ) {
              navigator.vibrate(
                80,
              );
            }
          } else {
            setFeedback({
              type:
                "error",

              message:
                payload.message ??
                "The laptop could not accept this product.",
            });

            if (
              "vibrate" in
              navigator
            ) {
              navigator.vibrate([
                100,
                60,
                100,
              ]);
            }
          }

          window.setTimeout(
            () => {
              setFeedback(
                null,
              );
            },
            2200,
          );
        },
      )

      /* =======================================================
         SUBSCRIBE
      ======================================================= */

      .subscribe(
        async (
          status: RealtimeSubscribeStatus,
          subscribeError?: RealtimeSubscribeError,
        ) => {
          if (
            status ===
            "SUBSCRIBED"
          ) {
            setSubscribed(
              true,
            );

            await channel.track({
              role:
                "scanner",

              scanner_id:
                scannerId,

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
              "Phone scanner realtime error:",
              status,
              subscribeError,
            );

            setSubscribed(
              false,
            );

            setPosConnected(
              false,
            );
          }

          if (
            status ===
            "CLOSED"
          ) {
            setSubscribed(
              false,
            );

            setPosConnected(
              false,
            );
          }
        },
      );

    /* =========================================================
       SESSION EXPIRATION
    ========================================================= */

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
          setInvalid(
            true,
          );

          setSession(
            null,
          );

          setSubscribed(
            false,
          );

          setPosConnected(
            false,
          );
        },
        remaining,
      );

    /* =========================================================
       CLEANUP
    ========================================================= */

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

      setSubscribed(
        false,
      );

      setPosConnected(
        false,
      );
    };
  }, [
    session,
    pairToken,
    supabase,
  ]);

  /* ============================================================
     SEND PRODUCT SCAN TO LAPTOP
  ============================================================ */

  function handleScan(
    value: string,
  ) {
    const channel =
      channelRef.current;

    const scannerId =
      scannerIdRef.current;

    if (
      !channel ||
      !scannerId ||
      !subscribed
    ) {
      setFeedback({
        type:
          "error",

        message:
          "Scanner connection is not ready yet.",
      });

      /*
       * Return true because the QR
       * itself was successfully read.
       *
       * The transmission error is
       * shown separately.
       */
      return true;
    }

    if (!posConnected) {
      setFeedback({
        type:
          "error",

        message:
          "Laptop POS is not connected.",
      });

      return true;
    }

    const requestId =
      crypto.randomUUID();

    setFeedback({
      type:
        "waiting",

      message:
        "Sending scan to laptop…",
    });

    void channel
      .send({
        type:
          "broadcast",

        event:
          "product_scan",

        payload: {
          requestId,

          scannerId,

          value,

          scannedAt:
            new Date().toISOString(),
        },
      })

      .then(
        (
          status,
        ) => {
          if (
            status !==
            "ok"
          ) {
            setFeedback({
              type:
                "error",

              message:
                "The scan could not be delivered to the laptop.",
            });
          }
        },
      )

      .catch(
        (
          cause,
        ) => {
          console.error(
            "Remote scan send failed:",
            cause,
          );

          setFeedback({
            type:
              "error",

            message:
              "The scan could not be delivered to the laptop.",
          });
        },
      );

    return true;
  }

  /* ============================================================
     LOADING
  ============================================================ */

  if (
    lookupLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />

          <p className="mt-4 text-sm text-white/60">
            Connecting NOVA
            Scanner…
          </p>
        </div>
      </main>
    );
  }

  /* ============================================================
     INVALID / EXPIRED
  ============================================================ */

  if (
    invalid ||
    !session
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-red-500/15">
            <TriangleAlert className="h-7 w-7 text-red-400" />
          </div>

          <h1 className="mt-5 text-xl font-semibold">
            Scanner Link Expired
          </h1>

          <p className="mt-2 text-sm leading-6 text-white/55">
            Return to NOVA on the
            laptop and create a new
            remote scanner session.
          </p>
        </div>
      </main>
    );
  }

  /* ============================================================
     ACTIVE REMOTE SCANNER
  ============================================================ */

  return (
    <>
      <Scanner
        isOpen
        continuous
        onScan={
          handleScan
        }
        onClose={() => {
          /*
           * Remote scanner is a
           * dedicated companion page.
           *
           * Closing it takes the user
           * to a neutral blank page.
           */
          window.location.href =
            "about:blank";
        }}
      />

      {/* ========================================================
          PHONE STATUS OVERLAY
      ======================================================== */}

      <div className="pointer-events-none fixed left-1/2 top-20 z-[60] w-[calc(100%-32px)] max-w-sm -translate-x-1/2">
        <div className="rounded-[20px] border border-white/10 bg-black/65 p-3 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {
                  session.business_name
                }
              </p>

              <p className="mt-0.5 text-[11px] text-white/50">
                NOVA Remote Scanner
              </p>
            </div>

            <div
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                posConnected
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {posConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}

              {posConnected
                ? "Laptop connected"
                : "Waiting for laptop"}
            </div>
          </div>

          {feedback && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-[14px] p-2.5 text-xs ${
                feedback.type ===
                "success"
                  ? "bg-emerald-500/15 text-emerald-200"
                  : feedback.type ===
                      "error"
                    ? "bg-red-500/15 text-red-200"
                    : "bg-white/10 text-white/70"
              }`}
            >
              {feedback.type ===
              "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : feedback.type ===
                "error" ? (
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Monitor className="mt-0.5 h-4 w-4 shrink-0" />
              )}

              <span>
                {
                  feedback.message
                }
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}