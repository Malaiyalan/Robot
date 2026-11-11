import React from "react";
import { StatusBar } from "expo-status-bar";
import EventPhotographyScreen from "./src/screens/EventPhotographyScreen";

export default function App() {
  return (
    <>
      <EventPhotographyScreen />
      <StatusBar style="light" />
    </>
  );
}
