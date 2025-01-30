import type { Metadata } from "next";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import "./globals.css";

export const metadata: Metadata = {
  title: "E-Paper Calendar Setting"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      
      <body>
        <AppRouterCacheProvider>
          
            {children}
          
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
