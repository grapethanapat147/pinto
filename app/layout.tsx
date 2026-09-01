import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "pinto-profit-center-th.grapetnp147.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Pinto — จัดการร้านออนไลน์ครบทุกช่องทาง",
    description: "ศูนย์รวมออเดอร์ สต๊อก ข้อความลูกค้า การตลาด และกำไรสำหรับร้านค้าออนไลน์หลายช่องทาง",
    openGraph: {
      title: "Pinto — Seller Operations Center",
      description: "จัดการออเดอร์ สต๊อก ลูกค้า การตลาด และกำไรได้จากที่เดียว",
      images: [`${origin}/og-v2.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "Pinto — Seller Operations Center",
      description: "จัดการออเดอร์ สต๊อก ลูกค้า การตลาด และกำไรได้จากที่เดียว",
      images: [`${origin}/og-v2.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${notoSansThai.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
