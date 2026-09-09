/** CSS `cm` is 96/2.54 px; 4cm prints/displays at that size in the browser. */
export const QR_SIDE_CM = 4;
export const QR_SIDE_PX = Math.round((96 / 2.54) * QR_SIDE_CM);
const QR_SOURCE_PX = 472;

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
