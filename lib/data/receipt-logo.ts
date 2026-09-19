"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  convertImageToWebP,
} from "@/lib/images/convert-to-webp";


const RECEIPT_ASSET_BUCKET =
  "receipt-assets";


export type ReceiptLogoUploadResult = {
  publicUrl:
    string;

  path:
    string;

  width:
    number;

  height:
    number;

  originalBytes:
    number;

  outputBytes:
    number;
};


export async function uploadReceiptLogo({
  businessId,
  file,
}: {
  businessId:
    string;

  file:
    File;
}): Promise<ReceiptLogoUploadResult> {
  const supabase =
    createClient();


  const converted =
    await convertImageToWebP(
      file,
      {
        maxDimension:
          720,

        quality:
          0.88,
      },
    );


  if (
    converted.outputBytes >
    2 * 1024 * 1024
  ) {
    throw new Error(
      "The optimized receipt logo is still larger than 2 MB. Choose a simpler or smaller image.",
    );
  }


  const path =
    `${businessId}/logo-${crypto.randomUUID()}.webp`;


  const {
    error:
      uploadError,
  } =
    await supabase.storage
      .from(
        RECEIPT_ASSET_BUCKET,
      )
      .upload(
        path,
        converted.file,
        {
          cacheControl:
            "31536000",

          contentType:
            "image/webp",

          upsert:
            false,
        },
      );


  if (
    uploadError
  ) {
    throw new Error(
      uploadError.message,
    );
  }


  const {
    data,
  } =
    supabase.storage
      .from(
        RECEIPT_ASSET_BUCKET,
      )
      .getPublicUrl(
        path,
      );


  if (
    !data.publicUrl
  ) {
    await supabase.storage
      .from(
        RECEIPT_ASSET_BUCKET,
      )
      .remove([
        path,
      ]);


    throw new Error(
      "The receipt logo was uploaded but its public URL could not be created.",
    );
  }


  return {
    publicUrl:
      data.publicUrl,

    path,

    width:
      converted.width,

    height:
      converted.height,

    originalBytes:
      converted.originalBytes,

    outputBytes:
      converted.outputBytes,
  };
}


export async function deleteReceiptLogo(
  path:
    string,
): Promise<void> {
  if (
    !path
  ) {
    return;
  }


  const supabase =
    createClient();


  const {
    error,
  } =
    await supabase.storage
      .from(
        RECEIPT_ASSET_BUCKET,
      )
      .remove([
        path,
      ]);


  if (
    error
  ) {
    throw new Error(
      error.message,
    );
  }
}
