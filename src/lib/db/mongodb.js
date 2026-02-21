import mongoose from "mongoose";
import {
  isNetworkConnectionError,
  FRIENDLY_OFFLINE_MESSAGE,
} from "./connectionError.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/expense_app";

let cached = global._mongooseConnection;

if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null };
}

export async function connectMongoDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
      })
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    if (isNetworkConnectionError(err)) {
      cached.promise = null;
      throw new Error(FRIENDLY_OFFLINE_MESSAGE);
    }
    throw err;
  }
}

export function disconnectMongoDB() {
  if (cached.conn) {
    mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
