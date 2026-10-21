// Pembuat file Excel yang meniru file contoh asli (folder templates/).
// Setiap fungsi menerima ExcelJS + isi file template, lalu menyalin format sel-demi-sel
// (font, warna, border, merge, lebar kolom, logo, pengaturan cetak) dan mengisi datanya.
// Modul ini tidak bergantung pada state aplikasi sehingga mudah diuji.

const klon = (x) => JSON.parse(JSON.stringify(x));
const adaNilai = (v) => typeof v === 'string' || typeof v === 'number' || Boolean(v && v.richText);
const tglUTC = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const gabung = (sheet, daftar) => daftar.forEach((r) => sheet.mergeCells(r));

/** Salin gaya (dan nilai teks/angka) satu baris template ke baris tujuan. */
function salin(asal, barisAsal, tujuan, barisTujuan, kolomAwal, kolomAkhir, { nilai = true, tinggi = true } = {}) {
  for (let c = kolomAwal; c <= kolomAkhir; c++) {
    const sel = asal.getCell(barisAsal, c);
    const dest = tujuan.getCell(barisTujuan, c);
    dest.style = klon(sel.style);
    const turunanMerge = sel.isMerged && sel.master.address !== sel.address;
    if (nilai && !turunanMerge && adaNilai(sel.value)) dest.value = klon(sel.value);
  }
  const tinggiBaris = asal.getRow(barisAsal).height;
  if (tinggi && tinggiBaris) tujuan.getRow(barisTujuan).height = tinggiBaris;
}

function siapkanSheet(workbook, template, nama, jumlahKolom) {
  const sheet = workbook.addWorksheet(nama);
  sheet.pageSetup = klon(template.pageSetup);
  sheet.properties.defaultRowHeight = template.properties.defaultRowHeight;
  sheet.properties.defaultColWidth = template.properties.defaultColWidth;
  for (let c = 1; c <= jumlahKolom; c++) {
    const lebar = template.getColumn(c).width;
    if (lebar) sheet.getColumn(c).width = lebar;
  }
  return sheet;
}

async function muatTemplate(ExcelJS, buffer, namaSheet) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return { workbook, template: namaSheet ? workbook.getWorksheet(namaSheet) : workbook.worksheets[0] };
}

const geser = (rentang, selisih) => rentang.replace(/\d+/g, (n) => Number(n) + selisih);
const jumlah = (items) => items.reduce((t, i) => t + i.qty * i.harga, 0);

// ======================= RAB =======================
// daftar: [{ sheet, tanggalTeks, menu, tglDokumen, items:[{uraian,qty,satuan,harga}], siswa:[...] }]
function isiRab(workbook, T, data) {
  const D = siapkanSheet(workbook, T, data.sheet, 13);
  gabung(D, ['A1:G1', 'A2:G2', 'A3:G3', 'A4:G4', 'A5:G5', 'H1:M1', 'H34:J34']);
  for (let k = 1; k <= 6; k++) salin(T, k, D, k, 1, 7);
  for (let k = 1; k <= 34; k++) salin(T, k, D, k, 8, 13); // tabel sekolah

  // tabel sekolah: jumlah siswa diinput manual, jumlah rupiah = siswa x pagu harga
  let totalSiswa = 0;
  let totalPagu = 0;
  for (let k = 3; k <= 33; k++) {
    const siswa = Number(data.siswa[k - 3]) || 0;
    const harga = T.getCell(k, 12).value;
    totalSiswa += siswa;
    totalPagu += siswa * harga;
    D.getCell(k, 11).value = data.siswa[k - 3] === '' || data.siswa[k - 3] == null ? null : siswa;
    D.getCell(k, 13).value = { formula: `L${k}*K${k}`, result: siswa * harga };
  }
  D.getCell('K34').value = { formula: 'SUM(K3:K33)', result: totalSiswa };
  D.getCell('M34').value = { formula: 'SUM(M3:M33)', result: totalPagu };

  // bahan
  const n = data.items.length;
  data.items.forEach((it, i) => {
    const r = 7 + i;
    salin(T, 8, D, r, 1, 7, { nilai: false });
    D.getCell(r, 1).value = i + 1;
    D.getCell(r, 2).value = it.uraian;
    D.getCell(r, 3).value = it.qty;
    D.getCell(r, 4).value = it.satuan;
    D.getCell(r, 5).value = it.harga;
    D.getCell(r, 6).value = { formula: `C${r}*E${r}`, result: it.qty * it.harga };
  });

  // total, pagu, sisa
  const t = 7 + n;
  const total = jumlah(data.items);
  [29, 30, 31].forEach((src, k) => {
    D.mergeCells(`A${t + k}:E${t + k}`);
    salin(T, src, D, t + k, 1, 7);
  });
  D.getCell(t, 6).value = { formula: `SUM(F7:F${Math.max(7, t - 1)})`, result: total };
  D.getCell(t + 1, 6).value = { formula: 'M34', result: totalPagu };
  D.getCell(t + 2, 6).value = { formula: `MIN(F${t + 1}-F${t})`, result: totalPagu - total };

  D.getCell('A4').value = `Hari : ${data.tanggalTeks}`;
  D.getCell('A5').value = `MENU: ${data.menu}`;
  D.getCell('H1').value = data.tglDokumen;
}

