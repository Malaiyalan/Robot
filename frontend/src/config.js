import { Platform } from "react-native";

const fallback = Platform.OS === "android" ? "http://0.0.0.0:8000" : "http://localhost:8000";

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallback;
export const API_URL = `${BASE_URL}/api/v1`;
