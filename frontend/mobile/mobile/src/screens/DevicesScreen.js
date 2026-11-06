import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { api, deviceService } from "../services";

export default function DevicesScreen() {
  const [online, setOnline] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [type, setType] = useState("wedding_photo");

  const load = useCallback(async () => {
    try {
      await api.health();
      setOnline(true);
      setDevices(await deviceService.list());
    } catch (e) {
      setOnline(false);
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim() || !serial.trim()) return Alert.alert("Enter name and serial number");
    try {
      await deviceService.create({ name: name.trim(), serial_number: serial.trim(), device_type: type });
      setName(""); setSerial("");
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const toggleStatus = async (d) => {
    try {
      await deviceService.update(d.id, { status: d.status === "online" ? "offline" : "online" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const remove = async (d) => {
    try { await deviceService.remove(d.id); load(); } catch (e) { Alert.alert("Error", e.message); }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Robot Devices</Text>
      <Text style={[s.badge, { color: online ? "#15803d" : "#b91c1c" }]}>
        {online === null ? "Checking backend..." : online ? "● Backend connected" : "● Backend unreachable"}
      </Text>

      <View style={s.form}>
        <TextInput style={s.input} placeholder="Robot name" value={name} onChangeText={setName} />
        <TextInput style={s.input} placeholder="Serial number" value={serial} onChangeText={setSerial} autoCapitalize="none" />
        <View style={s.row}>
          {["wedding_photo", "saree_tryon"].map((t) => (
            <TouchableOpacity key={t} style={[s.chip, type === t && s.chipOn]} onPress={() => setType(t)}>
              <Text style={type === t ? s.chipTextOn : s.chipText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.btn} onPress={add}><Text style={s.btnText}>Add Robot</Text></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator size="large" /> : (
        <FlatList
          data={devices}
          keyExtractor={(d) => String(d.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Text style={s.empty}>No devices yet. Add one above.</Text>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.sub}>{item.serial_number} · {item.device_type}</Text>
                <Text style={s.sub}>Status: {item.status}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleStatus(item)}><Text style={s.link}>Toggle</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(item)}><Text style={[s.link, { color: "#b91c1c" }]}>Delete</Text></TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 56, backgroundColor: "#f8faf7" },
  title: { fontSize: 24, fontWeight: "700", color: "#14532d" },
  badge: { marginBottom: 12, fontWeight: "600" },
  form: { backgroundColor: "#fff", padding: 12, borderRadius: 12, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: "#14532d", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: "#14532d" },
  chipText: { color: "#14532d" },
  chipTextOn: { color: "#fff" },
  btn: { backgroundColor: "#14532d", padding: 12, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 12, borderRadius: 12, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  sub: { color: "#6b7280", fontSize: 12 },
  link: { color: "#14532d", fontWeight: "600" },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 24 },
});