/** Menyusun workbook RAB (satu sheet per tanggal). Dipakai untuk unduh Excel dan cetak. */
export async function rakitRab(ExcelJS, buffer, daftar) {
  const { workbook, template } = await muatTemplate(ExcelJS, buffer);
  daftar.forEach((d) => isiRab(workbook, template, d));
  workbook.removeWorksheet(template.id);
  return workbook;
}

export const buatRab = async (...args) => (await rakitRab(...args)).xlsx.writeBuffer();

// ======================= PO =======================
// daftar: [{ sheet, nomor, supplier, alamat, tglKirim:'YYYY-MM-DD', items }]
function isiPO(workbook, T, data) {
  const D = siapkanSheet(workbook, T, data.sheet, 10);
  const n = data.items.length;
  const total = 14 + n; // baris "Total"
  const selisih = total - 24; // posisi baris total pada template = 24

  gabung(D, ['A1:G1', 'A2:G2', 'A3:G3', 'A5:G5', 'A6:G6', 'A13:B13', 'D13:E13']);
  for (let k = 1; k <= 13; k++) salin(T, k, D, k, 1, 7);

  data.items.forEach((it, i) => {
    const r = 14 + i;
    D.mergeCells(`A${r}:B${r}`);
    salin(T, 14, D, r, 1, 7, { nilai: false });
    D.getCell(r, 1).value = i + 1;
    D.getCell(r, 3).value = it.uraian;
    D.getCell(r, 4).value = it.qty;
    D.getCell(r, 5).value = it.satuan;
    D.getCell(r, 6).value = it.harga;
    D.getCell(r, 7).value = { formula: `D${r}*F${r}`, result: it.qty * it.harga };
  });

  D.mergeCells(`A${total}:F${total}`);
  salin(T, 24, D, total, 1, 7);
  D.getCell(total, 7).value = { formula: `SUM(G14:G${total - 1})`, result: jumlah(data.items) };

  // blok tanda tangan: ikut turun/naik mengikuti baris total
  gabung(
    D,
    ['A29:B31', 'F26:G26', 'F28:G28', 'A32:C32', 'A33:C33', 'F32:G32', 'F33:G33'].map((r) => geser(r, selisih)),
  );
  for (let src = 25; src <= 35; src++) salin(T, src, D, src + selisih, 1, 7);
  D.pageSetup.printArea = `A1:G${33 + selisih}`;

  D.getCell('A6').value = `No. ${data.nomor}`;
  D.getCell('G8').value = tglUTC(data.tglKirim);
  D.getCell('G9').value = tglUTC(data.tglKirim);
  D.getCell('C10').value = data.supplier;
  D.getCell('C11').value = data.alamat;

  const logo = T.getImages()[0];
  if (logo) D.addImage(logo.imageId, { tl: logo.range.tl, ext: logo.range.ext });
}

/** Menyusun workbook PO (satu sheet per nota). */
export async function rakitPO(ExcelJS, buffer, daftar) {
  const { workbook, template } = await muatTemplate(ExcelJS, buffer, '1 SEP'); // sheet contoh PO
  daftar.forEach((d) => isiPO(workbook, template, d));
  const dipakai = new Set(daftar.map((d) => d.sheet));
  [...workbook.worksheets].filter((w) => !dipakai.has(w.name)).forEach((w) => workbook.removeWorksheet(w.id)); // buang contoh + data supplier
  return workbook;
}

