"use client";

import { useEffect, useState } from "react";

import { ACADEMICS_CACHE, ACADEMICS_CACHE_MARKER } from "@/lib/academics-offline";
import styles from "./board.module.css";

/**
 * Saves this board on the device after an online visit, shows that copy when
 * the device is offline, and reloads it once the connection returns.
 */
export default function BoardOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let sawOffline = !navigator.onLine;
    setOffline(sawOffline);

    const onOffline = () => {
      sawOffline = true;
      setOffline(true);
    };
    const onOnline = () => {
      setOffline(false);
      if (sawOffline) window.location.reload();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    const save = async () => {
      if (!navigator.onLine || !("caches" in window)) return;
      try {
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register("/academics-offline.js");
          await navigator.serviceWorker.ready;
          // The worker only serves the saved copy after it controls the page.
          // One reload hands it control; the flag stops that reload repeating.
          if (!navigator.serviceWorker.controller && sessionStorage.getItem("academics-sw") !== "1") {
            sessionStorage.setItem("academics-sw", "1");
            window.location.reload();
            return;
          }
        }
        const cache = await caches.open(ACADEMICS_CACHE);
        const page = await fetch(window.location.pathname, {
          headers: { Accept: "text/html" },
          cache: "no-store",
        });
        if (page.ok) {
          const text = await page.clone().text();
          const body = text.replace(/<script[\s\S]*?<\/script>/gi, "");
          if (body.includes(ACADEMICS_CACHE_MARKER)) {
            await cache.put(window.location.origin + window.location.pathname, page);
          }
        }
        const fromDom = [...document.querySelectorAll("script[src], link[href]")]
          .map((node) => node.getAttribute("src") || node.getAttribute("href") || "")
          .filter((href) => href.includes("/_next/static/") || href.includes("/icon.svg"))
          .map((href) => new URL(href, window.location.origin).href);
        const assets = [...new Set([
          ...fromDom,
          ...performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(`${window.location.origin}/_next/static/`) || name.includes("/icon.svg")),
        ])];
        await Promise.all(
          assets.map(async (name) => {
            try {
              if (await cache.match(name)) return;
              const asset = await fetch(name);
              if (asset.ok) await cache.put(name, asset);
            } catch {
              // A missing script does not discard the saved page.
            }
          }),
        );
        document.documentElement.dataset.academicsSaved = "1";
      } catch (error) {
        console.error("[academics-offline]", error instanceof Error ? error.name : "error");
      }
    };
    void save();

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return (
    <>
      <div hidden data-academics-cache="1" />
      {offline ? (
        <p className={styles.banner} role="status">
          You are offline. This is the last copy saved on this device. It will update when you are back online.
        </p>
      ) : null}
    </>
  );
}
