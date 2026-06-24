// Build an Error the global handler sends to the client verbatim
// (status code + machine-readable code + message). Use it for EXPECTED,
// client-facing failures; unexpected errors stay generic 500s.
export function httpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.expose = true;
  return err;
}
