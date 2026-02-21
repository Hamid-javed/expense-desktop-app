/**
 * Detect network/connection errors (MongoDB SRV timeout, DNS, etc.)
 * so we can show a user-friendly message instead of hostnames/ETIMEOUT.
 */
export function isNetworkConnectionError(err) {
  if (!err) return false;
  const code = err.code;
  const syscall = err.syscall;
  const msg = (err.message || "").toLowerCase();
  if (
    code === "ETIMEOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    syscall === "querySrv" ||
    syscall === "getaddrinfo" ||
    /querySrv|ETIMEOUT|ENOTFOUND|ECONNREFUSED|getaddrinfo|network/i.test(msg)
  ) {
    return true;
  }
  return false;
}

export const FRIENDLY_OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again.";

/** True if err is our friendly offline message or a raw network/connection error. */
export function isOfflineError(err) {
  if (!err) return false;
  const msg = typeof err === "object" && err !== null ? err.message : String(err);
  return (
    msg === FRIENDLY_OFFLINE_MESSAGE ||
    (typeof msg === "string" && msg.includes("No internet connection")) ||
    isNetworkConnectionError(err)
  );
}

/** Safe to call with any value; never throws. */
export function getFriendlyConnectionMessage(err) {
  try {
    if (!err) return "An error occurred.";
    if (isNetworkConnectionError(err)) return FRIENDLY_OFFLINE_MESSAGE;
    const msg = typeof err === "object" && err !== null ? err.message : String(err);
    return msg && typeof msg === "string" ? msg : "An error occurred.";
  } catch {
    return "An error occurred.";
  }
}
