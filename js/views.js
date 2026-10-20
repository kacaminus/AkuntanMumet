// Tampilan: setiap fungsi render* mengembalikan string HTML untuk area utama.
// Interaksi memakai atribut data-act / data-chg / data-inp yang ditangani di main.js.
import { INSTANSI, KOP_PO } from './config.js';
import { SEKOLAH } from './master-data.js';
import { laporanBbbp, laporanPO, laporanRab } from './reports.js';
import {
  hariAktif,
  namaSheet,
  notaUrut,
  petaBahan,
  petaSupplier,
  rentangBbbp,
  state,
  tanggalAda,
  urutBerikutnya,
} from './store.js';
import { $, akhirBulan, bulanIndo, esc, formatDMY, rupiah, tanggalIndo } from './utils.js';

const PESAN_KOSONG = '<p class="m">Belum ada nota. Simpan nota dari tab Input Nota.</p>';

export const totalDraft = (draft) => draft.baris.reduce((t, b) => t + (Number(b.qty) || 0) * (Number(b.harga) || 0), 0);

// Navigasi tanggal ringkas: panah sebelumnya/berikutnya + pilihan bulan + pilihan tanggal.
function navigasiTanggal(aktif) {
  const tanggal = tanggalAda();
  const bulan = [...new Set(tanggal.map((t) => t.slice(0, 7)))];
  const bulanAktif = aktif.slice(0, 7);
  const i = tanggal.indexOf(aktif);
  const opsi = (nilai, teks, terpilih) =>
    `<option value="${nilai}"${nilai === terpilih ? ' selected' : ''}>${teks}</option>`;
  const jumlahNota = notaUrut().filter((n) => n.tanggal === aktif).length;
  return `
    <div class="navtgl noprint">
      <button class="btn g ikon" data-act="geserHari" data-arah="-1" ${i <= 0 ? 'disabled' : ''} title="Tanggal sebelumnya">&#8249;</button>
      <select data-chg="pilihBulan" aria-label="Bulan">${bulan.map((b) => opsi(b, bulanIndo(b), bulanAktif)).join('')}</select>
      <select data-chg="pilihHari" aria-label="Tanggal">${tanggal
        .filter((t) => t.startsWith(bulanAktif))
        .map((t) => opsi(t, tanggalIndo(t), aktif))
        .join('')}</select>
      <button class="btn g ikon" data-act="geserHari" data-arah="1" ${i >= tanggal.length - 1 ? 'disabled' : ''} title="Tanggal berikutnya">&#8250;</button>
      <span class="m">${jumlahNota} nota pada tanggal ini</span>
    </div>`;
}

const tombolSheet = (daftar, aktif) =>
  `<div class="tabs">${daftar
    .map(
      ({ id, label }) =>
        `<button class="${id === aktif ? 'on' : ''}" data-act="pilih" data-id="${esc(id)}">${esc(label)}</button>`,
    )
    .join('')}</div>`;
const tombolCetak = (kind, id) =>
  `<button class="btn" data-act="cetak" data-kind="${kind}" data-id="${esc(id)}">Cetak</button>`;
const tombolExcel = (kind, bulan, label = 'Unduh Excel') =>
  `<button class="btn g" data-act="unduh" data-kind="${kind}" data-id="${bulan}">${label}</button>`;

// ---------- Login ----------
export const renderLogin = () => `
  <div class="card" style="max-width:380px;margin:30px auto">
    <h2>Masuk</h2>
    <label>Email<input id="email" type="email" autocomplete="username"></label>
    <label class="mt">Kata sandi<input id="sandi" type="password" autocomplete="current-password"></label>
    <p><button class="btn" data-act="masuk">Masuk</button></p>
  </div>`;

// ---------- Input nota ----------
function barisInput(b, i) {
  return `
    <tr>
      <td><input list="dl-bahan" value="${esc(b.uraian)}" data-chg="bahan" data-i="${i}" placeholder="ketik / pilih bahan"></td>
      <td class="w80"><input type="number" step="any" value="${esc(b.qty)}" data-inp="qty" data-i="${i}"></td>
      <td class="w80"><input value="${esc(b.satuan)}" data-chg="satuan" data-i="${i}"></td>
      <td class="w110"><input type="number" value="${esc(b.harga)}" data-inp="harga" data-i="${i}"></td>
      <td class="r w120" id="jumlah-${i}">${rupiah(b.qty * b.harga)}</td>
      <td class="c"><button class="link-del" data-act="hapusBaris" data-i="${i}" title="Hapus baris">×</button></td>
    </tr>`;
}