export const buatPO = async (...args) => (await rakitPO(...args)).xlsx.writeBuffer();

// ======================= BBBP =======================
// data: { periode, pembuat, hari:[{ tanggalTeks, nota:[{ nomor, supplier, items }] }] }
/** Menyusun workbook BBBP (satu sheet berisi seluruh bulan). */
export async function rakitBbbp(ExcelJS, buffer, data) {
  const { workbook, template: T } = await muatTemplate(ExcelJS, buffer);
  const D = siapkanSheet(workbook, T, 'BBBP_hasil', 10);
  gabung(D, [
    'A1:J1',
    'A2:J2',
    'A3:J3',
    'A4:J4',
    'A5:J5',
    'A7:A8',
    'B7:B8',
    'C7:C8',
    'D7:D8',
    'E7:E8',
    'F7:G7',
    'H7:H8',
    'I7:I8',
    'J7:J8',
  ]);
  for (let k = 1; k <= 8; k++) salin(T, k, D, k, 1, 10);
  D.getCell('A5').value = data.periode;
  D.getCell('A2').value = data.alamat; // alamat kop (satu baris); baris 3 dikosongkan
  D.getCell('A3').value = null;
  const logo = T.getImages()[0]; // logo instansi dari template
  if (logo) D.addImage(logo.imageId, { tl: logo.range.tl, ext: logo.range.ext });

  // 1) tentukan baris + gabungan sel; 2) beri gaya dan isi nilai
  const baris = [];
  const merges = [];
  let r = 9;
  data.hari.forEach((hari, nomorHari) => {
    const awalHari = r;
    hari.nota.forEach((nota) => {
      const awalNota = r;
      nota.items.forEach((item, k) => {
        baris.push({
          r,
          item,
          nota,
          hari,
          nomorHari,
          awalHari: r === awalHari,
          awalNota: k === 0,
          akhirNota: k === nota.items.length - 1,
        });
        r += 1;
      });
      if (r - 1 > awalNota) merges.push(`C${awalNota}:C${r - 1}`, `D${awalNota}:D${r - 1}`);
    });
    if (r - 1 > awalHari) merges.push(`A${awalHari}:A${r - 1}`, `B${awalHari}:B${r - 1}`, `J${awalHari}:J${r - 1}`);
    hari.awal = awalHari;
    hari.akhir = r - 1;
  });
  const total = r;
  gabung(D, [...merges, `A${total}:H${total}`]);

  baris.forEach(({ r: row, item, nota, hari, nomorHari, awalHari, awalNota, akhirNota }) => {
    salin(T, 9, D, row, 5, 9, { nilai: false, tinggi: false });
    [1, 2, 10].forEach((c) => salin(T, awalHari ? 9 : 10, D, row, c, c, { nilai: false, tinggi: false }));
    [3, 4].forEach((c) => {
      const asal = awalNota ? 9 : akhirNota ? 35 : 10;
      salin(T, awalNota && akhirNota ? 9 : asal, D, row, c, c, { nilai: false, tinggi: false });
    });
    if (awalHari) {
      D.getCell(row, 1).value = nomorHari + 1;
      D.getCell(row, 2).value = hari.tanggalTeks;
      const jumlahHari = hari.nota.reduce((t, x) => t + jumlah(x.items), 0);
      D.getCell(row, 10).value = { formula: `SUM(I${hari.awal}:I${hari.akhir})`, result: jumlahHari };
    }
    const sel = D.getCell(row, 3);
    sel.alignment = { ...sel.alignment, shrinkToFit: true, wrapText: false }; // nomor bukti muat 1 baris
    if (awalNota) {
      D.getCell(row, 3).value = nota.nomor || null;
      D.getCell(row, 4).value = nota.supplier;
    }
    D.getCell(row, 5).value = item.uraian;
    D.getCell(row, 6).value = item.qty;
    D.getCell(row, 7).value = item.satuan;
    D.getCell(row, 8).value = item.harga;
    D.getCell(row, 9).value = { formula: `F${row}*H${row}`, result: item.qty * item.harga };
  });

  // baris TOTAL + blok tanda tangan (posisi relatif terhadap baris total pada template = 214)
  const selisih = total - 214;
  const totalBulan = baris.reduce((t, b) => t + b.item.qty * b.item.harga, 0);
  salin(T, 214, D, total, 1, 10);
  D.getCell(total, 9).value = { formula: `SUM(I9:I${total - 1})`, result: totalBulan };
  D.getCell(total, 10).value = { formula: `SUM(J9:J${total - 1})`, result: totalBulan };
  gabung(
    D,
    ['H218:I218', 'H219:I221', 'J219:J221', 'H222:I222', 'H223:I223'].map((x) => geser(x, selisih)),
  );
  for (let src = 215; src <= 225; src++) salin(T, src, D, src + selisih, 1, 10);
  D.getCell(222 + selisih, 8).value = data.pembuat;

  workbook.removeWorksheet(T.id);
  D.name = 'BBBP'; // nama akhir setelah sheet contoh (juga bernama BBBP) dihapus
  return workbook;
}

