import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Blocking inline script — runs before paint to apply the saved theme and
 * avoid a flash of the wrong color scheme.
 */
export default function ThemeInit() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t="light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
