/** CSS `cm` is 96/2.54 px; 4cm prints/displays at that size in the browser. */
export const QR_SIDE_CM = 4;
export const QR_SIDE_PX = Math.round((96 / 2.54) * QR_SIDE_CM);
const QR_SOURCE_PX = 472;

/** A4 portrait: 4 columns along the short side × 6 rows = 24 per sheet. */
export const QR_SHEET_COLS = 4;
export const QR_SHEET_ROWS = 6;
export const QR_SHEET_CAPACITY = QR_SHEET_COLS * QR_SHEET_ROWS;

export const qrCodeUrl = (data: string, sizePx = QR_SOURCE_PX) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&margin=0&data=${encodeURIComponent(data)}`;

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, char => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
    ));

export const openQrImageTab = (data: string, name: string) => {
    const src = qrCodeUrl(data);
    const title = escapeHtml(name);
    const tab = window.open('', '_blank');
    if (!tab) {
        window.open(src, '_blank', 'noopener,noreferrer');
        return;
    }
    tab.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title} QR</title>
<style>
  @page { size: ${QR_SIDE_CM}cm ${QR_SIDE_CM}cm; margin: 0; }
  html, body {
    margin: 0;
    background: #fff;
    min-height: 100%;
    display: grid;
    place-items: center;
  }
  img {
    width: ${QR_SIDE_CM}cm;
    height: ${QR_SIDE_CM}cm;
  }
</style>
</head>
<body>
  <img src="${src}" alt="${title} QR" width="${QR_SOURCE_PX}" height="${QR_SOURCE_PX}" />
</body>
</html>`);
    tab.document.close();
};

export type QrSheetMember = { name: string; endpoint: string };

export const openMemberQrSheet = (members: QrSheetMember[]) => {
    if (!members.length) return;

    const pages: QrSheetMember[][] = [];
    for (let i = 0; i < members.length; i += QR_SHEET_CAPACITY) {
        pages.push(members.slice(i, i + QR_SHEET_CAPACITY));
    }

    const pagesHtml = pages.map(pageMembers => {
        const cells = pageMembers.map(member => {
            const title = escapeHtml(member.name);
            const src = qrCodeUrl(member.endpoint, 300);
            return `<div class="cell">
  <img src="${src}" alt="${title} QR" width="300" height="300" />
  <span class="label">${title}</span>
</div>`;
        }).join('\n');
        return `<section class="page">${cells}</section>`;
    }).join('\n');

    const tab = window.open('', '_blank');
    if (!tab) return;

    tab.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Member QR Codes</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .page {
    width: 194mm;
    height: 281mm;
    display: grid;
    grid-template-columns: repeat(${QR_SHEET_COLS}, 1fr);
    grid-template-rows: repeat(${QR_SHEET_ROWS}, 1fr);
    page-break-after: always;
    break-after: page;
  }
  .page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    padding: 2mm;
    overflow: hidden;
  }
  .cell img {
    width: 36mm;
    height: 36mm;
    object-fit: contain;
  }
  .label {
    font-size: 8pt;
    line-height: 1.15;
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  @media screen {
    body { padding: 12px; background: #e8e8e8; }
    .page {
      background: #fff;
      margin: 0 auto 16px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.15);
    }
  }
</style>
</head>
<body>
${pagesHtml}
<script>
  const imgs = Array.from(document.images);
  const done = () => { window.focus(); window.print(); };
  if (!imgs.length) done();
  else {
    let left = imgs.length;
    const tick = () => { if (--left <= 0) done(); };
    imgs.forEach(img => {
      if (img.complete) tick();
      else {
        img.addEventListener('load', tick);
        img.addEventListener('error', tick);
      }
    });
  }
</script>
</body>
</html>`);
    tab.document.close();
};
