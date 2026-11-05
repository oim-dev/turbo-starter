/**
 * Преобразует pathname старой страницы управления в канонический адрес.
 * Проверка допустимости полного URL остаётся ответственностью getSafeReturnTo.
 */
export const getCanonicalManagementPath = (pathname: string): string => {
  if (/^\/access\/?$/i.test(pathname)) return '/management/users'
  if (/^\/settings\/keycloak\/?$/i.test(pathname)) return '/management/keycloak'
  return pathname.replace(
    /^\/access\/(users|roles|permissions)(?=\/|$)/i,
    (_match, section: string) => `/management/${section.toLowerCase()}`
  )
}
