// ══════════════════════════════════════════════════════════════
// app.js — Generator Berita Acara Pengadaan
// Preview : dari template HTML di index.html
// PDF     : pdfmake (justify native)
// ══════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────
let currentType    = 'aanwijzing';
let qaCount        = 0;
let perubahanCount = 0;
let ukpCount       = 0;

// ── Helpers ───────────────────────────────────────────────────
function terbilang(n) {
  const satuan = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan',
                  'sepuluh','sebelas','dua belas','tiga belas','empat belas','lima belas',
                  'enam belas','tujuh belas','delapan belas','sembilan belas'];
  if (n === 0) return 'nol';
  if (n < 20)  return satuan[n];
  if (n < 100) {
    const t = ['','','dua puluh','tiga puluh','empat puluh','lima puluh',
               'enam puluh','tujuh puluh','delapan puluh','sembilan puluh'];
    return t[Math.floor(n/10)] + (n%10 ? ' '+satuan[n%10] : '');
  }
  if (n < 200) return 'seratus' + (n%100 ? ' '+terbilang(n%100) : '');
  return terbilang(Math.floor(n/100)) + ' ratus' + (n%100 ? ' '+terbilang(n%100) : '');
}

function formatJumlah(n) { return `${n} (${terbilang(n)})`; }

/**
 * Clone <template>, isi data-field & data-slot, kembalikan elemen.
 */
function cloneTemplate(tmplId, fields = {}, slots = {}) {
  const frag = document.getElementById(tmplId).content.cloneNode(true);
  Object.entries(fields).forEach(([k, v]) => {
    frag.querySelectorAll(`[data-field="${k}"]`).forEach(el => el.textContent = v ?? '');
  });
  Object.entries(slots).forEach(([k, nodes]) => {
    const slot = frag.querySelector(`[data-slot="${k}"]`);
    if (!slot) return;
    (Array.isArray(nodes) ? nodes : [nodes]).forEach(n => { if (n) slot.appendChild(n); });
  });
  return frag.firstElementChild;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Inisialisasi tipe default aanwijzing
  switchType('aanwijzing');

  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // Isi hari otomatis dari tanggal
  document.getElementById('tanggal').addEventListener('change', function () {
    const hariList = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    if (this.value) {
      const d = new Date(this.value + 'T00:00:00');
      document.getElementById('hari').value = hariList[d.getDay()];
    } else {
      document.getElementById('hari').value = '';
    }
  });
  // Paste multi-baris → generate peserta otomatis
  document.getElementById('peserta-list').addEventListener('paste', function (e) {
    const activeInput = e.target.closest('.list-item input');
    if (!activeInput) return;

    const text  = (e.clipboardData || window.clipboardData).getData('text');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (lines.length <= 1) return; // paste biasa, biarkan normal

    e.preventDefault();
    activeInput.value = lines[0];
    lines.slice(1).forEach(line => {
      addPeserta();
      const inputs = document.querySelectorAll('#peserta-list .list-item input');
      inputs[inputs.length - 1].value = line;
    });
  });
});

// ── Switch Type ───────────────────────────────────────────────
function switchType(val) {
  currentType = val;
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
  document.getElementById('card-' + val).classList.add('active');
  const aan = val === 'aanwijzing';
  document.getElementById('section-jadwal').classList.toggle('hidden', !aan);
  document.getElementById('section-qa').classList.toggle('hidden', !aan);
  document.getElementById('section-perubahan').classList.toggle('hidden', !aan);
  document.getElementById('section-ttd-pembukaan').classList.toggle('hidden', aan);
  document.getElementById('section-ttd-aanwijzing').classList.toggle('hidden', !aan);
  if (aan && qaCount === 0) addQA();
  if (aan && ukpCount === 0) addUKP();
}

