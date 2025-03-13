import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons"; // Para ícones
import moment from "moment"; // Para formatar datas

// Tipagem para a localização
interface LocationType {
  coords: {
    latitude: number;
    longitude: number;
  };
}

// Tipagem para a localização do paciente
interface PatientLocation {
  latitude: number;
  longitude: number;
}

// Tipagem para uma solicitação
interface Request {
  id: string;
  emergencyType: string;
  address: string;
  timestamp: string;
}

// Tipagem para a resposta do backend
interface BackendResponse {
  message: string;
  location?: {
    latitude: string;
    longitude: string;
  };
}

const BACKEND_URL = "http://localhost:3000"; // Substitua pelo IP do backend

const DoctorScreen: React.FC = () => {
  const [location, setLocation] = useState<LocationType | null>(null); // Localização do médico
  const [patientLocation, setPatientLocation] = useState<PatientLocation | null>(null); // Localização do paciente
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false); // Permissão de notificação
  const [modalVisible, setModalVisible] = useState<boolean>(false); // Visibilidade do modal
  const [historyModalVisible, setHistoryModalVisible] = useState<boolean>(false); // Visibilidade do modal de histórico
  const [loading, setLoading] = useState<boolean>(false); // Estado de carregamento
  const [requests, setRequests] = useState<Request[]>([]); // Histórico de solicitações

  // Solicitar permissão de localização
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão negada", "Você precisa permitir acesso à localização.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  // Configurar notificações push
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status === "granted");

      // Ouvir notificações recebidas
      const subscription = Notifications.addNotificationReceivedListener(handleNotification);
      return () => subscription.remove(); // Limpar o listener ao desmontar
    })();
  }, []);

  // Carregar histórico de solicitações
  useEffect(() => {
    fetchRequests();
  }, []);

  // Função para buscar o histórico de solicitações
  const fetchRequests = async () => {
    try {
      const response = await axios.get<Request[]>(`${BACKEND_URL}/getRequests`);
      setRequests(response.data);
    } catch (error) {
      console.error("Erro ao buscar solicitações:", error);
      Alert.alert("Erro", "Não foi possível carregar o histórico de solicitações.");
    }
  };

  // Função para lidar com notificações recebidas
  const handleNotification = (notification: Notifications.Notification) => {
    if (!notificationPermission) return; // Ignorar se as notificações estiverem desativadas

    const { latitude, longitude, requestId, address } = notification.request.content.data as {
      latitude: string;
      longitude: string;
      requestId: string;
      address: string;
    };

    // Exibir alerta para o médico aceitar ou recusar a solicitação
    Alert.alert(
      "Nova Emergência!",
      `Localização do paciente: ${address}. Deseja aceitar a solicitação?`,
      [
        {
          text: "Recusar",
          onPress: () => respondToRequest(requestId, "rejected"),
          style: "cancel",
        },
        {
          text: "Aceitar",
          onPress: () => respondToRequest(requestId, "accepted"),
        },
      ]
    );
  };

  // Função para responder à solicitação
  const respondToRequest = async (requestId: string, response: string) => {
    setLoading(true);

    try {
      const res = await axios.post<BackendResponse>(`${BACKEND_URL}/respondToRequest`, {
        requestId,
        response,
      });

      if (response === "accepted" && res.data.location) {
        // Atualizar a localização do paciente no mapa
        setPatientLocation({
          latitude: parseFloat(res.data.location.latitude),
          longitude: parseFloat(res.data.location.longitude),
        });
      }

      // Atualizar o histórico de solicitações
      fetchRequests();
      Alert.alert("Sucesso", res.data.message);
    } catch (error) {
      console.error("Erro ao responder à solicitação:", error);
      Alert.alert("Erro", "Não foi possível responder à solicitação.");
    } finally {
      setLoading(false);
    }
  };

  // Função para remover uma solicitação
  const removeRequest = async (requestId: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/removeRequest/${requestId}`);
      fetchRequests(); // Atualizar o histórico
    } catch (error) {
      console.error("Erro ao remover solicitação:", error);
      Alert.alert("Erro", "Não foi possível remover a solicitação.");
    }
  };

  // Função para remover todas as solicitações
  const removeAllRequests = async () => {
    try {
      await axios.delete(`${BACKEND_URL}/removeAllRequests`);
      setRequests([]); // Limpar o histórico
    } catch (error) {
      console.error("Erro ao remover todas as solicitações:", error);
      Alert.alert("Erro", "Não foi possível remover todas as solicitações.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Mapa */}
      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          region={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {/* Marcador do médico */}
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Sua Localização"
            pinColor="blue"
          />

          {/* Marcador do paciente */}
          {patientLocation && (
            <Marker
              coordinate={{
                latitude: patientLocation.latitude,
                longitude: patientLocation.longitude,
              }}
              title="Localização do Paciente"
              pinColor="red"
            />
          )}
        </MapView>
      )}

      {/* Botão para abrir o modal de configuração */}
      <TouchableOpacity
        style={styles.configButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="settings" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal de Configuração */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Botão para fechar o modal */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#ff6347" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Configurações</Text>

            {/* Permissão de Notificação */}
            <View style={styles.settingItem}>
              <Text style={styles.settingText}>Permitir Notificações Push</Text>
              <Switch
                value={notificationPermission}
                onValueChange={async (value) => {
                  const { status } = await Notifications.requestPermissionsAsync();
                  setNotificationPermission(status === "granted");
                }}
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={notificationPermission ? "#007bff" : "#f4f3f4"}
              />
            </View>

            {/* Botão para abrir o histórico de solicitações */}
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => {
                setModalVisible(false);
                setHistoryModalVisible(true);
              }}
            >
              <Text style={styles.historyButtonText}>Histórico de Solicitações</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Histórico de Solicitações */}
      <Modal
        visible={historyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Botão para fechar o modal */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setHistoryModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#ff6347" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Histórico de Solicitações</Text>

            {requests.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma solicitação encontrada.</Text>
            ) : (
              <>
                <FlatList
                  data={requests}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.requestItem}>
                      <Text style={styles.requestText}>
                        {item.emergencyType} - {item.address}
                      </Text>
                      <Text style={styles.requestTime}>
                        {moment(item.timestamp).format("DD/MM/YYYY HH:mm")}
                      </Text>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeRequest(item.id)}
                      >
                        <Ionicons name="trash" size={20} color="#ff6347" />
                      </TouchableOpacity>
                    </View>
                  )}
                />
                <TouchableOpacity
                  style={styles.removeAllButton}
                  onPress={removeAllRequests}
                >
                  <Text style={styles.removeAllText}>Remover Todas</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Indicador de carregamento */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },
  map: {
    flex: 1,
  },
  configButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 50,
    elevation: 3,
    zIndex: 1,
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
    width: "80%",
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  settingText: {
    fontSize: 16,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  historyButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  historyButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
  },
  requestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  requestText: {
    fontSize: 14,
    color: "#333",
  },
  requestTime: {
    fontSize: 12,
    color: "#666",
  },
  removeButton: {
    padding: 5,
  },
  removeAllButton: {
    backgroundColor: "#ff6347",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  removeAllText: {
    color: "#fff",
    fontSize: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
});

export default DoctorScreen;