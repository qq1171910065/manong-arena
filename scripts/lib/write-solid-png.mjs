import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { deflateSync } from 'node:zlib'

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const combined = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(combined))
  return Buffer.concat([len, combined, crc])
}

/** Write a flat RGB PNG (no alpha) */
export function writeSolidPng(filePath, width, height, r, g, b) {
  mkdirSync(dirname(filePath), { recursive: true })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const row = Buffer.alloc(1 + width * 3)
  row[0] = 0
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 3
    row[offset] = r
    row[offset + 1] = g
    row[offset + 2] = b
  }
  const raw = Buffer.alloc((1 + width * 3) * height)
  for (let y = 0; y < height; y += 1) {
    row.copy(raw, y * row.length)
  }

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(filePath, png)
}
