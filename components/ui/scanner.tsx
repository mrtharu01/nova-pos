"use client";

import * as React from "react";

import {
  BrowserCodeReader,
  BrowserQRCodeReader,
  type IScannerControls,
} from "@zxing/browser";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  Camera,
  CheckCircle2,
  Flashlight,
  Keyboard,
  RefreshCcw,
  SwitchCamera,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";


interface ScannerProps {
  onScan: (
    value: string,
  ) => boolean | void;

  onClose: () => void;

  isOpen: boolean;

  continuous?: boolean;
}


type CameraDevice = {
  deviceId: string;

  label: string;
};


type LastScan = {
  value: string;

  at: number;
};


/* ============================================================
   STOP RAW MEDIA STREAM
============================================================ */

function stopVideoTracks(
  video:
    HTMLVideoElement | null,
) {
  if (!video) {
    return;
  }


  const stream =
    video.srcObject;


  if (
    !(stream instanceof MediaStream)
  ) {
    video.srcObject =
      null;

    return;
  }


  stream
    .getTracks()
    .forEach(
      (track) => {
        track.stop();
      },
    );


  video.srcObject =
    null;
}


/* ============================================================
   SCANNER
============================================================ */

export function Scanner({
  onScan,
  onClose,
  isOpen,
  continuous = false,
}: ScannerProps) {
  const videoRef =
    React.useRef<
      HTMLVideoElement | null
    >(null);


  const controlsRef =
    React.useRef<
      IScannerControls | null
    >(null);


  const lastScanRef =
    React.useRef<
      LastScan | null
    >(null);


  const startingRef =
    React.useRef(false);


  const onScanRef =
    React.useRef(
      onScan,
    );


  const onCloseRef =
    React.useRef(
      onClose,
    );


  const [
    success,
    setSuccess,
  ] =
    React.useState(false);


  const [
    manualCode,
    setManualCode,
  ] =
    React.useState("");


  const [
    cameraError,
    setCameraError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    scanError,
    setScanError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    cameraStarting,
    setCameraStarting,
  ] =
    React.useState(false);


  const [
    devices,
    setDevices,
  ] =
    React.useState<
      CameraDevice[]
    >([]);


  const [
    currentDeviceId,
    setCurrentDeviceId,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    torchAvailable,
    setTorchAvailable,
  ] =
    React.useState(false);


  const [
    torchOn,
    setTorchOn,
  ] =
    React.useState(false);


  /* ==========================================================
     KEEP CALLBACK REFERENCES CURRENT
  ========================================================== */

  React.useEffect(() => {
    onScanRef.current =
      onScan;
  }, [
    onScan,
  ]);


  React.useEffect(() => {
    onCloseRef.current =
      onClose;
  }, [
    onClose,
  ]);


  /* ==========================================================
     STOP CAMERA
  ========================================================== */

  const stopCamera =
    React.useCallback(() => {
      try {
        controlsRef.current?.stop();
      } catch {
        // Raw media tracks are
        // stopped below as well.
      }


      controlsRef.current =
        null;


      setTorchAvailable(
        false,
      );


      setTorchOn(
        false,
      );


      stopVideoTracks(
        videoRef.current,
      );
    }, []);


  /* ==========================================================
     ACCEPT SCAN
  ========================================================== */

  const submitScan =
    React.useCallback(
      (
        rawValue: string,
      ) => {
        const value =
          rawValue.trim();


        if (!value) {
          return;
        }


        const now =
          Date.now();


        const last =
          lastScanRef.current;


        /*
         * Avoid repeatedly adding the
         * same physical QR while it
         * remains visible to the camera.
         */
        if (
          last &&
          last.value === value &&
          now - last.at <
            1400
        ) {
          return;
        }


        lastScanRef.current = {
          value,
          at: now,
        };


        setScanError(
          null,
        );


        const accepted =
          onScanRef.current(
            value,
          );


        if (
          accepted === false
        ) {
          setScanError(
            "QR code or SKU was not found in the current catalog.",
          );

          return;
        }


        setSuccess(
          true,
        );


        setManualCode(
          "",
        );


        window.setTimeout(
          () => {
            setSuccess(
              false,
            );


            if (
              !continuous
            ) {
              onCloseRef.current();
            }
          },
          continuous
            ? 500
            : 800,
        );
      },
      [
        continuous,
      ],
    );


  /* ==========================================================
     CAMERA DEVICES
  ========================================================== */

  const loadCameraDevices =
    React.useCallback(
      async () => {
        try {
          const available =
            await BrowserCodeReader
              .listVideoInputDevices();


          const mapped =
            available.map(
              (
                device,
                index,
              ) => ({
                deviceId:
                  device.deviceId,

                label:
                  device.label ||
                  `Camera ${index + 1}`,
              }),
            );


          setDevices(
            mapped,
          );


          return mapped;
        } catch {
          return [];
        }
      },
      [],
    );


  /* ==========================================================
     START CAMERA
  ========================================================== */

  const startCamera =
    React.useCallback(
      async (
        requestedDeviceId?:
          string,
      ) => {
        if (
          !isOpen ||
          startingRef.current
        ) {
          return;
        }


        const video =
          videoRef.current;


        if (!video) {
          return;
        }


        startingRef.current =
          true;


        setCameraStarting(
          true,
        );


        setCameraError(
          null,
        );


        setScanError(
          null,
        );


        stopCamera();


        try {
          const reader =
            new BrowserQRCodeReader();


          const controls =
            await reader
              .decodeFromVideoDevice(
                requestedDeviceId,
                video,
                (
                  result,
                ) => {
                  if (
                    !result
                  ) {
                    return;
                  }


                  submitScan(
                    result.getText(),
                  );
                },
              );


          controlsRef.current =
            controls;


          setTorchAvailable(
            typeof controls.switchTorch ===
              "function",
          );


          const available =
            await loadCameraDevices();


          const stream =
            video.srcObject;


          if (
            stream instanceof
            MediaStream
          ) {
            const track =
              stream
                .getVideoTracks()[0];


            const activeDeviceId =
              track
                ?.getSettings()
                .deviceId;


            if (
              activeDeviceId
            ) {
              setCurrentDeviceId(
                activeDeviceId,
              );
            } else if (
              requestedDeviceId
            ) {
              setCurrentDeviceId(
                requestedDeviceId,
              );
            }
          } else if (
            requestedDeviceId
          ) {
            setCurrentDeviceId(
              requestedDeviceId,
            );
          }


          if (
            !requestedDeviceId &&
            available.length === 1
          ) {
            setCurrentDeviceId(
              available[0]
                .deviceId,
            );
          }
        } catch (
          error
        ) {
          console.error(
            "NOVA scanner camera error:",
            error,
          );


          if (
            error instanceof
            DOMException
          ) {
            switch (
              error.name
            ) {
              case "NotAllowedError":
              case "PermissionDeniedError":

                setCameraError(
                  "Camera permission was blocked. Allow camera access for NOVA and try again.",
                );

                break;


              case "NotFoundError":
              case "DevicesNotFoundError":

                setCameraError(
                  "No usable camera was found on this device.",
                );

                break;


              case "NotReadableError":
              case "TrackStartError":

                setCameraError(
                  "The camera is already being used by another application or browser tab.",
                );

                break;


              default:

                setCameraError(
                  error.message ||
                    "Unable to start the camera.",
                );
            }
          } else if (
            error instanceof
            Error
          ) {
            setCameraError(
              error.message,
            );
          } else {
            setCameraError(
              "Unable to start the camera.",
            );
          }


          stopCamera();
        } finally {
          startingRef.current =
            false;


          setCameraStarting(
            false,
          );
        }
      },
      [
        isOpen,
        loadCameraDevices,
        stopCamera,
        submitScan,
      ],
    );


  /* ==========================================================
     OPEN / CLOSE
  ========================================================== */

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }


    const previousOverflow =
      document.body.style
        .overflow;


    document.body.style.overflow =
      "hidden";


    const timer =
      window.setTimeout(
        () => {
          void startCamera();
        },
        100,
      );


    return () => {
      window.clearTimeout(
        timer,
      );


      document.body.style.overflow =
        previousOverflow;


      stopCamera();
    };
  }, [
    isOpen,
    startCamera,
    stopCamera,
  ]);


  React.useEffect(() => {
    if (isOpen) {
      return;
    }


    setSuccess(
      false,
    );


    setManualCode(
      "",
    );


    setCameraError(
      null,
    );


    setScanError(
      null,
    );


    setDevices(
      [],
    );


    setCurrentDeviceId(
      null,
    );


    lastScanRef.current =
      null;
  }, [
    isOpen,
  ]);


  /* ==========================================================
     TORCH
  ========================================================== */

  async function toggleTorch() {
    const controls =
      controlsRef.current;


    if (
      !controls ||
      typeof controls.switchTorch !==
        "function"
    ) {
      setScanError(
        "Flashlight control is not available on this camera.",
      );

      return;
    }


    const next =
      !torchOn;


    try {
      await controls
        .switchTorch(
          next,
        );


      setTorchOn(
        next,
      );


      setScanError(
        null,
      );
    } catch (
      error
    ) {
      console.error(
        "NOVA torch error:",
        error,
      );


      setTorchOn(
        false,
      );


      setTorchAvailable(
        false,
      );


      setScanError(
        "Flashlight control is not supported by this camera or browser.",
      );
    }
  }


  /* ==========================================================
     SWITCH CAMERA
  ========================================================== */

  async function switchCamera() {
    let available =
      devices;


    if (
      available.length <
      2
    ) {
      available =
        await loadCameraDevices();
    }


    if (
      available.length <
      2
    ) {
      setScanError(
        "Only one camera is available on this device.",
      );

      return;
    }


    let currentIndex =
      available.findIndex(
        (device) =>
          device.deviceId ===
          currentDeviceId,
      );


    if (
      currentIndex <
      0
    ) {
      currentIndex =
        0;
    }


    const nextIndex =
      (
        currentIndex +
        1
      ) %
      available.length;


    const nextDevice =
      available[
        nextIndex
      ];


    setCurrentDeviceId(
      nextDevice.deviceId,
    );


    setScanError(
      null,
    );


    await startCamera(
      nextDevice.deviceId,
    );
  }


  /* ==========================================================
     CLOSE
  ========================================================== */

  function closeScanner() {
    stopCamera();

    onClose();
  }


  /* ==========================================================
     UI
  ========================================================== */

  return (
    <AnimatePresence>

      {isOpen && (

        <motion.div
          initial={{
            opacity: 0,
            y: 24,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: 24,
          }}
          transition={{
            duration: 0.2,
          }}
          className="
            fixed
            inset-0
            z-50
            flex
            h-[100dvh]
            flex-col
            overflow-hidden
            bg-black
            text-white
          "
        >

          {/* ==================================================
              HEADER
          =================================================== */}

          <div
            className="
              flex
              h-16
              shrink-0
              items-center
              justify-between
              border-b
              border-white/5
              bg-black
              px-4
            "
          >

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={
                closeScanner
              }
              className="
                rounded-full
                text-white
                hover:bg-white/15
                hover:text-white
              "
              aria-label="Close scanner"
            >

              <X className="h-6 w-6" />

            </Button>


            <p className="text-sm font-semibold">
              Scan Product
            </p>


            <div className="flex gap-2">

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={
                  !torchAvailable
                }
                onClick={() =>
                  void toggleTorch()
                }
                className="
                  rounded-full
                  text-white
                  hover:bg-white/15
                  hover:text-white
                  disabled:text-white/25
                "
                aria-label={
                  torchOn
                    ? "Turn flashlight off"
                    : "Turn flashlight on"
                }
              >

                <Flashlight className="h-5 w-5" />

              </Button>


              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={
                  devices.length <
                  2
                }
                onClick={() =>
                  void switchCamera()
                }
                className="
                  rounded-full
                  text-white
                  hover:bg-white/15
                  hover:text-white
                  disabled:text-white/25
                "
                aria-label="Switch camera"
              >

                <SwitchCamera className="h-5 w-5" />

              </Button>

            </div>

          </div>


          {/* ==================================================
              SCANNER CONTENT
          =================================================== */}

          <div
            className={`
              relative
              flex
              min-h-0
              flex-1
              flex-col
              items-center
              overflow-y-auto
              overscroll-y-contain
              px-5
              pb-8
              [-webkit-overflow-scrolling:touch]

              ${
                continuous
                  ? `
                    justify-start
                    pt-48

                    md:justify-center
                    md:py-8
                  `
                  : `
                    justify-center
                    pt-8

                    md:py-8
                  `
              }
            `}
          >

            {/* ==================================================
                CAMERA FRAME

                Camera video now exists ONLY inside this square.
            =================================================== */}

            <div
              className="
                relative
                z-10
                aspect-square
                w-64
                shrink-0
                overflow-hidden
                rounded-[28px]
                border-2
                border-white/25
                bg-slate-950
                shadow-2xl

                md:w-80
              "
            >

              <video
                ref={
                  videoRef
                }
                autoPlay
                muted
                playsInline
                className="
                  absolute
                  inset-0
                  h-full
                  w-full
                  object-cover
                "
              />


              <div className="pointer-events-none absolute inset-0 bg-black/10" />


              {/* ==============================================
                  SCAN LINE
              =============================================== */}

              {!success &&
                !cameraError &&
                !cameraStarting && (

                <motion.div
                  className="
                    absolute
                    left-0
                    top-0
                    z-10
                    h-1
                    w-full
                    bg-primary
                    shadow-[0_0_15px_rgba(99,102,241,0.9)]
                  "
                  animate={{
                    top: [
                      "5%",
                      "94%",
                      "5%",
                    ],
                  }}
                  transition={{
                    duration:
                      2.4,

                    repeat:
                      Infinity,

                    ease:
                      "linear",
                  }}
                />

              )}


              {/* ==============================================
                  CORNERS
              =============================================== */}

              <div
                className="
                  pointer-events-none
                  absolute
                  left-0
                  top-0
                  z-20
                  h-10
                  w-10
                  rounded-tl-[26px]
                  border-l-4
                  border-t-4
                  border-primary
                "
              />


              <div
                className="
                  pointer-events-none
                  absolute
                  right-0
                  top-0
                  z-20
                  h-10
                  w-10
                  rounded-tr-[26px]
                  border-r-4
                  border-t-4
                  border-primary
                "
              />


              <div
                className="
                  pointer-events-none
                  absolute
                  bottom-0
                  left-0
                  z-20
                  h-10
                  w-10
                  rounded-bl-[26px]
                  border-b-4
                  border-l-4
                  border-primary
                "
              />


              <div
                className="
                  pointer-events-none
                  absolute
                  bottom-0
                  right-0
                  z-20
                  h-10
                  w-10
                  rounded-br-[26px]
                  border-b-4
                  border-r-4
                  border-primary
                "
              />


              {/* ==============================================
                  STARTING CAMERA
              =============================================== */}

              {cameraStarting && (

                <div
                  className="
                    absolute
                    inset-0
                    z-30
                    flex
                    items-center
                    justify-center
                    bg-black/65
                    backdrop-blur-sm
                  "
                >

                  <div className="text-center">

                    <RefreshCcw className="mx-auto h-7 w-7 animate-spin" />


                    <p className="mt-2 text-xs text-white/75">
                      Starting camera…
                    </p>

                  </div>

                </div>

              )}


              {/* ==============================================
                  CAMERA ERROR
              =============================================== */}

              {cameraError && (

                <div
                  className="
                    absolute
                    inset-0
                    z-30
                    flex
                    items-center
                    justify-center
                    bg-slate-950/95
                    p-5
                    text-center
                  "
                >

                  <div>

                    <Camera className="mx-auto h-10 w-10 text-white/40" />


                    <p className="mt-3 text-sm text-white/80">
                      Camera unavailable
                    </p>

                  </div>

                </div>

              )}


              {/* ==============================================
                  SUCCESS
              =============================================== */}

              <AnimatePresence>

                {success && (

                  <motion.div
                    initial={{
                      opacity: 0,
                    }}
                    animate={{
                      opacity: 1,
                    }}
                    exit={{
                      opacity: 0,
                    }}
                    className="
                      absolute
                      inset-0
                      z-40
                      flex
                      items-center
                      justify-center
                      bg-emerald-500/35
                      backdrop-blur-sm
                    "
                  >

                    <motion.div
                      initial={{
                        scale: 0.7,
                      }}
                      animate={{
                        scale: 1,
                      }}
                    >

                      <CheckCircle2 className="h-16 w-16 text-white" />

                    </motion.div>

                  </motion.div>

                )}

              </AnimatePresence>

            </div>


            {/* ==================================================
                INSTRUCTIONS
            =================================================== */}

            <div className="relative z-10 mt-8 w-full max-w-sm text-center">

              <p className="text-lg font-medium">
                Point the camera at a NOVA product QR
              </p>


              <p className="mt-1 text-sm leading-6 text-white/60">

                {continuous
                  ? "Continuous mode stays open so you can scan multiple products quickly."
                  : "A successful scan closes the scanner automatically."}

              </p>


              {/* ==============================================
                  ERRORS
              =============================================== */}

              {(cameraError ||
                scanError) && (

                <div
                  className="
                    mt-4
                    flex
                    items-start
                    gap-2
                    rounded-[16px]
                    border
                    border-amber-300/20
                    bg-white/5
                    p-3
                    text-left
                    text-xs
                    text-amber-100
                  "
                >

                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />


                  <span>
                    {cameraError ||
                      scanError}
                  </span>

                </div>

              )}


              {/* ==============================================
                  RETRY CAMERA
              =============================================== */}

              {cameraError && (

                <Button
                  type="button"
                  variant="outline"
                  className="
                    mt-3
                    border-white/15
                    bg-white/10
                    text-white
                    hover:bg-white/15
                    hover:text-white
                  "
                  onClick={() =>
                    void startCamera(
                      currentDeviceId ??
                        undefined,
                    )
                  }
                >

                  <RefreshCcw className="mr-2 h-4 w-4" />

                  Retry camera

                </Button>

              )}


              {/* ==============================================
                  MANUAL ENTRY
              =============================================== */}

              <div
                className="
                  mt-6
                  rounded-[24px]
                  border
                  border-white/10
                  bg-white/[0.06]
                  p-2
                "
              >

                <div className="flex gap-2">

                  <div className="relative flex-1">

                    <Keyboard
                      className="
                        absolute
                        left-3
                        top-3
                        h-4
                        w-4
                        text-white/50
                      "
                    />


                    <Input
                      value={
                        manualCode
                      }
                      onChange={(
                        event,
                      ) =>
                        setManualCode(
                          event.target.value,
                        )
                      }
                      onKeyDown={(
                        event,
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();


                          submitScan(
                            manualCode,
                          );
                        }
                      }}
                      placeholder="Enter SKU / NOVA QR"
                      className="
                        h-10
                        rounded-[16px]
                        border-white/10
                        bg-white/[0.06]
                        pl-9
                        text-white
                        placeholder:text-white/35
                      "
                    />

                  </div>


                  <Button
                    type="button"
                    onClick={() =>
                      submitScan(
                        manualCode,
                      )
                    }
                    disabled={
                      !manualCode.trim()
                    }
                    className="h-10 rounded-[16px] px-4"
                  >

                    Add

                  </Button>

                </div>

              </div>


              <p className="mt-3 pb-2 text-[11px] leading-5 text-white/40">
                Camera scanning requires HTTPS in production,
                or localhost during development.
              </p>

            </div>

          </div>

        </motion.div>

      )}

    </AnimatePresence>
  );
}