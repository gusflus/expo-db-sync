import { sqliteDb, useMigrations } from "db";
import migrations from "db/migrations";
import { Stack } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useEffect } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function RootLayout() {
  const { success, error } = useMigrations(sqliteDb, migrations);

  useEffect(() => {
    if (error) {
      console.log({ success, error: error?.message });
    }
  }, [success, error]);

  if (error) {
    const errorMsg = error.message || String(error);
    const isTableExists =
      errorMsg.includes("already exists") || errorMsg.includes("CREATE TABLE");

    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Migration Error</Text>
        <Text style={styles.errorText}>
          {isTableExists
            ? "Database tables already exist. Delete app and reinstall, or use button below."
            : errorMsg}
        </Text>
        {isTableExists && (
          <Button
            title="Delete Database & Reload"
            color="#FF3B30"
            onPress={() => {
              try {
                SQLite.deleteDatabaseSync("db.db");
                // Force reload by throwing error that will crash and restart
                setTimeout(() => {
                  throw new Error("Reload app");
                }, 100);
              } catch (e) {
                console.error("Failed to delete database:", e);
              }
            }}
          />
        )}
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Running migrations...</Text>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  text: {
    fontSize: 16,
    color: "#000",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF3B30",
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
});
