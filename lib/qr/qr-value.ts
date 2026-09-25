export const ARC_QR_PREFIX = "ARC:V1:";

export const LEGACY_NOVA_QR_PREFIX =
  "NOVA:V1:";


/**
 * Backward-compatible export name used by existing application
 * code. New QR values are branded ARC; previously printed NOVA
 * QR values remain valid.
 */
export const NOVA_QR_PREFIX =
  ARC_QR_PREFIX;


export function createNovaQrValue(
  qrToken: string,
) {
  return `${ARC_QR_PREFIX}${qrToken}`;
}


export function parseNovaQrValue(
  value: string,
) {
  const normalized =
    value.trim();


  if (
    normalized.startsWith(
      ARC_QR_PREFIX,
    )
  ) {
    return normalized.slice(
      ARC_QR_PREFIX.length,
    );
  }


  if (
    normalized.startsWith(
      LEGACY_NOVA_QR_PREFIX,
    )
  ) {
    return normalized.slice(
      LEGACY_NOVA_QR_PREFIX.length,
    );
  }


  return null;
}