export const buatBbbp = async (...args) => (await rakitBbbp(...args)).xlsx.writeBuffer();

// ======================= ANGGARAN BAHAN MAKANAN =======================
// Tidak ada file contoh Excel-nya (hanya gambar), jadi kop + logo disalin dari template BBBP,
// sedangkan tabelnya dibuat mengikuti gambar contoh: warna, garis, lebar kolom, dan susunan sel.
const TNR = (size = 12, tambahan = {}) => ({ name: 'Times New Roman', family: 1, size, ...tambahan });
const GARIS = { style: 'thin', color: { argb: 'FF000000' } };
const KOTAK = { top: GARIS, left: GARIS, bottom: GARIS, right: GARIS };
const FORMAT_RP = '"Rp"* #,##0';
const WARNA = { kepala: 'FFCFE2F3', surplus: 'FFB3CEFB', total: 'FFFFE599', kuning: 'FFFFFF00' };
const LEBAR_ANGGARAN = [26.1, 11.8, 12.4, 16.9, 20.8, 25, 24.8, 24.8, 15.5];

function gayaSel(sel, { font = TNR(), fill, horizontal, vertical = 'bottom', numFmt } = {}) {
  sel.font = font;
  if (fill) sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  sel.border = KOTAK;
  sel.alignment = { horizontal, vertical };
  if (numFmt) sel.numFmt = numFmt;
}

/**
 * data: { periode, paket:[{nama,harga}], hari:[{ tanggalTeks, jumlah:[kecil,besar], realisasi:number|null }],
 *         pembuat:{nama,jabatan}, mengetahui:{nama,jabatan} }
 */
