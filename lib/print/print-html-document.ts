"use client";

export function printHtmlDocument(
  html: string,
) {
  const frame =
    document.createElement(
      "iframe",
    );

  frame.setAttribute(
    "aria-hidden",
    "true",
  );

  frame.tabIndex = -1;

  Object.assign(
    frame.style,
    {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    },
  );

  document.body.appendChild(
    frame,
  );

  const printWindow =
    frame.contentWindow;

  const printDocument =
    frame.contentDocument ??
    printWindow?.document;

  if (
    !printWindow ||
    !printDocument
  ) {
    frame.remove();

    return false;
  }

  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    window.setTimeout(
      () => frame.remove(),
      250,
    );
  };

  try {
    printDocument.open();
    printDocument.write(
      html,
    );
    printDocument.close();

    printWindow.addEventListener(
      "afterprint",
      cleanup,
      {
        once: true,
      },
    );

    window.setTimeout(
      () => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          cleanup();
        }
      },
      80,
    );

    window.setTimeout(
      cleanup,
      60_000,
    );

    return true;
  } catch {
    cleanup();

    return false;
  }
}
