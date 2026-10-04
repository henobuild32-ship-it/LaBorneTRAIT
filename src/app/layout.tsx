import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import PWAUpdateManager from "@/components/gradeup/pwa-update-manager";
import OfflineSyncManager from "@/components/gradeup/offline-sync-manager";

// Local fallback variables to guarantee 100% offline build capability without network dependencies
const geistSans = {
  variable: "--font-geist-sans",
};

const geistMono = {
  variable: "--font-geist-mono",
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
};

export const metadata: Metadata = {
  title: "LaBorneTRAIT – Gestion scolaire",
  description: "La plateforme de gestion scolaire LaBorneTRAIT pour les établissements de La Borne.",
  keywords: ["LaBorneTRAIT", "école", "gestion scolaire"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    title: 'LaBorneTRAIT – Gestion scolaire',
    description: 'Gestion scolaire, notes, présences et bulletins dans une seule application.',
    siteName: 'LaBorneTRAIT',
    images: [{ url: '/trait-logo.png', width: 820, height: 640, alt: 'Logo LaBorneTRAIT' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LaBorneTRAIT – Gestion scolaire',
    description: 'Gestion scolaire, notes, présences et bulletins.',
    images: ['/trait-logo.png'],
  },
  authors: [{ name: "LaBorneTRAIT" }],
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <PWAUpdateManager />
          <OfflineSyncManager />
          <Toaster />
          <SonnerToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
