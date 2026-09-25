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

  signedUrl: string;

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
    data: businesses,
    error: businessError,
  } =
    await supabase.rpc(
      "get_my_current_business",
    );


  const business =
    businesses?.[0] ??
    null;


  if (
    businessError
  ) {

    throw businessError;

  }


  if (
    !business?.id
  ) {

    throw new Error(
      "Your ARC business could not be identified.",
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
    error:
      signedUrlError,
  } =
    await supabase.storage

      .from(
        PRODUCT_IMAGE_BUCKET,
      )

      .createSignedUrl(
        path,
        60 * 60 * 8,
      );


  if (
    signedUrlError ||
    !data?.signedUrl
  ) {
    await supabase.storage
      .from(
        PRODUCT_IMAGE_BUCKET,
      )
      .remove([
        path,
      ]);


    throw new Error(
      signedUrlError?.message ??
      "The image was uploaded but a secure preview URL could not be created.",
    );

  }


  return {

    signedUrl:
      data.signedUrl,

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