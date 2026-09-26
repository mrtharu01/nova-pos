"use client";

import {
  Loader2,
} from "lucide-react";

import {
  useFormStatus,
} from "react-dom";

import {
  Button,
} from "@/components/ui/button";


export function OnboardingSubmitButton() {
  const {
    pending,
  } =
    useFormStatus();


  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={
        pending
      }
      aria-disabled={
        pending
      }
    >

      {pending && (

        <Loader2 className="mr-2 h-4 w-4 animate-spin" />

      )}


      {pending
        ? "Creating workspace…"
        : "Create business workspace"}

    </Button>
  );
}
