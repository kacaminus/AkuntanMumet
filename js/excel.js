// Penghubung antara data aplikasi, pembuat Excel (excel-builder.js), dan pencetakan (sheet-html.js).
// Hasilnya mengikuti tiga file contoh: PO_<BLN>.xlsx, LAPORAN_RAB_<BLN>.xlsx, BBBP_<BLN>.xlsx
import { ANGGARAN, INSTANSI, PAKET } from './config.js';
import {
  buatAnggaran,
  buatBbbp,
  buatPO,
  buatRab,
  rakitAnggaran,
  rakitBbbp,
  rakitPO,
  rakitRab,
} from './excel-builder.js';
import { laporanAnggaran, laporanBbbp, laporanRab, notaRentang, satuBulanPenuh } from './reports.js';
import { sheetKeHtml } from './sheet-html.js';
import { namaSheet, nomorPO, notaUrut, state } from './store.js';
import { $, hariIni, hariSebelum, tanggalIndo } from './utils.js';

const SINGKATAN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE = { po: 'PO.xlsx', rab: 'RAB.xlsx', bbbp: 'BBBP.xlsx', anggaran: 'BBBP.xlsx' }; // kop anggaran memakai template BBBP
const KERTAS_PX = { portrait: [794, 1123], landscape: [1123, 794] }; // A4 pada 96 dpi

const unik = (daftar) => [...new Set(daftar)];

async function ambilTemplate(jenis) {
  const respons = await fetch(`templates/${TEMPLATE[jenis]}`);
  if (!respons.ok) throw new Error(`File template templates/${TEMPLATE[jenis]} tidak ditemukan.`);
  return respons.arrayBuffer();
}

// ---------- data aplikasi -> data untuk pembuat Excel ----------
const dataPO = (daftar) =>
  daftar.map((n) => ({
    sheet: namaSheet(n),
    nomor: nomorPO(n),
    supplier: n.supplier,
    alamat: n.alamat,
    tglKirim: hariSebelum(n.tanggal, 1),
    items: n.items,
  }));

const dataRab = (tanggal) =>
  tanggal.map((t) => {
    const rab = laporanRab(t);
    return {
      sheet: `RAB_${t}`,
      tanggalTeks: tanggalIndo(t),
      menu: rab.menu,
      tglDokumen: tanggalIndo(hariIni()),
      items: rab.baris,
      siswa: rab.siswa,
    };
  });

const dataBbbp = (dari, sampai) => {
  const daftar = notaRentang(dari, sampai);
  return {
    periode: `Periode: ${laporanBbbp(dari, sampai).periode}`,
    alamat: INSTANSI.alamat,
    pembuat: INSTANSI.pembuat.nama,
    hari: unik(daftar.map((n) => n.tanggal)).map((tanggal) => ({
      tanggalTeks: tanggalIndo(tanggal),
      nota: daftar
        .filter((n) => n.tanggal === tanggal)
        .map((n) => ({ nomor: n.bukti, supplier: n.supplier, items: n.items })),
    })),
  };
};

const dataAnggaran = (dari, sampai) => {
  const laporan = laporanAnggaran(dari, sampai);
  return {
    periode: `Periode ${laporan.periode}`,
    paket: PAKET,
    hari: laporan.hari.map((h) => ({ tanggalTeks: tanggalIndo(h.tanggal), jumlah: h.jumlah, realisasi: h.realisasi })),
    pembuat: { nama: ANGGARAN.pembuat, jabatan: INSTANSI.pembuat.jabatan },
    mengetahui: { nama: ANGGARAN.mengetahui, jabatan: INSTANSI.mengetahui.jabatan },
  };
};

const notaBulan = (bulan) => notaUrut().filter((n) => n.tanggal.startsWith(bulan));
const pecahRentang = (id) => id.split('_'); // 'YYYY-MM-DD_YYYY-MM-DD' -> [dari, sampai]

// ---------- unduh .xlsx ----------
/**
 * jenis: 'po' | 'rab' (id = 'YYYY-MM') atau 'bbbp' (id = 'YYYY-MM-DD_YYYY-MM-DD', rentang tanggal).
 * Mengembalikan { buffer, nama }.
 */
export async function siapkanExcel(jenis, id) {
  const template = await ambilTemplate(jenis);
  if (jenis === 'anggaran') {
    const [dari, sampai] = pecahRentang(id);
    if (!laporanAnggaran(dari, sampai).hari.length) throw new Error('Belum ada data pada rentang tanggal ini.');
    const nama = satuBulanPenuh(dari, sampai)
      ? `ANGGARAN_${SINGKATAN[Number(dari.slice(5, 7)) - 1]}.xlsx`
      : `ANGGARAN_${dari}_sd_${sampai}.xlsx`;
    return { buffer: await buatAnggaran(ExcelJS, template, dataAnggaran(dari, sampai)), nama };
  }
  if (jenis === 'bbbp') {
    const [dari, sampai] = pecahRentang(id);
    if (!notaRentang(dari, sampai).length) throw new Error('Belum ada data pada rentang tanggal ini.');
    const nama = satuBulanPenuh(dari, sampai)
      ? `BBBP_${SINGKATAN[Number(dari.slice(5, 7)) - 1]}.xlsx`
      : `BBBP_${dari}_sd_${sampai}.xlsx`;
    return { buffer: await buatBbbp(ExcelJS, template, dataBbbp(dari, sampai)), nama };
  }
  const daftar = notaBulan(id);
  if (!daftar.length) throw new Error('Belum ada data pada bulan ini.');
  const kode = SINGKATAN[Number(id.slice(5, 7)) - 1];
  if (jenis === 'po') return { buffer: await buatPO(ExcelJS, template, dataPO(daftar)), nama: `PO_${kode}.xlsx` };
  const buffer = await buatRab(ExcelJS, template, dataRab(unik(daftar.map((n) => n.tanggal))));
  return { buffer, nama: `LAPORAN_RAB_${kode}.xlsx` };
}

