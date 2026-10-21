// Titik masuk: menggambar tampilan dan menangani semua interaksi (event delegation).
import {
  barisKosong,
  draftBaru,
  hariAktif,
  hapusNota,
  keluar,
  masuk,
  mulaiEdit,
  muatData,
  rentangBbbp,
  petaBahan,
  petaSupplier,
  sb,
  simpanNota,
  simpanRab,
  state,
  tanggalAda,
  tanggalRab,
} from './store.js';
import { cetakExcel, unduhExcel } from './excel.js';
import {
  perbaruiRab,
  renderAnggaran,
  renderBbbp,
  renderInput,
  renderLogin,
  renderPO,
  renderRab,
  totalDraft,
} from './views.js';
import { $, akhirBulan, rupiah } from './utils.js';

const TAMPILAN = {
  login: renderLogin,
  input: renderInput,
  po: renderPO,
  rab: renderRab,
  anggaran: renderAnggaran,
  bbbp: renderBbbp,
};
const TAB = [
  ['input', 'Input Nota'],
  ['po', 'Nota / PO'],
  ['rab', 'RAB Harian'],
  ['anggaran', 'Anggaran'],
  ['bbbp', 'BBBP'],
];

// Daftar tanggal yang dipakai navigasi: tab RAB boleh membuka tanggal tanpa nota, tab PO hanya tanggal bernota.
const daftarTab = () => (state.tab === 'rab' ? tanggalRab() : tanggalAda());

function render() {
  $('#nav').innerHTML = state.user
    ? TAB.map(
        ([id, label]) =>
          `<button class="${state.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${label}</button>`,
      ).join('')
    : '';
  $('#app').innerHTML = TAMPILAN[state.tab]();
}

async function jalankan(proses) {
  try {
    await proses();
  } catch (galat) {
    alert(galat.message ?? galat);
  }
}

// ---------- klik ----------
const aksi = {
  tab: ({ tab }) => {
    state.tab = tab;
    render();
  },
  pilih: ({ id }) => {
    state.notaId = id;
    render();
  },
  geserHari: ({ arah }) => {
    const tanggal = daftarTab();
    const ke = tanggal[tanggal.indexOf(hariAktif(tanggal)) + Number(arah)];
    if (!ke) return;
    state.hari = ke;
    state.notaId = null;
    render();
  },
  tambahBaris: () => {
    state.draft.baris.push(barisKosong());
    render();
  },
  hapusBaris: ({ i }) => {
    state.draft.baris.splice(Number(i), 1);
    if (!state.draft.baris.length) state.draft.baris = [barisKosong()];
    render();
  },
  simpan: () =>
    jalankan(async () => {
      const id = await simpanNota(state.draft);
      state.draft = draftBaru(state.draft.tanggal);
      Object.assign(state, { tab: 'po', hari: state.draft.tanggal, notaId: id });
      render();
    }),
  hapusNota: ({ id }) =>
    confirm('Hapus nota ini? Nomor nota berikutnya akan naik menggantikannya.') &&
    jalankan(async () => {
      await hapusNota(id);
      if (state.draft.editId === id) state.draft = draftBaru(state.draft.tanggal);
      state.notaId = null;
      render();
    }),
  salinSiswa: ({ tanggal }) =>
    jalankan(async () => {
      const lalu = Object.keys(state.rab)
        .filter((t) => t < tanggal && state.rab[t].siswa?.some((x) => x))
        .sort()
        .at(-1);
      if (!lalu) return alert('Belum ada data jumlah siswa pada hari sebelumnya.');
      await simpanRab(tanggal, { siswa: [...state.rab[lalu].siswa] });
      render();
    }),
  edit: ({ id }) => {
    mulaiEdit(id);
    state.tab = 'input';
    render();
  },
  batalEdit: () => {
    state.draft = draftBaru(state.draft.tanggal);
    render();
  },
  rentangBulan: ({ bulan }) => {
    state.rentang = { dari: `${bulan}-01`, sampai: akhirBulan(bulan) };
    render();
  },
  keRab: ({ tanggal }) => {
    // dari laporan Anggaran: buka RAB Harian pada tanggal yang diklik
    state.tab = 'rab';
    state.hari = tanggal;
    state.notaId = null;
    render();
  },
  cetak: ({ kind, id }) => jalankan(() => cetakExcel(kind, id)),
  unduh: ({ kind, id }) => jalankan(() => unduhExcel(kind, id)),
  masuk: () =>
    jalankan(async () => {
      const { error } = await masuk($('#email').value, $('#sandi').value);
      if (error) throw error;
    }),
  keluar: () => keluar(),
};

