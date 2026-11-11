import React from "react";
import { StatusBar } from "expo-status-bar";
import DevicesScreen from "./src/screens/DevicesScreen";

// Later: add React Navigation / expo-router and your own screens here.
export default function App() {
  return (
    <>
      <DevicesScreen />
      <StatusBar style="dark" />
    </>
  );
}
