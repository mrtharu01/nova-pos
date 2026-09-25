"use client";

import Link from "next/link";

import {
  ArrowLeft,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  BulkProductImport,
} from "@/components/products/BulkProductImport";

import {
  Button,
} from "@/components/ui/button";


export default function ProductImportPage() {
  return (
    <AppLayout title="Import Products">

      <div className="mb-5">

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3"
        >
          <Link href="/products">

            <ArrowLeft className="mr-2 h-4 w-4" />

            Products

          </Link>
        </Button>

      </div>


      <BulkProductImport />

    </AppLayout>
  );
}
