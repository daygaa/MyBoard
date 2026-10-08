import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { BoardHeader } from "@/components/board/Header";
import { db } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyBoard — Gestionnaire de médias local",
  description:
    "Tri de médias par tags, façon image board booru. 100% local, privé, rapide.",
  applicationName: "MyBoard",
};

export const dynamic = "force-dynamic";

async function fetchStats() {
  try {
    const [total, images, videos, audio, documents, archives, favorites, tags] =
      await Promise.all([
        db.media.count(),
        db.media.count({ where: { kind: "image" } }),
        db.media.count({ where: { kind: "video" } }),
        db.media.count({ where: { kind: "audio" } }),
        db.media.count({ where: { kind: "document" } }),
        db.media.count({ where: { kind: "archive" } }),
        db.media.count({ where: { favorite: true } }),
        db.tag.count(),
      ]);
    return {
      total,
      images,
      videos,
      audio,
      documents,
      archives,
      others: 0,
      favorites,
      tags,
    };
  } catch (e) {
    // DB peut ne pas être prête au premier rendu (build / cold start)
    return {
      total: 0,
      images: 0,
      videos: 0,
      audio: 0,
      documents: 0,
      archives: 0,
      others: 0,
      favorites: 0,
      tags: 0,
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stats = await fetchStats();
  return (
    <html lang="fr" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="flex min-h-screen flex-col">
          <BoardHeader stats={stats} />
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="mt-auto border-t border-border bg-card/40 px-4 py-3 text-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              MyBoard · local
            </span>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
