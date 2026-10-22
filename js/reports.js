// Menyusun data laporan (PO, RAB, BBBP). Dipakai bersama oleh tampilan dan ekspor Excel.
import { PAKET } from './instansi.js';
import { SEKOLAH } from './master-data.js';
import { namaSheet, nomorPO, notaUrut, state, totalNota } from './store.js';
import { akhirBulan, bulanIndo, hariSebelum, periodeHuruf, tanggalIndo, tanggalPanjang } from './utils.js';

const jumlahBaris = (i) => ({ ...i, jumlah: i.qty * i.harga });

export function laporanPO(nota) {
  return {
    nomor: nomorPO(nota),
    supplier: nota.supplier,
    alamat: nota.alamat,
    tglKirim: hariSebelum(nota.tanggal, 1), // barang dikirim sehari sebelum tanggal menu
    baris: nota.items.map((i, k) => ({ no: k + 1, ...jumlahBaris(i) })),
    total: totalNota(nota),
  };
}

// RAB: semua nota pada satu tanggal digabung lalu dibandingkan dengan pagu.
export function laporanRab(tanggal) {
  const daftar = notaUrut().filter((n) => n.tanggal === tanggal);
  const meta = state.rab[tanggal] ?? {};
  const siswa = meta.siswa ?? []; // jumlah siswa per baris SEKOLAH, diinput manual
  const pagu = SEKOLAH.reduce((t, x, i) => t + (Number(siswa[i]) || 0) * x.pagu, 0);
  const total = daftar.reduce((t, n) => t + totalNota(n), 0);
  let no = 0;
  const baris = daftar.flatMap((n) =>
    n.items.map((i) => ({ no: ++no, ...jumlahBaris(i), keterangan: `${n.supplier} (${namaSheet(n)})` })),
  );
  return { tanggal, menu: meta.menu ?? '', siswa, pagu, total, sisa: pagu - total, jumlahNota: daftar.length, baris };
}

export const notaRentang = (dari, sampai) => notaUrut().filter((n) => n.tanggal >= dari && n.tanggal <= sampai);

/** true bila rentang tepat satu bulan penuh (mis. 1-30 September). */
export const satuBulanPenuh = (dari, sampai) => dari.endsWith('-01') && sampai === akhirBulan(dari.slice(0, 7));

// BBBP: urutan belanja sesuai nota pada rentang tanggal; no/tanggal/total harian hanya di baris pertama tiap hari.
export function laporanBbbp(dari, sampai) {
  const daftar = notaRentang(dari, sampai);
  const totalHari = {};
  daftar.forEach((n) => (totalHari[n.tanggal] = (totalHari[n.tanggal] ?? 0) + totalNota(n)));

  let hari = 0;
  let tanggalLalu = '';
  const baris = daftar.flatMap((n) => {
    const hariBaru = n.tanggal !== tanggalLalu;
    if (hariBaru) {
      hari += 1;
      tanggalLalu = n.tanggal;
    }
    return n.items.map((i, k) => {
      const awalHari = hariBaru && k === 0;
      return {
        no: awalHari ? hari : '',
        tanggal: awalHari ? tanggalIndo(n.tanggal) : '',
        bukti: k === 0 ? (n.bukti ?? '') : '',
        supplier: k === 0 ? n.supplier : '',
        ...jumlahBaris(i),
        totalHari: awalHari ? totalHari[n.tanggal] : '',
      };
    });
  });
  const periode = satuBulanPenuh(dari, sampai)
    ? bulanIndo(dari.slice(0, 7))
    : `${tanggalPanjang(dari)} s/d ${tanggalPanjang(sampai)}`;
  return { dari, sampai, periode, baris, total: daftar.reduce((t, n) => t + totalNota(n), 0) };
}

/**
 * Anggaran Bahan Makanan: ringkasan per tanggal yang diturunkan dari RAB Harian.
 *  - jumlah paket KECIL/BESAR = jumlah siswa (input manual di RAB) yang pagu harganya 8.000 / 10.000
 *  - total anggaran = jumlah x harga paket (sama dengan PAGU di RAB)
 *  - realisasi = total belanja hari itu (RAB: TOTAL); kosong bila belum ada nota
 *  - selisih = total anggaran - realisasi
 */
export function laporanAnggaran(dari, sampai) {
  const adaSiswa = (t) => state.rab[t]?.siswa?.some((x) => Number(x) > 0);
  const tanggal = [...new Set([...notaUrut().map((n) => n.tanggal), ...Object.keys(state.rab).filter(adaSiswa)])]
    .filter((t) => t >= dari && t <= sampai)
    .sort();
  const hari = tanggal.map((t) => {
    const rab = laporanRab(t);
    const jumlah = PAKET.map((p) =>
      SEKOLAH.reduce((jml, s, i) => jml + (s.pagu === p.harga ? Number(rab.siswa[i]) || 0 : 0), 0),
    );
    const anggaran = PAKET.map((p, k) => jumlah[k] * p.harga);
    const totalAnggaran = anggaran.reduce((a, b) => a + b, 0);
    const realisasi = rab.jumlahNota ? rab.total : null;
    return { tanggal: t, jumlah, anggaran, totalAnggaran, realisasi, selisih: totalAnggaran - (realisasi ?? 0) };
  });
  const jumlahkan = (kunci) => hari.reduce((t, h) => t + (h[kunci] ?? 0), 0);
  return {
    dari,
    sampai,
    periode: periodeHuruf(dari, sampai),
    hari,
    total: {
      totalAnggaran: jumlahkan('totalAnggaran'),
      realisasi: jumlahkan('realisasi'),
      selisih: jumlahkan('selisih'),
    },
  };
}