export function renderInput() {
  const { draft } = state;
  const sedangEdit = Boolean(draft.editId);
  const notaLama = sedangEdit ? state.nota.find((n) => n.id === draft.editId) : null;
  const opsi = (peta) => [...peta.values()].map((x) => `<option value="${esc(x.nama)}">`).join('');
  const tombolSimpan = sedangEdit
    ? `<button class="btn" data-act="simpan">Simpan perubahan</button><button class="btn g" data-act="batalEdit">Batal</button>`
    : `<button class="btn" data-act="simpan">Simpan sebagai PO_${String(urutBerikutnya(draft.tanggal)).padStart(2, '0')}_${draft.tanggal}</button>`;
  return `
    <datalist id="dl-bahan">${opsi(petaBahan())}</datalist>
    <datalist id="dl-supplier">${opsi(petaSupplier())}</datalist>
    ${sedangEdit ? `<div class="card banner">Sedang mengedit <b>${notaLama ? namaSheet(notaLama) : 'nota'}</b>. Ubah datanya lalu klik "Simpan perubahan".</div>` : ''}
    <div class="card">
      <div class="row">
        <label>Tanggal menu<input type="date" value="${draft.tanggal}" data-chg="tanggal"></label>
        <label>Supplier<input list="dl-supplier" value="${esc(draft.supplier)}" data-inp="supplier" placeholder="pilih / ketik supplier baru"></label>
      </div>
      <div class="row mt">
        <label style="flex:2">Alamat supplier (untuk di PO)<input id="alamat" value="${esc(draft.alamat)}" data-inp="alamat"></label>
        <label>Nomor bukti transaksi (isi manual)<input value="${esc(draft.bukti)}" data-inp="bukti" placeholder="boleh dikosongkan"></label>
      </div>
    </div>
    <div class="card">
      <table>
        <tr><th>Bahan</th><th>Qty</th><th>Satuan</th><th>Harga</th><th>Jumlah</th><th></th></tr>
        ${draft.baris.map(barisInput).join('')}
      </table>
      <p class="r"><b>Total nota: <span id="total-draft">${rupiah(totalDraft(draft))}</span></b></p>
      <div class="row">
        <button class="btn g" data-act="tambahBaris">+ Baris bahan</button>
        ${tombolSimpan}
      </div>
      <p class="m"><small>Harga & satuan terisi dari riwayat; ubah bila hari ini berbeda. Setiap nota menjadi satu sheet PO.</small></p>
    </div>`;
}

// ---------- Nota / PO ----------
export function renderPO() {
  if (!tanggalAda().length) return PESAN_KOSONG;
  const hari = hariAktif();
  const harian = notaUrut().filter((n) => n.tanggal === hari);
  const nota = harian.find((n) => n.id === state.notaId) ?? harian[0];
  const po = laporanPO(nota);
  const { pembuat, mengetahui } = INSTANSI;
  return `
    ${navigasiTanggal(hari)}
    ${tombolSheet(
      harian.map((n) => ({ id: n.id, label: `${namaSheet(n).slice(0, 5)} · ${n.supplier}` })),
      nota.id,
    )}
    <div class="noprint row mt">
      ${tombolCetak('po', nota.id)}${tombolExcel('po', nota.tanggal.slice(0, 7), 'Unduh Excel PO bulan ini')}
      <button class="btn g" data-act="edit" data-id="${esc(nota.id)}">Edit nota ini</button>
      <button class="btn d" data-act="hapusNota" data-id="${esc(nota.id)}">Hapus nota ini</button>
    </div>
    <div class="sheet sheet-po">
      <div class="kop"><b>${KOP_PO[0]}</b><br>${KOP_PO[1]}<br>${KOP_PO[2]}<br><br>
        <b>NOTA PESANAN BAHAN PANGAN</b><br>No. ${po.nomor}</div><br>
      <div class="row info">
        <div style="flex:2">SPPG : ${INSTANSI.sppg}<br>ID SPPG : ${INSTANSI.idSppg}<br>
          Kepada : <b>${esc(po.supplier)}</b><br>Alamat : ${esc(po.alamat)}</div>
        <div>Tgl. Permintaan: ${formatDMY(po.tglKirim)}<br>Tgl. Pengiriman: ${formatDMY(po.tglKirim)}</div>
      </div><br>
      <table>
        <tr><th>NO</th><th>URAIAN BAHAN</th><th>QTY</th><th>SATUAN</th><th>HARGA</th><th>TOTAL</th></tr>
        ${po.baris
          .map(
            (b) => `<tr><td class="c">${b.no}</td><td>${esc(b.uraian)}</td><td class="c">${b.qty}</td>
          <td class="c">${esc(b.satuan)}</td><td class="r">${rupiah(b.harga)}</td><td class="r">${rupiah(b.jumlah)}</td></tr>`,
          )
          .join('')}
        <tr class="tot"><td colspan="5" class="r">Total</td><td class="r">${rupiah(po.total)}</td></tr>
      </table>
      <div class="sig">
        <div>Dibuat Oleh,<br><br><br><b>${pembuat.nama}</b><br>${pembuat.jabatan}</div>
        <div>Diketahui Oleh,<br><br><br><b>${mengetahui.nama}</b><br>${mengetahui.jabatan}</div>
      </div>
    </div>`;
}

