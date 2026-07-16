// Registers extra className props NativeWind doesn't map by default.
// Must be imported once, for its side effects, before any screen renders.
import { FlatList, ScrollView, TextInput } from 'react-native';
import { remapProps, cssInterop } from 'nativewind';

remapProps(FlatList, {
  columnWrapperClassName: 'columnWrapperStyle',
  contentContainerClassName: 'contentContainerStyle',
});

remapProps(ScrollView, {
  contentContainerClassName: 'contentContainerStyle',
});

cssInterop(TextInput, {
  placeholderClassName: {
    target: false,
    nativeStyleToProp: { color: 'placeholderTextColor' },
  },
});
