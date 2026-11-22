"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen, Bug, Globe2, Image as ImageIcon, LockKeyhole, Mic, Music2,
  Settings2, Sparkles, X,
} from "lucide-react";
import type { PublicLocalProvider } from "../lib/localProviders";
import type { ImageSettings, ProviderCapability } from "../lib/imageSettings";
import type { WebToolConfig } from "../lib/webToolSettings";
import { capabilityFor } from "../lib/imageSettings";
import type { CloudCredentials, CloudCredential } from "../lib/cloudCredentials";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { useAppDialog } from "../context/DialogContext";
import { LANGUAGE_OPTIONS, type Locale } from "../lib/locale";
import { CONTEXT_WINDOW_OPTIONS, type ContextWindowTokens } from "../lib/contextWindow";



export type SettingKey = "webSearch" | "imageGen" | "tts" | "musicControl";
export type StoryTheme = "sky" | "sage" | "rose";

type Props = {
  open: boolean;
  onClose: () => void;
  values: Record<SettingKey, boolean>;
  onToggle: (key: SettingKey) => void;
  debugMode: boolean;
  onToggleDebug: () => void;
  debugDrawTagsEnabled: boolean;
  onToggleDebugDrawTags: () => void;
  danmakuEnabled: boolean;
  onToggleDanmaku: () => void;
  danmakuCount: number;
  onDanmakuCountChange: (count: number) => void;
  terminalRequestLogEnabled: boolean;
  onToggleTerminalRequestLog: () => void;
  terminalLogEnabled: boolean;
  onToggleTerminalLog: () => void;
  engineeringTransitionEnabled: boolean;
  onToggleEngineeringTransition: () => void;
  curtainTransitionEnabled: boolean;
  onToggleCurtainTransition: () => void;
  geminiNarrativeStyleEnabled: boolean;
  onToggleGeminiNarrativeStyle: () => void;
  engineeringLoreRelationshipsEnabled: boolean;
  engineeringLoreExperiencesEnabled: boolean;
  onToggleEngineeringLoreRelationships: () => void;
  onToggleEngineeringLoreExperiences: () => void;
  onTestEffect: (name: "rain" | "curtain" | "parchment" | "math" | "glitch") => void;
  isStory: boolean;
  activeMode: "infinite" | "sliding" | "novel" | "chat" | "lime" | "hub";
  contextWindowTokens: ContextWindowTokens;
  onContextWindowChange: (value: ContextWindowTokens) => void;
  storyTheme: StoryTheme;
  onStoryThemeChange: (value: StoryTheme) => void;
  activeProvider: string;
  providers: PublicLocalProvider[];
  disabledProviders: string[];
  onToggleProvider: (id: string) => void;
  autoSync: boolean;
  autoSyncInterval: 3 | 4 | 5;
  onAutoSyncChange: (enabled: boolean) => void;
  onAutoSyncIntervalChange: (turns: 3 | 4 | 5) => void;
  webToolConfig: WebToolConfig;
  onWebToolConfigChange: (changes: Partial<WebToolConfig>) => void;
  providerAliases: Record<string, string>;
  onProviderAliasChange: (id: string, label: string) => void;
  imageSettings: ImageSettings;
  onImageSettingsChange: (changes: Partial<ImageSettings>) => void;
  providerCapabilities: Record<string, ProviderCapability>;
  onProviderCapabilitiesChange: (id: string, changes: Partial<ProviderCapability>) => void;
  falConfigured: boolean;
  cloudCredentials: CloudCredentials;
  onCloudCredentialChange: (id:string, next:CloudCredential) => Promise<void>;
  credentialVaultStatus: "loading" | "setup" | "migrate" | "locked" | "unlocked" | "error";
  credentialVaultBusy: boolean;
  credentialVaultError: string;
  onCredentialVaultSubmit: (passphrase: string, confirmation: string) => Promise<boolean>;
  onCredentialVaultLock: () => Promise<void>;
  onCredentialVaultReset: () => Promise<void>;
};

type Tab = "general" | "ai" | "media" | "developer";

