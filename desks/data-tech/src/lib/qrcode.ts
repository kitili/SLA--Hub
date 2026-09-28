import QRCode from "qrcode";

export function toolDetailUrl(toolId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4050";
  return `${baseUrl}/dashboard/tools/${toolId}`;
}

export async function generateToolQrDataUrl(toolId: string) {
  return QRCode.toDataURL(toolDetailUrl(toolId), { margin: 1, width: 320 });
}

export async function generateToolQrPngBuffer(toolId: string) {
  return QRCode.toBuffer(toolDetailUrl(toolId), { margin: 1, width: 320 });
}
