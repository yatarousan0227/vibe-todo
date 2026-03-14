import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LocaleSwitcher } from "@/src/components/locale-switcher";
import { LOCALE_COOKIE, getDictionary, resolveLocale } from "@/src/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeTodo Intake",
  description: "Local intake environment for VibeTodo.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const dict = getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <LocaleSwitcher locale={locale} label={dict.localeLabel} />
        {children}
      </body>
    </html>
  );
}
