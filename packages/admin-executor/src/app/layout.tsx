import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Admin Executor",
  description: "Slack-triggered admin execution",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
