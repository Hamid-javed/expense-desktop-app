"use client";

import { FRIENDLY_OFFLINE_MESSAGE } from "../lib/db/connectionError.js";

export default function Error({ error, reset }) {
  const isOffline =
    error?.message === FRIENDLY_OFFLINE_MESSAGE ||
    (error?.message && error.message.includes("No internet connection"));

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-slate-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-medium">
          {isOffline ? error.message : "Something went wrong."}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {isOffline
            ? "Connect to the internet and try again."
            : "You can try again."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
