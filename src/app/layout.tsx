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
  icons: {
    // The SVG goes last with sizes="any" so Chrome and Firefox pick it over the rasters.
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      ...[32, 64, 96].flatMap((size) =>
        (["light", "dark"] as const).map((scheme) => ({
          url: `/icon-${scheme}-${size}.png`,
          sizes: `${size}x${size}`,
          type: "image/png",
          media: `(prefers-color-scheme: ${scheme})`,
        })),
      ),
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
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
