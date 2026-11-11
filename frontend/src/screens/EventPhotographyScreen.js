import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api, publicEventService } from "../services";

function extractPhotoId(rawInput) {
  if (!rawInput) return "";
  const trimmed = String(rawInput).trim();
  const pathMatch = trimmed.match(/\/photos\/([A-Za-z0-9_-]+)/i);
  if (pathMatch && pathMatch[1]) return pathMatch[1].toUpperCase();
  const queryMatch = trimmed.match(/[?&](?:photoId|id|code)=([A-Za-z0-9_-]+)/i);
  if (queryMatch && queryMatch[1]) return queryMatch[1].toUpperCase();
  return trimmed.toUpperCase();
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val >= 10 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export default function EventPhotographyScreen() {
  // Stages: "access" -> "camera" -> "preview" -> "uploaded" | "viewer"
  const [stage, setStage] = useState("access");
  const [backendOnline, setBackendOnline] = useState(null);

  // Phase 5: Event Access Code
  const [accessCode, setAccessCode] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Phase 6: Camera Capture
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState("back");
  const [capturing, setCapturing] = useState(false);
  const [capturedUri, setCapturedUri] = useState(null);
  const cameraRef = useRef(null);

  // Phase 7 & 8: Upload & QR Code
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const uploadLockRef = useRef(false);

  // Phase 9: Photo Viewer
  const [viewerQuery, setViewerQuery] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState(null);
  const [viewerError, setViewerError] = useState(null);

  const openPhotoViewer = useCallback(async (input) => {
    const photoId = extractPhotoId(input);
    setStage("viewer");
    if (!photoId) {
      setViewerPhoto(null);
      setViewerError(null);
      return;
    }

    setViewerQuery(photoId);
    setViewerLoading(true);
    setViewerError(null);
    setViewerPhoto(null);
    try {
      const data = await publicEventService.getPhotoByCode(photoId);
      setViewerPhoto(data);
    } catch {
      setViewerError("Sorry, this photograph is currently unavailable.");
    } finally {
      setViewerLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .health()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));

    const checkDeepLink = async () => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const extracted = extractPhotoId(window.location.href);
        if (extracted && extracted.startsWith("PHOTO-")) {
          openPhotoViewer(extracted);
          return;
        }
      }
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl) {
        const extracted = extractPhotoId(initialUrl);
        if (extracted && extracted.startsWith("PHOTO-")) {
          openPhotoViewer(extracted);
        }
      }
    };

    checkDeepLink();
    const sub = Linking.addEventListener("url", ({ url }) => {
      const extracted = extractPhotoId(url);
      if (extracted && extracted.startsWith("PHOTO-")) {
        openPhotoViewer(extracted);
      }
    });
    return () => sub.remove();
  }, [openPhotoViewer]);

  const handleEnterEvent = async () => {
    const cleaned = accessCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length !== 10) {
      setAccessError("Invalid event code.");
      return;
    }

    setAccessError(null);
    setAccessLoading(true);
    try {
      const res = await publicEventService.accessEvent(cleaned);
      setSessionToken(res.session_token);
      setEventInfo(res.event);
      setUploadedCount(0);
      setStage("camera");
      if (!permission?.granted) {
        await requestPermission().catch(() => undefined);
      }
    } catch (err) {
      setAccessError(err?.message || "Invalid event code.");
    } finally {
      setAccessLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setUploadError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setStage("preview");
      }
    } catch (err) {
      setUploadError(err?.message || "Could not capture photograph.");
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setUploadError(null);
    setUploadResult(null);
    setStage("camera");
  };

  const handleUpload = async () => {
    if (!capturedUri || !sessionToken || uploadLockRef.current || uploading) return;
    uploadLockRef.current = true;
    setUploading(true);
    setUploadError(null);

    try {
      const res = await publicEventService.uploadPhoto(capturedUri, sessionToken);
      setUploadResult(res);
      setUploadedCount((c) => c + 1);
      setStage("uploaded");
    } catch (err) {
      setUploadError(err?.message || "Failed to upload photograph.");
    } finally {
      setUploading(false);
      uploadLockRef.current = false;
    }
  };

  const handleExitEvent = () => {
    setSessionToken(null);
    setEventInfo(null);
    setCapturedUri(null);
    setUploadResult(null);
    setAccessCode("");
    setAccessError(null);
    setStage("access");
  };

  const handleShareQr = async () => {
    if (!uploadResult) return;
    const url = uploadResult.qr_target_url || publicEventService.resolveUrl(uploadResult.photo_view_url);
    await Share.share({
      message: `${uploadResult.event_name} Photo (${uploadResult.photo_id}): ${url}`,
      url,
    }).catch(() => undefined);
  };

  const isInsecureWebCamera =
    Platform.OS === "web" && typeof window !== "undefined" && !window.isSecureContext;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Top Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>EVENT PHOTOGRAPHY</Text>
            <Text style={s.title} numberOfLines={1}>
              {stage === "access"
                ? "Event Access"
                : stage === "viewer"
                  ? "Photo Viewer"
                  : eventInfo?.event_name || "Event Camera"}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={[s.statusBadge, backendOnline ? s.statusOk : s.statusErr]}>
              {backendOnline === null ? "..." : backendOnline ? "● Connected" : "● Offline"}
            </Text>
            {sessionToken && stage !== "access" && (
              <TouchableOpacity style={s.exitBtn} onPress={handleExitEvent}>
                <Text style={s.exitBtnText}>Exit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* PHASE 5: EVENT ACCESS CODE SCREEN */}
        {stage === "access" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome to Event Photography</Text>
            <Text style={s.cardSub}>
              Enter your 10-character event access code to continue.
            </Text>

            <Text style={s.label}>Event Access Code</Text>
            <TextInput
              style={s.codeInput}
              value={accessCode}
              onChangeText={(txt) => {
                setAccessCode(txt.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                if (accessError) setAccessError(null);
              }}
              placeholder="A7K9P2X5M8"
              placeholderTextColor="#475569"
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleEnterEvent}
            />

            {accessError && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{accessError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, accessLoading && s.disabledBtn]}
              onPress={handleEnterEvent}
              disabled={accessLoading}
            >
              {accessLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={s.primaryBtnText}>Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.linkBtn}
              onPress={() => openPhotoViewer("")}
            >
              <Text style={s.linkBtnText}>Already have a Photo ID? View Photograph</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PHASE 6: CAMERA ACCESS & PHOTO CAPTURE */}
        {stage === "camera" && (
          <View style={s.cameraSection}>
            <View style={s.sessionBar}>
              <Text style={s.sessionMeta}>
                {eventInfo?.location ? `${eventInfo.location} · ` : ""}
                {uploadedCount} photo{uploadedCount === 1 ? "" : "s"} uploaded
              </Text>
              <TouchableOpacity
                style={s.flipBtn}
                onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
              >
                <Text style={s.flipBtnText}>
                  Switch ({facing === "back" ? "Rear" : "Front"})
                </Text>
              </TouchableOpacity>
            </View>

            {isInsecureWebCamera ? (
              <View style={s.permissionCard}>
                <Text style={s.permissionTitle}>HTTPS Required for Browser Camera</Text>
                <Text style={s.permissionSub}>
                  Browser camera access requires localhost or HTTPS. Open on http://localhost:8081 or use Expo Go on your phone.
                </Text>
              </View>
            ) : !permission ? (
              <View style={s.permissionCard}>
                <ActivityIndicator size="large" color="#818cf8" />
                <Text style={s.permissionSub}>Checking camera permissions...</Text>
              </View>
            ) : !permission.granted ? (
              <View style={s.permissionCard}>
                <Text style={s.permissionTitle}>Camera Permission Required</Text>
                <Text style={s.permissionSub}>
                  Allow camera access to capture photographs for {eventInfo?.event_name}.
                </Text>
                <TouchableOpacity style={s.primaryBtn} onPress={requestPermission}>
                  <Text style={s.primaryBtnText}>Enable Camera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={s.cameraFrame}>
                  <CameraView
                    ref={cameraRef}
                    style={s.cameraPreview}
                    facing={facing}
                  />
                </View>

                <View style={s.captureBar}>
                  <TouchableOpacity
                    style={[s.shutterOuter, capturing && s.disabledBtn]}
                    onPress={handleCapture}
                    disabled={capturing}
                  >
                    <View style={s.shutterInner}>
                      {capturing && <ActivityIndicator color="#0f172a" />}
                    </View>
                  </TouchableOpacity>
                  <Text style={s.captureHint}>Tap to Capture Photograph</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* PHASE 6 & 7: PREVIEW / RETAKE / UPLOAD */}
        {stage === "preview" && capturedUri && (
          <View style={s.card}>
            <Text style={s.previewLabel}>Captured Preview</Text>
            <View style={s.previewStage}>
              <Image source={{ uri: capturedUri }} style={s.previewImage} resizeMode="contain" />
            </View>

            {uploadError && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{uploadError}</Text>
              </View>
            )}

            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.secondaryBtn, uploading && s.disabledBtn]}
                onPress={handleRetake}
                disabled={uploading}
              >
                <Text style={s.secondaryBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.uploadBtn, uploading && s.disabledBtn]}
                onPress={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={s.primaryBtnText}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PHASE 8: QR CODE GENERATED */}
        {stage === "uploaded" && uploadResult && (
          <View style={s.card}>
            <Text style={s.successBadge}>UPLOADED TO EVENT STORAGE</Text>
            <Text style={s.cardTitle}>Scan QR Code to View Photo</Text>
            <Text style={s.metaText}>
              Photo ID: {uploadResult.photo_id} · {formatBytes(uploadResult.file_size)}
            </Text>

            <View style={s.qrBox}>
              <Image source={{ uri: uploadResult.qr_data_url }} style={s.qrImage} resizeMode="contain" />
            </View>

            <View style={s.btnStack}>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => openPhotoViewer(uploadResult.photo_id)}
              >
                <Text style={s.primaryBtnText}>View Photograph</Text>
              </TouchableOpacity>

              <View style={s.actionRow}>
                <TouchableOpacity
                  style={s.secondaryBtn}
                  onPress={() =>
                    Linking.openURL(
                      `${publicEventService.resolveUrl(uploadResult.qr_image_url)}?download=1`
                    )
                  }
                >
                  <Text style={s.secondaryBtnText}>Download QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={handleShareQr}>
                  <Text style={s.secondaryBtnText}>Share Link</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.uploadBtn} onPress={handleRetake}>
                <Text style={s.primaryBtnText}>Capture Another Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PHASE 9: PHOTO VIEWER */}
        {stage === "viewer" && (
          <View style={s.card}>
            <View style={s.viewerHeader}>
              <TouchableOpacity
                style={s.backPill}
                onPress={() => setStage(sessionToken ? "camera" : "access")}
              >
                <Text style={s.backPillText}>
                  {sessionToken ? "← Back to Camera" : "← Enter Event Code"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                value={viewerQuery}
                onChangeText={setViewerQuery}
                placeholder="PHOTO-000001"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={() => openPhotoViewer(viewerQuery)}
              />
              <TouchableOpacity
                style={s.searchBtn}
                onPress={() => openPhotoViewer(viewerQuery)}
                disabled={viewerLoading}
              >
                <Text style={s.primaryBtnText}>View</Text>
              </TouchableOpacity>
            </View>

            {viewerLoading && (
              <View style={s.centerBox}>
                <ActivityIndicator size="large" color="#818cf8" />
                <Text style={s.metaText}>Loading photograph...</Text>
              </View>
            )}

            {!viewerLoading && viewerError && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{viewerError}</Text>
              </View>
            )}

            {!viewerLoading && viewerPhoto && (
              <View style={{ marginTop: 14 }}>
                <Text style={s.eventTag}>{viewerPhoto.event_name}</Text>
                <Text style={s.metaText}>
                  {viewerPhoto.photo_id} · {formatBytes(viewerPhoto.file_size)}
                </Text>
                <View style={s.previewStage}>
                  <Image
                    source={{ uri: publicEventService.resolveUrl(viewerPhoto.image_url) }}
                    style={s.previewImage}
                    resizeMode="contain"
                    onError={() => {
                      setViewerPhoto(null);
                      setViewerError("Sorry, this photograph is currently unavailable.");
                    }}
                  />
                </View>
                {viewerPhoto.download_enabled && (
                  <TouchableOpacity
                    style={[s.primaryBtn, { marginTop: 14 }]}
                    onPress={() =>
                      Linking.openURL(publicEventService.resolveUrl(viewerPhoto.download_url))
                    }
                  >
                    <Text style={s.primaryBtnText}>Download Photograph</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020617" },
  container: { padding: 16, paddingTop: 26, gap: 16, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "#818cf8" },
  title: { fontSize: 22, fontWeight: "800", color: "#f8fafc", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: { fontSize: 12, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusOk: { color: "#4ade80", backgroundColor: "rgba(34, 197, 94, 0.14)" },
  statusErr: { color: "#f87171", backgroundColor: "rgba(239, 68, 68, 0.14)" },
  exitBtn: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  exitBtnText: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#f8fafc" },
  cardSub: { fontSize: 14, color: "#94a3b8", lineHeight: 20 },
  label: { color: "#cbd5e1", fontSize: 13, fontWeight: "600", marginTop: 6 },
  codeInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 5,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  secondaryBtnText: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  disabledBtn: { opacity: 0.55 },
  linkBtn: { paddingVertical: 8, alignItems: "center" },
  linkBtnText: { color: "#a5b4fc", fontSize: 13, fontWeight: "600" },
  errorBox: {
    backgroundColor: "rgba(244, 63, 94, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.4)",
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: "#fecdd3", fontSize: 14, fontWeight: "600", textAlign: "center" },
  cameraSection: { flex: 1, gap: 12 },
  sessionBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sessionMeta: { color: "#94a3b8", fontSize: 13, fontWeight: "600", flex: 1 },
  flipBtn: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  flipBtnText: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  cameraFrame: {
    flex: 1,
    minHeight: 420,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  cameraPreview: { flex: 1, minHeight: 420 },
  captureBar: { alignItems: "center", paddingVertical: 10, gap: 8 },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#ffffff",
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  shutterInner: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureHint: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  permissionCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 22,
    padding: 24,
    gap: 12,
    alignItems: "center",
  },
  permissionTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700", textAlign: "center" },
  permissionSub: { color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 20 },
  previewLabel: { color: "#a5b4fc", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  previewStage: {
    backgroundColor: "#000000",
    borderRadius: 16,
    overflow: "hidden",
    minHeight: 320,
    justifyContent: "center",
  },
  previewImage: { width: "100%", height: 340 },
  actionRow: { flexDirection: "row", gap: 12 },
  successBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    color: "#6ee7b7",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: { color: "#94a3b8", fontSize: 13 },
  qrBox: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 20,
    marginVertical: 8,
  },
  qrImage: { width: 210, height: 210 },
  btnStack: { gap: 10 },
  viewerHeader: { flexDirection: "row", justifyContent: "flex-start" },
  backPill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backPillText: { color: "#cbd5e1", fontSize: 13, fontWeight: "600" },
  searchRow: { flexDirection: "row", gap: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  searchBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  centerBox: { paddingVertical: 30, alignItems: "center", gap: 10 },
  eventTag: { color: "#f8fafc", fontSize: 18, fontWeight: "800", marginBottom: 4 },
});

