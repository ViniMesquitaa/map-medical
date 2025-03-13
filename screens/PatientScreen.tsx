import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import axios from "axios";

const { height } = Dimensions.get("window");

const GOOGLE_MAPS_API_KEY = "CHAVE_API"; 
const BACKEND_URL = "http://localhost:3000"; 

const EMERGENCY_TYPES = [
  { id: "1", title: "Emergência Cardíaca", icon: "favorite" },
  { id: "2", title: "Acidente de Trânsito", icon: "directions-car" },
  { id: "3", title: "Queda Grave", icon: "warning" },
  { id: "4", title: "Dificuldade Respiratória", icon: "air" },
  { id: "5", title: "Outro", icon: "help-outline" },
];

interface LocationType {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface Prediction {
  place_id: string;
  description: string;
}

const PatientScreen: React.FC = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<LocationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [doctorLocation, setDoctorLocation] = useState<LocationType | null>(null);
  const [address, setAddress] = useState<string>("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão negada", "Você precisa permitir acesso à localização.");
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      await Notifications.requestPermissionsAsync();
    })();
  }, []);

  const fetchAddressPredictions = async (query: string) => {
    if (!query) {
      setPredictions([]);
      return;
    }

    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=${GOOGLE_MAPS_API_KEY}&location=${region?.latitude},${region?.longitude}&radius=5000`
      );
      setPredictions(response.data.predictions);
    } catch (error) {
      console.error("Erro ao buscar previsões de endereço:", error);
    }
  };

  const handleSelectAddress = async (placeId: string) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const { formatted_address, geometry } = response.data.result;
      setAddress(formatted_address);
      setRegion({
        latitude: geometry.location.lat,
        longitude: geometry.location.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setPredictions([]);
    } catch (error) {
      console.error("Erro ao buscar detalhes do endereço:", error);
    }
  };

  const handleCallDoctor = async () => {
    if (!location || !selectedEmergency) {
      Alert.alert("Erro", "Selecione um tipo de emergência e verifique sua localização.");
      return;
    }

    if (requestSent) {
      Alert.alert("Atenção", "Você já solicitou um médico.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/requestEmergency`, {
        emergencyType: EMERGENCY_TYPES.find((item) => item.id === selectedEmergency)?.title,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      });

      if (response.status === 200) {
        setRequestSent(true);
        setDoctorLocation({
          latitude: location.coords.latitude + 0.005,
          longitude: location.coords.longitude + 0.005,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        Notifications.scheduleNotificationAsync({
          content: {
            title: "Médico a Caminho!",
            body: "Um médico foi despachado para sua localização.",
          },
          trigger: null,
        });

        Alert.alert("Sucesso", "O médico foi chamado e está a caminho!");
      }
    } catch (error) {
      console.error("Erro ao chamar o médico:", error);
      Alert.alert("Erro", "Não foi possível chamar o médico. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = () => {
    setRequestSent(false);
    setDoctorLocation(null);
    Alert.alert("Cancelado", "Sua solicitação foi cancelada.");
  };

  const confirmAddress = () => {
    if (!selectedEmergency) {
      Alert.alert("Atenção", "Selecione o tipo de emergência.");
      return;
    }
    setModalVisible(true);
  };

  return (
    <LinearGradient colors={["#e6f0ff", "#f0f4ff"]} style={styles.container}>
      <View style={styles.mapContainer}>
        {region && (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={region}
            showsUserLocation
            followsUserLocation
            initialRegion={region}
          >
            {doctorLocation && (
              <Marker coordinate={doctorLocation} title="Médico a Caminho">
                <Ionicons name="medkit" size={30} color="#ff6347" />
              </Marker>
            )}
          </MapView>
        )}
      </View>

      <View style={styles.addressOverlay}>
        <TextInput
          placeholder="Digite seu endereço"
          value={address}
          onChangeText={(text) => {
            setAddress(text);
            fetchAddressPredictions(text);
          }}
          style={styles.addressInput}
          placeholderTextColor="#999"
        />
        {predictions.length > 0 && (
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.predictionItem}
                onPress={() => handleSelectAddress(item.place_id)}
              >
                <Text style={styles.predictionText}>{item.description}</Text>
              </TouchableOpacity>
            )}
            style={styles.predictionsList}
          />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Selecione o Tipo de Emergência</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {EMERGENCY_TYPES.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.emergencyButton,
                    selectedEmergency === item.id && styles.selectedEmergency,
                  ]}
                  onPress={() => setSelectedEmergency(item.id)}
                >
                  <MaterialIcons name={item.icon as any} size={24} color="#007bff" />
                  <Text style={styles.emergencyText}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, (loading || requestSent) && styles.buttonDisabled]}
            onPress={confirmAddress}
            disabled={loading || requestSent}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirmar Chamado</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {requestSent && (
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRequest}>
          <Text style={styles.cancelButtonText}>Cancelar Chamado</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Chamado</Text>
            <Text style={styles.modalText}>
              {address || "Sua localização atual será usada."}
            </Text>
            <Text style={styles.modalText}>
              Tipo de Emergência: {EMERGENCY_TYPES.find((item) => item.id === selectedEmergency)?.title}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  setModalVisible(false);
                  handleCallDoctor();
                }}
              >
                <Text style={styles.buttonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4ff",
  },
  mapContainer: {
    height: height * 0.6,
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  addressOverlay: {
    position: "absolute",
    top: 5,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    padding: 10,
    elevation: 5,
    zIndex: 1,
    width: 300,
  },
  addressInput: {
    fontSize: 16,
    color: "#333",
    padding: 10,
  },
  predictionsList: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 5,
    maxHeight: 150,
    elevation: 3,
  },
  predictionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  predictionText: {
    fontSize: 14,
    color: "#333",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  menuContainer: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    elevation: 6,
    marginBottom: 20,
    overflow: "hidden",
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  emergencyButton: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#007bff",
    width: 120,
    height: 80,
    backgroundColor: "#fff",
  },
  selectedEmergency: {
    backgroundColor: "#e3f2fd",
    borderColor: "#0056b3",
  },
  emergencyText: {
    fontSize: 14,
    color: "#007bff",
    marginTop: 5,
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonDisabled: {
    backgroundColor: "#a0a0a0",
  },
  cancelButton: {
    backgroundColor: "#ff6347",
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: 300,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modalButton: {
    padding: 12,
    borderRadius: 10,
    width: 120,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default PatientScreen;