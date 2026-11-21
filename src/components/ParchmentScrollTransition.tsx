"use client";

import { motion } from "framer-motion";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";

/**
 * TELA mode transition: a parchment scroll opens from a narrow rolled sheet,
 * holds the title, and rolls back up. This is a CSS-only overlay so the Local
 * edition does not depend on downloaded assets or external imagery.
 */
export function ParchmentScrollTransition({ compact = false }: { compact?: boolean }) {
  const { locale } = useLanguage();
  const duration = compact ? 2.35 : 2.8;
  return (
    <motion.div role="presentation" aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#251a14]/75"
      initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration, times: [0, 0.13, 0.86, 1], ease: "easeInOut" }}>
      <motion.div className="relative flex h-[min(62vh,390px)] w-[min(86vw,760px)] items-stretch justify-center"
        initial={{ scaleX: 0.03 }} animate={{ scaleX: [0.03, 1, 1, 0.03] }}
        transition={{ duration, times: [0, 0.3, 0.7, 1], ease: [0.22, 1, 0.36, 1] }}>
        <div className="absolute inset-0 overflow-hidden rounded-sm border-y-[8px] border-[#b38c57] bg-[#ead2a2] shadow-[0_26px_75px_rgba(0,0,0,.55),inset_0_0_90px_rgba(109,68,27,.3)]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,rgba(117,79,37,.035) 0px,rgba(117,79,37,.035) 2px,transparent 2px,transparent 7px),radial-gradient(ellipse at center,#fff1cb 0%,#eed3a2 68%,#cba874 100%)" }}/>
        <div className="absolute inset-y-[-4%] left-[-8px] w-[20px] rounded-full border border-[#704b29] bg-gradient-to-r from-[#5a361d] via-[#ba9052] to-[#734421] shadow-[5px_0_13px_rgba(49,28,15,.48)]"/>
        <div className="absolute inset-y-[-4%] right-[-8px] w-[20px] rounded-full border border-[#704b29] bg-gradient-to-r from-[#63391f] via-[#d1a46a] to-[#5c321c] shadow-[-5px_0_13px_rgba(49,28,15,.48)]"/>
        <motion.div className="relative z-10 m-auto px-5 text-center font-serif text-[#6a4930]"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.9, 0.9, 1, 1, 0.96] }}
          transition={{ duration, times: [0, 0.23, 0.38, 0.7, 1] }}>
          <div className="mx-auto mb-5 h-px w-36 bg-gradient-to-r from-transparent via-[#9c7347] to-transparent"/>
          <p className="text-[10px] font-semibold tracking-[.45em] opacity-80">SHIORIVIA · NOVEL STUDIO</p>
          <p className={compact ? "mt-4 text-3xl tracking-[.2em]" : "mt-4 text-5xl tracking-[.25em]"}>TELA</p>
          <p className="mt-3 text-sm tracking-[.22em]">{deepText(locale, "tela.transition.subtitle")}</p>
          <div className="mx-auto mt-5 h-px w-36 bg-gradient-to-r from-transparent via-[#9c7347] to-transparent"/>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
