/**
 * ID di seluruh skema adalah BIGINT UNSIGNED (docs/ERD.md), sehingga Prisma
 * mengembalikannya sebagai `bigint` JavaScript. `JSON.stringify` menolak bigint dan
 * melempar "Do not know how to serialize a BigInt", yang akan meledak di response
 * pertama yang memuat id.
 *
 * Patch ini membuat bigint bisa diserialisasi: jadi number selama masih dalam rentang
 * aman IEEE-754 (semua id realistis ada di sini, dan cocok dengan `type: integer` di
 * docs/OPENAPI.yaml), dan jadi string kalau melampauinya agar presisi tidak hilang diam-diam.
 *
 * Harus di-import sekali saat bootstrap, sebelum response apa pun dikirim.
 */
declare global {
  interface BigInt {
    toJSON(): number | string;
  }
}

// `this` di dalam metode prototype bertipe wrapper `BigInt`, bukan primitif `bigint`,
// sehingga tipe `this` dinyatakan eksplisit agar operator perbandingan bisa dipakai.
BigInt.prototype.toJSON = function toJSON(this: bigint): number | string {
  const aman =
    this <= BigInt(Number.MAX_SAFE_INTEGER) && this >= BigInt(Number.MIN_SAFE_INTEGER);
  return aman ? Number(this) : this.toString();
};

export {};
