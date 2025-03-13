import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import LoginScreen from "./screens/LoginScreen";
import PatientScreen from "./screens/PatientScreen";
import DoctorScreen from "./screens/DoctorScreen";

const Stack = createStackNavigator();

const App: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LoginScreen">
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="PatientScreen" component={PatientScreen} />
        <Stack.Screen name="DoctorScreen" component={DoctorScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
