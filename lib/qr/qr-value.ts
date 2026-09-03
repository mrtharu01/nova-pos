export const NOVA_QR_PREFIX = "NOVA:V1:";

export function createNovaQrValue(
  qrToken: string,
) {
  return `${NOVA_QR_PREFIX}${qrToken}`;
}

export function parseNovaQrValue(
  value: string,
) {
  const normalized = value.trim();

  if (
    !normalized.startsWith(
      NOVA_QR_PREFIX,
    )
  ) {
    return null;
  }

  const token = normalized.slice(
    NOVA_QR_PREFIX.length,
  );

  if (!token) {
    return null;
  }

  return {
    version: 1,
    token,
  };
}