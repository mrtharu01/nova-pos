"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  convertImageToWebP,
} from "@/lib/images/convert-to-webp";


const PRODUCT_IMAGE_BUCKET =
  "product-images";


export type ProductImageUploadResult = {

  publicUrl: string;

  path: string;

  width: number;

  height: number;

  originalBytes: number;

  outputBytes: number;

};


export async function uploadProductImage(

  originalFile: File,

): Promise<ProductImageUploadResult> {


  const supabase =
    createClient();


  /*
   * RLS means this only returns
   * a business that the signed-in
   * user is allowed to access.
   */

  const {
    data: business,
    error: businessError,
  } =
    await supabase

      .from(
        "businesses",
      )

      .select(
        "id",
      )

      .limit(
        1,
      )

      .maybeSingle();


  if (
    businessError
  ) {

    throw businessError;

  }


  if (
    !business?.id
  ) {

    throw new Error(
      "Your NOVA business could not be identified.",
    );

  }


  /*
   * NECROS-style image optimization:
   *
   * JPG / PNG / WebP
   *
   * ↓
   *
   * max 1600px
   *
   * ↓
   *
   * WebP 82%
   */

  const converted =
    await convertImageToWebP(

      originalFile,

      {

        maxDimension:
          1600,

        quality:
          0.82,

      },

    );


  /*
   * Every upload gets a NEW path.
   *
   * Do not overwrite old CDN files.
   */

  const path =

    `${business.id}/${crypto.randomUUID()}.webp`;


  const {
    error: uploadError,
  } =
    await supabase.storage

      .from(
        PRODUCT_IMAGE_BUCKET,
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

    throw uploadError;

  }


  const {
    data,
  } =
    supabase.storage

      .from(
        PRODUCT_IMAGE_BUCKET,
      )

      .getPublicUrl(
        path,
      );


  if (
    !data.publicUrl
  ) {

    throw new Error(
      "The image was uploaded but its public URL could not be created.",
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