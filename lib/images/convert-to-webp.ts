const MAX_INPUT_BYTES =
  12 * 1024 * 1024;

const MAX_OUTPUT_BYTES =
  5 * 1024 * 1024;

const DEFAULT_MAX_DIMENSION =
  1600;

const DEFAULT_QUALITY =
  0.82;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type WebPConversionResult = {
  file: File;

  width: number;
  height: number;

  originalBytes: number;
  outputBytes: number;
};


function loadImage(
  file: File,
): Promise<HTMLImageElement> {

  return new Promise(
    (
      resolve,
      reject,
    ) => {

      const url =
        URL.createObjectURL(file);

      const image =
        new Image();


      image.onload = () => {

        URL.revokeObjectURL(
          url,
        );

        resolve(
          image,
        );

      };


      image.onerror = () => {

        URL.revokeObjectURL(
          url,
        );

        reject(
          new Error(
            "This image could not be decoded by your browser.",
          ),
        );

      };


      image.src =
        url;

    },
  );

}


function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {

  return new Promise(
    (
      resolve,
      reject,
    ) => {

      canvas.toBlob(

        (
          blob,
        ) => {

          if (!blob) {

            reject(
              new Error(
                "Your browser could not convert this image to WebP.",
              ),
            );

            return;

          }


          resolve(
            blob,
          );

        },

        type,

        quality,

      );

    },
  );

}


function safeBaseName(
  name: string,
) {

  return (

    name

      .replace(
        /\.[^/.]+$/,
        "",
      )

      .trim()

      .toLowerCase()

      .replace(
        /[^a-z0-9]+/g,
        "-",
      )

      .replace(
        /^-+|-+$/g,
        "",
      )

    ||

    "product-image"

  );

}


export async function convertImageToWebP(

  input: File,

  options?: {

    maxDimension?: number;

    quality?: number;

  },

): Promise<WebPConversionResult> {


  if (
    !ALLOWED_TYPES.has(
      input.type,
    )
  ) {

    throw new Error(
      "Use a JPG, PNG, or WebP image.",
    );

  }


  if (
    input.size >
    MAX_INPUT_BYTES
  ) {

    throw new Error(
      "The original image must be 12 MB or smaller.",
    );

  }


  const image =
    await loadImage(
      input,
    );


  const maxDimension =
    Math.max(

      256,

      options?.maxDimension
      ??
      DEFAULT_MAX_DIMENSION,

    );


  const quality =
    Math.min(

      0.95,

      Math.max(

        0.5,

        options?.quality
        ??
        DEFAULT_QUALITY,

      ),

    );


  const originalWidth =
    image.naturalWidth
    ||
    image.width;


  const originalHeight =
    image.naturalHeight
    ||
    image.height;


  if (
    !originalWidth
    ||
    !originalHeight
  ) {

    throw new Error(
      "The selected image has invalid dimensions.",
    );

  }


  const scale =
    Math.min(

      1,

      maxDimension
      /
      Math.max(
        originalWidth,
        originalHeight,
      ),

    );


  const width =
    Math.max(

      1,

      Math.round(
        originalWidth
        *
        scale,
      ),

    );


  const height =
    Math.max(

      1,

      Math.round(
        originalHeight
        *
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
      {
        alpha: true,
      },
    );


  if (!context) {

    throw new Error(
      "Your browser could not prepare the image converter.",
    );

  }


  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";


  context.drawImage(

    image,

    0,
    0,

    width,
    height,

  );


  const blob =
    await canvasToBlob(

      canvas,

      "image/webp",

      quality,

    );


  if (
    blob.type
    !==
    "image/webp"
  ) {

    throw new Error(
      "WebP conversion is not supported by this browser.",
    );

  }


  if (
    blob.size >
    MAX_OUTPUT_BYTES
  ) {

    throw new Error(
      "The converted image is still larger than 5 MB. Choose a smaller image.",
    );

  }


  const output =
    new File(

      [
        blob,
      ],

      `${safeBaseName(
        input.name,
      )}.webp`,

      {
        type:
          "image/webp",

        lastModified:
          Date.now(),
      },

    );


  return {

    file:
      output,

    width,

    height,

    originalBytes:
      input.size,

    outputBytes:
      output.size,

  };

}