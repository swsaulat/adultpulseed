/* PulseED — a small, dependency-free Excel (.xlsx) writer for the coloured handover.
 * Writes one styled worksheet (fills, bold headings, borders, merged rows) into a stored (uncompressed) ZIP. */
(function (PE) {
  'use strict';
  const X = (PE.xlsx = {});

  // ------------------------------------------------------------------ ZIP (store, no compression)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(f => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
        .forEach(([o, v, n]) => (n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2],
        [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]].forEach(([o, v, n]) => (n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const size = central.reduce((n, p) => n + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, size, 4], [16, offset, 4], [20, 0, 2]].forEach(([o, v, n]) => (n === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true)));
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  X.zip = zip;

  // ------------------------------------------------------------------ styles
  const TONES = { sky: ['0284C7', 'E0F2FE'], blue: ['2563EB', 'DBEAFE'], amber: ['D97706', 'FEF3C7'], green: ['059669', 'D1FAE5'], red: ['DC2626', 'FEE2E2'], grey: ['64748B', 'F1F5F9'] };
  const TONE_KEYS = Object.keys(TONES);
  // fonts: 0 normal · 1 bold · 2 title (bold white 16) · 3 section (bold white 12) · 4 small grey italic
  const FONTS = ['<font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>', '<font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>',
    '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>', '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
    '<font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>'];
  const fill = rgb => `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const FILLS = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', fill('0B4A5A'), fill('F8FAFC'), fill('E2E8F0')];
  TONE_KEYS.forEach(k => FILLS.push(fill(TONES[k][0]), fill(TONES[k][1])));
  const fillDark = k => 5 + TONE_KEYS.indexOf(k) * 2, fillLight = k => 6 + TONE_KEYS.indexOf(k) * 2;
  const XF = [], STYLE = {};
  const xf = (name, font, fillId, border, wrap) => { STYLE[name] = XF.length; XF.push(`<xf numFmtId="0" fontId="${font}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"${wrap ? ' wrapText="1"' : ''}/></xf>`); };
  xf('none', 0, 0, 0); xf('title', 2, 2, 0); xf('sub', 4, 0, 0); xf('lbl', 1, 3, 1, 1); xf('val', 0, 0, 1, 1); xf('th', 1, 4, 1, 1); xf('td', 0, 0, 1, 1);
  TONE_KEYS.forEach(k => { xf('sec_' + k, 3, fillDark(k), 0); xf('grp_' + k, 1, fillLight(k), 1); xf('val_' + k, 1, fillLight(k), 1, 1); });
  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${FONTS.length}">${FONTS.join('')}</fonts><fills count="${FILLS.length}">${FILLS.join('')}</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD5DEE6"/></left><right style="thin"><color rgb="FFD5DEE6"/></right><top style="thin"><color rgb="FFD5DEE6"/></top><bottom style="thin"><color rgb="FFD5DEE6"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${XF.length}">${XF.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  // ------------------------------------------------------------------ worksheet
  const xe = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const colL = n => String.fromCharCode(65 + n);
  /** sheet = { name, widths: [..], rows: [{ cells: [[text, styleName], ...], merge: lastColIndex?, ht }] } */
  X.workbook = sheet => {
    const last = sheet.widths.length - 1, merges = [];
    const rows = sheet.rows.map((r, i) => {
      const n = i + 1;
      const cells = r.cells.map(([v, st], c) => (/^-?\d+(\.\d+)?$/.test(String(v))
        ? `<c r="${colL(c)}${n}" s="${STYLE[st] || 0}"><v>${v}</v></c>` // plain numbers as numbers (no "stored as text" marks)
        : `<c r="${colL(c)}${n}" t="inlineStr" s="${STYLE[st] || 0}"><is><t xml:space="preserve">${xe(v)}</t></is></c>`));
      // a merged tail keeps its borders and fill
      const endStyle = r.cells.length ? r.cells[r.cells.length - 1][1] : 'none';
      if (r.merge != null && r.cells.length - 1 < last) for (let c = r.cells.length; c <= last; c++) cells.push(`<c r="${colL(c)}${n}" s="${STYLE[endStyle] || 0}"/>`);
      if (r.merge != null && r.merge < last) merges.push(`${colL(r.merge)}${n}:${colL(last)}${n}`);
      return `<row r="${n}"${r.ht ? ` ht="${r.ht}" customHeight="1"` : ''}>${cells.join('')}</row>`;
    });
    const ws = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/>
<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>`;
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xe(sheet.name).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: STYLES_XML },
      { name: 'xl/worksheets/sheet1.xml', data: ws },
    ]);
  };

  /** The handover (PE.domain.handover) as a coloured, card-like worksheet: one band per SBAR part. */
  X.handover = h => {
    const W = 6, rows = [];
    const blank = () => rows.push({ cells: [], ht: 8 });
    rows.push({ cells: [[h.title, 'title']], merge: 0, ht: 30 });
    rows.push({ cells: [[`Generated ${h.generated} by ${h.by} · period: ${h.window}${h.demo ? ' · TRAINING DATA' : ''}`, 'sub']], merge: 0 });
    h.sections.forEach(sec => {
      blank();
      rows.push({ cells: [[`${sec.key} · ${sec.title.toUpperCase()}`, 'sec_' + sec.tone]], merge: 0, ht: 24 });
      sec.facts.forEach(([k, v, tone]) => rows.push({ cells: [[k, 'lbl'], [String(v), tone ? 'val_' + tone : 'val']], merge: 1 }));
      sec.groups.filter(g => g.rows.length).forEach(g => {
        rows.push({ cells: [[`${g.title} (${g.rows.length})`, 'grp_' + g.tone]], merge: 0 });
        rows.push({ cells: g.cols.map(c => [c, 'th']), merge: g.cols.length < W ? g.cols.length - 1 : null });
        g.rows.forEach(r => rows.push({ cells: r.cells.map(c => [c, 'td']), merge: r.cells.length < W ? r.cells.length - 1 : null }));
      });
      (sec.items || []).forEach((t, i) => rows.push({ cells: [[`${i + 1}. ${t}`, 'val_' + sec.tone]], merge: 0 }));
    });
    if (h.notes) { blank(); rows.push({ cells: [['NOTES FROM OUTGOING NURSE', 'sec_grey']], merge: 0, ht: 24 }); rows.push({ cells: [[h.notes, 'val']], merge: 0, ht: 60 }); }
    return X.workbook({ name: 'Handover', widths: [34, 34, 22, 22, 16, 22], rows });
  };
})(window.PulseED);