export async function unduhExcel(jenis, id) {
  const { buffer, nama } = await siapkanExcel(jenis, id);
  const tautan = document.createElement('a');
  tautan.href = URL.createObjectURL(new Blob([buffer], { type: MIME }));
  tautan.download = nama;
  tautan.click();
  URL.revokeObjectURL(tautan.href);
}

// ---------- cetak ----------
function logoUrl(workbook, ws) {
  const gambar = ws.getImages?.()[0];
  if (!gambar) return null;
  const media = workbook.getImage(gambar.imageId);
  let biner = '';
  for (let i = 0; i < media.buffer.length; i += 0x8000)
    biner += String.fromCharCode(...media.buffer.subarray(i, i + 0x8000));
  return `data:image/${media.extension};base64,${btoa(biner)}`;
}

/**
 * Menyusun HTML + aturan halaman untuk dicetak. jenis: 'po' (id = id nota), 'rab' (id = tanggal), 'bbbp' (id = 'dari_sampai').
 * Tampilannya berasal dari sheet Excel yang sama, jadi cetakan = file contoh.
 */
export async function susunCetak(jenis, id) {
  const template = await ambilTemplate(jenis);
  let workbook;
  let blok;
  if (jenis === 'po') {
    workbook = await rakitPO(ExcelJS, template, dataPO([state.nota.find((n) => n.id === id)]));
    const ws = workbook.worksheets[0];
    blok = [sheetKeHtml(ws, workbook, { logoUrl: logoUrl(workbook, ws) })];
  } else if (jenis === 'rab') {
    workbook = await rakitRab(ExcelJS, template, dataRab([id]));
    const ws = workbook.worksheets[0];
    // tabel bahan (A-G) dan tabel sekolah (H-M) dicetak di halaman terpisah agar tetap terbaca
    blok = [
      sheetKeHtml(ws, workbook, { kolom: [1, 7] }),
      sheetKeHtml(ws, workbook, { kolom: [8, 13], baris: [1, 34] }),
    ];
    blok.forEach((b) => (b.cocokTinggi = true));
  } else if (jenis === 'anggaran') {
    const [dari, sampai] = pecahRentang(id);
    if (!laporanAnggaran(dari, sampai).hari.length) throw new Error('Belum ada data pada rentang tanggal ini.');
    workbook = await rakitAnggaran(ExcelJS, template, dataAnggaran(dari, sampai));
    const ws = workbook.worksheets[0];
    blok = [sheetKeHtml(ws, workbook, { logoUrl: logoUrl(workbook, ws) })];
  } else {
    const [dari, sampai] = pecahRentang(id);
    if (!notaRentang(dari, sampai).length) throw new Error('Belum ada data pada rentang tanggal ini.');
    workbook = await rakitBbbp(ExcelJS, template, dataBbbp(dari, sampai));
    const ws = workbook.worksheets[0];
    blok = [sheetKeHtml(ws, workbook, { logoUrl: logoUrl(workbook, ws) })];
  }
  const { orientasi, margin } = blok[0];
  const [lebarKertas, tinggiKertas] = KERTAS_PX[orientasi];
  const bolehLebar = lebarKertas - (margin.kiri + margin.kanan) * 96;
  const bolehTinggi = tinggiKertas - (margin.atas + margin.bawah) * 96;
  const html = blok
    .map((b, i) => {
      // muat satu halaman, dengan ruang cadangan 5% agar tidak ada halaman kosong/terpotong di browser berbeda
      const skala = Math.min(
        1,
        bolehLebar / b.lebar,
        ['bbbp', 'anggaran'].includes(jenis) ? 1 : (bolehTinggi * 0.95) / b.tinggi,
      );
      return `<div style="${i ? 'page-break-before:always;' : ''}zoom:${skala}">${b.html}</div>`;
    })
    .join('');
  const css = `@page{size:A4 ${orientasi};margin:${margin.atas}in ${margin.kanan}in ${margin.bawah}in ${margin.kiri}in}`;
  return { html, css };
}

export async function cetakExcel(jenis, id) {
  const { html, css } = await susunCetak(jenis, id);
  $('#gaya-halaman').textContent = css;
  const area = $('#area-cetak');
  area.innerHTML = html;
  await Promise.all([...area.querySelectorAll('img')].map((g) => g.decode().catch(() => {})));
  const bersihkan = () => {
    area.innerHTML = '';
    window.removeEventListener('afterprint', bersihkan);
  };
  window.addEventListener('afterprint', bersihkan);
  window.print();
}
