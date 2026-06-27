import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Obscura",
  description: "Private payments on Stellar. Your wallet is finally private.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var legacyThemeKey = ["stellar", "shield", "theme"].join("-");
                var savedTheme = localStorage.getItem("obscura-theme") || localStorage.getItem(legacyThemeKey);
                if (savedTheme) localStorage.setItem("obscura-theme", savedTheme);
                var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                document.documentElement.dataset.theme = savedTheme || (systemDark ? "dark" : "light");
              } catch (_) {
                document.documentElement.dataset.theme = "light";
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
