import React, { useEffect } from "react";
import { Text, View, Button } from "react-native";
import { initDatabase, sqliteDb, useLiveQuery, user, createUser } from "db";

export default function Index() {
  useEffect(() => {
    initDatabase().catch((e) => console.error("DB init error", e));
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
        onPress={() =>
          createUser({
            id: `${Date.now()}`,
            username: `user_${Math.floor(Math.random() * 1000)}`,
            name: "Sample User",
            email: "user@example.com",
          }).catch((e) => console.error(e))
        }
      />
    </View>
  );
}
