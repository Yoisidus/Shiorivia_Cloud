import type { Metadata, Viewport } from "next";
import { Inter, Noto_Serif_SC, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script"; 
import { MusicProvider } from "../context/MusicContext";
import { LanguageProvider } from "../context/LanguageContext";
import { DialogProvider } from "../context/DialogContext";
import { SingleTabGate } from "../components/SingleTabGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Noto_Serif_SC({ 
  subsets: ["latin"], 
  weight: ["400", "700"],
  variable: "--font-serif" 
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  // Public Cloud metadata resolves against the hosted origin.
  metadataBase: new URL("https://app.shiorivia.com"),
  title: "Shiorivia · Cloud Edition",
  description: "Where Stories Find Their Way — a browser-first, multilingual AI conversation and interactive storytelling studio with encrypted BYOK keys.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Shiorivia · Cloud Edition",
    description: "Where Stories Find Their Way. Explore AI conversations, characters, stories and novels in your browser.",
    images: [{ url: "/shiorivia-og.png", width: 1200, height: 630, alt: "Shiorivia Star Road" }],
  },
  twitter: { card: "summary_large_image", images: ["/shiorivia-og.png"] },
  icons: {
    icon: [{ url: "/shiorivia-favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/shiorivia-app-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Shiorivia",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", 
  themeColor: "#08182e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} ${serif.variable} ${mono.variable} font-sans`}>
        {process.env.NEXT_PUBLIC_ENABLE_LOCAL_LIVE2D === "true" && <Script
          src="/lib/live2d.min.js"
          strategy="beforeInteractive"
        />}
        
        {process.env.NEXT_PUBLIC_ENABLE_LOCAL_LIVE2D === "true" && <Script
          src="/lib/live2dcubismcore.min.js"
          strategy="beforeInteractive"
        />}
        
        <LanguageProvider>
          <SingleTabGate>
            <MusicProvider><DialogProvider>{children}</DialogProvider></MusicProvider>
          </SingleTabGate>
        </LanguageProvider>
      </body>
    </html>
  );
}