-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.
-- (Jika sebelumnya sudah menjalankan versi lama: drop table nota, rab, master_extra; lalu jalankan ini.)
create table if not exists nota (
  id text primary key,                 -- contoh: 2026-09-01_02  (sheet PO_02_2026-09-01)
  tanggal date not null,
  urut int not null,                   -- urutan nota pada hari itu
  no_po int not null,                  -- nomor PO (urut per bulan)
  supplier text not null,
  alamat text,
  items jsonb not null,                -- [{uraian, qty, satuan, harga}]
  created_at timestamptz default now()
);
create table if not exists rab (
  tanggal date primary key,
  menu text,
  pagu numeric,                        -- tidak dipakai lagi (pagu dihitung dari jumlah siswa)
  siswa jsonb                          -- jumlah siswa per baris sekolah, diinput manual: [60, 6, 259, ...]
);
-- Jika tabel rab sudah ada dari versi sebelumnya, cukup jalankan baris ini:
alter table rab add column if not exists siswa jsonb;

create table if not exists master_extra (
  id text primary key,
  bahan jsonb default '[]',            -- [{nama, satuan, harga}]
  supplier jsonb default '[]'          -- [{nama, alamat}]
);

-- Keamanan: hanya pengguna yang sudah login yang boleh membaca/menulis.
alter table nota enable row level security;
alter table rab enable row level security;
alter table master_extra enable row level security;
create policy "login_saja" on nota for all to authenticated using (true) with check (true);
create policy "login_saja" on rab for all to authenticated using (true) with check (true);
create policy "login_saja" on master_extra for all to authenticated using (true) with check (true);
