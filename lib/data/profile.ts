"use client";

import {
  createClient,
} from "@/lib/supabase/client";


export type AccountProfile = {
  userId: string;

  email: string;

  displayName: string;

  avatarUrl:
    | string
    | null;
};


function stringValue(
  value: unknown,
) {
  return typeof value ===
    "string" &&
    value.trim()
    ? value.trim()
    : null;
}


/* ============================================================
   FETCH PROFILE
============================================================ */

export async function fetchAccountProfile():
Promise<AccountProfile> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.auth.getUser();


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const user =
    data.user;


  if (!user) {
    throw new Error(
      "Signed-in user could not be found.",
    );
  }


  const metadata =
    user.user_metadata ??
    {};


  const displayName =
    stringValue(
      metadata.display_name,
    ) ??
    stringValue(
      metadata.full_name,
    ) ??
    stringValue(
      metadata.name,
    ) ??
    user.email
      ?.split("@")[0] ??
    "NOVA User";


  const avatarUrl =
    stringValue(
      metadata.avatar_url,
    ) ??
    stringValue(
      metadata.picture,
    );


  return {
    userId:
      user.id,

    email:
      user.email ??
      "",

    displayName,

    avatarUrl,
  };
}


/* ============================================================
   UPDATE NAME
============================================================ */

export async function updateAccountName(
  displayName: string,
): Promise<AccountProfile> {
  const supabase =
    createClient();


  const cleanedName =
    displayName.trim();


  if (!cleanedName) {
    throw new Error(
      "Profile name is required.",
    );
  }


  const {
    error,
  } =
    await supabase.auth.updateUser({
      data: {
        display_name:
          cleanedName,
      },
    });


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return fetchAccountProfile();
}


/* ============================================================
   IMAGE CONVERSION
============================================================ */

async function convertAvatarToWebP(
  file: File,
): Promise<Blob> {
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
    ].includes(
      file.type,
    )
  ) {
    throw new Error(
      "Use a JPG, PNG or WebP image.",
    );
  }


  if (
    file.size >
    10 * 1024 * 1024
  ) {
    throw new Error(
      "Profile image must be smaller than 10 MB.",
    );
  }


  const sourceUrl =
    URL.createObjectURL(
      file,
    );


  try {
    const image =
      await new Promise<HTMLImageElement>(
        (
          resolve,
          reject,
        ) => {
          const element =
            new Image();


          element.onload =
            () =>
              resolve(
                element,
              );


          element.onerror =
            () =>
              reject(
                new Error(
                  "Profile image could not be read.",
                ),
              );


          element.src =
            sourceUrl;
        },
      );


    const maxSide =
      1024;


    const scale =
      Math.min(
        1,
        maxSide /
          Math.max(
            image.naturalWidth,
            image.naturalHeight,
          ),
      );


    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
          scale,
        ),
      );


    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
          scale,
        ),
      );


    const canvas =
      document.createElement(
        "canvas",
      );


    canvas.width =
      width;

    canvas.height =
      height;


    const context =
      canvas.getContext(
        "2d",
      );


    if (!context) {
      throw new Error(
        "Image conversion is unavailable in this browser.",
      );
    }


    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );


    const blob =
      await new Promise<
        Blob | null
      >(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/webp",
            0.86,
          );
        },
      );


    if (!blob) {
      throw new Error(
        "Profile image conversion failed.",
      );
    }


    if (
      blob.size >
      5 * 1024 * 1024
    ) {
      throw new Error(
        "Converted profile image is larger than 5 MB.",
      );
    }


    return blob;
  } finally {
    URL.revokeObjectURL(
      sourceUrl,
    );
  }
}


/* ============================================================
   UPLOAD AVATAR
============================================================ */

export async function uploadProfileAvatar(
  file: File,
): Promise<AccountProfile> {
  const supabase =
    createClient();


  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser();


  if (userError) {
    throw new Error(
      userError.message,
    );
  }


  const user =
    userData.user;


  if (!user) {
    throw new Error(
      "Signed-in user could not be found.",
    );
  }


  const webp =
    await convertAvatarToWebP(
      file,
    );


  const path =
    `${user.id}/avatar.webp`;


  const {
    error: uploadError,
  } =
    await supabase.storage
      .from(
        "profile-avatars",
      )
      .upload(
        path,
        webp,
        {
          contentType:
            "image/webp",

          cacheControl:
            "3600",

          upsert:
            true,
        },
      );


  if (uploadError) {
    throw new Error(
      uploadError.message,
    );
  }


  const {
    data: publicUrlData,
  } =
    supabase.storage
      .from(
        "profile-avatars",
      )
      .getPublicUrl(
        path,
      );


  /*
   * Cache-busting value means a newly uploaded avatar
   * immediately replaces the old one in the browser.
   */

  const avatarUrl =
    `${publicUrlData.publicUrl}?v=${Date.now()}`;


  const {
    error: metadataError,
  } =
    await supabase.auth.updateUser({
      data: {
        avatar_url:
          avatarUrl,
      },
    });


  if (metadataError) {
    throw new Error(
      metadataError.message,
    );
  }


  return fetchAccountProfile();
}


/* ============================================================
   REMOVE CUSTOM AVATAR
============================================================ */

export async function removeProfileAvatar():
Promise<AccountProfile> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.auth.getUser();


  if (error) {
    throw new Error(
      error.message,
    );
  }


  if (!data.user) {
    throw new Error(
      "Signed-in user could not be found.",
    );
  }


  const path =
    `${data.user.id}/avatar.webp`;


  const {
    error: removeError,
  } =
    await supabase.storage
      .from(
        "profile-avatars",
      )
      .remove([
        path,
      ]);


  if (
    removeError &&
    !removeError.message
      .toLowerCase()
      .includes(
        "not found",
      )
  ) {
    throw new Error(
      removeError.message,
    );
  }


  const {
    error: metadataError,
  } =
    await supabase.auth.updateUser({
      data: {
        avatar_url:
          null,
      },
    });


  if (metadataError) {
    throw new Error(
      metadataError.message,
    );
  }


  return fetchAccountProfile();
}