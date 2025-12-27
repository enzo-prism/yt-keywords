import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteDescription =
  "Test how hot video ideas are BEFORE you start shooting.";

export const metadata: Metadata = {
  metadataBase: new URL("https://hotcontent.app"),
  title: {
    default: "hotcontent.app - Publish what's about to blow up",
    template: "%s — hotcontent.app",
  },
  description: siteDescription,
  icons: {
    icon: [
      {
        url: "/favicon%20small.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/Favicon%20large.png",
        sizes: "256x256",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/Favicon%20large.png",
        sizes: "256x256",
        type: "image/png",
      },
    ],
    shortcut: "/favicon%20small.png",
  },
  openGraph: {
    title: "HotContent - Publish what's about to blow up",
    description: siteDescription,
    url: "https://hotcontent.app",
    siteName: "HotContent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HotContent - Publish what's about to blow up",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-KSYZ1K3PKX"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-KSYZ1K3PKX');`}
        </Script>
        <Script id="hotjar" strategy="afterInteractive">
          {`(function(h,o,t,j,a,r){
    h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
    h._hjSettings={hjid:6608906,hjsv:6};
    a=o.getElementsByTagName('head')[0];
    r=o.createElement('script');r.async=1;
    r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
    a.appendChild(r);
})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
        </Script>
      </head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
