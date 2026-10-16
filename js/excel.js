// Penghubung antara data aplikasi dan pembuat Excel (excel-builder.js).
// Hasilnya mengikuti tiga file contoh: PO_<BLN>.xlsx, LAPORAN_RAB_<BLN>.xlsx, BPPP_<BLN>.xlsx
import { INSTANSI } from './config.js';
import { buatBppp, buatPO, buatRab } from './excel-builder.js';
import { laporanRab } from './reports.js';
import { namaSheet, nomorPO, notaUrut } from './store.js';
import { bulanIndo, hariIni, hariSebelum, tanggalIndo } from './utils.js';

const SINGKATAN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const unik = (daftar) => [...new Set(daftar)];

async function ambilTemplate(nama) {
  const respons = await fetch(`templates/${nama}`);
  if (!respons.ok) throw new Error(`File template templates/${nama} tidak ditemukan.`);
  return respons.arrayBuffer();
}

/** jenis: 'po' | 'rab' | 'bppp'; bulan: 'YYYY-MM'. Mengembalikan { buffer, nama }. */
export async function siapkanExcel(jenis, bulan) {
  const daftar = notaUrut().filter((n) => n.tanggal.startsWith(bulan));
  if (!daftar.length) throw new Error('Belum ada data pada bulan ini.');
  const kode = SINGKATAN[Number(bulan.slice(5, 7)) - 1];

  if (jenis === 'po') {
    const data = daftar.map((n) => ({
      sheet: namaSheet(n),
      nomor: nomorPO(n),
      supplier: n.supplier,
      alamat: n.alamat,
      tglKirim: hariSebelum(n.tanggal, 1),
      items: n.items,
    }));
    return { buffer: await buatPO(ExcelJS, await ambilTemplate('PO.xlsx'), data), nama: `PO_${kode}.xlsx` };
  }

  if (jenis === 'rab') {
    const data = unik(daftar.map((n) => n.tanggal)).map((tanggal) => {
      const rab = laporanRab(tanggal);
      return {
        sheet: `RAB_${tanggal}`,
        tanggalTeks: tanggalIndo(tanggal),
        menu: rab.menu,
        tglDokumen: tanggalIndo(hariIni()),
        items: rab.baris,
        siswa: rab.siswa,
      };
    });
    return { buffer: await buatRab(ExcelJS, await ambilTemplate('RAB.xlsx'), data), nama: `LAPORAN_RAB_${kode}.xlsx` };
  }

  const hari = unik(daftar.map((n) => n.tanggal)).map((tanggal) => ({
    tanggalTeks: tanggalIndo(tanggal),
    nota: daftar
      .filter((n) => n.tanggal === tanggal)
      .map((n) => ({ nomor: nomorPO(n), supplier: n.supplier, items: n.items })),
  }));
  const data = { periode: `Periode: ${bulanIndo(bulan)}`, pembuat: INSTANSI.pembuat.nama, hari };
  return { buffer: await buatBppp(ExcelJS, await ambilTemplate('BPPP.xlsx'), data), nama: `BPPP_${kode}.xlsx` };
}

export async function unduhExcel(jenis, bulan) {
  const { buffer, nama } = await siapkanExcel(jenis, bulan);
  const tautan = document.createElement('a');
  tautan.href = URL.createObjectURL(new Blob([buffer], { type: MIME }));
  tautan.download = nama;
  tautan.click();
  URL.revokeObjectURL(tautan.href);
}
