// Mengubah worksheet ExcelJS menjadi HTML tabel berformat identik (font, warna, border, merge, lebar kolom, logo).
// Dipakai untuk mencetak: sumbernya sheet yang sama dengan file Excel, sehingga cetakan = contoh.

const esc = (t) =>
  String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const p2 = (n) => String(n).padStart(2, '0');
const GARIS = {
  thin: '1px solid',
  hair: '1px solid',
  medium: '2px solid',
  thick: '3px solid',
  dotted: '1px dotted',
  dashed: '1px dashed',
  double: '3px double',
};
const FONT_DASAR = 'Aptos Narrow';

export const lebarKolomPx = (lebar) => Math.trunc((lebar || 8.43) * 7 + 5); // satuan lebar kolom Excel -> piksel

const hurufKeAngka = (huruf) => [...huruf].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const parseRef = (ref) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return { c: hurufKeAngka(m[1]), r: Number(m[2]) };
};

// ---------- warna (termasuk warna tema + tint seperti Excel) ----------
function warnaTema(workbook) {
  const xml = String(workbook.model.themes?.theme1 ?? '');
  const ambil = (nama) =>
    xml.match(new RegExp(`<a:${nama}>.*?(?:val|lastClr)="([0-9A-Fa-f]{6})"`, 's'))?.[1] ?? '000000';
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map(ambil);
}

function terangkan(hex, tint) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const f = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = s === 0 ? [l, l, l] : [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)];
  return (
    '#' +
    rgb
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

function warna(c, tema) {
  if (!c) return null;
  if (c.argb) return '#' + c.argb.slice(-6);
  if (c.theme !== undefined)
    return c.tint ? terangkan(tema[c.theme] ?? '000000', c.tint) : '#' + (tema[c.theme] ?? '000000');
  return null;
}

// ---------- isi sel ----------
const gayaFont = (f = {}, tema) =>
  [
    f.name && `font-family:'${f.name}',serif`,
    f.size && `font-size:${f.size}pt`,
    f.bold && 'font-weight:700',
    f.italic && 'font-style:italic',
    f.underline && 'text-decoration:underline',
    warna(f.color, tema) && `color:${warna(f.color, tema)}`,
  ]
    .filter(Boolean)
    .join(';');

function isiSel(sel, tema) {
  let v = sel.value;
  if (v && typeof v === 'object' && 'formula' in v) v = v.result;
  if (v && typeof v === 'object' && 'sharedFormula' in v) v = v.result;
  const fmt = sel.numFmt ?? '';
  if (v instanceof Date) return { teks: `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}` };
  if (v && v.richText) {
    return {
      html: v.richText.map((b) => `<span style="${gayaFont(b.font, tema)}">${esc(b.text)}</span>`).join(''),
      teks: v.richText.map((b) => b.text).join(''),
    };
  }
  if (typeof v === 'number') {
    if (/Rp/.test(fmt)) {
      const des = /0\.00/.test(fmt) ? 2 : 0;
      const angka =
        v === 0 && des === 2
          ? '-'
          : v.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des });
      return { rp: true, teks: angka };
    }
    return { teks: String(v), angka: true };
  }
  return { teks: v == null ? '' : String(v) };
}

const sisiGaris = (sel, sisi, tema) => {
  const b = sel?.border?.[sisi];
  return b?.style ? `${GARIS[b.style] ?? '1px solid'} ${warna(b.color, tema) ?? '#000'}` : 'none';
};

/**
 * @param ws        worksheet ExcelJS
 * @param workbook  workbook induknya (untuk tema warna & gambar)
 * @param opsi      { kolom:[awal,akhir], baris:[awal,akhir], logoUrl }
 * @returns { html, lebar, margin, orientasi }
 */
