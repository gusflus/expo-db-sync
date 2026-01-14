import {
  createUser,
  deleteAllUsers,
  initDatabase,
  sqliteDb,
  useLiveQuery,
  user,
} from "db";
import React, { useEffect } from "react";
import { Alert, Button, Text, View } from "react-native";

export default function Index() {
  useEffect(() => {
    try {
      initDatabase();
    } catch (e) {
      console.error("DB init error", e);
    }
  }, []);

  // Live query that re-renders when users change
  const { data } = useLiveQuery(sqliteDb.select().from(user));

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <Text style={{ marginBottom: 8 }}>Users:</Text>
      <Text style={{ marginBottom: 12 }}>{JSON.stringify(data || [])}</Text>
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

      <View style={{ height: 12 }} />

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
    </View>
  );
}
