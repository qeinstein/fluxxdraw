/**
 * Read/write a PNG `tEXt` chunk so exported PNGs carry their own scene JSON.
 * This is what makes a flat image re-openable and editable later.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const METADATA_KEYWORD = "excalidraw";

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const isPng = (bytes: Uint8Array) =>
  PNG_SIGNATURE.every((b, i) => bytes[i] === b);

/** Builds a PNG chunk: length, type, data, CRC. */
const buildChunk = (type: string, data: Uint8Array) => {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  view.setUint32(8 + data.length, crc32(crcInput));
  return chunk;
};

/**
 * Returns a new PNG blob with `text` stored under `keyword`. The chunk is
 * inserted right after IHDR, which every decoder tolerates.
 */
export const encodePngMetadata = async (
  blob: Blob,
  text: string,
  keyword = METADATA_KEYWORD,
): Promise<Blob> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(bytes)) return blob;

  // IHDR is always the first chunk: 8-byte signature + 4 length + 4 type + 13 data + 4 crc
  const insertAt = 8 + 4 + 4 + 13 + 4;

  const encoder = new TextEncoder();
  const keywordBytes = encoder.encode(keyword);
  const textBytes = encoder.encode(text);
  const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  data.set(keywordBytes, 0);
  data[keywordBytes.length] = 0; // null separator
  data.set(textBytes, keywordBytes.length + 1);

  const chunk = buildChunk("tEXt", data);
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(bytes.subarray(insertAt), insertAt + chunk.length);
  return new Blob([out], { type: "image/png" });
};

/** Extracts previously embedded text, or null if the PNG carries none. */
export const decodePngMetadata = async (
  blob: Blob,
  keyword = METADATA_KEYWORD,
): Promise<string | null> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(bytes)) return null;
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
    if (type === "IEND") break;
    if (type === "tEXt") {
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      const sep = data.indexOf(0);
      if (sep !== -1 && decoder.decode(data.subarray(0, sep)) === keyword) {
        return decoder.decode(data.subarray(sep + 1));
      }
    }
    offset += 12 + length;
  }
  return null;
};
