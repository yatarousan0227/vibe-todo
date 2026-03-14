"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/src/lib/i18n";

export function LocaleSwitcher(props: {
  locale: Locale;
  label: string;
}) {
  const { locale, label } = props;
  const router = useRouter();

  function setLocale(nextLocale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="localeSwitch" aria-label={label}>
      <span className="localeSwitchLabel">{label}</span>
      <div className="localeSwitchActions">
        {(["en", "ja"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`localeSwitchButton ${locale === option ? "localeSwitchButton--active" : ""}`}
            onClick={() => setLocale(option)}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
