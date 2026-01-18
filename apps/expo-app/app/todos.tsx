import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, SafeAreaView, Text } from "react-native";

export default function RedirectToIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <SafeAreaView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Redirecting…</Text>
    </SafeAreaView>
  );
}
