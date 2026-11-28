"use client";

import { Star, Moon, Sun, Compass, Sparkles, Heart } from "lucide-react";
import { parseSelfAvatar, type SelfAvatarChoice } from "../lib/selfAvatar";

const icons = { star: Star, moon: Moon, sun: Sun, compass: Compass, sparkles: Sparkles, heart: Heart };

export function SelfAvatar({ self, className = "h-8 w-8" }: {
  self?: (SelfAvatarChoice & { hex?: string }) | null;
  className?: string;
}) {
  const choice = parseSelfAvatar(self);
  const Icon = icons[choice.avatarPreset || "star"];
  const color = self?.hex && /^#[0-9a-f]{6}$/i.test(self.hex) ? self.hex : "#798da8";
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dce3ed] bg-[#eff3f8] ${className}`} style={{ color }}>
    {choice.avatarImage ? <img src={choice.avatarImage} alt="" className="h-full w-full object-cover" /> : <Icon className="h-1/2 w-1/2" strokeWidth={1.8}/>}
  </span>;
}
