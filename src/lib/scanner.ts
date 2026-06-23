import { Capacitor } from "@capacitor/core";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";

export type ScanResult = { value: string } | { error: string };

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
      formats: [
        BarcodeFormat.QrCode,
        BarcodeFormat.Itf,        // boleto bancário e arrecadação
        BarcodeFormat.Code128,
        BarcodeFormat.Ean13,
        BarcodeFormat.Codabar,
      ],
    });

    if (!barcodes || barcodes.length === 0) {
      return { error: "Nenhum código detectado." };
    }
    const raw = barcodes[0].rawValue;
    if (!raw) return { error: "Código vazio." };
    return { value: raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao abrir o leitor.";
    return { error: msg };
  }
}
