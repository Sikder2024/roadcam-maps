import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from "react-native";

const CONSENT_KEY = "roadcam-recording-consent-v1";
const ORGANIC_MAPS_DOWNLOAD_URL = "https://organicmaps.app/";

export default function App() {
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const recordingTaskRef = useRef<Promise<void> | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const hasLeftForegroundRef = useRef(false);
  const mapHandoffStartedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaPermission] = MediaLibrary.usePermissions();
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [returnLinkChecked, setReturnLinkChecked] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [returnedFromMaps, setReturnedFromMaps] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showInstallOrganicMaps, setShowInstallOrganicMaps] = useState(false);

  useEffect(() => {
    const handleReturnLink = (url: string) => {
      if (!url.startsWith("roadcam://return")) return;
      hasLeftForegroundRef.current = true;
      autoStartAttemptedRef.current = true;
      setReturnedFromMaps(true);
    };
    const subscription = Linking.addEventListener("url", ({ url }) => handleReturnLink(url));
    Linking.getInitialURL()
      .then((url) => {
        if (url) handleReturnLink(url);
      })
      .catch(() => setErrorMessage("Unable to read the Organic Maps return link. Recording remains stopped."))
      .finally(() => setReturnLinkChecked(true));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY)
      .then((value) => setConsentAccepted(value === "accepted"))
      .catch(() => setErrorMessage("Unable to read recording setup. Please restart the app."))
      .finally(() => setConsentChecked(true));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active") {
        if (nextState === "background") hasLeftForegroundRef.current = true;
        setForeground(false);
        if (recordingRef.current) cameraRef.current?.stopRecording();
      } else {
        setForeground(true);
        if (mapHandoffStartedRef.current) setReturnedFromMaps(true);
      }
    });
    return () => subscription.remove();
  }, []);

  const startRecording = useCallback(async () => {
    if (
      !cameraReady ||
      !foreground ||
      recordingRef.current ||
      !cameraPermission?.granted ||
      !microphonePermission?.granted
    ) {
      return;
    }

    recordingRef.current = true;
    setRecording(true);
    setErrorMessage("");

    const task = (async () => {
      try {
        const result = await cameraRef.current?.recordAsync();
        if (!result?.uri) {
          throw new Error("The camera did not return a video file.");
        }

        const permission = mediaPermission?.granted
          ? mediaPermission
          : await MediaLibrary.requestPermissionsAsync(false, ["video"]);
        if (!permission.granted) {
          throw new Error("Storage permission was denied. The recording could not be saved.");
        }
        await MediaLibrary.saveToLibraryAsync(result.uri);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The recording could not be saved.";
        setErrorMessage(message);
      } finally {
        recordingRef.current = false;
        setRecording(false);
      }
    })();

    recordingTaskRef.current = task;
    await task;
    recordingTaskRef.current = null;
  }, [
    cameraPermission?.granted,
    cameraReady,
    foreground,
    mediaPermission,
    microphonePermission?.granted
  ]);

  const stopRecording = useCallback(() => {
    if (recordingRef.current) cameraRef.current?.stopRecording();
  }, []);

  useEffect(() => {
    if (
      consentAccepted &&
      returnLinkChecked &&
      cameraReady &&
      foreground &&
      !hasLeftForegroundRef.current &&
      cameraPermission?.granted &&
      microphonePermission?.granted &&
      !autoStartAttemptedRef.current
    ) {
      autoStartAttemptedRef.current = true;
      void startRecording();
    }
  }, [
    cameraPermission?.granted,
    cameraReady,
    consentAccepted,
    foreground,
    microphonePermission?.granted,
    returnLinkChecked,
    startRecording
  ]);

  const acceptDisclosure = async () => {
    try {
      await AsyncStorage.setItem(CONSENT_KEY, "accepted");
      setConsentAccepted(true);
      const camera = await requestCameraPermission();
      const microphone = await requestMicrophonePermission();
      if (!camera.granted || !microphone.granted) {
        setErrorMessage("Camera and microphone access are required. Enable them in Settings to record.");
      }
    } catch {
      setErrorMessage("Setup could not be saved or permissions could not be requested.");
    }
  };

  const openOrganicMaps = async () => {
    setErrorMessage("");
    setShowInstallOrganicMaps(false);
    if (recordingRef.current) {
      cameraRef.current?.stopRecording();
      await recordingTaskRef.current;
    }

    let target: string;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Allow location access to open Organic Maps at your current position.");
      }
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const backUrl = encodeURIComponent("roadcam://return");
      target = `om://map?v=1&ll=${currentPosition.coords.latitude},${currentPosition.coords.longitude}&backurl=${backUrl}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to get your current position.";
      setErrorMessage(message);
      return;
    }

    hasLeftForegroundRef.current = true;
    mapHandoffStartedRef.current = true;
    try {
      await Linking.openURL(target);
    } catch {
      mapHandoffStartedRef.current = false;
      setShowInstallOrganicMaps(true);
      setErrorMessage("Organic Maps could not be opened. Check that it is installed.");
    }
  };

  const needsDisclosure = consentChecked && !consentAccepted;
  const missingRecordingPermission =
    consentAccepted &&
    cameraPermission !== null &&
    microphonePermission !== null &&
    (!cameraPermission.granted || !microphonePermission.granted);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.panes}>
        <View style={styles.cameraPane}>
          {cameraPermission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="video"
              mute={false}
              onCameraReady={() => setCameraReady(true)}
              onMountError={(event) => setErrorMessage(`Camera error: ${event.message}`)}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.placeholderTitle}>Camera is off</Text>
              <Text style={styles.placeholderText}>
                {consentAccepted
                  ? "Grant camera and microphone access to record."
                  : "Review the recording notice to begin setup."}
              </Text>
            </View>
          )}
          <View pointerEvents="box-none" style={styles.cameraOverlay}>
            <View style={styles.brandPill}>
              <Text style={styles.brand}>ROADCAM</Text>
            </View>
            {recording && (
              <View accessibilityLiveRegion="polite" style={styles.recordingBadge}>
                <View style={styles.recordDot} />
                <Text style={styles.recordingText}>RECORDING</Text>
              </View>
            )}
            {recording ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                onPress={stopRecording}
                style={styles.stopButton}
              >
                <View style={styles.stopIcon} />
                <Text style={styles.stopText}>STOP</Text>
              </Pressable>
            ) : (
              consentAccepted &&
              cameraReady &&
              !missingRecordingPermission && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start recording"
                  onPress={() => void startRecording()}
                  style={styles.startButton}
                >
                  <Text style={styles.startText}>START RECORDING</Text>
                </Pressable>
              )
            )}
          </View>
        </View>

        <View style={styles.navigationPane}>
          <View>
            <Text style={styles.navigationEyebrow}>NAVIGATION</Text>
            <Text style={styles.navigationTitle}>Organic Maps</Text>
            <Text style={styles.navigationDescription}>
              Opens Organic Maps full-screen. Choose a destination and start its voice-guided
              navigation there. Organic Maps includes a return button to RoadCam; you can also use
              your phone&apos;s app switcher or Back button.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop recording and open Organic Maps"
            onPress={() => void openOrganicMaps()}
            style={styles.mapsButton}
          >
            <Text style={styles.mapsButtonTitle}>OPEN ORGANIC MAPS</Text>
            <Text style={styles.mapsButtonSubtitle}>Recording stops before handoff</Text>
          </Pressable>
          {foreground && returnedFromMaps && !recording && cameraReady && (
            <Text style={styles.pausedNotice}>
              Returned to RoadCam. Recording is stopped; press Start Recording when safe.
            </Text>
          )}
          <Text style={styles.locationNote}>Location is requested only when opening Organic Maps.</Text>
        </View>
      </View>

      {(errorMessage || missingRecordingPermission) && (
        <View accessibilityLiveRegion="assertive" style={styles.notice}>
          <Text style={styles.noticeText}>
            {errorMessage || "Camera and microphone access are required to record."}
          </Text>
          {missingRecordingPermission && (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
                const microphone = microphonePermission?.granted
                  ? microphonePermission
                  : await requestMicrophonePermission();
                if (camera.granted && microphone.granted) setErrorMessage("");
              }}
            >
              <Text style={styles.noticeAction}>RETRY PERMISSIONS</Text>
            </Pressable>
          )}
          {showInstallOrganicMaps && (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(ORGANIC_MAPS_DOWNLOAD_URL)}>
              <Text style={styles.noticeAction}>GET ORGANIC MAPS</Text>
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={needsDisclosure} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Before you record</Text>
            <Text style={styles.dialogBody}>
              RoadCam records video and microphone audio while the app is open. Recordings are saved
              to this phone&apos;s media library; RoadCam does not upload them. Your position is
              requested only when you choose to open Organic Maps. Recording stops when RoadCam leaves
              the foreground, and does not restart automatically when you return.
            </Text>
            <Text style={styles.dialogSafety}>
              Mount and set up your phone before driving. Do not interact with the app while moving.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void acceptDisclosure()}
              style={styles.acceptButton}
            >
              <Text style={styles.acceptText}>I UNDERSTAND — CONTINUE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!consentChecked && (
        <View style={styles.loading}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#080d13" },
  panes: { flex: 1, flexDirection: "row" },
  cameraPane: { flex: 1, backgroundColor: "#101820" },
  navigationPane: {
    flex: 1,
    backgroundColor: "#121c26",
    padding: 28,
    justifyContent: "space-between"
  },
  cameraPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  placeholderTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
  placeholderText: { color: "#bdc7d1", marginTop: 8, textAlign: "center" },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18
  },
  brandPill: {
    alignSelf: "flex-start",
    backgroundColor: "#071018cc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  brand: { color: "#fff", fontWeight: "800", letterSpacing: 1.5 },
  recordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#9d1c24",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  recordDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" },
  recordingText: { color: "#fff", fontWeight: "800", letterSpacing: 1.2 },
  stopButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 78,
    height: 78,
    borderRadius: 40,
    backgroundColor: "#d4323b",
    borderWidth: 4,
    borderColor: "#fff"
  },
  stopIcon: { width: 22, height: 22, backgroundColor: "#fff", borderRadius: 4 },
  stopText: { color: "#fff", fontSize: 10, fontWeight: "800", marginTop: 3 },
  startButton: {
    backgroundColor: "#1d8f5a",
    borderRadius: 28,
    paddingHorizontal: 25,
    paddingVertical: 16
  },
  startText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
  navigationEyebrow: { color: "#6bd39a", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  navigationTitle: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 8 },
  navigationDescription: { color: "#d2dbe3", fontSize: 16, lineHeight: 24, marginTop: 14 },
  mapsButton: { backgroundColor: "#1d8f5a", borderRadius: 10, padding: 18 },
  mapsButtonTitle: { color: "#fff", fontWeight: "800", fontSize: 16, textAlign: "center" },
  mapsButtonSubtitle: { color: "#e5fff1", fontSize: 12, textAlign: "center", marginTop: 6 },
  pausedNotice: { color: "#ffd166", fontWeight: "700", lineHeight: 21, textAlign: "center" },
  locationNote: { color: "#9eb0c0", textAlign: "center", fontSize: 12 },
  notice: {
    position: "absolute",
    bottom: 12,
    left: 20,
    right: 20,
    backgroundColor: "#512128",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  noticeText: { color: "#fff", flex: 1 },
  noticeAction: { color: "#fff", fontWeight: "800", fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000b",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  dialog: { width: "100%", maxWidth: 560, backgroundColor: "#121c26", borderRadius: 16, padding: 24 },
  dialogTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  dialogBody: { color: "#d2dbe3", fontSize: 16, lineHeight: 24, marginTop: 14 },
  dialogSafety: { color: "#ffd166", fontWeight: "700", lineHeight: 21, marginTop: 14 },
  acceptButton: {
    marginTop: 22,
    backgroundColor: "#1d8f5a",
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center"
  },
  acceptText: { color: "#fff", fontWeight: "800", letterSpacing: 0.4 },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#080d13"
  }
});
