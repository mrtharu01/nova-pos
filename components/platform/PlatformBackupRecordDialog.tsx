"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { recordPlatformBackupEvent } from "@/lib/data/platform-admin";

import type {
  PlatformBackupEventKind,
  PlatformBackupEventStatus,
} from "@/lib/domain/platform-admin";


type ManualKind =
  Exclude<
    PlatformBackupEventKind,
    "tenant_export"
  >;


export function PlatformBackupRecordDialog({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [kind, setKind] =
    React.useState<ManualKind>("database_dump");

  const [status, setStatus] =
    React.useState<PlatformBackupEventStatus>("success");

  const [occurredAt, setOccurredAt] =
    React.useState("");

  const [note, setNote] =
    React.useState("");

  const [saving, setSaving] =
    React.useState(false);

  const [error, setError] =
    React.useState<string | null>(null);


  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      await recordPlatformBackupEvent({
        kind,
        status,
        note,
        occurredAt:
          occurredAt
            ? new Date(occurredAt).toISOString()
            : undefined,
      });

      setOccurredAt("");
      setNote("");
      setStatus("success");
      onClose();
      onRecorded();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Recovery event could not be recorded.",
      );
    } finally {
      setSaving(false);
    }
  }


  return (
    <Dialog
      isOpen={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Record Recovery Event"
      description="Record this only after the external backup or restore operation actually completed."
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Event
          </label>

          <Select
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as ManualKind)
            }
            disabled={saving}
            className="mt-2"
          >
            <option value="database_dump">
              Database dump
            </option>
            <option value="storage_snapshot">
              Storage snapshot
            </option>
            <option value="restore_test">
              Restore test
            </option>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Result
          </label>

          <Select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PlatformBackupEventStatus)
            }
            disabled={saving}
            className="mt-2"
          >
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Completed at
          </label>

          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(event) =>
              setOccurredAt(event.target.value)
            }
            disabled={saving}
            className="mt-2"
          />

          <p className="mt-1 text-[11px] text-muted-foreground">
            Leave blank to use the current time.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Note
          </label>

          <Textarea
            value={note}
            onChange={(event) =>
              setNote(event.target.value)
            }
            placeholder="Example: encrypted logical dump copied off-site and checksum verified."
            disabled={saving}
            className="mt-2 min-h-24"
          />
        </div>

        {error ? (
          <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={saving}
          >
            {saving ? "Recording..." : "Record Event"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
