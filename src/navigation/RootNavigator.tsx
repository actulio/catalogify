// src/navigation/RootNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../services/auth';
import { SignInScreen } from '../screens/SignInScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { EditListFieldsScreen } from '../screens/EditListFieldsScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { ItemFormScreen } from '../screens/ItemFormScreen';
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CatalogList, CatalogItem } from '../domain/types';
import { theme } from '../theme/theme';

export type RootStackParamList = {
  Home: undefined;
  EditListFields: { list?: CatalogList };
  ListDetail: { list: CatalogList };
  ItemForm: { list: CatalogList; item?: CatalogItem };
  ItemDetail: { list: CatalogList; item: CatalogItem };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          // Warm Archive header: cream `background`, terracotta `primary` tint,
          // centered Playfair wordmark. Hex mirrors tailwind.config.js tokens.
          title: 'Catalogify',
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#faf9f5' },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { fontFamily: 'PlayfairDisplay_700Bold', color: theme.colors.primary },
        }}
      >
        {!user ? (
          <Stack.Screen name="Home" component={SignInScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="EditListFields" component={EditListFieldsScreen} />
            <Stack.Screen name="ListDetail" component={ListDetailScreen} />
            <Stack.Screen name="ItemForm" component={ItemFormScreen} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
