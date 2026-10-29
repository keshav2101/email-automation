import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HR Outreach AI — Personalized Job Outreach Platform",
  description:
    "AI-powered HR email automation system that generates personalized outreach emails for every company and recruiter using your verified resume and achievements.",
  keywords: "HR outreach, job search, email automation, AI personalization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-surface text-gray-100 antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#161b27",
              color: "#f3f4f6",
              border: "1px solid #1e2536",
            },
          }}
        />
      </body>
    </html>
  );
}