export async function rakitAnggaran(ExcelJS, buffer, data) {
  const { workbook, template: T } = await muatTemplate(ExcelJS, buffer);
  const D = siapkanSheet(workbook, T, 'ANGGARAN_hasil', 9);
  D.pageSetup = { ...klon(T.pageSetup), fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; // muat 1 halaman lebar
  LEBAR_ANGGARAN.forEach((lebar, i) => (D.getColumn(i + 1).width = lebar));

  // kop (baris 1-5) dan logo dari template
  gabung(D, ['A1:I1', 'A2:I2', 'A3:I3', 'A4:I4', 'A5:I5', 'B7:C7']);
  for (let k = 1; k <= 5; k++) salin(T, k, D, k, 1, 9);
  D.getCell('A4').value = 'ANGGARAN BAHAN MAKANAN';
  D.getCell('A5').value = data.periode;
  const logo = T.getImages()[0];
  if (logo) D.addImage(logo.imageId, { tl: logo.range.tl, ext: logo.range.ext });

  // judul kolom
  [
    'HARI/TANGGAL',
    'JUMLAH PAKET MBG',
    null,
    'HARGA PAKET',
    'ANGGARAN',
    'TOTAL ANGGARAN',
    'REALISASI',
    'SELISIH',
    'KET',
  ].forEach((teks, i) => {
    const sel = D.getCell(7, i + 1);
    if (teks) sel.value = teks;
    gayaSel(sel, { font: TNR(12, { bold: true }), fill: WARNA.kepala, horizontal: 'center', vertical: 'middle' });
  });
  D.getRow(7).height = 31.5;

  // dua baris (KECIL/BESAR) untuk setiap tanggal
  let sumAnggaran = 0;
  let sumRealisasi = 0;
  let sumSelisih = 0;
  data.hari.forEach((h, i) => {
    const r = 8 + i * 2;
    gabung(
      D,
      ['A', 'F', 'G', 'H', 'I'].map((k) => `${k}${r}:${k}${r + 1}`),
    );
    const anggaran = data.paket.map((p, k) => h.jumlah[k] * p.harga);
    const total = anggaran.reduce((a, b) => a + b, 0);
    const kosong = h.realisasi == null;
    sumAnggaran += total;
    sumRealisasi += h.realisasi ?? 0;
    sumSelisih += total - (h.realisasi ?? 0);

    D.getCell(r, 1).value = h.tanggalTeks;
    data.paket.forEach((p, k) => {
      const row = r + k;
      D.getCell(row, 2).value = p.nama;
      D.getCell(row, 3).value = h.jumlah[k];
      D.getCell(row, 4).value = p.harga;
      D.getCell(row, 5).value = { formula: `C${row}*D${row}`, result: anggaran[k] };
      gayaSel(D.getCell(row, 2), { horizontal: 'left' });
      gayaSel(D.getCell(row, 3), { fill: WARNA.kuning, horizontal: 'center' });
      gayaSel(D.getCell(row, 4), { numFmt: FORMAT_RP });
      gayaSel(D.getCell(row, 5), { numFmt: FORMAT_RP });
    });
    D.getCell(r, 6).value = { formula: `E${r}+E${r + 1}`, result: total };
    if (!kosong) D.getCell(r, 7).value = h.realisasi;
    D.getCell(r, 8).value = { formula: `F${r}-G${r}`, result: total - (h.realisasi ?? 0) };
    [r, r + 1].forEach((row) => {
      gayaSel(D.getCell(row, 1), { horizontal: 'left', vertical: 'top' });
      gayaSel(D.getCell(row, 6), { numFmt: FORMAT_RP, vertical: 'top' });
      gayaSel(D.getCell(row, 7), { numFmt: FORMAT_RP, vertical: 'top', fill: kosong ? WARNA.kuning : undefined });
      gayaSel(D.getCell(row, 8), {
        numFmt: FORMAT_RP,
        vertical: 'top',
        fill: kosong ? WARNA.kuning : undefined,
        font: TNR(12, { bold: kosong }),
      });
      gayaSel(D.getCell(row, 9), {});
    });
  });

  // SURPLUS/HUTANG + baris total, lalu tanda tangan
  const s = 8 + data.hari.length * 2;
  const akhir = Math.max(8, s - 1);
  gabung(D, [`A${s}:E${s}`]);
  D.getCell(s, 1).value = 'SURPLUS/HUTANG';
  for (let c = 1; c <= 9; c++) {
    gayaSel(D.getCell(s, c), {
      font: TNR(12, { bold: true }),
      fill: WARNA.surplus,
      horizontal: c === 1 ? 'left' : undefined,
      vertical: 'middle',
      numFmt: c >= 6 && c <= 8 ? FORMAT_RP : undefined,
    });
  }
  D.getRow(s).height = 31.5;
  [
    [6, 'F', sumAnggaran],
    [7, 'G', sumRealisasi],
    [8, 'H', sumSelisih],
  ].forEach(([c, huruf, nilai]) => {
    D.getCell(s, c).value = { formula: `SUM(${huruf}8:${huruf}${akhir})`, result: nilai };
    D.getCell(s + 1, c).value = { formula: `${huruf}${s}`, result: nilai };
    gayaSel(D.getCell(s + 1, c), { font: TNR(12, { bold: true }), fill: WARNA.total, numFmt: FORMAT_RP });
  });

  const tanda = (row, kolom, teks, font) => {
    const sel = D.getCell(row, kolom);
    sel.value = teks;
    sel.font = font;
    sel.alignment = { horizontal: 'center' };
  };
  tanda(s + 3, 6, 'Dibuat Oleh,', TNR(12, { bold: true }));
  tanda(s + 3, 8, 'Diketahui Oleh,', TNR(12, { bold: true }));
  tanda(s + 7, 6, data.pembuat.nama, TNR(12, { bold: true, underline: true }));
  tanda(s + 7, 8, data.mengetahui.nama, TNR(12, { bold: true, underline: true }));
  tanda(s + 8, 6, data.pembuat.jabatan, TNR(12));
  tanda(s + 8, 8, data.mengetahui.jabatan, TNR(12));
  D.pageSetup.printArea = `A1:I${s + 8}`;

  workbook.removeWorksheet(T.id);
  D.name = 'ANGGARAN';
  return workbook;
}

export const buatAnggaran = async (...args) => (await rakitAnggaran(...args)).xlsx.writeBuffer();
