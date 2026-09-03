export type RemoteScanResult = {
  accepted: boolean;

  label?: string;

  message?: string;
};

export type ProductScanBroadcast = {
  requestId: string;

  scannerId: string;

  value: string;

  scannedAt: string;
};

export type ScanResultBroadcast = {
  requestId: string;

  scannerId: string;

  accepted: boolean;

  label?: string;

  message?: string;
};

export function remoteScannerTopic(
  pairToken: string,
) {
  return `nova-remote-scanner:${pairToken}`;
}