import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";

import {
  ThemeProvider,
} from "@/components/providers/ThemeProvider";


export const metadata: Metadata = {
  title: {
    default:
      "ARC",

    template:
      "%s | ARC",
  },

  description:
    "ARC is a fast, mobile-first point of sale, inventory and business operations platform.",

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

      <head>

        <link
          rel="icon"
          href="/favicon-black.svg?v=5"
          type="image/svg+xml"
          media="(prefers-color-scheme: light)"
        />

        <link
          rel="shortcut icon"
          href="/favicon-black.svg?v=5"
          type="image/svg+xml"
          media="(prefers-color-scheme: light)"
        />


        <link
          rel="icon"
          href="/favicon-white.svg?v=5"
          type="image/svg+xml"
          media="(prefers-color-scheme: dark)"
        />

        <link
          rel="shortcut icon"
          href="/favicon-white.svg?v=5"
          type="image/svg+xml"
          media="(prefers-color-scheme: dark)"
        />

      </head>


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
