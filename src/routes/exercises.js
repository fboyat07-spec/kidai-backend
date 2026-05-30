import React, { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { fetchExercise } from "../services/api";

export default function ExerciseScreen() {
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExercise();
  }, []);

  async function loadExercise() {
    try {
      setLoading(true);

      const data = await fetchExercise();

      if (data) {
        setExercise(data);
      }
    } catch (err) {
      console.log("SCREEN ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <Text>Chargement...</Text>;
  }

  if (!exercise) {
    return <Text>Erreur chargement</Text>;
  }

  return (
    <View style={{ padding: 20 }}>
      <Text>Question:</Text>
      <Text>{exercise.question}</Text>

      <Button title="RECHARGER" onPress={loadExercise} />
    </View>
  );
}