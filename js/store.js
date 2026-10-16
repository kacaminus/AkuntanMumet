// State aplikasi, akses database Supabase, dan fungsi pencarian data.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY, INSTANSI } from './config.js';
import { BAHAN, SUPPLIER } from './master-data.js';
import { hariIni, maks, pad, ROMAWI } from './utils.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const barisKosong = () => ({ uraian: '', qty: '', satuan: '', harga: '' });
export const draftBaru = (tanggal = hariIni()) => ({ tanggal, supplier: '', alamat: '', baris: [barisKosong()] });

export const state = {
  user: null,
  tab: 'input', // input | po | rab | bppp | login
  pilihan: null, // id sheet yang sedang dibuka (nota / tanggal / bulan)
  nota: [],
  rab: {}, // { 'YYYY-MM-DD': { menu, pagu } }
  extra: { bahan: [], supplier: [] }, // master tambahan dari database
  draft: draftBaru(),
};

// ---------- pencarian & perhitungan ----------
const gabung = (awal, tambahan) => {
  const peta = new Map(awal.map((x) => [x.nama.toLowerCase(), x]));
  tambahan.forEach((x) => peta.set(x.nama.toLowerCase(), x)); // data database menimpa data awal
  return peta;
};
export const petaBahan = () => gabung(BAHAN, state.extra.bahan);
export const petaSupplier = () => gabung(SUPPLIER, state.extra.supplier);

export const notaUrut = () => [...state.nota].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.urut - b.urut);
export const totalNota = (n) => n.items.reduce((t, i) => t + i.qty * i.harga, 0);
export const namaSheet = (n) => `PO_${pad(n.urut)}_${n.tanggal}`;
export const urutBerikutnya = (tanggal) =>
  maks(
    state.nota.filter((n) => n.tanggal === tanggal),
    'urut',
  ) + 1;

export const nomorPO = (n) =>
  `${pad(n.no_po, 3)}/${INSTANSI.kodePO}/${ROMAWI[Number(n.tanggal.slice(5, 7)) - 1]}/${n.tanggal.slice(0, 4)}`;

// ---------- autentikasi ----------
export const masuk = (email, password) => sb.auth.signInWithPassword({ email, password });
export const keluar = () => sb.auth.signOut();

// ---------- database ----------
export async function muatData() {
  const [nota, rab, master] = await Promise.all([
    sb.from('nota').select('*').order('tanggal').order('urut'),
    sb.from('rab').select('*'),
    sb.from('master_extra').select('*').eq('id', 'main').maybeSingle(),
  ]);
  if (nota.error) throw nota.error;
  state.nota = nota.data;
  state.rab = Object.fromEntries((rab.data ?? []).map((r) => [r.tanggal, r]));
  state.extra = { bahan: master.data?.bahan ?? [], supplier: master.data?.supplier ?? [] };
}

export async function simpanNota(draft) {
  const items = draft.baris
    .filter((b) => b.uraian && Number(b.qty) > 0 && Number(b.harga) > 0)
    .map((b) => ({ uraian: b.uraian.trim(), qty: Number(b.qty), satuan: b.satuan, harga: Number(b.harga) }));
  if (!draft.supplier.trim() || !items.length) {
    throw new Error('Isi supplier dan minimal satu bahan lengkap (qty & harga).');
  }
  const bulan = draft.tanggal.slice(0, 7);
  const urut = urutBerikutnya(draft.tanggal);
  const nota = {
    id: `${draft.tanggal}_${pad(urut)}`,
    tanggal: draft.tanggal,
    urut,
    no_po:
      maks(
        state.nota.filter((n) => n.tanggal.startsWith(bulan)),
        'no_po',
      ) + 1,
    supplier: draft.supplier.trim(),
    alamat: draft.alamat,
    items,
  };
  const { error } = await sb.from('nota').insert(nota);
  if (error) throw error;
  await simpanMasterBaru(nota);
  await muatData();
  return nota.id;
}

// Bahan & supplier yang dipakai di nota diingat (harga terakhir jadi harga standar berikutnya).
async function simpanMasterBaru(nota) {
  const bahan = gabung([], state.extra.bahan);
  nota.items.forEach((i) => bahan.set(i.uraian.toLowerCase(), { nama: i.uraian, satuan: i.satuan, harga: i.harga }));
  const supplier = gabung([], state.extra.supplier);
  if (nota.alamat) supplier.set(nota.supplier.toLowerCase(), { nama: nota.supplier, alamat: nota.alamat });
  await sb.from('master_extra').upsert({ id: 'main', bahan: [...bahan.values()], supplier: [...supplier.values()] });
}

export async function hapusNota(id) {
  const { error } = await sb.from('nota').delete().eq('id', id);
  if (error) throw error;
  await muatData();
}

export async function simpanRab(tanggal, perubahan) {
  const data = { ...(state.rab[tanggal] ?? {}), tanggal, ...perubahan };
  const { error } = await sb.from('rab').upsert(data);
  if (error) throw error;
  state.rab[tanggal] = data;
}
