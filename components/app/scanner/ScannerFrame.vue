<template>
  <div class="relative mx-auto w-full max-w-xl min-h-[280px]">
    <div class="absolute inset-0 pointer-events-none z-10">
      <div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-stone-700 shadow-lg" aria-hidden="true" />
    </div>
    <div class="relative bg-black rounded-xl overflow-hidden border border-stone-700">
      <div :id="regionId" class="w-full h-[280px]"></div>
      <div
        v-if="errorMessage"
        class="absolute inset-0 flex items-center justify-center bg-red-50/90 border-4 border-red-500 text-red-900 p-4 text-center m-3 rounded-lg"
        role="alert"
      >
        <p class="font-semibold text-sm">{{ errorMessage }}</p>
      </div>
    </div>
    <p class="mt-2 text-center text-xs text-stone-500">{{ t('scanner.alignHint') || 'Align code within the frame' }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useI18n } from 'vue-i18n';
import { logger } from '@/lib/logger';

const props = withDefaults(defineProps<{ scannerId?: string }>(), { scannerId: 'vue-reader' });
const emit = defineEmits<{ (e: 'scan', code: string): void }>();

const { t } = useI18n();
const scannerRef = ref<Html5Qrcode | null>(null);
const errorMessage = ref<string | null>(null);
const lastScan = ref<{ code: string; timestamp: number } | null>(null);
const regionId = props.scannerId;

/**
 * Map technical scanner errors to user-friendly messages
 */
function mapScannerError(error: string): string {
  if (error.includes('NotAllowedError') || error.includes('Permission denied')) {
    return t('camera.permissionDenied')
  }
  if (error.includes('NotReadableError') || error.includes('Could not start video')) {
    return t('camera.inUse')
  }
  if (error.includes('NotFoundError') || error.includes('Requested device not found')) {
    return t('camera.notFound')
  }
  return t('scanner.cameraError')
}

const stopScanner = async () => {
  if (scannerRef.value) {
    try {
      if (scannerRef.value.isScanning) {
        await scannerRef.value.stop();
      }
      await scannerRef.value.clear();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to stop scanner', {
        scannerId: regionId,
        error: message,
      });
    } finally {
      scannerRef.value = null;
    }
  }
};

onMounted(async () => {
  const formatsToSupport = [
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.QR_CODE,
  ];

  try {
    const scanner = new Html5Qrcode(regionId, { formatsToSupport, verbose: false });
    scannerRef.value = scanner;

    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 24,
        qrbox: { width: 240, height: 240 },
      },
      (decodedText) => {
        const clean = decodedText.trim();
        const validLengths = [8, 12, 13];
        if (!validLengths.includes(clean.length)) return;
        const now = Date.now();
        if (lastScan.value && lastScan.value.code === clean && now - lastScan.value.timestamp < 1500) return;
        lastScan.value = { code: clean, timestamp: now };
        emit('scan', clean);
      },
      (err) => {
        const expected =
          err.includes('No MultiFormat Readers') ||
          err.includes('NotFoundException') ||
          err.includes('No barcode or QR code detected');
        if (!expected) {
          logger.warn('Unexpected scanner error during operation', {
            scannerId: regionId,
            error: err,
          });
          errorMessage.value = mapScannerError(err);
        }
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to start scanner', {
      scannerId: regionId,
      error: message,
    });
    errorMessage.value = mapScannerError(message);
  }
});

onBeforeUnmount(stopScanner);

watch(
  () => props.scannerId,
  async () => {
    await stopScanner();
  }
);
</script>
