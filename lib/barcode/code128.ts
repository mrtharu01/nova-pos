export type Code128Bar = {
  x: number;
  width: number;
};

export type Code128Layout = {
  bars: Code128Bar[];
  width: number;
  height: number;
};

const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
] as const;

const START_CODE_B = 104;
const STOP_CODE = 106;
const QUIET_ZONE = 10;
const BAR_HEIGHT = 70;

function normalizeUuidToken(value: string) {
  const compact =
    value
      .trim()
      .toLowerCase()
      .replaceAll(
        "-",
        "",
      );

  if (
    !/^[0-9a-f]{32}$/.test(
      compact,
    )
  ) {
    return compact
      .toUpperCase();
  }

  return BigInt(
    `0x${compact}`,
  )
    .toString(
      36,
    )
    .toUpperCase()
    .padStart(
      25,
      "0",
    );
}

export function buildArcVariantBarcodePayload(
  stableVariantToken: string,
) {
  return `ARC1V${normalizeUuidToken(
    stableVariantToken,
  )}`;
}

export function buildArcBatchBarcodePayload(
  batchId: string,
) {
  return `ARC1B${normalizeUuidToken(
    batchId,
  )}`;
}

export function encodeCode128B(
  value: string,
): Code128Layout {
  if (
    !value
  ) {
    throw new Error(
      "Barcode value is required.",
    );
  }

  const dataCodes =
    Array.from(
      value,
    ).map(
      (
        character,
      ) => {
        const code =
          character.charCodeAt(
            0,
          );

        if (
          code < 32 ||
          code > 126
        ) {
          throw new Error(
            "Code 128 labels support printable ASCII characters only.",
          );
        }

        return code - 32;
      },
    );

  let checksum =
    START_CODE_B;

  dataCodes.forEach(
    (
      code,
      index,
    ) => {
      checksum +=
        code *
        (
          index +
          1
        );
    },
  );

  checksum %=
    103;

  const codes = [
    START_CODE_B,
    ...dataCodes,
    checksum,
    STOP_CODE,
  ];

  const bars:
    Code128Bar[] = [];

  let x =
    QUIET_ZONE;

  codes.forEach(
    (
      code,
    ) => {
      const pattern =
        CODE128_PATTERNS[
          code
        ];

      if (!pattern) {
        throw new Error(
          "Unsupported Code 128 symbol.",
        );
      }

      Array.from(
        pattern,
      ).forEach(
        (
          widthCharacter,
          index,
        ) => {
          const width =
            Number(
              widthCharacter,
            );

          if (
            index %
              2 ===
            0
          ) {
            bars.push({
              x,
              width,
            });
          }

          x +=
            width;
        },
      );
    },
  );

  x +=
    QUIET_ZONE;

  return {
    bars,
    width:
      x,
    height:
      BAR_HEIGHT,
  };
}
