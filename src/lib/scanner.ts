import { Capacitor } from "@capacitor/core";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import type { Barcode } from "@capacitor-mlkit/barcode-scanning";

export type ScanResult = { value: string; format?: string } | { error: string };

function barcodeParaTexto(barcode: Barcode): string {
  const valores = [barcode.rawValue, barcode.displayValue]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => v.trim());

  if (valores.length > 0) return valores[0];

  // Alguns boletos ITF não vêm como UTF-8 em rawValue; nesses casos o plugin expõe bytes.
  if (barcode.bytes && barcode.bytes.length > 0) {
    const ascii = barcode.bytes
      .map((b) => (b >= 48 && b <= 57 ? String.fromCharCode(b) : ""))
      .join("");
    if (ascii.length >= 44) return ascii;
  }

  return "";
}

function prioridadeCodigo(value: string): number {
  const texto = value.trim().toUpperCase();
  const digitos = texto.replace(/[^\d]/g, "");
  if (texto.includes("BR.GOV.BCB.PIX")) return 1000 + texto.length;
  if ([44, 47, 48].includes(digitos.length)) return 900 + digitos.length;
  if (digitos.length > 48) return 700 + digitos.length;
  if (digitos.length >= 40) return 600 + digitos.length;
  return digitos.length;
}

/**
 * Abre a câmera nativa e tenta ler 1 código (boleto, QR, etc).
 * Só funciona no APK Android. No navegador retorna erro.
 */
export async function escanearCodigo(): Promise<ScanResult> {
  if (!Capacitor.isNativePlatform()) {
    return { error: "O leitor só funciona no app instalado no celular." };
  }

  try {
    // Verifica se o módulo do Google ML Kit está instalado no aparelho
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }

    const perm = await BarcodeScanner.checkPermissions();
    if (perm.camera !== "granted") {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== "granted") {
        return { error: "Permissão de câmera negada." };
      }
    }

    const { barcodes } = await BarcodeScanner.scan({
      autoZoom: true,
      formats: [
        BarcodeFormat.QrCode,
        BarcodeFormat.Itf,        // boleto bancário e arrecadação
        BarcodeFormat.Pdf417,
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
        BarcodeFormat.Code93,
        BarcodeFormat.Ean13,
        BarcodeFormat.Codabar,
      ],
    });

    if (!barcodes || barcodes.length === 0) {
      return { error: "Nenhum código detectado." };
    }
    const candidatos = barcodes
      .map(barcodeParaTexto)
      .filter(Boolean)
      .sort((a, b) => prioridadeCodigo(b) - prioridadeCodigo(a));
    const raw = candidatos[0] || "";
    if (!raw) return { error: "Código lido sem texto. Tente focar a linha digitável ou o QR Code." };
    return { value: raw, format: barcodes[0].format };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao abrir o leitor.";
    return { error: msg };
  }
}