// ── Peserta ───────────────────────────────────────────────────
function addPeserta() {
  const list = document.getElementById('peserta-list');
  const div  = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = `<span class="list-num"></span>
    <input type="text" placeholder="Nama peserta / perusahaan...">
    <button class="btn-icon" onclick="removePeserta(this)" title="Hapus">&#215;</button>`;
  list.appendChild(div);
  renumberPeserta();
}
function removePeserta(btn) { btn.parentElement.remove(); renumberPeserta(); }
function renumberPeserta() {
  document.querySelectorAll('#peserta-list .list-num').forEach((s,i) => s.textContent = (i+1)+'.');
}
function getPeserta() {
  return [...document.querySelectorAll('#peserta-list .list-item input')]
    .map(i => i.value.trim()).filter(Boolean);
}

// ── Q&A ───────────────────────────────────────────────────────
// Format input: baris ganjil = pertanyaan, baris genap = jawaban
// Q1 (baris 1), A1 (baris 2), Q2 (baris 3), A2 (baris 4), dst.
function addQA() {
  const list = document.getElementById('qa-list');
  // Hanya ada 1 textarea besar, hapus tombol tidak diperlukan
  if (list.querySelector('.qa-textarea')) return; // sudah ada
  const div = document.createElement('div');
  div.className = 'qa-item';
  div.innerHTML = `
    <div class="qa-item-header">
      <span class="qa-badge">Pertanyaan &amp; Jawaban</span>
    </div>
    <div class="qa-body">
      <div class="field">
        <label>Format: baris ganjil = Pertanyaan, baris genap = Jawaban</label>
        <textarea class="qa-textarea" placeholder="Q1: Pertanyaan pertama&#10;A1: Jawaban pertama&#10;Q2: Pertanyaan kedua&#10;A2: Jawaban kedua" rows="8"></textarea>
      </div>
    </div>`;
  list.appendChild(div);
}

function getQA() {
  const ta = document.querySelector('.qa-textarea');
  if (!ta || !ta.value.trim()) return [];
  const lines = ta.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = [];
  for (let i = 0; i < lines.length; i += 2) {
    const q = lines[i]   || '';
    const a = lines[i+1] || '';
    if (q || a) result.push({ pertanyaan: q, jawaban: a });
  }
  return result;
}

// ── Perubahan ─────────────────────────────────────────────────
function addPerubahan() {
  perubahanCount++;
  const id = perubahanCount;
  const div = document.createElement('div');
  div.className = 'perubahan-item'; div.id = 'per-'+id;
  div.innerHTML = `
    <div class="perubahan-header">
      <span class="qa-badge">Perubahan #${id}</span>
      <button class="btn-icon" onclick="document.getElementById('per-${id}').remove()">&#215;</button>
    </div>
    <div class="perubahan-body">
      <div class="field"><label>Sebelum</label>
        <textarea placeholder="Ketentuan sebelum perubahan..." rows="2"></textarea></div>
      <div class="field"><label>Sesudah</label>
        <textarea placeholder="Ketentuan sesudah perubahan..." rows="2"></textarea></div>
      <div class="form-row">
        <div class="field"><label>Diusulkan Oleh</label>
          <input type="text" placeholder="Nama / pihak yang mengusulkan"></div>
        <div class="field"><label>Pertimbangan</label>
          <input type="text" placeholder="Alasan / pertimbangan perubahan"></div>
      </div>
    </div>`;
  document.getElementById('perubahan-list').appendChild(div);
}
function getPerubahan() {
  return [...document.querySelectorAll('.perubahan-item')].map(item => ({
    sebelum:      item.querySelectorAll('textarea')[0].value.trim(),
    sesudah:      item.querySelectorAll('textarea')[1].value.trim(),
    diusulkan:    item.querySelectorAll('input')[0].value.trim(),
    pertimbangan: item.querySelectorAll('input')[1].value.trim()
  })).filter(p => p.sebelum || p.sesudah);
}

