/* ===== Gerador de Folgas — motor (leitura xlsx, regras, solver, escrita) ===== */
(function (root) {
  'use strict';

  /* ---------- ZIP ---------- */
  async function pipe(u8, stream) {
    const s = new Blob([u8]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const inflateRaw = (u8) => pipe(u8, new DecompressionStream('deflate-raw'));
  const deflateRaw = (u8) => pipe(u8, new CompressionStream('deflate-raw'));

  let CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) {
      CRC_T = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        CRC_T[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function readZip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Arquivo não é um .xlsx válido (zip não encontrado).');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const entries = [];
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Zip corrompido.');
      const method = dv.getUint16(p + 10, true);
      const time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
      const crc = dv.getUint32(p + 16, true);
      const csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      const ln = dv.getUint16(lho + 26, true), le = dv.getUint16(lho + 28, true);
      const start = lho + 30 + ln + le;
      entries.push({ name, method, time, date, crc, csize, usize, raw: u8.subarray(start, start + csize) });
    }
    return entries;
  }

  async function entryBytes(e) {
    if (e.method === 0) return e.raw;
    if (e.method === 8) return inflateRaw(e.raw);
    throw new Error('Compressão não suportada: ' + e.method);
  }

  async function writeZip(entries) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let off = 0;
    for (const e of entries) {
      let { method, crc, csize, usize, raw } = e;
      if (e.data) {
        crc = crc32(e.data); usize = e.data.length;
        raw = await deflateRaw(e.data); csize = raw.length; method = 8;
      }
      const name = enc.encode(e.name);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
      lh.setUint16(8, method, true); lh.setUint16(10, e.time || 0, true); lh.setUint16(12, e.date || 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, csize, true); lh.setUint32(22, usize, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, raw);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0, true); ch.setUint16(10, method, true); ch.setUint16(12, e.time || 0, true);
      ch.setUint16(14, e.date || 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, csize, true);
      ch.setUint32(24, usize, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + raw.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, entries.length, true); eo.setUint16(10, entries.length, true);
    eo.setUint32(12, cdSize, true); eo.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(eo.buffer)],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- XML helpers ---------- */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const unesc = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] ?? m));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function attr(tag, name) {
    const m = tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'));
    return m ? unesc(m[1]) : null;
  }
  function colIdx(letters) { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
  function colName(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function splitRef(ref) { const m = ref.match(/^([A-Z]+)(\d+)$/); return m ? { c: colIdx(m[1]), r: +m[2] } : null; }
  function textOf(xml) {
    xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let out = '';
    const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; let m;
    while ((m = re.exec(xml))) out += unesc(m[1]);
    return out;
  }
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '');

  function parseSST(xml) {
    const out = []; const re = /<si>([\s\S]*?)<\/si>|<si\/>/g; let m;
    while ((m = re.exec(xml))) out.push(m[1] ? textOf(m[1]) : '');
    return out;
  }

  function parseSheet(xml, sst) {
    const cells = new Map();
    const a = xml.indexOf('<sheetData'); const b = xml.lastIndexOf('</sheetData>');
    if (a < 0 || b < 0) return cells;
    const data = xml.slice(a, b);
    const re = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
    while ((m = re.exec(data))) {
      const at = m[1], body = m[2] || '';
      const ref = attr(at, 'r'); if (!ref) continue;
      const t = attr(at, 't');
      let v = null;
      const vm = body.match(/<v>([\s\S]*?)<\/v>/);
      if (t === 's') v = vm ? sst[+vm[1]] ?? '' : null;
      else if (t === 'inlineStr') v = textOf(body);
      else if (t === 'str') v = vm ? unesc(vm[1]) : '';
      else if (t === 'b') v = vm ? vm[1] === '1' : null;
      else if (t === 'e') v = vm ? '#ERR' : null;
      else v = vm ? Number(vm[1]) : null;
      if (v === null || v === '') continue;
      cells.set(ref, v);
    }
    return cells;
  }

  async function loadWorkbook(buf) {
    const entries = readZip(buf);
    const byName = new Map(entries.map((e) => [e.name, e]));
    const txt = async (n) => { const e = byName.get(n); return e ? new TextDecoder().decode(await entryBytes(e)) : null; };
    const wbXml = await txt('xl/workbook.xml');
    if (!wbXml) throw new Error('Não encontrei xl/workbook.xml — o arquivo precisa ser .xlsx.');
    const rels = await txt('xl/_rels/workbook.xml.rels');
    const relMap = {};
    for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
      const id = attr(m[0], 'Id'); let tgt = attr(m[0], 'Target');
      tgt = tgt.startsWith('/') ? tgt.slice(1) : 'xl/' + tgt.replace(/^\.\//, '');
      relMap[id] = tgt;
    }
    const sstXml = await txt('xl/sharedStrings.xml');
    const sst = sstXml ? parseSST(sstXml) : [];
    const sheets = [];
    for (const m of wbXml.matchAll(/<sheet\s[^>]*>/g)) {
      const name = attr(m[0], 'name'); const state = attr(m[0], 'state') || 'visible';
      const rid = attr(m[0], 'r:id'); const path = relMap[rid];
      sheets.push({ name, state, path });
    }
    for (const s of sheets) {
      if (s.state !== 'visible' || !byName.has(s.path)) { s.cells = new Map(); continue; }
      s.cells = parseSheet(await txt(s.path), sst);
    }
    return { entries, byName, sheets, wbXml };
  }

  /* ---------- Modelo ---------- */
  const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function serialToDate(n) { return new Date(Math.round((n - 25569) * 86400000)); }
  const isSerial = (v) => typeof v === 'number' && Number.isInteger(v) && v > 40000 && v < 60000;
  const clean = (v) => (v === null || v === undefined ? '' : String(v).trim().toUpperCase());

  function buildModel(wb) {
    const out = { sheets: [], month: null, unknownCodes: new Set(), empCount: 0 };
    for (const sh of wb.sheets) {
      if (sh.state !== 'visible' || !sh.cells.size) continue;
      const get = (r, c) => sh.cells.get(colName(c) + r);
      let maxRow = 0, maxCol = 0;
      for (const k of sh.cells.keys()) { const p = splitRef(k); if (p.r > maxRow) maxRow = p.r; if (p.c > maxCol) maxCol = p.c; }
      // linhas de datas
      const dateRows = [];
      for (let r = 1; r <= maxRow; r++) {
        const cols = [];
        for (let c = 3; c <= Math.min(maxCol, 90); c++) { const v = get(r, c); if (isSerial(v)) cols.push([c, v]); }
        if (cols.length >= 28) dateRows.push({ r, cols });
      }
      if (!dateRows.length) continue;
      // tabela CH
      let chTable = [];
      for (let r = 1; r <= 4 && !chTable.length; r++) for (let c = 40; c <= maxCol; c++) {
        if (norm(get(r, c)) === 'CH' && norm(get(r, c + 1)).startsWith('HORA')) {
          for (let rr = r + 1; rr <= r + 12; rr++) {
            const ch = get(rr, c), mh = get(rr, c + 1), j = get(rr, c + 2);
            if (typeof ch === 'number' && typeof mh === 'number' && typeof j === 'number' && j > 0) chTable.push({ ch, maxH: mh, jorn: j });
            else if (chTable.length) break;
          }
          break;
        }
      }
      const sheet = { name: sh.name, path: sh.path, blocks: [], chTable };
      dateRows.forEach((dr, bi) => {
        const serials = dr.cols.map((x) => x[1]);
        const last = serialToDate(Math.max(...serials));
        const Y = last.getUTCFullYear(), M = last.getUTCMonth();
        const D = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
        if (!out.month) out.month = { year: Y, month: M, days: D, label: MESES[M] + '/' + Y,
          dow: Array.from({ length: D }, (_, i) => new Date(Date.UTC(Y, M, i + 1)).getUTCDay()) };
        const cur = new Array(D).fill(0); const prev = [];
        const first = Date.UTC(Y, M, 1);
        for (const [c, v] of dr.cols) {
          const d = serialToDate(v);
          if (d.getUTCFullYear() === Y && d.getUTCMonth() === M) cur[d.getUTCDate() - 1] = c;
          else if (d.getTime() < first) prev.push([v, c]);
        }
        prev.sort((a, b) => a[0] - b[0]);
        const prevCols = prev.map((x) => x[1]); const prevDates = prev.map((x) => serialToDate(x[0]).getUTCDate());
        if (cur.some((c) => !c)) return;
        const hdr = dr.r - 1;
        const lastCur = Math.max(...cur);
        const find = (pred) => { for (let c = lastCur + 1; c <= maxCol; c++) if (pred(norm(get(hdr, c)))) return c; return 0; };
        const goldCol = find((s) => s === 'FOLGAAGRUPADA');
        const chCol = find((s) => s === 'CARGAHORARIA' || s === 'CH');
        const teamCol = find((s) => s === 'EQUIPE');
        let entCol = 0;
        for (let c = lastCur + 1; c <= maxCol; c++) if (norm(get(dr.r + 1, c)) === 'ENTRADA' || norm(get(dr.r, c)) === 'ENTRADA') { entCol = c; break; }
        const endRow = bi + 1 < dateRows.length ? dateRows[bi + 1].r - 2 : maxRow;
        const title = String(get(hdr, 2) ?? get(hdr, 1) ?? sh.name).trim() || sh.name;
        const block = { title, headerRow: hdr, dateRow: dr.r, cur, prevCols, prevDates, groups: [] };
        let label = null, run = null, labelUse = {};
        const closeRun = () => {
          if (run && run.emps.length) {
            const base = run.label || title;
            labelUse[base] = (labelUse[base] || 0) + 1;
            run.name = labelUse[base] > 1 ? base + ' (parte ' + labelUse[base] + ')' : base;
            block.groups.push(run);
          }
          run = null;
        };
        for (let r = dr.r + 1; r <= endRow; r++) {
          const A = get(r, 1), B = get(r, 2);
          const isEmp = typeof A === 'number' && A >= 1000 && typeof B === 'string' && B.trim();
          if (!isEmp) {
            closeRun();
            const a = typeof A === 'string' ? A.trim() : '', b = typeof B === 'string' ? B.trim() : '';
            if (a && !/^vers/i.test(a) && !/^total/i.test(a) && !/^matr/i.test(a)) label = a;
            else if (!a && b && !/^total/i.test(b)) label = b;
            else if (typeof A === 'number') label = null;
            continue;
          }
          if (!run) run = { label, emps: [] };
          const fixed = cur.map((c) => clean(get(r, c)));
          const prevCodes = prevCols.map((c) => clean(get(r, c)));
          const chv = chCol ? get(r, chCol) : null;
          const gv = goldCol ? get(r, goldCol) : null;
          const fmtTime = (v) => { if (typeof v !== 'number') return ''; const m = Math.round((v % 1) * 1440); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
          const emp = {
            id: sh.name + '!' + r, row: r, mat: A, name: B.trim(), fixed, prev: prevCodes,
            ch: typeof chv === 'number' ? Math.round(chv) : null,
            gold: gv === 1 || gv === true || gv === '1',
            team: teamCol ? String(get(r, teamCol) ?? '') : '',
            entrada: entCol ? fmtTime(get(r, entCol)) : '', saida: entCol ? fmtTime(get(r, entCol + 1)) : '',
            gen: new Array(D).fill(''), manual: new Array(D).fill(''),
          };
          for (const code of [...fixed, ...prevCodes]) if (code && !KNOWN.has(code)) out.unknownCodes.add(code);
          run.emps.push(emp); out.empCount++;
        }
        closeRun();
        if (block.groups.length) sheet.blocks.push(block);
      });
      if (sheet.blocks.length) out.sheets.push(sheet);
    }
    if (!out.sheets.length) throw new Error('Nenhuma aba de escala encontrada (procurei linhas com as datas do mês e matrículas na coluna A).');
    out.unknownCodes = [...out.unknownCodes].sort();
    return out;
  }

  /* ---------- Regras ---------- */
  const KNOWN = new Set(['F', 'FA', 'L', 'K', 'AF', 'CH']);
  function defaultSettings() { return { maxRun: 6, afCounts: false, offCodes: [] }; }
  // tipo de um código: 'free' | 'offC' (folga que conta) | 'offX' (folga que não conta) | 'work'
  function kind(code, st) {
    if (!code) return 'free';
    if (code === '·') return 'work';
    if (code === 'F' || code === 'FA' || code === 'L') return 'offC';
    if (code === 'AF' || code === 'CH') return st.afCounts ? 'offC' : 'offX';
    if (code === 'K') return 'work';
    return st.offCodes.includes(code) ? 'offX' : 'work';
  }

  function requirement(emp, sheet, D) {
    let row = emp.ch != null ? sheet.chTable.find((t) => t.ch === emp.ch) : null;
    if (row) {
      const maxWork = Math.floor(row.maxH / row.jorn + 1e-9);
      return { required: Math.max(0, D - maxWork), maxH: row.maxH, jorn: row.jorn, known: true };
    }
    const jorn = emp.ch ? Math.round(emp.ch / D) : 6;
    return { required: D === 31 ? 6 : 5, maxH: null, jorn, known: false };
  }

  // código efetivo de um dia (fixo > manual > gerado)
  const eff = (emp, d) => { const v = emp.fixed[d] || emp.manual[d] || emp.gen[d]; return v === '·' ? '' : v; };

  // O FA é folga para a meta do mês, mas NÃO é o descanso semanal: ele vem
  // grudado no F do domingo, como dia extra do nome dourado. Então não zera a
  // contagem do 6x1 — a sequência é medida de descanso a descanso, e o próprio
  // dia de FA entra nela. Ex.: F no sábado 17 e FA no sábado 24 seguido de F no
  // domingo 25 são 7 dias (18 a 24) até o descanso de verdade.
  function quebraSequencia(code, st) {
    if (code === 'FA') return false;
    const k = kind(code, st);
    return k === 'offC' || k === 'offX';
  }

  function prevRun(emp, st) {
    if (emp.prevUnknown) return { run: 0, found: true, unknown: true };
    let run = 0;
    for (let i = emp.prev.length - 1; i >= 0; i--) {
      if (quebraSequencia(emp.prev[i], st)) return { run, found: true };
      run++;
    }
    return { run, found: false };
  }

  /* ---------- Solver (programação dinâmica por colaborador) ---------- */
  const BIG = 1e6, SHORT = 1e5, SUNPEN = 5e4, FAPEN = 2e4, EXTRA = 300, ADJ = 60, GAP1 = 8;

  function solveEmp(emp, ctx, costDay) {
    const { D, dow, st } = ctx;
    const maxRun = st.maxRun;
    // estado fixo do dia (fixos + edições manuais)
    const fx = new Array(D); let counted = 0, hasFA = false, sunAvail = false;
    for (let d = 0; d < D; d++) {
      const code = emp.fixed[d] || emp.manual[d];
      const k = kind(code, st);
      // `quebra` separa "é folga" de "zera a sequência": o FA é folga para a
      // meta, mas a sequência do 6x1 atravessa ele.
      fx[d] = { k, quebra: quebraSequencia(code, st), sun: dow[d] === 0 && (code === 'F' || code === 'AF' || code === 'CH') };
      if (k === 'offC') counted++;
      if (code === 'FA') hasFA = true;
      if (dow[d] === 0 && k === 'free') sunAvail = true;
    }
    const need = Math.max(0, emp.req.required - counted);
    const pr = prevRun(emp, st);
    const r0 = Math.min(pr.run, maxRun);
    const prevOff = pr.found && pr.run === 0 && !pr.unknown;
    const anyFree = fx.some((x) => x.k === 'free');
    if (!anyFree) return { gen: new Array(D).fill(''), cost: 0 };
    const isOff = (d) => d >= 0 && d < D && (fx[d].k === 'offC' || fx[d].k === 'offX');
    const adjFixed = (d) => (isOff(d - 1) || isOff(d + 1) || (d === 0 && prevOff) ? ADJ : 0);

    function dp(forced) {
      const Kc = need + 8;
      const R = maxRun + 1;
      const S = R * (Kc + 1) * 4;
      const idx = (run, k, s, pg) => ((run * (Kc + 1) + k) * 2 + s) * 2 + pg;
      let cur = new Float64Array(S).fill(Infinity);
      cur[idx(r0, 0, 0, 0)] = 0;
      const back = [];
      for (let d = 0; d < D; d++) {
        const nxt = new Float64Array(S).fill(Infinity);
        const bp = new Int32Array(S).fill(-1); const bc = new Int8Array(S);
        const f = fx[d];
        for (let run = 0; run < R; run++) for (let k = 0; k <= Kc; k++) for (let s = 0; s < 2; s++) for (let pg = 0; pg < 2; pg++) {
          const i = idx(run, k, s, pg); const c0 = cur[i]; if (c0 === Infinity) continue;
          const relax = (j, c, ch) => { if (c < nxt[j]) { nxt[j] = c; bp[j] = i; bc[j] = ch; } };
          if (f.k !== 'free') {
            if (f.k === 'work') {
              const over = run + 1 > maxRun;
              relax(idx(Math.min(run + 1, maxRun), k, s, 0), c0 + (over ? BIG : 0), 0);
            } else if (!f.quebra) {
              // FA já lançado na planilha: não trabalha, mas a sequência segue.
              const over = run + 1 > maxRun;
              relax(idx(Math.min(run + 1, maxRun), k, s, 0), c0 + (over ? BIG : 0), 0);
            } else relax(idx(0, k, s || (f.sun ? 1 : 0), 0), c0, 0);
            continue;
          }
          const fd = forced && forced[d];
          if (fd) {
            // O F do domingo zera a sequência; o FA colado nele, não.
            if (k + 1 <= Kc) {
              if (fd === 'FA') {
                const over = run + 1 > maxRun;
                relax(idx(Math.min(run + 1, maxRun), k + 1, s, 1), c0 + costDay[d] + adjFixed(d) * 0.5 + (over ? BIG : 0), 2);
              } else {
                relax(idx(0, k + 1, s || (dow[d] === 0 ? 1 : 0), 1), c0 + costDay[d] + adjFixed(d) * 0.5, 1);
              }
            }
            continue;
          }
          // trabalhar
          const over = run + 1 > maxRun;
          relax(idx(Math.min(run + 1, maxRun), k, s, 0), c0 + (over ? BIG : 0), 0);
          // folgar
          if (k + 1 <= Kc) {
            const pen = costDay[d] + (pg ? ADJ : 0) + adjFixed(d) + (run === 1 && !(pr.unknown && d - 2 < 0) ? GAP1 : 0);
            relax(idx(0, k + 1, s || (dow[d] === 0 ? 1 : 0), 1), c0 + pen, 1);
          }
        }
        back.push({ bp, bc });
        cur = nxt;
      }
      let best = Infinity, bi = -1;
      for (let run = 0; run < R; run++) for (let k = 0; k <= Kc; k++) for (let s = 0; s < 2; s++) for (let pg = 0; pg < 2; pg++) {
        const i = idx(run, k, s, pg); if (cur[i] === Infinity) continue;
        let c = cur[i] + (k < need ? (need - k) * SHORT : (k - need) * EXTRA) + (!s && sunAvail ? SUNPEN : 0);
        if (c < best) { best = c; bi = i; }
      }
      const gen = new Array(D).fill('');
      let i = bi;
      for (let d = D - 1; d >= 0; d--) {
        const { bp, bc } = back[d];
        if (bc[i] === 1) gen[d] = 'F'; else if (bc[i] === 2) gen[d] = 'FA';
        i = bp[i];
      }
      return { gen, cost: best };
    }

    if (emp.gold && !hasFA && ctx.faOn) {
      let best = dp(null); best.cost += FAPEN;
      for (let d = 0; d < D; d++) {
        if (dow[d] !== 0) continue;
        const code = emp.fixed[d] || emp.manual[d];
        const sunOk = !code ? true : code === 'F';
        if (!sunOk) continue;
        for (const p of [d - 1, d + 1]) {
          if (p < 0 || p >= D || fx[p].k !== 'free') continue;
          const forced = {}; if (!code) forced[d] = 'F'; forced[p] = 'FA';
          const r = dp(forced);
          if (r.cost < best.cost) best = r;
        }
      }
      return best;
    }
    return dp(null);
  }

  function isNonWorking(code) { return !!code; } // convenção da planilha: trabalhando = célula vazia

  function generate(model, st, opts = {}) {
    const D = model.month.days, dow = model.month.dow;
    const ctx = { D, dow, st, faOn: true };
    for (const sheet of model.sheets) for (const block of sheet.blocks) {
      const all = block.groups.flatMap((g) => g.emps);
      for (const g of block.groups) for (const e of g.emps) {
        e.req = requirement(e, sheet, D);
        if (!opts.keep) e.gen = new Array(D).fill('');
        e._g = g;
      }
      for (const g of block.groups) {
        g.prevUnknown = g.emps.every((e) => e.prev.every((c) => !c));
        for (const e of g.emps) e.prevUnknown = g.prevUnknown;
      }
      const loadG = new Map(block.groups.map((g) => [g, new Array(D).fill(0)]));
      const loadB = new Array(D).fill(0);
      const add = (e, sign) => {
        const lg = loadG.get(e._g);
        for (let d = 0; d < D; d++) if (isNonWorking(eff(e, d))) { lg[d] += sign; loadB[d] += sign; }
      };
      all.forEach((e) => add(e, 1));
      const cost = (e, ei) => {
        const lg = loadG.get(e._g); const gsz = e._g.emps.length; const bsz = all.length;
        return Array.from({ length: D }, (_, d) =>
          (2 * lg[d] + 1) * (12 / Math.max(3, gsz)) + 0.35 * (2 * loadB[d] + 1) * (12 / Math.max(6, bsz)) +
          0.002 * ((d * 7 + ei * 13) % 17));
      };
      const freeCount = (e) => e.fixed.filter((c, d) => !c && !e.manual[d]).length;
      const order = all.map((e, i) => [e, i]).sort((a, b) => (freeCount(a[0]) - freeCount(b[0])) || (b[0].gold - a[0].gold) || (a[1] - b[1]));
      const passes = opts.passes ?? 5;
      for (let p = 0; p < passes; p++) {
        const seq = p === 0 ? order : all.map((e, i) => [e, i]);
        for (const [e, ei] of seq) {
          add(e, -1); e.gen = new Array(D).fill(''); add(e, 1);
          const r = solveEmp(e, ctx, cost(e, ei));
          add(e, -1); e.gen = r.gen.map((g, d) => (e.fixed[d] || e.manual[d] ? '' : g)); add(e, 1);
        }
      }
    }
    validate(model, st);
    return model;
  }

  /* ---------- Validação ---------- */
  function validate(model, st) {
    const D = model.month.days, dow = model.month.dow;
    let issues = 0;
    for (const sheet of model.sheets) for (const block of sheet.blocks) for (const g of block.groups) {
      for (const e of g.emps) {
        if (!e.req) e.req = requirement(e, sheet, D);
        const codes = Array.from({ length: D }, (_, d) => eff(e, d));
        const list = [];
        const allL = codes.every((c) => c === 'L');
        const counted = codes.filter((c) => kind(c, st) === 'offC').length;
        const offs = codes.filter((c) => { const k = kind(c, st); return k === 'offC' || k === 'offX'; }).length;
        // sequência (inclui mês anterior)
        const pr = prevRun(e, st);
        let run = pr.run, maxSeen = 0, runStart = pr.run ? -pr.run : 0, worst = null;
        if (!pr.found && e.prev.length) list.push({ lv: 'aviso', t: `Sem folga nos ${e.prev.length} dias do mês anterior — tratei como ${e.prev.length} dias trabalhados` });
        let temFAnaSeq = false, faNaSeq = false;
        for (let d = 0; d < D; d++) {
          if (quebraSequencia(codes[d], st)) { run = 0; runStart = d + 1; faNaSeq = false; }
          else {
            if (codes[d] === 'FA') faNaSeq = true;
            run++;
            if (run > maxSeen) { maxSeen = run; worst = [runStart, d]; temFAnaSeq = faNaSeq; }
          }
        }
        if (maxSeen > st.maxRun) {
          const a = worst[0] < 0 ? 'desde o mês anterior' : `dia ${worst[0] + 1}`;
          const porFA = temFAnaSeq ? ' — a folga agrupada no meio não quebra a sequência' : '';
          list.push({ lv: 'erro', t: `${maxSeen} dias seguidos sem folga (${a} até o dia ${worst[1] + 1})${porFA}` });
        }
        if (!allL && counted < e.req.required) list.push({ lv: 'erro', t: `Faltam ${e.req.required - counted} folga(s): tem ${counted} de ${e.req.required}` });
        const sunOff = codes.some((c, d) => dow[d] === 0 && (c === 'F' || c === 'AF' || c === 'CH'));
        const sunBlocked = codes.every((c, d) => dow[d] !== 0 || (c && c !== 'F' && c !== 'AF' && c !== 'CH'));
        if (!sunOff && !allL) list.push(sunBlocked ? { lv: 'info', t: 'Nenhum domingo livre (férias/curso em todos)' } : { lv: 'erro', t: 'Sem domingo de folga no mês' });
        const faDays = codes.map((c, d) => (c === 'FA' ? d : -1)).filter((d) => d >= 0);
        for (const d of faDays) {
          if (dow[d] !== 6 && dow[d] !== 1) list.push({ lv: 'erro', t: `FA no dia ${d + 1} (${DOW[dow[d]]}) — só sábado ou segunda` });
          else {
            const sun = dow[d] === 6 ? d + 1 : d - 1;
            if (sun < 0 || sun >= D || codes[sun] !== 'F') list.push({ lv: 'erro', t: `FA do dia ${d + 1} sem F no domingo ao lado` });
          }
        }
        const faPossible = codes.some((c, d) => dow[d] === 0 && (c === 'F' || (!e.fixed[d] && !e.manual[d])) &&
          [d - 1, d + 1].some((p) => p >= 0 && p < D && !e.fixed[p] && !e.manual[p]));
        if (e.gold) {
          if (!faDays.length && faPossible) list.push({ lv: 'aviso', t: 'Nome dourado sem folga agrupada (FA)' });
          else if (!faDays.length) list.push({ lv: 'info', t: 'Dourado sem fim de semana livre para FA (férias/curso)' });
          if (faDays.length > 1) list.push({ lv: 'aviso', t: `${faDays.length} FA no mês — o normal é 1` });
        }
        if (!e.gold && faDays.length) list.push({ lv: 'aviso', t: 'FA para nome que não é dourado' });
        if (!e.req.known) list.push({ lv: 'info', t: `Carga horária ${e.ch ?? '—'} não está na tabela CH; usei ${e.req.required} folgas` });
        const hours = e.req.maxH != null ? (e.ch - e.req.jorn * counted) : null;
        e.stat = { counted, offs, required: e.req.required, maxRun: maxSeen, sunOff, fa: faDays.length, hours, maxH: e.req.maxH, allL };
        e.issues = list;
        issues += list.filter((x) => x.lv === 'erro').length;
      }
      g.work = Array.from({ length: D }, (_, d) => g.emps.filter((e) => !eff(e, d)).length);
    }
    model.errorCount = issues;
    return model;
  }

  /* ---------- Saída ---------- */
  function groupTSV(model, g) {
    const D = model.month.days;
    return g.emps.map((e) => Array.from({ length: D }, (_, d) => eff(e, d)).join('\t')).join('\r\n');
  }

  async function buildXlsx(wb, model) {
    const D = model.month.days;
    const bySheet = new Map();
    for (const sheet of model.sheets) {
      const upd = new Map();
      for (const block of sheet.blocks) for (const g of block.groups) for (const e of g.emps) for (let d = 0; d < D; d++) {
        if (e.fixed[d]) continue;
        const v = e.manual[d] || e.gen[d];
        if (!v || v === '·') continue;
        if (!upd.has(e.row)) upd.set(e.row, new Map());
        upd.get(e.row).set(block.cur[d], v);
      }
      if (upd.size) bySheet.set(sheet.path, upd);
    }
    const dec = new TextDecoder(), enc = new TextEncoder();
    const out = [];
    for (const e of wb.entries) {
      if (bySheet.has(e.name)) {
        const xml = dec.decode(await entryBytes(e));
        out.push({ name: e.name, time: e.time, date: e.date, data: enc.encode(patchSheet(xml, bySheet.get(e.name))) });
      } else if (e.name === 'xl/workbook.xml') {
        let xml = dec.decode(await entryBytes(e));
        if (/<calcPr\b/.test(xml)) { if (!/fullCalcOnLoad=/.test(xml)) xml = xml.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"'); }
        else xml = xml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
        out.push({ name: e.name, time: e.time, date: e.date, data: enc.encode(xml) });
      } else out.push(e);
    }
    return writeZip(out);
  }

  function patchSheet(xml, upd) {
    const cellXml = (ref, s, v) => `<c r="${ref}"${s != null ? ` s="${s}"` : ''} t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
    return xml.replace(/<row\s([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, (whole, at, tail, body) => {
      const r = +attr(at, 'r');
      const u = upd.get(r); if (!u) return whole;
      const cells = [];
      const re = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
      body = body || '';
      while ((m = re.exec(body))) cells.push({ c: splitRef(attr(m[1], 'r')).c, xml: m[0], s: attr(m[1], 's') });
      const seen = new Set();
      for (const cell of cells) if (u.has(cell.c)) { cell.xml = cellXml(colName(cell.c) + r, cell.s, u.get(cell.c)); seen.add(cell.c); }
      for (const [c, v] of u) if (!seen.has(c)) cells.push({ c, xml: cellXml(colName(c) + r, null, v) });
      cells.sort((a, b) => a.c - b.c);
      const openAt = at.replace(/\/$/, '').trimEnd();
      return `<row ${openAt}>${cells.map((x) => x.xml).join('')}</row>`;
    });
  }

  const api = { loadWorkbook, buildModel, generate, validate, groupTSV, buildXlsx, defaultSettings, kind, quebraSequencia, eff, colName, DOW, MESES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FolgaEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
