import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";
import { site } from "@/config/site";
import "./globals.css";

// The share image is app/opengraph-image.jpg; on Vercel its URL resolves against the deployment's domain.
export const metadata: Metadata = {
  title: site.title,
  description: site.tagline,
  applicationName: site.title,
  openGraph: {
    type: "website",
    title: site.title,
    description: site.tagline,
    siteName: site.title,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.tagline },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#131315" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/InterVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
