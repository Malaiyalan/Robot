import { NativeModules, Platform } from "react-native";

function resolveBaseUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    const proto = window.location.protocol === "https:" ? "https:" : "http:";
    return `${proto}//${window.location.hostname}:8000`;
  }

  // In Expo Go on a physical device, infer the live Metro host IP so stale .env IPs don't break Wi-Fi access.
  const sourceCode = NativeModules?.SourceCode;
  const scriptUrl = sourceCode?.getConstants?.()?.scriptURL || sourceCode?.scriptURL;
  if (typeof scriptUrl === "string") {
    const match = scriptUrl.match(/^https?:\/\/([^/:]+)/i);
    const host = match?.[1];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:8000`;
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (envUrl) return envUrl;

  return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
}

export const BASE_URL = resolveBaseUrl();
export const API_URL = `${BASE_URL}/api/v1`;
