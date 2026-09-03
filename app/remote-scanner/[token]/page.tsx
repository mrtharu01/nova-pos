"use client";

import { useParams } from "next/navigation";

import {
  RemoteScannerClient,
} from "@/components/remote-scanner/RemoteScannerClient";

export default function RemoteScannerPage() {
  const params =
    useParams<{
      token: string;
    }>();

  const pairToken =
    typeof params.token === "string"
      ? params.token
      : "";

  return (
    <RemoteScannerClient
      pairToken={pairToken}
    />
  );
}   