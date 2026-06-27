/** 深拷贝可 JSON 序列化的纯数据（兼容 Vue reactive proxy） */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
