// Menyusun data laporan (PO, RAB, BPPP). Dipakai bersama oleh tampilan dan ekspor Excel.
import { SEKOLAH } from './master-data.js';
import { namaSheet, nomorPO, notaUrut, state, totalNota } from './store.js';
import { hariSebelum, tanggalIndo } from './utils.js';

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

// BPPP: urutan belanja sesuai nota; no/tanggal/total harian hanya muncul di baris pertama tiap hari.
export function laporanBppp(bulan) {
  const daftar = notaUrut().filter((n) => n.tanggal.startsWith(bulan));
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
  return { bulan, baris, total: daftar.reduce((t, n) => t + totalNota(n), 0) };
}
