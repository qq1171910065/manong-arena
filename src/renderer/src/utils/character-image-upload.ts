import { imageSpecForSlot, validateImageDimensions, type CharacterImageSlot } from '@shared/arena/character-visuals'

export async function readImageFileWithValidation(
  file: File,
  slot: CharacterImageSlot
): Promise<{ ok: true; dataUrl: string; width: number; height: number } | { ok: false; message: string }> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, message: '请选择 PNG / JPG / WebP 图片文件。' }
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, message: '图片不能超过 8MB。' }
  }

  const dataUrl = await readFileAsDataUrl(file)
  const { width, height } = await loadImageSize(dataUrl)
  const validation = validateImageDimensions(width, height, slot)
  if (!validation.ok) return validation
  return { ok: true, dataUrl, width, height }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('无法解析图片尺寸'))
    img.src = src
  })
}

export function specHint(slot: CharacterImageSlot): string {
  return imageSpecForSlot(slot).hint
}
