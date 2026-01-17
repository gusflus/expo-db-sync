import { createUser, deleteAllUsers, sqliteDb, useLiveQuery, user } from "db";
import { Link } from "expo-router";
import React from "react";
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Index() {
  // Live query that re-renders when users change
  const { data } = useLiveQuery(sqliteDb.select().from(user));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Expo DB Sync Demo</Text>

        <Link href="/todos" style={styles.link}>
          <Text style={styles.linkText}>Go to Todos →</Text>
        </Link>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Users:</Text>
          <Text style={styles.data}>{JSON.stringify(data || [], null, 2)}</Text>
        </View>

        <Button
          title="Create sample user"
          onPress={() => {
            try {
              createUser({
                id: `${Date.now()}`,
                username: `user_${Math.floor(Math.random() * 1000)}`,
                name: "Sample User",
                email: "user@example.com",
              });
            } catch (e) {
              console.error(e);
            }
          }}
        />

        <View style={styles.spacer} />

        <Button
          title="Delete all users"
          color="#FF3B30"
          onPress={() => {
            Alert.alert(
              "Delete all users",
              "Are you sure you want to delete all users? This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    try {
                      deleteAllUsers();
                    } catch (e) {
                      console.error(e);
                    }
                  },
                },
              ]
            );
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    padding: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#000",
  },
  link: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  linkText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  section: {
    width: "100%",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  data: {
    fontSize: 12,
    marginBottom: 12,
    color: "#666",
    fontFamily: "monospace",
  },
  spacer: {
    height: 12,
  },
});
