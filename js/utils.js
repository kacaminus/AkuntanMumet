// Fungsi bantu umum: format angka, tanggal, dan HTML.
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
export const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const $ = (selector, root = document) => root.querySelector(selector);

export const esc = (teks) =>
  String(teks ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const rupiah = (angka) => 'Rp ' + Math.round(angka || 0).toLocaleString('id-ID');
export const pad = (angka, panjang = 2) => String(angka).padStart(panjang, '0');
export const maks = (daftar, kunci) => Math.max(0, ...daftar.map((x) => x[kunci]));

const keTanggal = (iso) => new Date(`${iso}T00:00:00`);
export const hariIni = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, zona waktu lokal
export const formatDMY = (iso) => iso.split('-').reverse().join('/');
export const bulanIndo = (ym) => `${BULAN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export function tanggalIndo(iso) {
  const t = keTanggal(iso);
  return `${HARI[t.getDay()]}, ${t.getDate()} ${BULAN[t.getMonth()]} ${t.getFullYear()}`;
}

export function hariSebelum(iso, jumlah = 1) {
  const t = keTanggal(iso);
  t.setDate(t.getDate() - jumlah);
  return t.toLocaleDateString('en-CA');
}

/** '2026-09-01' -> '1 September 2026' */
export function tanggalPanjang(iso) {
  const t = keTanggal(iso);
  return `${t.getDate()} ${BULAN[t.getMonth()]} ${t.getFullYear()}`;
}

/** 'YYYY-MM' -> tanggal terakhir bulan itu ('YYYY-MM-DD') */
export function akhirBulan(ym) {
  const [tahun, bulan] = ym.split('-').map(Number);
  return `${ym}-${pad(new Date(tahun, bulan, 0).getDate())}`;
}
