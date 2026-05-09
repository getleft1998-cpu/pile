import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/src/lib/cart";
import Header from "@/src/components/Header";
import Footer from "@/src/components/Footer";

export const metadata: Metadata = {
  title: "Flormar Tunisie — Maquillage & Cosmétiques",
  description:
    "Découvrez la gamme complète Flormar en Tunisie. Rouge à lèvres, fond de teint, mascara et bien plus.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <CartProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
