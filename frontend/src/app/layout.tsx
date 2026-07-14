import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingProvider } from "@/lib/branding-context";
import { ThemeProvider } from "@/lib/theme-context";
import { InlineScript } from "@/components/inline-script";

// Runs before paint to set the .dark class, preventing a light-mode flash.
const NO_FLASH_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('poscafe-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POSCAFE",
  description: "Coffee shop point-of-sale system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={NO_FLASH_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <BrandingProvider>
            <AuthProvider>{children}</AuthProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
