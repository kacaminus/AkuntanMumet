// Data instansi, penanda tangan, kop, dan pengaturan paket. Boleh diganti kapan saja (tidak berisi kunci rahasia).
export const INSTANSI = {
  sppg: 'SPPG SIDOARJO TULANGAN TULANGAN',
  yayasan: 'YAYASAN PAUD PSM SURODADI',
  alamat: 'Jl. Raya Tulangan No 38, Kenongo, Tulangan, Sidoarjo, Jawa Timur, Indonesia', // kop BBBP
  idSppg: 'PRVM7QGM',
  kodePO: 'PO/BMK',
  pembuat: { nama: 'Ira sukma Yuliawati S.Ak.', jabatan: 'Akuntan SPPG' },
  mengetahui: { nama: 'Fany Bella Nur Azizah S.Farm.', jabatan: 'Kepala SPPG' },
};

export const KOP_PO = [
  'BADAN GIZI NASIONAL (NATIONAL NUTRITION AGENCY)',
  'Gedung E Kompleks Kementerian Pertanian',
  'Jalan Harsono RM Nomor 3 Ragunan, Pasar Minggu Jakarta, 12550',
];

// Laporan "Anggaran Bahan Makanan": paket MBG dikelompokkan menurut pagu harga per porsi (lihat master-data SEKOLAH).
export const PAKET = [
  { nama: 'KECIL', harga: 8000 },
  { nama: 'BESAR', harga: 10000 },
];

export const ANGGARAN = {
  kop: [
    'Jln Raya Tulangan RT 002 RW 002, Desa Tulangan, Kec. Tulangan (Jl. Raya Tulangan No 38, Kenongo, Tulangan)',
    'Sidoarjo, Jawa Timur, Indonesia',
  ],
  pembuat: 'Ira Sukma Yuliawati, S.Ak.',
  mengetahui: 'Fany Bella Nur Azizah, S.Farm.',
};
