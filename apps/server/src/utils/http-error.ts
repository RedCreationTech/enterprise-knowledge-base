/**
 * 抛出一个携带 HTTP 状态码（及可选领域错误码）的错误。
 * error-handler 读取 `statusCode` 映射 HTTP 语义，读取 `domainCode` 覆盖信封 error.code。
 */
export function httpError(statusCode: number, message: string, domainCode?: string): Error {
  const err = new Error(message) as Error & { statusCode: number; domainCode?: string }
  err.statusCode = statusCode
  if (domainCode) err.domainCode = domainCode
  return err
}
