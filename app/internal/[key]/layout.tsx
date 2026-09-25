import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";


export const dynamic =
  "force-dynamic";


export const metadata: Metadata = {
  title:
    "NOVA Internal",

  robots: {
    index:
      false,

    follow:
      false,

    nocache:
      true,
  },
};


export default async function InternalLayout({
  children,
  params,
}: {
  children:
    React.ReactNode;

  params:
    Promise<{
      key:
        string;
    }>;
}) {
  const {
    key,
  } =
    await params;


  const expectedKey =
    process.env
      .NOVA_PLATFORM_PORTAL_KEY
      ?.trim();


  if (
    !expectedKey ||
    key !==
      expectedKey
  ) {
    notFound();
  }


  return (
    <>
      {children}
    </>
  );
}
