// Registers extra className props NativeWind doesn't map by default.
// Must be imported once, for its side effects, before any screen renders.
import { FlatList, ScrollView, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { remapProps, cssInterop } from 'nativewind';

remapProps(FlatList, {
  columnWrapperClassName: 'columnWrapperStyle',
  contentContainerClassName: 'contentContainerStyle',
});

remapProps(ScrollView, {
  contentContainerClassName: 'contentContainerStyle',
});

// react-native-keyboard-controller's KeyboardAwareScrollView is a distinct
// component reference, so NativeWind doesn't map className/contentContainerClassName
// on it by default — register both here (className resolves to the `style` prop).
remapProps(KeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

cssInterop(TextInput, {
  placeholderClassName: {
    target: false,
    nativeStyleToProp: { color: 'placeholderTextColor' },
  },
});
