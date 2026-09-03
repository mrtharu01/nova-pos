"use client";

import * as React from "react";

import {
  Building2,
  Camera,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  fetchAccountProfile,
  removeProfileAvatar,
  updateAccountName,
  uploadProfileAvatar,
  type AccountProfile,
} from "@/lib/data/profile";


type ProfileDialogProps = {
  isOpen: boolean;

  onClose:
    () => void;

  businessName: string;

  roleLabel: string;

  onProfileUpdated?:
    (
      profile:
        AccountProfile,
    ) => void;
};


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Profile could not be updated.";
}


function initials(
  value: string,
) {
  const pieces =
    value
      .trim()
      .split(/\s+/)
      .filter(
        Boolean,
      );


  if (
    pieces.length ===
    0
  ) {
    return "NV";
  }


  if (
    pieces.length ===
    1
  ) {
    return pieces[0]
      .slice(
        0,
        2,
      )
      .toUpperCase();
  }


  return (
    pieces[0][0] +
    pieces[
      pieces.length - 1
    ][0]
  ).toUpperCase();
}


export function ProfileDialog({
  isOpen,
  onClose,
  businessName,
  roleLabel,
  onProfileUpdated,
}: ProfileDialogProps) {
  const fileInputRef =
    React.useRef<HTMLInputElement | null>(
      null,
    );


  const [
    profile,
    setProfile,
  ] =
    React.useState<
      AccountProfile | null
    >(null);


  const [
    displayName,
    setDisplayName,
  ] =
    React.useState("");


  const [
    loading,
    setLoading,
  ] =
    React.useState(false);


  const [
    saving,
    setSaving,
  ] =
    React.useState(false);


  const [
    uploading,
    setUploading,
  ] =
    React.useState(false);


  const [
    removing,
    setRemoving,
  ] =
    React.useState(false);


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  const busy =
    saving ||
    uploading ||
    removing;


  /* ==========================================================
     LOAD PROFILE
  ========================================================== */

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }


    let cancelled =
      false;


    setLoading(true);

    setError(null);


    void fetchAccountProfile()
      .then(
        (result) => {
          if (
            cancelled
          ) {
            return;
          }


          setProfile(
            result,
          );


          setDisplayName(
            result.displayName,
          );
        },
      )
      .catch(
        (cause: unknown) => {
          if (
            cancelled
          ) {
            return;
          }


          setError(
            getErrorMessage(
              cause,
            ),
          );
        },
      )
      .finally(
        () => {
          if (
            !cancelled
          ) {
            setLoading(false);
          }
        },
      );


    return () => {
      cancelled =
        true;
    };
  }, [
    isOpen,
  ]);


  /* ==========================================================
     UPDATE LOCAL PROFILE
  ========================================================== */

  function commitProfile(
    next:
      AccountProfile,
  ) {
    setProfile(
      next,
    );


    setDisplayName(
      next.displayName,
    );


    onProfileUpdated?.(
      next,
    );
  }


  /* ==========================================================
     SAVE PROFILE
  ========================================================== */

  async function handleSave() {
    if (
      saving ||
      uploading ||
      removing
    ) {
      return;
    }


    if (
      !displayName.trim()
    ) {
      setError(
        "Display name is required.",
      );

      return;
    }


    setSaving(true);

    setError(null);


    try {
      const result =
        await updateAccountName(
          displayName,
        );


      /*
       * Update the sidebar immediately.
       */

      commitProfile(
        result,
      );


      /*
       * Close the profile popup after
       * the save completes successfully.
       */

      onClose();

    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(false);
    }
  }


  /* ==========================================================
     UPLOAD AVATAR
  ========================================================== */

  async function handleFile(
    file:
      File |
      undefined,
  ) {
    if (
      !file ||
      uploading ||
      saving ||
      removing
    ) {
      return;
    }


    setUploading(true);

    setError(null);


    try {
      const result =
        await uploadProfileAvatar(
          file,
        );


      commitProfile(
        result,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setUploading(false);


      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  }


  /* ==========================================================
     REMOVE AVATAR
  ========================================================== */

  async function handleRemovePhoto() {
    if (
      removing ||
      uploading ||
      saving
    ) {
      return;
    }


    setRemoving(true);

    setError(null);


    try {
      const result =
        await removeProfileAvatar();


      commitProfile(
        result,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setRemoving(false);
    }
  }


  /* ==========================================================
     KEYBOARD
  ========================================================== */

  function handleNameKeyDown(
    event:
      React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key !==
        "Enter" ||
      event.nativeEvent.isComposing
    ) {
      return;
    }


    event.preventDefault();


    if (!busy) {
      void handleSave();
    }
  }


  return (
    <Dialog
      isOpen={
        isOpen
      }
      onClose={
        busy
          ? () => {}
          : onClose
      }
      title="Profile"
      description="Manage your NOVA account profile."
      className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-hidden"
    >

      {loading ? (

        <div className="flex min-h-[300px] items-center justify-center">

          <Loader2 className="h-7 w-7 animate-spin text-primary" />

        </div>

      ) : profile ? (

        <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]">

          <div className="space-y-5 pb-1">

            {/* ===============================================
                AVATAR
            ================================================ */}

            <div className="flex flex-col items-center text-center">

              <div className="relative">

                {profile.avatarUrl ? (

                  <img
                    src={
                      profile.avatarUrl
                    }
                    alt="Profile"
                    className="h-24 w-24 rounded-[28px] border object-cover shadow-sm"
                  />

                ) : (

                  <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary/10 text-2xl font-bold text-primary">

                    {
                      initials(
                        profile.displayName,
                      )
                    }

                  </div>

                )}


                {uploading && (

                  <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-background/70 backdrop-blur-sm">

                    <Loader2 className="h-6 w-6 animate-spin text-primary" />

                  </div>

                )}

              </div>


              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(
                  event,
                ) =>
                  void handleFile(
                    event.target.files?.[0],
                  )
                }
              />


              <div className="mt-4 flex flex-wrap justify-center gap-2">

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-[14px]"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >

                  <Camera className="mr-2 h-4 w-4" />


                  {profile.avatarUrl
                    ? "Change Photo"
                    : "Add Photo"}

                </Button>


                {profile.avatarUrl && (

                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-[14px] text-destructive hover:text-destructive"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void handleRemovePhoto()
                    }
                  >

                    {removing ? (

                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                    ) : (

                      <Trash2 className="mr-2 h-4 w-4" />

                    )}


                    Remove

                  </Button>

                )}

              </div>


              <p className="mt-2 text-[11px] text-muted-foreground">
                JPG, PNG or WebP. NOVA automatically converts the image to WebP.
              </p>

            </div>


            {/* ===============================================
                DISPLAY NAME
            ================================================ */}

            <div className="space-y-2">

              <label className="text-sm font-semibold">
                Display name
              </label>


              <Input
                value={
                  displayName
                }
                disabled={
                  busy
                }
                onChange={(
                  event,
                ) => {
                  setDisplayName(
                    event.target.value,
                  );


                  setError(
                    null,
                  );
                }}
                onKeyDown={
                  handleNameKeyDown
                }
                className="h-11 rounded-[14px]"
                placeholder="Your name"
              />


              <p className="text-[10px] text-muted-foreground">
                Press Enter or Save Profile to save changes.
              </p>

            </div>


            {/* ===============================================
                ACCOUNT INFORMATION
            ================================================ */}

            <div className="overflow-hidden rounded-[18px] border">

              <ProfileLine
                icon={
                  <Mail className="h-4 w-4" />
                }
                label="Email"
                value={
                  profile.email ||
                  "—"
                }
              />


              <ProfileLine
                icon={
                  <ShieldCheck className="h-4 w-4" />
                }
                label="Role"
                value={
                  roleLabel
                }
              />


              <ProfileLine
                icon={
                  <Building2 className="h-4 w-4" />
                }
                label="Business"
                value={
                  businessName
                }
                last
              />

            </div>


            {/* ===============================================
                ERROR
            ================================================ */}

            {error && (

              <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">

                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />


                <span className="min-w-0 break-words">
                  {
                    error
                  }
                </span>

              </div>

            )}


            {/* ===============================================
                SAVE
            ================================================ */}

            <Button
              type="button"
              className="h-11 w-full rounded-[14px]"
              disabled={
                busy ||
                !displayName.trim()
              }
              onClick={() =>
                void handleSave()
              }
            >

              {saving ? (

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              ) : (

                <UserRound className="mr-2 h-4 w-4" />

              )}


              {saving
                ? "Saving…"
                : "Save Profile"}

            </Button>


            {/* ===============================================
                SIGN OUT
            ================================================ */}

            <div className="border-t pt-4">

              <form
                action="/auth/signout"
                method="post"
              >

                <button
                  type="submit"
                  disabled={
                    busy
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-destructive/20 bg-destructive/5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >

                  <LogOut className="h-4 w-4" />

                  Sign Out

                </button>

              </form>

            </div>

          </div>

        </div>

      ) : (

        <div className="flex min-h-[240px] flex-col items-center justify-center text-center">

          <TriangleAlert className="h-7 w-7 text-destructive" />


          <p className="mt-3 font-semibold">
            Profile unavailable
          </p>


          <p className="mt-1 text-sm text-destructive">
            {
              error ??
              "NOVA could not load your account."
            }
          </p>

        </div>

      )}

    </Dialog>
  );
}


/* ============================================================
   PROFILE INFO ROW
============================================================ */

function ProfileLine({
  icon,
  label,
  value,
  last = false,
}: {
  icon:
    React.ReactNode;

  label:
    string;

  value:
    string;

  last?:
    boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        last
          ? ""
          : "border-b"
      }`}
    >

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">

        {
          icon
        }

      </div>


      <div className="min-w-0 flex-1">

        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {
            label
          }
        </p>


        <p className="mt-0.5 truncate text-sm font-semibold">
          {
            value
          }
        </p>

      </div>

    </div>
  );
}