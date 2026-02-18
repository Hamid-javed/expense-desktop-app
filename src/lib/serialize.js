/**
 * Convert a value to a plain serializable form for Client Components.
 * Handles MongoDB ObjectIds and nested objects.
 */
function toPlainValue(val) {
  if (val == null) return val;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && typeof val?.toHexString === "function") return val.toString();
  if (Array.isArray(val)) return val.map(toPlainValue);
  if (typeof val === "object") {
    const out = {};
    for (const k of Object.keys(val)) {
      if (k === "__v") continue;
      out[k] = toPlainValue(val[k]);
    }
    return out;
  }
  return val;
}

/**
 * Serialize a Mongoose lean() result for passing to Client Components.
 * Converts ObjectIds and other non-plain values to strings/plain objects.
 */
export function serializeForClient(doc) {
  if (doc == null) return doc;
  if (Array.isArray(doc)) return doc.map(serializeForClient);
  return toPlainValue(doc);
}
