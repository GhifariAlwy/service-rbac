/**
 * Sanitasi input string di backend (CLAUDE.md paragraf 6 aturan #6).
 *
 * Pertahanan utama terhadap XSS tetap output encoding di React; ini lapisan kedua
 * agar payload seperti `<script>` tidak pernah tersimpan di database sejak awal.
 * Karakter kontrol dibuang supaya tidak bisa dipakai menyisipkan baris palsu ke log.
 */
const HTML_TAG = /<[^>]*>/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function sanitizeText(value: string): string {
  return value.replace(HTML_TAG, '').replace(CONTROL_CHARS, '').trim();
}
