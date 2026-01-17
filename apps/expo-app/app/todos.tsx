import {
  createTodo,
  deleteTodo,
  sqliteDb,
  SyncEngine,
  todo as todoTable,
  updateTodo,
  useLiveQuery,
} from "db";
import { isNull } from "drizzle-orm";
import React, { useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Initialize sync engine
const syncEngine = new SyncEngine(sqliteDb, process.env.EXPO_PUBLIC_API_URL!);

// Set auth token (in a real app, you'd get this from Cognito)
// syncEngine.setAuthToken("your-auth-token");

export default function TodosScreen() {
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Live query that re-renders when todos change
  const { data: todos } = useLiveQuery(
    sqliteDb.select().from(todoTable).where(isNull(todoTable.deletedAt))
  );

  const handleCreateTodo = () => {
    if (!newTodoTitle.trim()) return;

    try {
      createTodo(sqliteDb, { title: newTodoTitle.trim() });
      setNewTodoTitle("");
    } catch (e) {
      console.error("Error creating todo:", e);
      Alert.alert("Error", "Failed to create todo");
    }
  };

  const handleToggleTodo = (id: string, completed: boolean) => {
    try {
      updateTodo(sqliteDb, id, { completed: !completed });
    } catch (e) {
      console.error("Error updating todo:", e);
      Alert.alert("Error", "Failed to update todo");
    }
  };

  const handleDeleteTodo = (id: string, title: string) => {
    Alert.alert("Delete Todo", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            deleteTodo(sqliteDb, id);
          } catch (e) {
            console.error("Error deleting todo:", e);
            Alert.alert("Error", "Failed to delete todo");
          }
        },
      },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncEngine.syncTodos();
      Alert.alert(
        "Sync Complete",
        `Synced ${result.synced} local changes\nPulled ${result.pulled} remote changes`
      );
    } catch (e) {
      console.error("Sync error:", e);
      Alert.alert("Sync Failed", "Failed to sync with server");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, paddingTop: 60 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
        Todos
      </Text>

      {/* Add new todo */}
      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
            padding: 12,
            marginRight: 8,
          }}
          placeholder="New todo..."
          value={newTodoTitle}
          onChangeText={setNewTodoTitle}
          onSubmitEditing={handleCreateTodo}
        />
        <Button title="Add" onPress={handleCreateTodo} />
      </View>

      {/* Sync button */}
      <View style={{ marginBottom: 16 }}>
        <Button
          title={syncing ? "Syncing..." : "Sync with Server"}
          onPress={handleSync}
          disabled={syncing}
        />
      </View>

      {/* Todo list */}
      <ScrollView style={{ flex: 1 }}>
        {todos && todos.length > 0 ? (
          todos.map((todo: any) => (
            <View
              key={todo.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <TouchableOpacity
                style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                onPress={() => handleToggleTodo(todo.id, todo.completed)}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderWidth: 2,
                    borderColor: todo.completed ? "#007AFF" : "#ccc",
                    borderRadius: 12,
                    backgroundColor: todo.completed ? "#007AFF" : "transparent",
                    marginRight: 12,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    textDecorationLine: todo.completed
                      ? "line-through"
                      : "none",
                    color: todo.completed ? "#999" : "#000",
                  }}
                >
                  {todo.title}
                </Text>
              </TouchableOpacity>
              <Button
                title="Delete"
                color="#FF3B30"
                onPress={() => handleDeleteTodo(todo.id, todo.title)}
              />
            </View>
          ))
        ) : (
          <Text style={{ textAlign: "center", color: "#999", marginTop: 32 }}>
            No todos yet. Add one above!
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
