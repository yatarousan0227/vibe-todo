import { cookies } from "next/headers";
import { IntakeApp } from "@/src/components/intake-app";
import { LOCALE_COOKIE, getDictionary, resolveLocale } from "@/src/lib/i18n";

export default async function HomePage() {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const dict = getDictionary(locale);
  return <IntakeApp locale={locale} dictionary={dict} />;
}