const tabs = [
  { id: "general", labelKey: "settings.general", icon: Settings2 },
  { id: "ai", labelKey: "settings.ai", icon: Globe2 },
  { id: "media", labelKey: "settings.media", icon: Music2 },
  { id: "developer", labelKey: "settings.developer", icon: Bug },
] as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="h-px w-5 bg-[#91a79c]" />
      <h3 className="shrink-0 text-xs font-bold tracking-widest text-[#3d6657]">{children}</h3>
      <div className="h-px flex-1 bg-[#dce5df]" />
    </div>
  );
}

function SwitchRow({ title, description, checked, onClick, icon: Icon }: {
  title: string;
  description: string;
  checked: boolean;
  onClick: () => void;
  icon: typeof Music2;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-4 last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon size={17} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#5c927b]" : "bg-slate-200"}`}>
        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export function SettingsCenter({ open, onClose, values, onToggle, debugMode, onToggleDebug, debugDrawTagsEnabled, onToggleDebugDrawTags, danmakuEnabled, onToggleDanmaku, danmakuCount, onDanmakuCountChange, terminalRequestLogEnabled, onToggleTerminalRequestLog, terminalLogEnabled, onToggleTerminalLog, engineeringTransitionEnabled, onToggleEngineeringTransition, curtainTransitionEnabled, onToggleCurtainTransition, geminiNarrativeStyleEnabled, onToggleGeminiNarrativeStyle, engineeringLoreRelationshipsEnabled, engineeringLoreExperiencesEnabled, onToggleEngineeringLoreRelationships, onToggleEngineeringLoreExperiences, onTestEffect, isStory, activeMode, contextWindowTokens, onContextWindowChange, storyTheme, onStoryThemeChange, activeProvider, providers, disabledProviders, onToggleProvider, autoSync, autoSyncInterval, onAutoSyncChange, onAutoSyncIntervalChange, webToolConfig, onWebToolConfigChange, providerAliases, onProviderAliasChange, imageSettings, onImageSettingsChange, providerCapabilities, onProviderCapabilitiesChange, falConfigured, cloudCredentials, onCloudCredentialChange, credentialVaultStatus, credentialVaultBusy, credentialVaultError, onCredentialVaultSubmit, onCredentialVaultLock, onCredentialVaultReset }: Props) {
  const dialog = useAppDialog();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultConfirm, setVaultConfirm] = useState("");
  useEffect(() => { if (!open) { setVaultPassphrase(""); setVaultConfirm(""); } }, [open]);

  const { t, locale, setLocale } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={t("settings.title")} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#fbfcfb] text-slate-700 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><Settings2 size={20} className="text-[#517d69]" /><div><h2 className="text-lg font-bold">{t("settings.title")}</h2><p className="text-[11px] text-slate-400">Shiorivia · Cloud</p></div></div>
          <button type="button" onClick={onClose} aria-label={t("settings.close")} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav aria-label={t("settings.categories")} className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-[#f5f8f6] p-2 md:w-[216px] md:flex-col md:border-b-0 md:border-r md:p-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition md:w-full ${activeTab === tab.id ? "bg-white text-[#376c54] shadow-sm ring-1 ring-emerald-100" : "text-slate-500 hover:bg-white/60"}`}>
                  <Icon size={16} /> {t(tab.labelKey)}
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
            {activeTab === "general" && (
              <section>
                <h2 className="mb-2 text-xl font-bold">{t("settings.general")}</h2>
                <p className="mb-5 text-sm text-slate-400">{t("settings.general.description")}</p>
                <div className="mb-7 rounded-xl border border-slate-200 bg-white p-4">
                  <label htmlFor="shiorivia-language" className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#376c54]"><Globe2 size={16} />{t("settings.language")}</label>
                  <select id="shiorivia-language" value={locale} onChange={e => setLocale(e.target.value as Locale)} className="w-full rounded-lg border border-slate-200 bg-[#fbfcfb] px-3 py-2 text-sm text-slate-700 focus:border-[#81a58f] focus:outline-none">
                    {LANGUAGE_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{t("settings.language.description")}</p>
                </div>
                <div className="mb-7 rounded-xl border border-slate-200 bg-white p-4">
                  <label htmlFor="shiorivia-context-window" className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <BookOpen size={16} /> {deepText(locale, "settings.contextWindow")}
                  </label>
                  <select id="shiorivia-context-window" value={contextWindowTokens}
                    onChange={event => onContextWindowChange(Number(event.target.value) as ContextWindowTokens)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400">
                    {CONTEXT_WINDOW_OPTIONS.map(tokens => <option key={tokens} value={tokens}>
                      {tokens / 1024}K Token{tokens === 262144 ? ` · ${deepText(locale, "settings.contextDefault")}` : ""}
                    </option>)}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {deepText(locale, "settings.contextHelp")}
                  </p>
                </div>
                {isStory ? (
                  <>
                    <SectionTitle>{t("settings.storyTheme")}</SectionTitle>
                    <p className="mb-3 text-xs text-slate-500">{t("settings.storyTheme.description")}</p>
                    <div className="mb-8 flex flex-wrap gap-3">
                      {([
                        { id: "sky", name: t("settings.sky"), swatch: "bg-[#e0f2fe]" },
                        { id: "sage", name: t("settings.sage"), swatch: "bg-[#b7d3b0]" },
                        { id: "rose", name: t("settings.rose"), swatch: "bg-[#f4c6d2]" },
                      ] as const).map((option) => (
                        <button key={option.id} type="button" aria-pressed={storyTheme === option.id} onClick={() => onStoryThemeChange(option.id)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${storyTheme === option.id ? "border-[#65927c] bg-[#edf6ef] text-[#366b54]" : "border-slate-200 bg-white text-slate-500"}`}>
                          <span className={`h-4 w-4 rounded-full border border-black/5 ${option.swatch}`} /> {option.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mb-7 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">{t("settings.storyTheme.unavailable")}</div>
                )}
                <SectionTitle>{t("settings.data")}</SectionTitle>
                <div className="mb-6 rounded-2xl border border-[#dce7de] bg-white p-5">
                  <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-semibold text-[#345b48]">{deepText(locale, "settings.autoSync")}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{deepText(locale, "settings.autoSyncHelp")}</p></div><button type="button" role="switch" aria-checked={autoSync} aria-label={deepText(locale, "settings.autoSync")} onClick={() => onAutoSyncChange(!autoSync)} className={`h-6 w-11 shrink-0 rounded-full p-1 transition ${autoSync ? "bg-[#5c927b]" : "bg-slate-200"}`}><span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition ${autoSync ? "translate-x-5" : ""}`}/></button></div>
                  <label className="mt-4 block text-xs text-[#61786d]">{deepText(locale, "settings.autoSyncFrequency")}<select disabled={!autoSync} value={autoSyncInterval} onChange={e => onAutoSyncIntervalChange(Number(e.target.value) as 3 | 4 | 5)} className="mt-2 block w-full rounded-xl border border-[#dce7de] bg-[#f9fbf9] px-3 py-2 text-sm disabled:opacity-40"><option value={3}>3 {deepText(locale, "settings.turns")}</option><option value={4}>4 {deepText(locale, "settings.turns")} · {deepText(locale, "settings.contextDefault")}</option><option value={5}>5 {deepText(locale, "settings.turns")}</option></select></label>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">
                  <BookOpen size={17} className="mt-0.5 shrink-0 text-[#65927c]" />
                  <span>{t("settings.data.description")}</span>
                </div>
              </section>
            )}

            {activeTab === "ai" && (
              <section>
                <h2 className="mb-2 text-xl font-bold">{t("settings.ai")}</h2>
                <p className="mb-8 text-sm text-slate-400">{t("settings.ai.description")}</p>
                <SectionTitle>{deepText(locale,"cloud.byok.heading")}</SectionTitle>
                <p className="mb-4 text-xs leading-6 text-slate-500">{deepText(locale,"cloud.byok.warning")}</p>
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3d6657]"><LockKeyhole size={17}/>{deepText(locale,"cloud.vault.title")}</h3>
                  {credentialVaultStatus==="loading"&&<p className="text-xs">{deepText(locale,"cloud.vault.loading")}</p>}
                  {credentialVaultStatus==="error"&&<div className="flex flex-wrap items-center gap-3"><p role="alert" className="text-xs text-red-700">{deepText(locale,"cloud.vault.corrupt")}</p><button type="button" disabled={credentialVaultBusy} onClick={()=>void onCredentialVaultReset()} className="text-xs text-red-700 underline">{deepText(locale,"cloud.vault.reset")}</button></div>}
                  {credentialVaultStatus==="unlocked"?<div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-emerald-800">{deepText(locale,"cloud.vault.unlocked")}</p>
                    <button type="button" disabled={credentialVaultBusy} onClick={()=>void onCredentialVaultLock()}
                      className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">{deepText(locale,"cloud.vault.lock")}</button>
                  </div>:["setup","migrate","locked"].includes(credentialVaultStatus)?<form className="space-y-3" onSubmit={e=>{
                    e.preventDefault();void onCredentialVaultSubmit(vaultPassphrase,vaultConfirm).then(ok=>{if(ok){setVaultPassphrase("");setVaultConfirm("");}});
                  }}>
                    <p className="text-xs leading-5">{deepText(locale,credentialVaultStatus==="migrate"?"cloud.vault.migrate":credentialVaultStatus==="setup"?"cloud.vault.setup":"cloud.vault.locked")}</p>
                    <label className="block text-xs font-semibold">{deepText(locale,"cloud.vault.passphrase")}
                      <input type="password" required autoComplete={credentialVaultStatus==="locked"?"current-password":"new-password"}
                        value={vaultPassphrase} onChange={e=>setVaultPassphrase(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"/>
                    </label>
                    {credentialVaultStatus!=="locked"&&<label className="block text-xs font-semibold">{deepText(locale,"cloud.vault.confirm")}
                      <input type="password" required autoComplete="new-password" value={vaultConfirm} onChange={e=>setVaultConfirm(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"/>
                    </label>}
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" disabled={credentialVaultBusy} className="rounded-lg bg-[#457b60] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
                        {deepText(locale,credentialVaultStatus==="locked"?"cloud.vault.unlock":"cloud.vault.protect")}</button>
                      {credentialVaultStatus==="locked"&&<button type="button" disabled={credentialVaultBusy} onClick={()=>void onCredentialVaultReset()}
                        className="text-xs text-red-700 underline">{deepText(locale,"cloud.vault.reset")}</button>}
                    </div>
                  </form>:null}
                  {credentialVaultError&&<p role="alert" className="mt-3 text-xs text-red-700">{credentialVaultError}</p>}
                </div>
                {credentialVaultStatus==="unlocked"&&<div className="mb-7 grid gap-3">
                  {providers.map(p=>{
                    const value=cloudCredentials[p.id]||{apiKey:"",baseURL:""};
                    return <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-700">{p.label}</p>
                      {p.custom&&<label className="block text-xs text-slate-600">{deepText(locale,"cloud.byok.url")}
                        <input type="url" autoComplete="off" value={value.baseURL} onChange={e=>void onCloudCredentialChange(p.id,{...value,baseURL:e.target.value})}
                          placeholder="https://example.com/v1" maxLength={500} className="mb-3 mt-1 w-full rounded-lg border p-2 font-mono text-xs"/></label>}
                      <label className="block text-xs text-slate-600">{deepText(locale,"cloud.byok.key")}
                        <input type="password" autoComplete="new-password" spellCheck={false} value={value.apiKey}
                          onChange={e=>void onCloudCredentialChange(p.id,{...value,apiKey:e.target.value})}
                          placeholder="••••••••••" maxLength={400} className="mt-1 w-full rounded-lg border p-2 font-mono text-xs"/>
                      </label>
                    </div>;
                  })}
                </div>}
                <SectionTitle>{deepText(locale, "settings.providerHeading")} · {t("settings.providers")}</SectionTitle>
                <div className="mb-7 space-y-2">
                  {providers.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold">{provider.label} {provider.id === "fal" && <span className="ml-2 text-[10px] font-normal text-[#71917d]">IMAGE ONLY</span>} {provider.id !== "fal" && activeProvider === provider.id && <span className="ml-1 text-[10px] text-emerald-600">{t("settings.active")}</span>}</p>
                        <p className="mt-1 text-xs text-slate-400">{provider.configured ? t("settings.configured") : t("settings.unconfigured")}{" · "}{provider.custom ? t("settings.custom") : t("settings.default")}</p>
                      </div>
                      {provider.custom && <label className="block mt-2 max-w-[250px] text-[11px] text-slate-500">{deepText(locale, "settings.providerAlias")}
                        <input aria-label={`${provider.id} ${deepText(locale, "settings.displayName")}`} value={providerAliases[provider.id] || ""}
                          onChange={event => onProviderAliasChange(provider.id, event.target.value)}
                          placeholder={provider.id} maxLength={40}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#8ea9cd]" />
                      </label>}
                      {provider.custom && <div className="flex shrink-0 gap-2 text-[11px] text-slate-600"><label className="flex items-center gap-1"><input type="checkbox" checked={capabilityFor(provider.id, providerCapabilities).llm} onChange={e => onProviderCapabilitiesChange(provider.id, { llm: e.target.checked })}/>LLM</label><label className="flex items-center gap-1"><input type="checkbox" checked={capabilityFor(provider.id, providerCapabilities).image} onChange={e => onProviderCapabilitiesChange(provider.id, { image: e.target.checked })}/>{deepText(locale, "settings.imageCapability")}</label></div>}
                      <button type="button" disabled={!provider.configured} aria-pressed={!disabledProviders.includes(provider.id)} onClick={() => onToggleProvider(provider.id)}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold ${disabledProviders.includes(provider.id) ? "border-slate-200 bg-slate-50 text-slate-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"} disabled:opacity-40`}>
                        {disabledProviders.includes(provider.id) ? t("settings.disabled") : t("settings.enabled")}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mb-6 text-xs leading-6 text-slate-500">{t("settings.providers.description")}</p>
                <SectionTitle>{deepText(locale, "settings.extensionHeading")} · EXTENSIONS</SectionTitle>
                {(activeMode === "sliding" || activeMode === "novel") && <>
                  <SwitchRow title={deepText(locale, "settings.danmaku")} description={deepText(locale, "settings.danmakuHelp")} checked={danmakuEnabled} onClick={onToggleDanmaku} icon={Sparkles} />
                  {danmakuEnabled && <div className="mb-4 rounded-xl border border-amber-200 bg-[#fffaf0] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label htmlFor="danmaku-count" className="text-xs font-medium text-[#745a3d]">{deepText(locale, "settings.danmakuCount")}</label>
                      <output htmlFor="danmaku-count" className="rounded-lg border border-[#dec39e] bg-white px-3 py-1 text-sm font-bold tabular-nums text-[#8a6236]">{danmakuCount} <span className="text-[10px] font-normal">{deepText(locale, "settings.danmakuUnit")}</span></output>
                    </div>
                    <input id="danmaku-count" type="range" min={1} max={24} step={1}
                      aria-label={deepText(locale, "settings.danmakuCount")} aria-valuetext={`${danmakuCount} ${deepText(locale, "settings.danmakuUnit")}`}
                      value={danmakuCount}
                      onChange={event => onDanmakuCountChange(Math.max(1, Math.min(24, Number(event.target.value))))}
                      className="w-full cursor-pointer accent-[#bc8550]"
                      style={{ background: `linear-gradient(to right, #b88750 0%, #b88750 ${((danmakuCount - 1) / 23) * 100}%, #e8d6b9 ${((danmakuCount - 1) / 23) * 100}%, #e8d6b9 100%)` }} />
                    <div className="mt-1 flex justify-between text-[10px] text-[#9f8667]"><span>1</span><span>12</span><span>24</span></div>
                  </div>}
                </>}
                {(activeMode === "sliding" || activeMode === "novel") && <SwitchRow
                  title={deepText(locale, "settings.narrativeStyle")}
                  description={deepText(locale, "settings.narrativeStyleHelp")}
                  checked={geminiNarrativeStyleEnabled}
                  onClick={onToggleGeminiNarrativeStyle}
                  icon={BookOpen}
                />}

                {activeMode === "infinite" && <div className="mt-3 space-y-2">
                  <div className="px-1">
                    <p className="text-xs font-semibold text-slate-700">Officina · {deepText(locale, "settings.engineerLore")}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{deepText(locale, "settings.engineerLoreHelp")}</p>
                  </div>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white px-3">
                    <SwitchRow title={deepText(locale, "settings.relationships")} description={deepText(locale, "settings.relationshipsHelp")} checked={engineeringLoreRelationshipsEnabled} onClick={onToggleEngineeringLoreRelationships} icon={BookOpen} />
                    <SwitchRow title={deepText(locale, "settings.experiences")} description={deepText(locale, "settings.experiencesHelp")} checked={engineeringLoreExperiencesEnabled} onClick={onToggleEngineeringLoreExperiences} icon={BookOpen} />
                  </div>
                </div>}
                {activeMode === "infinite" && <>
                  <SwitchRow title={deepText(locale, "settings.officinaSearch")} description={deepText(locale, "settings.officinaSearchHelp")} checked={values.webSearch} onClick={() => onToggle("webSearch")} icon={Globe2} />
                  {values.webSearch && <div className="mt-2 mb-5 space-y-3 rounded-xl border border-sky-200 bg-[#f5f9ff] p-4">
                    <p className="text-xs font-semibold text-[#3b6589]">{deepText(locale, "settings.searchRoute")}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button type="button" aria-pressed={webToolConfig.mode === "native"}
                        onClick={() => onWebToolConfigChange({mode:"native"})}
                        className={`rounded-lg border px-3 py-3 text-left text-xs ${webToolConfig.mode === "native" ? "border-blue-400 bg-white font-semibold text-[#275b94]" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                        {deepText(locale, "settings.searchNative")}
                        <span className="mt-1 block text-[10px] font-normal">{deepText(locale, "settings.searchNativeHelp")}</span>
                      </button>
                      <button type="button" aria-pressed={webToolConfig.mode === "model"}
                        onClick={() => onWebToolConfigChange({mode:"model"})}
                        className={`rounded-lg border px-3 py-3 text-left text-xs ${webToolConfig.mode === "model" ? "border-blue-400 bg-white font-semibold text-[#275b94]" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                        {deepText(locale, "settings.searchModel")}
                        <span className="mt-1 block text-[10px] font-normal">{deepText(locale, "settings.searchModelHelp")}</span>
                      </button>
                    </div>
                    {webToolConfig.mode === "model" && <>
                      <label className="block text-xs text-slate-600">{deepText(locale, "settings.searchProvider")}
                        <select value={webToolConfig.provider} onChange={e => onWebToolConfigChange({provider:e.target.value})}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                          {providers.filter(provider => provider.configured && provider.id !== "fal" && !disabledProviders.includes(provider.id)).map(provider =>
                            <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs text-slate-600">{deepText(locale, "settings.searchModelId")}
                        <input value={webToolConfig.model} onChange={e => onWebToolConfigChange({model:e.target.value})}
                          placeholder={deepText(locale, "settings.searchModelPlaceholder")} maxLength={160}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
                      </label>
                    </>}
                    <p className="text-[11px] leading-5 text-slate-500">{deepText(locale, "settings.searchInfo")}</p>
                  </div>}
                </>}
                {(["sliding", "novel", "infinite", "chat"].includes(activeMode)) && <>
                <SwitchRow title={t("settings.imageGen")} description={deepText(locale, "cloud.image.requiresModel")} checked={values.imageGen} onClick={() => onToggle("imageGen")} icon={ImageIcon} />
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-700">Image Studio · {deepText(locale, "settings.imageHeading")}</p>
                  <label className="block text-xs text-slate-600">{deepText(locale, "settings.imageProvider")}<select value={imageSettings.provider} onChange={e => onImageSettingsChange({provider: e.target.value})} className="mt-1 block w-full rounded-lg border bg-white p-2 text-sm"><option value="">{deepText(locale, "cloud.image.chooseProvider")}</option>

                    {falConfigured && !disabledProviders.includes("fal") && <option value="fal">fal.ai</option>}
                    {providers.filter(p => p.configured && (p.id === 'google' || p.id === 'openrouter' || (p.custom && capabilityFor(p.id, providerCapabilities).image))).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select></label>
                  <label className="block text-xs text-slate-600">{deepText(locale, "settings.imageModel")}<input value={imageSettings.model} onChange={e => onImageSettingsChange({model:e.target.value})} placeholder={deepText(locale, "settings.imageModelPlaceholder")} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/40 p-2 text-sm text-slate-700 outline-none focus:border-slate-400"/></label>
                  <div className="space-y-3">
                  <label className="block text-xs text-slate-600">{deepText(locale, "settings.imagePositive")}<textarea rows={2} value={imageSettings.positive} onChange={e => onImageSettingsChange({positive:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/40 p-2 text-sm text-slate-700 outline-none focus:border-slate-400"/></label>
                  <label className="block text-xs text-slate-600">{deepText(locale, "settings.imageNegative")}<textarea rows={2} value={imageSettings.negative} onChange={e => onImageSettingsChange({negative:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/40 p-2 text-sm text-slate-700 outline-none focus:border-slate-400"/></label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {([['width',deepText(locale, "settings.imageWidth")],['height',deepText(locale, "settings.imageHeight")],['steps',deepText(locale, "settings.imageSteps")],['cfg','CFG']] as const).map(([key,label]) => <label key={key} className="text-xs text-slate-600">{label}<input type="number" min={1} max={2048} value={imageSettings[key]} onChange={e => onImageSettingsChange({[key]:Number(e.target.value)})} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/40 p-2 text-sm text-slate-700 outline-none focus:border-slate-400"/></label>)}
                  </div>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-500">{deepText(locale, "cloud.image.requiresModel")}</p>
                </div>
                </>}
              </section>
            )}

            {activeTab === "media" && (
              <section>
                <h2 className="mb-2 text-xl font-bold">{t("settings.media")}</h2>
                <p className="mb-8 text-sm text-slate-400">{t("settings.media.description")}</p>
                <SectionTitle>{t("settings.voiceAndMusic")}</SectionTitle>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-400"><Mic size={18}/><span>{t("settings.tts")} · {deepText(locale, "settings.developing")}</span></div>
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-400"><Music2 size={18}/><span>{t("settings.autoDJ")} · {deepText(locale, "cloud.music.unavailable")}</span></div>
                <p className="mt-4 text-xs leading-6 text-slate-500">{deepText(locale, "cloud.music.demoOnly")}</p>
                <a href="https://github.com/Yoisidus/Shiorivia" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-[#3c735c] underline">
                  {deepText(locale, "cloud.music.getLocal")}
                </a>
              </section>
            )}

            {activeTab === "developer" && (
              <section>
                <h2 className="mb-2 text-xl font-bold">{t("settings.developer")}</h2>
                <p className="mb-8 text-sm text-slate-400">{t("settings.developer.description")}</p>
                <SectionTitle>{t("settings.debugging")}</SectionTitle>
                <SwitchRow title="Debug Mode" description={t("settings.debug.description")} checked={debugMode} onClick={onToggleDebug} icon={Bug} />
                {debugMode && <>
                <SwitchRow title={deepText(locale, "settings.debugDraw")} description={deepText(locale, "settings.debugDrawHelp")} checked={debugDrawTagsEnabled} onClick={onToggleDebugDrawTags} icon={ImageIcon} />
                </>}
                <SwitchRow title={t("settings.transition")} description={t("settings.transition.description")} checked={engineeringTransitionEnabled} onClick={onToggleEngineeringTransition} icon={Sparkles} />
                <SwitchRow title={deepText(locale, "settings.telaTransition")} description={deepText(locale, "settings.telaTransitionHelp")} checked={curtainTransitionEnabled} onClick={onToggleCurtainTransition} icon={Sparkles} />
                <SectionTitle>{t("settings.preview")}</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([
                    { id: "rain", label: "Rain" },
                    { id: "curtain", label: "Curtain" },
                    { id: "parchment", label: "Parchment" },
                    { id: "math", label: "Math" },
                    { id: "glitch", label: "Glitch" },
                  ] as const).map((effect) => (
                    <button key={effect.id} type="button" onClick={() => { onClose(); onTestEffect(effect.id); }} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:bg-emerald-50">
                      <Sparkles size={14} /> {effect.label}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-right text-[11px] text-slate-400 sm:px-6">Shiorivia · Settings</footer>
      </div>
    </div>
  );
}