export function sheetKeHtml(ws, workbook, opsi = {}) {
  const tema = warnaTema(workbook);
  const [k1, k2] = opsi.kolom ?? [
    1,
    ws.pageSetup.printArea ? parseRef(ws.pageSetup.printArea.split(':')[1]).c : ws.columnCount,
  ];
  const [b1, b2] = opsi.baris ?? [
    1,
    ws.pageSetup.printArea ? parseRef(ws.pageSetup.printArea.split(':')[1]).r : ws.rowCount,
  ];

  // sel gabungan
  const induk = new Map();
  const turunan = new Set();
  (ws.model.merges ?? []).forEach((m) => {
    const [a, z] = m.split(':').map(parseRef);
    for (let r = a.r; r <= z.r; r++)
      for (let c = a.c; c <= z.c; c++) if (r !== a.r || c !== a.c) turunan.add(`${r},${c}`);
    induk.set(`${a.r},${a.c}`, { r2: z.r, c2: z.c });
  });

  const lebarKol = [];
  for (let c = k1; c <= k2; c++) lebarKol[c] = lebarKolomPx(ws.getColumn(c).width ?? ws.properties.defaultColWidth);
  const lebar = lebarKol.reduce((t, x) => t + (x ?? 0), 0);

  let baris = '';
  let tinggi = 0;
  const tinggiBawaan = ws.properties.defaultRowHeight ?? 15;
  for (let r = b1; r <= b2; r++) {
    let sel = '';
    for (let c = k1; c <= k2; c++) {
      if (turunan.has(`${r},${c}`)) continue;
      const s = ws.getCell(r, c);
      const g = induk.get(`${r},${c}`);
      const r2 = g ? Math.min(g.r2, b2) : r;
      const c2 = g ? Math.min(g.c2, k2) : c;
      const lebarSel = lebarKol.slice(c, c2 + 1).reduce((t, x) => t + x, 0);
      const isi = isiSel(s, tema);
      const f = s.font ?? {};
      const al = s.alignment ?? {};
      const bungkus = Boolean(al.wrapText);
      let ukuran = f.size ?? 11;
      if (al.shrinkToFit && isi.teks)
        ukuran *= Math.min(1, (lebarSel - 6) / (isi.teks.length * ((ukuran * 4) / 3) * 0.52));
      const isiFill = s.fill?.type === 'pattern' && s.fill.pattern === 'solid' ? warna(s.fill.fgColor, tema) : null;
      const horizontal =
        al.horizontal === 'centerContinuous' ? 'center' : (al.horizontal ?? (isi.angka ? 'right' : 'left'));
      const css = [
        `font-family:'${f.name ?? FONT_DASAR}','Arial Narrow',Arial,sans-serif`,
        `font-size:${ukuran}pt`,
        f.bold && 'font-weight:700',
        f.italic && 'font-style:italic',
        f.underline && 'text-decoration:underline',
        `color:${warna(f.color, tema) ?? '#000'}`,
        isiFill && `background:${isiFill}`,
        'padding:0 2px',
        'line-height:1.15', // tinggi baris ditentukan oleh template, bukan isi sel
        `text-align:${horizontal}`,
        `vertical-align:${al.vertical === 'middle' ? 'middle' : (al.vertical ?? 'bottom')}`,
        `white-space:${bungkus ? 'pre-wrap' : 'pre'}`,
        `overflow:${bungkus ? 'hidden' : 'visible'}`,
        `border-top:${sisiGaris(s, 'top', tema)}`,
        `border-left:${sisiGaris(s, 'left', tema)}`,
        `border-right:${sisiGaris(ws.getCell(r, c2), 'right', tema)}`,
        `border-bottom:${sisiGaris(ws.getCell(r2, c), 'bottom', tema)}`,
      ]
        .filter(Boolean)
        .join(';');
      const tengahMeluber = horizontal === 'center' && !bungkus && !g && !isi.rp && !isi.html && isi.teks;
      const dalam = tengahMeluber
        ? `<div style="display:flex;justify-content:center"><span style="flex:none">${esc(isi.teks)}</span></div>`
        : isi.rp
          ? `<div style="display:flex;justify-content:space-between"><span>Rp</span><span>${esc(isi.teks)}</span></div>`
          : (isi.html ?? esc(isi.teks));
      const span = `${r2 > r ? ` rowspan="${r2 - r + 1}"` : ''}${c2 > c ? ` colspan="${c2 - c + 1}"` : ''}`;
      sel += `<td${span} style="${css}">${dalam}</td>`;
    }
    const tinggiBaris = ws.getRow(r).height ?? tinggiBawaan;
    tinggi += (tinggiBaris * 4) / 3;
    baris += `<tr style="height:${tinggiBaris}pt">${sel}</tr>`;
  }

  let logo = '';
  const gambar = ws.getImages?.()[0];
  if (gambar && opsi.logoUrl && k1 === 1 && b1 === 1) {
    const tl = gambar.range.tl;
    const nKol = tl.nativeCol ?? Math.floor(tl.col ?? 0);
    const kiri =
      lebarKol.slice(1, nKol + 1).reduce((t, x) => t + x, 0) +
      (tl.nativeColOff !== undefined ? tl.nativeColOff / 9525 : ((tl.col ?? 0) % 1) * (lebarKol[nKol + 1] ?? 64));
    const tinggiBarisAtas =
      ((ws.getRow(Math.floor(tl.row ?? 0) + 1).height ?? ws.properties.defaultRowHeight ?? 15) * 4) / 3;
    const atas = tl.nativeRowOff !== undefined ? tl.nativeRowOff / 9525 : ((tl.row ?? 0) % 1) * tinggiBarisAtas;
    logo = `<img src="${opsi.logoUrl}" style="position:absolute;left:${kiri}px;top:${atas}px;width:${gambar.range.ext.width}px;height:${gambar.range.ext.height}px">`;
  }
  const html =
    `<div style="position:relative;width:${lebar}px">${logo}<table style="table-layout:fixed;border-collapse:collapse;width:${lebar}px">` +
    `<colgroup>${lebarKol.map((w) => (w ? `<col style="width:${w}px">` : '')).join('')}</colgroup>${baris}</table></div>`;
  const m = ws.pageSetup.margins ?? {};
  return {
    html,
    lebar,
    tinggi,
    margin: { kiri: m.left ?? 0.7, kanan: m.right ?? 0.7, atas: m.top ?? 0.75, bawah: m.bottom ?? 0.75 },
    orientasi: ws.pageSetup.orientation === 'landscape' ? 'landscape' : 'portrait',
  };
}
