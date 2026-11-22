"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { startSingleTabLease } from "../lib/singleTabLease";

type Status = "checking" | "active" | "blocked" | "unsupported";

/** Mounted before MusicProvider, DialogProvider, and the application page. */
export function SingleTabGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [attempt, setAttempt] = useState(0);
  const { locale } = useLanguage();

  useEffect(() => {
    let release = () => {};
    // Defer one task so React Strict Mode's immediate effect cleanup cannot
    // briefly deny this same tab its own lock during development.
    const timer = window.setTimeout(() => {
      const manager = typeof navigator === "undefined" ? undefined : navigator.locks;
      release = startSingleTabLease(manager, setStatus);
    }, 0);
    const onPageHide = () => {
      window.clearTimeout(timer);
      release();
      setStatus("checking");
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // A page restored from the back/forward cache has released its lock.
      // It must acquire a fresh lock BEFORE restoring the real application.
      if (event.persisted) {
        setStatus("checking");
        setAttempt(value => value + 1);
      }
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearTimeout(timer);
      release();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [attempt]);

  if (status === "active") return <>{children}</>;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0b1728] px-5 py-10 text-slate-100">
      <section role={status === "blocked" ? "alert" : "status"}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#14243a] p-7 text-center shadow-2xl sm:p-9">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[#c1d4eb]">
          <LockKeyhole size={28} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold tracking-wide text-white">
          {deepText(locale, status === "checking" ? "cloud.singleTab.checking"
            : status === "blocked" ? "cloud.singleTab.blocked" : "cloud.singleTab.unsupported")}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          {deepText(locale, status === "checking" ? "cloud.singleTab.wait"
            : status === "blocked" ? "cloud.singleTab.description" : "cloud.singleTab.browser")}
        </p>
        {status === "blocked" && (
          <button type="button" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#c7dfcf] px-5 py-2.5 text-sm font-semibold text-[#183e33] hover:bg-[#e0f3e6]"
            onClick={() => { setStatus("checking"); setAttempt(value => value + 1); }}>
            <RefreshCw size={15} aria-hidden="true"/>
            {deepText(locale, "cloud.singleTab.retry")}
          </button>
        )}
      </section>
    </main>
  );
}
