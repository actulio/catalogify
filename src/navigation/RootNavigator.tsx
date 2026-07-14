// src/navigation/RootNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../services/auth';
import { SignInScreen } from '../screens/SignInScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { EditListFieldsScreen } from '../screens/EditListFieldsScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { ItemFormScreen } from '../screens/ItemFormScreen';
import { CatalogList, CatalogItem } from '../domain/types';

export type RootStackParamList = {
  Home: undefined;
  EditListFields: { list?: CatalogList };
  ListDetail: { list: CatalogList };
  ItemForm: { list: CatalogList; item?: CatalogItem };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!user ? (
          <Stack.Screen name="Home" component={SignInScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'My Catalogs' }} />
            <Stack.Screen name="EditListFields" component={EditListFieldsScreen} options={{ title: 'List Fields' }} />
            <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="ItemForm" component={ItemFormScreen} options={{ title: 'Item' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