// ---------- RAB harian ----------
export function renderRab() {
  if (!tanggalAda().length) return PESAN_KOSONG;
  const aktif = hariAktif();
  const rab = laporanRab(aktif);
  const baris = (b) => `
    <tr class="hl"><td class="c">${b.no}</td><td>${esc(b.uraian)}</td><td class="c">${b.qty}</td><td class="c">${esc(b.satuan)}</td>
      <td class="r">${rupiah(b.harga)}</td><td class="r">${rupiah(b.jumlah)}</td><td>${esc(b.keterangan)}</td></tr>`;
  const sekolah = (s, i) => `
    <tr><td class="c">${s.no ?? ''}</td><td>${esc(s.nama)}</td><td>${esc(s.klaster)}</td>
      <td class="c w80"><input type="number" min="0" value="${esc(rab.siswa[i] ?? '')}" data-chg="siswa" data-i="${i}" data-tanggal="${aktif}"></td>
      <td class="r">${rupiah(s.pagu)}</td><td class="r" id="jml-${i}">${rupiah((Number(rab.siswa[i]) || 0) * s.pagu)}</td></tr>`;
  return `
    ${navigasiTanggal(aktif)}
    <div class="noprint row mt">
      <label>Menu hari ini<input value="${esc(rab.menu)}" data-chg="menu" data-tanggal="${aktif}"></label>
      <div style="align-self:end">
        ${tombolCetak('rab', aktif)} <button class="btn g" data-act="salinSiswa" data-tanggal="${aktif}">Salin siswa dari hari sebelumnya</button>
        ${tombolExcel('rab', aktif.slice(0, 7), 'Unduh Excel RAB bulan ini')}
      </div>
    </div>
    <div class="sheet mt">
      <b>RENCANA ANGGARAN BELANJA (RAB) BAHAN BAKU HARIAN</b><br>${INSTANSI.sppg}<br>${INSTANSI.yayasan}<br>
      Hari : ${tanggalIndo(aktif)}<br>MENU: ${esc(rab.menu || '-')}<br><br>
      <table>
        <tr><th>NO</th><th>URAIAN</th><th>QTY</th><th>SATUAN</th><th>HARGA</th><th>JUMLAH</th><th>KETERANGAN</th></tr>
        ${rab.baris.map(baris).join('')}
        <tr class="tot"><td colspan="5">TOTAL</td><td class="r">${rupiah(rab.total)}</td><td>${rab.jumlahNota} nota</td></tr>
        <tr class="tot"><td colspan="5">PAGU BELANJA HARIAN</td><td class="r" id="rab-pagu">${rupiah(rab.pagu)}</td><td id="rab-info">${rab.pagu ? '' : 'Isi jumlah siswa di tabel bawah'}</td></tr>
        <tr class="tot"><td colspan="5">SISA</td><td class="r" id="rab-sisa">${rupiah(rab.sisa)}</td><td class="warn" id="rab-status">${rab.pagu && rab.sisa < 0 ? 'MELEBIHI PAGU' : ''}</td></tr>
      </table><br>
      <table>
        <tr><th>NO</th><th>SEKOLAH</th><th>KLASTER</th><th>JUMLAH SISWA</th><th>PAGU HARGA</th><th>JUMLAH</th></tr>
        ${SEKOLAH.map(sekolah).join('')}
        <tr class="tot"><td colspan="3">TOTAL</td><td class="c" id="total-siswa">${hitungSiswa(rab)}</td><td></td><td class="r" id="total-pagu">${rupiah(rab.pagu)}</td></tr>
      </table>
    </div>`;
}

