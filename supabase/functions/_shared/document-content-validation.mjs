// Bounded signature screening, not an antivirus or an archive/macro scanner.
export const CONTENT_PREFIX_BYTES = 4096;

export function validateDocumentContent(name, mime, bytes) {
  const prefix = bytes.subarray(0, CONTENT_PREFIX_BYTES);
  if (!prefix.length) throw new Error('File kosong tidak dapat disimpan.');
  const starts = (...values) => values.every((value, i) => prefix[i] === value);
  const ascii = new TextDecoder().decode(prefix);
  const extension = String(name).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  const mediaType = String(mime).toLowerCase().split(';')[0].trim();
  if (/^(exe|msi|apk|bat|cmd|com|scr|ps1|vbs|js|mjs|cjs|jar|sh|php|py|rb|pl|cgi|dll|html?|svgz?|wasm)$/.test(extension) ||
      /^(text\/html|image\/svg\+xml|application\/(xhtml\+xml|javascript|wasm|x-msdownload|x-msdos-program|x-sh|x-executable))$/.test(mediaType) ||
      starts(0x4d, 0x5a) || starts(0x7f, 0x45, 0x4c, 0x46) || starts(0, 0x61, 0x73, 0x6d) ||
      starts(0xcf, 0xfa, 0xed, 0xfe) || starts(0xfe, 0xed, 0xfa, 0xcf) ||
      starts(0xce, 0xfa, 0xed, 0xfe) || starts(0xfe, 0xed, 0xfa, 0xce) ||
      /^\s*(?:#!|<\?php|<!doctype\s+html|<html\b|<script\b|<svg\b)/i.test(ascii) ||
      /^\s*<\?xml[\s\S]*?<svg\b/i.test(ascii)) {
    throw new Error('Isi file berupa program atau konten web aktif yang tidak diizinkan.');
  }
  const signatures = {
    pdf: ascii.startsWith('%PDF-'),
    png: starts(137, 80, 78, 71, 13, 10, 26, 10),
    jpeg: starts(255, 216, 255),
    gif: ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a'),
    webp: ascii.startsWith('RIFF') && new TextDecoder().decode(prefix.subarray(8, 12)) === 'WEBP',
    zip: starts(80, 75, 3, 4),
    ole: starts(208, 207, 17, 224, 161, 177, 26, 225),
    rtf: ascii.startsWith('{\\rtf')
  };
  const formats = { pdf: 'pdf', png: 'png', jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif', webp: 'webp',
    docx: 'zip', xlsx: 'zip', pptx: 'zip', odt: 'zip', ods: 'zip', odp: 'zip',
    doc: 'ole', xls: 'ole', ppt: 'ole', rtf: 'rtf' };
  const mimeFormats = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpeg',
    'image/gif': 'gif', 'image/webp': 'webp', 'application/rtf': 'rtf' };
  for (const format of [formats[extension], mimeFormats[mediaType]]) {
    if (format && !signatures[format]) throw new Error('Isi file tidak sesuai dengan format dokumen yang dipilih.');
  }
}

export async function readDocumentPrefix(url, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let reader;
  try {
    const response = await fetcher(url, { headers: { Range: 'bytes=0-' + (CONTENT_PREFIX_BYTES - 1) }, signal: controller.signal });
    if (!response.ok || !response.body) throw new Error('Isi file belum dapat diperiksa. Silakan coba lagi.');
    reader = response.body.getReader();
    const prefix = new Uint8Array(CONTENT_PREFIX_BYTES);
    let size = 0;
    while (size < prefix.length) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, prefix.length - size);
      prefix.set(part, size);
      size += part.length;
    }
    return prefix.subarray(0, size);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) await reader.cancel().catch(() => {});
  }
}
