import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";

import {
  ThemeProvider,
} from "@/components/providers/ThemeProvider";


  // ARC preview redeploy marker: multi-unit-ux-2026-09-26-retry

export const metadata: Metadata = {
  title: {
    default:
      "ARC",

    template:
      "%s | ARC",
  },

  description:
    "ARC is a fast, mobile-first point of sale, inventory and business operations platform.",

  // ARC brand deployment marker.

  applicationName:
    "ARC",

  manifest:
    "/site.webmanifest",

  robots: {
    index:
      false,

    follow:
      false,
  },
};


export const viewport: Viewport = {
  colorScheme:
    "light dark",

  themeColor: [
    {
      media:
        "(prefers-color-scheme: light)",

      color:
        "#ffffff",
    },
    {
      media:
        "(prefers-color-scheme: dark)",

      color:
        "#0a0a0a",
    },
  ],
};


export default function RootLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >


      <body
        suppressHydrationWarning
      >

        <ThemeProvider>
          {children}
        </ThemeProvider>

      </body>

    </html>
  );
}
