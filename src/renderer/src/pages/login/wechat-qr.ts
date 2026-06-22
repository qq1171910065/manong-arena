/** 按需加载 qrcode（仅 wechatOAuth 启用时由 LoginPage 动态 import 本模块） */
export async function toWechatLoginQrDataUrl(authorizeUrl: string): Promise<string> {
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(authorizeUrl, { width: 220, margin: 1 })
}