// ---------- perubahan nilai (selesai mengetik / memilih) ----------
const ubah = {
  tanggal: (el) => {
    state.draft.tanggal = el.value;
    render();
  },
  pilihBulan: (el) => {
    state.hari = daftarTab()
      .filter((t) => t.startsWith(el.value))
      .at(-1);
    state.notaId = null;
    render();
  },
  bukaTanggal: (el) => {
    if (!el.value) return;
    state.hari = el.value;
    state.notaId = null;
    render();
  },
  pilihHari: (el) => {
    state.hari = el.value;
    state.notaId = null;
    render();
  },
  rentangDari: (el) => {
    if (!el.value) return;
    const { sampai } = rentangBbbp();
    state.rentang = { dari: el.value, sampai: sampai < el.value ? el.value : sampai };
    render();
  },
  rentangSampai: (el) => {
    if (!el.value) return;
    const { dari } = rentangBbbp();
    state.rentang = { dari: dari > el.value ? el.value : dari, sampai: el.value };
    render();
  },
  bahan: (el, { i }) => {
    const baris = state.draft.baris[i];
    baris.uraian = el.value.trim();
    const master = petaBahan().get(baris.uraian.toLowerCase());
    if (master) Object.assign(baris, { satuan: master.satuan, harga: master.harga });
    render();
  },
  satuan: (el, { i }) => {
    state.draft.baris[i].satuan = el.value;
  },
  menu: (el, { tanggal }) =>
    jalankan(async () => {
      await simpanRab(tanggal, { menu: el.value });
      render();
    }),
  siswa: (el, { i, tanggal }) => {
    // simpan di state dulu (agar ketikan cepat antar kolom tidak saling menimpa), lalu kirim ke database
    const siswa = [...(state.rab[tanggal]?.siswa ?? [])];
    siswa[i] = el.value === '' ? null : Number(el.value);
    state.rab[tanggal] = { ...(state.rab[tanggal] ?? { tanggal }), siswa };
    perbaruiRab(tanggal);
    jalankan(() => simpanRab(tanggal, { siswa: state.rab[tanggal].siswa }));
  },
};

// ---------- ketikan langsung (tanpa menggambar ulang agar kursor tidak hilang) ----------
function ketikAngka(kolom, el, i) {
  const baris = state.draft.baris[i];
  baris[kolom] = el.value;
  $(`#jumlah-${i}`).textContent = rupiah(baris.qty * baris.harga);
  $('#total-draft').textContent = rupiah(totalDraft(state.draft));
}
const ketik = {
  supplier: (el) => {
    state.draft.supplier = el.value;
    const supplier = petaSupplier().get(el.value.trim().toLowerCase());
    if (supplier) {
      state.draft.alamat = supplier.alamat;
      $('#alamat').value = supplier.alamat;
    }
  },
  alamat: (el) => {
    state.draft.alamat = el.value;
  },
  bukti: (el) => {
    state.draft.bukti = el.value;
  },
  qty: (el, { i }) => ketikAngka('qty', el, i),
  harga: (el, { i }) => ketikAngka('harga', el, i),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el) aksi[el.dataset.act]?.(el.dataset);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-chg]');
  if (el) ubah[el.dataset.chg]?.(el, el.dataset);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-inp]');
  if (el) ketik[el.dataset.inp]?.(el, el.dataset);
});

// ---------- sesi login ----------
sb.auth.onAuthStateChange((_peristiwa, sesi) => {
  state.user = sesi?.user ?? null;
  jalankan(async () => {
    if (!state.user) {
      state.tab = 'login';
      $('#status').textContent = 'Silakan masuk';
    } else {
      $('#status').textContent = `${state.user.email} · data tersimpan di Supabase`;
      await muatData();
      if (state.tab === 'login') state.tab = 'input';
    }
    render();
  });
});
