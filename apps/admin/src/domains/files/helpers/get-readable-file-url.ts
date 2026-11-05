/**
 * Делает имя в копируемой ссылке читаемым, сохраняя смысл URL и параметры версии.
 * Процент и разделители остаются закодированными, чтобы не декодировать имя дважды.
 */
export const getReadableFileUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    const pathname = decodeURIComponent(parsed.pathname.replace(
      /%(?:25|23|3f|2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/gi,
      (encoded) => `%25${encoded.slice(1)}`
    ))
    const readable = `${parsed.origin}${pathname}${parsed.search}${parsed.hash}`
    // Например, завершающий пробел браузер удаляет при разборе строки URL.
    const restored = new URL(readable)
    const isEquivalent = restored.origin === parsed.origin
      && decodeURIComponent(restored.pathname) === decodeURIComponent(parsed.pathname)
      && restored.search === parsed.search
      && restored.hash === parsed.hash
    return isEquivalent ? readable : url
  } catch {
    return url
  }
}