// ── Unit Kerja Pengguna (UKP) ────────────────────────────────
function addUKP() {
  ukpCount++;
  const id  = ukpCount;
  const div = document.createElement('div');
  div.className = 'ukp-item'; div.id = 'ukp-'+id;
  div.innerHTML = `
    <button class="btn-icon-remove" onclick="document.getElementById('ukp-${id}').remove()" title="Hapus">&#215;</button>
    <div class="form-row">
      <div class="field"><label>Jabatan Unit Kerja Pengguna</label>
        <input type="text" class="ukp-jabatan" placeholder="Jabatan"></div>
      <div class="field"><label>Nama</label>
        <input type="text" class="ukp-nama" placeholder="Nama"></div>
    </div>`;
  document.getElementById('ukp-list').appendChild(div);
}

function getUKP() {
  return [...document.querySelectorAll('.ukp-item')].map(item => ({
    jabatan: item.querySelector('.ukp-jabatan').value.trim(),
    nama:    item.querySelector('.ukp-nama').value.trim(),
  })).filter(u => u.nama || u.jabatan);
}

// ── Form Data ─────────────────────────────────────────────────
function getFormData() {
  const tv = document.getElementById('tanggal').value;
  const tanggal = tv
    ? new Date(tv+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})
    : '';
  // Format MMYYYY dari tanggal
  const mmyyyy = tv
    ? (() => { const d = new Date(tv+'T00:00:00');
               const mm = String(d.getMonth()+1).padStart(2,'0');
               const yyyy = d.getFullYear();
               return mm+yyyy; })()
    : '';
  const jv           = document.getElementById('jam').value;
  const nomorUrut    = document.getElementById('nomor_urut').value;
  const nomorPengadaan = document.getElementById('nomor_pengadaan').value.trim();
  // Format: BA-01/nomor_pengadaan/MMYYYY
  const nomorFull    = ['BA-' + nomorUrut, nomorPengadaan, mmyyyy].filter(Boolean).join('/');

  // Helper format tanggal
  function fmtTgl(id) {
    const v = document.getElementById(id) ? document.getElementById(id).value : '';
    if (!v) return '-';
    return new Date(v+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  }

  const isAan = currentType === 'aanwijzing';

  return {
    jenis:             currentType,
    nama_pekerjaan:    document.getElementById('nama_pekerjaan').value.trim(),
    nomor_urut:        nomorUrut,
    nomor_pengadaan:   nomorFull,
    hari:              document.getElementById('hari').value.trim(),
    tanggal,
    jam:               jv ? jv+' WIB' : '...',
    lokasi:            document.getElementById('lokasi').value.trim(),
    metode:            document.getElementById('metode_pengadaan').value,
    peserta:           getPeserta(),
    qa:                getQA(),
    perubahan:         getPerubahan(),
    // Jadwal aanwijzing
    jadwal_mulai:      fmtTgl('jadwal_mulai'),
    jadwal_akhir:      fmtTgl('jadwal_akhir'),
    jadwal_pembukaan:  fmtTgl('jadwal_pembukaan'),
    jadwal_lokasi_pembukaan: document.getElementById('jadwal_lokasi_pembukaan') ? document.getElementById('jadwal_lokasi_pembukaan').value.trim() : '',
    // TTD
    ukp:               isAan ? getUKP() : [],
    ukpng_deputi_jabatan: isAan && document.getElementById('ukpng_deputi_jabatan') ? document.getElementById('ukpng_deputi_jabatan').value.trim() : 'Deputi Bidang Pengadaan',
    ukpng_deputi_nama:    isAan && document.getElementById('ukpng_deputi_nama') ? document.getElementById('ukpng_deputi_nama').value.trim() : '',
    aan_pelaksana_nama:   isAan && document.getElementById('aan_pelaksana_nama') ? document.getElementById('aan_pelaksana_nama').value.trim() : '',
    pelaksana_nama:    document.getElementById('pelaksana_nama').value.trim(),
    pelaksana_jabatan: document.getElementById('pelaksana_jabatan').value.trim(),
  };
}