const hitungSiswa = (rab) => rab.siswa.reduce((t, x) => t + (Number(x) || 0), 0);

/** Perbarui angka turunan RAB di layar saat jumlah siswa diketik (tanpa menggambar ulang). */
export function perbaruiRab(tanggal) {
  const rab = laporanRab(tanggal);
  SEKOLAH.forEach((s, i) => {
    $(`#jml-${i}`).textContent = rupiah((Number(rab.siswa[i]) || 0) * s.pagu);
  });
  $('#total-siswa').textContent = hitungSiswa(rab);
  $('#total-pagu').textContent = rupiah(rab.pagu);
  $('#rab-pagu').textContent = rupiah(rab.pagu);
  $('#rab-sisa').textContent = rupiah(rab.sisa);
  $('#rab-info').textContent = rab.pagu ? '' : 'Isi jumlah siswa di tabel bawah';
  $('#rab-status').textContent = rab.pagu && rab.sisa < 0 ? 'MELEBIHI PAGU' : '';
}

// ---------- BBBP (rentang tanggal bebas) ----------
export function renderBbbp() {
  const bulan = [...new Set(notaUrut().map((n) => n.tanggal.slice(0, 7)))];
  if (!bulan.length) return PESAN_KOSONG;
  const { dari, sampai } = rentangBbbp();
  const bbbp = laporanBbbp(dari, sampai);
  const idRentang = `${dari}_${sampai}`;
  const baris = (b) => `
    <tr><td class="c">${b.no}</td><td>${b.tanggal}</td><td>${esc(b.bukti)}</td><td>${esc(b.supplier)}</td><td>${esc(b.uraian)}</td>
      <td class="c">${b.qty}</td><td class="c">${esc(b.satuan)}</td><td class="r">${rupiah(b.harga)}</td>
      <td class="r">${rupiah(b.jumlah)}</td><td class="r"><b>${b.totalHari === '' ? '' : rupiah(b.totalHari)}</b></td></tr>`;
  const pilihBulan = (b) =>
    `<button class="${dari === `${b}-01` && sampai === akhirBulan(b) ? 'on' : ''}" data-act="rentangBulan" data-bulan="${b}">${bulanIndo(b)}</button>`;
  return `
    <div class="tabs">${bulan.map(pilihBulan).join('')}</div>
    <div class="noprint row mt">
      <label>Dari tanggal<input type="date" value="${dari}" data-chg="rentangDari"></label>
      <label>Sampai tanggal<input type="date" value="${sampai}" data-chg="rentangSampai"></label>
      <div style="align-self:end">${tombolCetak('bbbp', idRentang)} ${tombolExcel('bbbp', idRentang, 'Unduh Excel BBBP')}</div>
    </div>
    <div class="sheet mt">
      <div class="kop"><img src="templates/logo.png" alt="" style="float:left;height:64px">
        <b>${INSTANSI.sppg}</b><br>${INSTANSI.alamat}<br><b>BUKU BANTU BAHAN PANGAN</b><br>Periode: ${esc(bbbp.periode)}</div>
      <div style="clear:both"></div><br>
      <table>
        <tr><th>No</th><th>Tanggal</th><th>Nomor Bukti Transaksi</th><th>SUPPLIER</th><th>Uraian</th><th>QTY</th><th>SATUAN</th><th>HARGA SATUAN</th><th>TOTAL</th><th>TOTAL PERHARI</th></tr>
        ${bbbp.baris.map(baris).join('')}
        <tr class="tot"><td colspan="8">TOTAL</td><td class="r">${rupiah(bbbp.total)}</td><td></td></tr>
      </table>
    </div>`;
}