// ── Preview ───────────────────────────────────────────────────
function showPreview() {
  const data = getFormData();
  const body = document.getElementById('modal-body');
  body.innerHTML = '';
  body.appendChild(buildPreviewDOM(data));
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function buildPreviewDOM(data) {
  const isAan = data.jenis === 'aanwijzing';

  const pesertaNodes = data.peserta.map((nama, i) =>
    cloneTemplate('tmpl-peserta-item', {
      nomor: isAan ? `${i+1}.` : `1.2.${i+1}.`,
      nama
    })
  );

  if (!isAan) {
    return cloneTemplate('tmpl-pembukaan', {
      nama_pekerjaan:    data.nama_pekerjaan   || '...',
      nomor_pengadaan:   data.nomor_pengadaan  || '-',
      hari:              data.hari             || '...',
      tanggal:           data.tanggal          || '...',
      jam:               data.jam,
      lokasi:            data.lokasi           || '...',
      metode:            data.metode           || '...',
      jumlah_peserta:    formatJumlah(data.peserta.length),
      pelaksana_nama:    data.pelaksana_nama   || '...',
      pelaksana_jabatan: data.pelaksana_jabatan || '',
    }, { peserta: pesertaNodes });
  }

  // Aanwijzing — Q&A nodes
  const qaNodes = [];
  if (data.qa.length > 0) {
    const h = document.createElement('p');
    h.className = 'doc-section-title'; h.textContent = 'PERTANYAAN DAN JAWABAN';
    qaNodes.push(h);
    data.qa.forEach((qa, i) =>
      qaNodes.push(cloneTemplate('tmpl-qa-block', {
        nomor: String(i+1), pertanyaan: qa.pertanyaan||'-', jawaban: qa.jawaban||'-'
      }))
    );
  }

  // Aanwijzing — Perubahan nodes
  const perubahanNodes = [];
  if (data.perubahan.length > 0) {
    const rows = data.perubahan.map((p, i) =>
      cloneTemplate('tmpl-perubahan-row', {
        nomor: String(i+1), sebelum: p.sebelum||'-', sesudah: p.sesudah||'-',
        diusulkan: p.diusulkan||'-', pertimbangan: p.pertimbangan||'-'
      })
    );
    perubahanNodes.push(cloneTemplate('tmpl-perubahan-table', {}, { 'perubahan-rows': rows }));
  }

  return cloneTemplate('tmpl-aanwijzing', {
    nama_pekerjaan:    data.nama_pekerjaan   || '...',
    nomor_pengadaan:   data.nomor_pengadaan  || '-',
    hari:              data.hari             || '...',
    tanggal:           data.tanggal          || '...',
    jam:               data.jam,
    lokasi:            data.lokasi           || '...',
    metode:            data.metode           || '-',
    pelaksana_nama:    data.pelaksana_nama   || '...',
    pelaksana_jabatan: data.pelaksana_jabatan || '',
  }, { peserta: pesertaNodes, qa: qaNodes, perubahan: perubahanNodes });
}

// ── Generate Word ─────────────────────────────────────────────
function generateWord() {
  const data    = getFormData();
  const docNode = buildPreviewDOM(data);

  // Ambil styling preview dari style.css yang sudah ada
  const styles = [...document.styleSheets]
    .map(ss => { try { return [...ss.cssRules].map(r => r.cssText).join('\n'); } catch(e){ return ''; } })
    .join('\n');

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <style>${styles}</style>
    </head>
    <body style="margin:2.5cm 2cm 2cm 2.5cm">
      ${docNode.outerHTML}
    </body>
    </html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `BA_${(data.nomor_pengadaan || 'dokumen').replace(/\//g, '-')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
// ══════════════════════════════════════════════════════════════
// GENERATE PDF — pdfmake
// Setiap properti text/alignment/margin diatur di sini.
// Untuk mengubah konten teks paragraf, ubah string di bawah.
// ══════════════════════════════════════════════════════════════

function generatePDF() {
  const data  = getFormData();
  const isAan = data.jenis === 'aanwijzing';

  // ── Shorthand styles ──
  const J  = 'justify';   // alignment
  const C  = 'center';
  const L  = 'left';
  const f  = 11;          // font size normal
  const fH = 13;          // font size judul

  // ── Margin halaman: [kiri, atas, kanan, bawah] dalam pt (1 mm ≈ 2.835 pt) ──
  const margin = [70, 70, 56, 56]; // ~25mm kiri, 25mm atas, 20mm kanan, 20mm bawah

  // ── Helper: paragraph justify ──
  function para(text, opts = {}) {
    return { text, alignment: J, fontSize: f, margin: [0, 0, 0, 6], ...opts };
  }

  // ── Helper: teks bold inline ──
  function bold(text) { return { text, bold: true }; }

  // ── Helper: baris tabel info (label : nilai) ──
  function infoRow(label, val) {
    return [
      { text: label, border:[false,false,false,false] },
      { text: ':',   border:[false,false,false,false], width: 10 },
      { text: val,   border:[false,false,false,false] },
    ];
  }

  // ── Helper: item numbered list ──
  function listItem(label, content, marginLeft = 0, labelWidth = null) {
    const lw = labelWidth ?? (30 + (label.length > 3 ? 10 : 0));
    return {
      columns: [
        { text: label,   width: lw },
        { text: content, alignment: J, width: '*' }
      ],
      columnGap: 0,
      margin: [marginLeft, 0, 0, 4],
      fontSize: f,
    };
  }

  // ── TTD columns ──
  function ttdBlock(label, nama, jabatan) {
    return {
      stack: [
        { text: label, bold: true, alignment: C, fontSize: f },
        { text: '', margin: [0, 60, 0, 0] }, // ruang tanda tangan
        ,
        { text: nama,    bold: true, alignment: C, fontSize: f, margin:[0,4,0,0] },
        { text: jabatan, alignment: C, fontSize: f },
      ]
    };
  }

  // ══════════════════
  // KONTEN DOKUMEN
  // ══════════════════
  let content = [];

  if (!isAan) {
    // ────────────────────────────────────
    // BA PEMBUKAAN DOKUMEN PENAWARAN
    // ────────────────────────────────────

    // Header
    content.push(
      { text: 'BERITA ACARA PEMBUKAAN DOKUMEN PENAWARAN', style: 'judul' },
      { text: data.nama_pekerjaan || '', style: 'subjudul' },
      { text: `Nomor: ${data.nomor_pengadaan || ''}`, style: 'nomor' },
      
    );

    // Paragraf 1
    content.push(para([
      'Pada hari ini, ', bold(data.hari||'...'), ', tanggal ', bold(data.tanggal||'...'),
      ', pukul ', bold(data.jam), ', bertempat di ', bold(data.lokasi||'...'),
      ', telah dilaksanakan Pembukaan Dokumen Penawaran.'
    ]));

    // Paragraf 2
    content.push(para([
      'Bidang Pelaksanaan Pengadaan BPJS Ketenagakerjaan telah mengadakan kegiatan pemasukan dan pembukaan dokumen penawaran pekerjaan ',
      bold(data.nama_pekerjaan||'...'),
      ' yang diproses dengan metode ',
      bold(data.metode||'...'), '.'
    ]));

    // Numbered list
    const jmlStr = formatJumlah(data.peserta.length);

    content.push(listItem('1.', 'Pelaksanaan pemasukan dan pembukaan dokumen penawaran dihadiri oleh:',0,20));
    content.push(listItem('1.1.', 'Bidang Pelaksanaan Pengadaan', 20));
    content.push(listItem('1.2.',
      [{ text: `Calon penyedia yang menyampaikan dokumen penawaran pada aplikasi Pengadaan Barang/Jasa sebanyak ` },
       bold(jmlStr),
       { text: ` perusahaan, yaitu:` }],
      20
    ));

    // List peserta 1.2.x
    if (data.peserta.length === 0) {
      content.push(listItem('1.2.1.', '-', 60, 36));
    } else {
      data.peserta.forEach((p, i) => content.push(listItem(`1.2.${i+1}.`, p, 60, 36)));
    }

    content.push(listItem('1.3.',
      'Calon penyedia yang menghadiri kegiatan pemasukan dan pembukaan dokumen penawaran sebanyak ______________ perusahaan.',
      20
    ));
    content.push(listItem('1.4.', 'Daftar hadir sebagaimana terlampir.', 20));

    content.push({ text: '', margin:[0,4,0,0] }); // spacer

    content.push(listItem('2.',
      'Pembukaan dokumen penawaran dilakukan oleh personil Bidang Pelaksanaan Pengadaan dan wakil dari Calon Penyedia yang hadir sebagaimana dimaksud pada angka 1.3.',
      0,20
    ));
    content.push(listItem('3.',
      'Hasil pembukaan dokumen penawaran sebagaimana tertuang dalam lampiran Berita Acara ini.',
      0,20
    ));

  } else {
    // ────────────────────────────────────
    // BA AANWIJZING
    // ────────────────────────────────────

    // Header
    content.push(
      { text: 'BERITA ACARA AANWIJZING', style: 'judul' },
      { text: data.nama_pekerjaan || '', style: 'subjudul' },
      { text: `Nomor: ${data.nomor_pengadaan || ''}`, style: 'nomor' },
    );

    // Paragraf 1
    content.push(para([
      'Pada hari ini, ', bold(data.hari||'...'), ', tanggal ', bold(data.tanggal||'...'),
      ', pukul ', bold(data.jam), ', bertempat di ', bold(data.lokasi||'...'),
      ', telah dilaksanakan Rapat Penjelasan Pekerjaan (Aanwijzing).'
    ]));

    // Paragraf 2 — menggantikan tabel info
    content.push(para([
      'Bidang Pelaksanaan Pengadaan BPJS Ketenagakerjaan telah mengadakan kegiatan penjelasan pekerjaan (Aanwijzing) pekerjaan ',
      bold(data.nama_pekerjaan||'-'),
      ' yang diproses dengan metode ',
      bold(data.metode||'-'), '.'
    ]));

    // ── 1. Peserta ──
    const jmlPeserta = formatJumlah(data.peserta.length);
    content.push(listItem('1.', [
      { text: 'Peserta yang mendaftar sebanyak ' },
      bold(jmlPeserta),
      { text: ' perusahaan, yaitu:' }
    ], 0, 20));

    if (data.peserta.length === 0) {
      content.push(listItem('1.1.', '-', 20, 30));
    } else {
      data.peserta.forEach((p, i) => content.push(listItem(`1.${i+1}.`, p, 20, 30)));
    }

    content.push({ text: '', margin:[0,4,0,0] });

    // ── 2. Hasil Aanwijzing ──
    content.push(listItem('2.', 'Hasil aanwijzing:', 0, 20));
    content.push(listItem('2.1.', 'Jadwal pelaksanaan pengadaan:', 20, 30));

    // Tabel jadwal
    content.push({
      table: {
        headerRows: 1,
        widths: [20, '*', '*'],
        body: [
          [
            { text: 'No',      bold:true, alignment:C, fillColor:'#e8e8e8' },
            { text: 'Uraian',  bold:true, alignment:C, fillColor:'#e8e8e8' },
            { text: 'Jadwal',  bold:true, alignment:C, fillColor:'#e8e8e8' },
          ],
          [{ text:'1', alignment:C }, { text:'Tanggal Mulai Pemasukan Penawaran', alignment:J }, { text: data.jadwal_mulai||'-', alignment:J }],
          [{ text:'2', alignment:C }, { text:'Tanggal Akhir Pemasukan Penawaran', alignment:J }, { text: data.jadwal_akhir||'-', alignment:J }],
          [{ text:'3', alignment:C }, { text:'Tanggal dan Lokasi Pembukaan Dokumen Penawaran', alignment:J },
           { text: (data.jadwal_pembukaan||'-') + (data.jadwal_lokasi_pembukaan ? ', ' + data.jadwal_lokasi_pembukaan : ''), alignment:J }],
        ]
      },
      fontSize: f,
      margin: [40, 4, 0, 8],
    });

    content.push({ text: '', margin:[0,4,0,0] });

    // ── 2.2. Pertanyaan dan Jawaban ──
    content.push(listItem('2.2.', 'Pertanyaan dan Jawaban:', 20, 30));
    if (data.qa.length === 0) {
      content.push({ text: '-', fontSize: f, margin:[40,0,0,8] });
    } else {
      content.push({
        table: {
          headerRows: 1,
          widths: [20, '*', '*'],
          body: [
            [
              { text: 'No',         bold:true, alignment:C, fillColor:'#e8e8e8' },
              { text: 'Pertanyaan', bold:true, alignment:C, fillColor:'#e8e8e8' },
              { text: 'Jawaban',    bold:true, alignment:C, fillColor:'#e8e8e8' },
            ],
            ...data.qa.map((qa, i) => [
              { text: String(i+1), alignment: C },
              { text: qa.pertanyaan || '-', alignment: J },
              { text: qa.jawaban    || '-', alignment: J },
            ])
          ]
        },
        fontSize: f,
        margin: [40, 4, 0, 8],
      });
    }

    content.push({ text: '', margin:[0,4,0,0] });

    // ── 2.3. Perubahan Dokumen RKS ──
    content.push(listItem('2.3.', 'Perubahan Dokumen RKS:', 20, 30));
    if (data.perubahan.length === 0) {
      content.push({ text: '-', fontSize: f, margin:[40,0,0,8] });
    } else {
      // Setiap perubahan = 4 baris: Sebelum, Sesudah, Diusulkan Oleh, Pertimbangan
      const perubahanRows = [
        [
          { text: 'No',        bold:true, alignment:C, fillColor:'#e8e8e8' },
          { text: 'Uraian',    bold:true, alignment:C, fillColor:'#e8e8e8' },
          { text: 'Keterangan',bold:true, alignment:C, fillColor:'#e8e8e8' },
        ]
      ];
      data.perubahan.forEach((p, i) => {
        const no = String(i + 1);
        const rows = [
          ['Sebelum',       p.sebelum      || '-'],
          ['Sesudah',       p.sesudah      || '-'],
          ['Diusulkan Oleh',p.diusulkan    || '-'],
          ['Pertimbangan',  p.pertimbangan || '-'],
        ];
        rows.forEach(([uraian, ket], j) => {
          perubahanRows.push([
            { text: j === 0 ? no : '', alignment: C },
            { text: uraian, alignment: L },
            { text: ket,    alignment: J },
          ]);
        });
      });
      content.push({
        table: {
          headerRows: 1,
          widths: [20, 120, '*'],
          body: perubahanRows,
        },
        fontSize: f,
        margin: [40, 4, 0, 8],
      });
    }

    content.push({ text: '', margin:[0,4,0,0] });

    // ── 3. Daftar hadir ──
    content.push(listItem('3.', 'Daftar hadir aanwijzing terlampir.', 0, 20));
  }

  // ── Penutup + Tanda Tangan (gabung, pindah halaman hanya jika perlu) ──

  if (!isAan) {
    // ── Penutup Pembukaan ──
    content.push({
      unbreakable: true,
      id: 'blok-penutup',
      stack: [
        para(
          'Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.',
          { margin: [0, 12, 0, 0] }
        ),
        {
          columns: [
            ttdBlock('Mengetahui,', 'Jessica Puspadayasari', 'Asdep Pelaksanaan Pengadaan'),
            ttdBlock('Yang Membuat,', data.pelaksana_nama || '...', 'Penata Pelaksana Pengadaan'),
          ],
          columnGap: 20,
          margin: [0, 30, 0, 0],
        }
      ]
    });

  } else {
    // ── Penutup Aanwijzing ──
    content.push({
      unbreakable: true,
      id: 'blok-penutup',
      stack: [
        para([
          'Berita Acara ini merupakan bagian dan menjadi satu kesatuan yang tidak terpisahkan dengan RKS. ',
          'Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.'
        ], { margin: [0, 12, 0, 0] }),

        // TTD Aanwijzing: 2 kolom
        // Kiri: Unit Kerja Pengguna (bisa lebih dari 1)
        // Kanan: Unit Kerja Pengadaan (Deputi + Jessica + Pelaksana)
        {
          columns: [
            // ── Kiri: UKP ──
            {
              stack: [
                { text: 'Unit Kerja Pengguna,', bold: true, alignment: C, fontSize: f },
                ...(data.ukp.length === 0 ? [
                  { text: '', margin: [0, 60, 0, 0] },
                  { text: '...', bold: true, alignment: C, fontSize: f, margin:[0,4,0,0] },
                  { text: '...', alignment: C, fontSize: f },
                ] : data.ukp.map((u, i) => ({
                  stack: [
                    { text: u.jabatan || '', alignment: C, fontSize: f, margin:[0, i===0?8:16, 0, 0] },
                    { text: '', margin: [0, 50, 0, 0] },
                    { text: u.nama || '...', bold: true, alignment: C, fontSize: f, margin:[0,4,0,0] },
                  ]
                })))
              ]
            },
            // ── Kanan: UKPng ──
            {
              stack: [
                { text: 'Unit Kerja Pengadaan,', bold: true, alignment: C, fontSize: f },
                { text: 'Asdep Pelaksanaan Pengadaan,', alignment: C, fontSize: f, margin:[0,8,0,0] },
                { text: '', margin: [0, 45, 0, 0] },
                { text: 'Jessica Puspadayasari', bold: true, alignment: C, fontSize: f, margin:[0,4,0,0] },
                { text: '', margin: [0, 20, 0, 0] },
                { text: 'Penata Pelaksana Pengadaan,', alignment: C, fontSize: f, margin:[0,8,0,0] },
                { text: '', margin: [0, 45, 0, 0] },
                { text: data.aan_pelaksana_nama || '...', bold: true, alignment: C, fontSize: f, margin:[0,4,0,0] },
              ]
            }
          ],
          columnGap: 20,
          margin: [0, 20, 0, 0],
        }
      ]
    });
  }

  // ══════════════════
  // DEFINISI DOKUMEN
  // ══════════════════
  const docDefinition = {
    pageSize:    'A4',
    pageMargins: margin,



    // ── Style ──
    defaultStyle: {
      font:     'Roboto',
      fontSize: f,
      lineHeight: 1.4,
    },

    styles: {
      judul: {
        fontSize:  fH,
        bold:      true,
        alignment: C,
        
        margin:    [0, 0, 0, 6],
      },
      subjudul: {
        fontSize:  fH,
        bold:      true,
        alignment: C,
        margin:    [0, 0, 0, 4],
      },
      nomor: {
        fontSize:  f,
        alignment: C,
        margin:    [0, 0, 0, 14],
      },
    },

    content,

    // ── Footer: nomor halaman ──
    footer: (currentPage, pageCount) => ({
      text: `Halaman ${currentPage} dari ${pageCount}`,
      alignment: C,
      fontSize: 9,
      margin: [0, 10, 0, 0],
    }),
  };

  const filename = isAan ? 'BA_Aanwijzing' : 'BA_Pembukaan_Dokumen';
  const nomor    = (data.nomor_pengadaan || 'dokumen').replace(/\//g, '-');
  pdfMake.createPdf(docDefinition).download(`${filename}_${nomor}.pdf`);
}