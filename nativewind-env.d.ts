// expo-env.d.ts is auto-generated and gitignored, so the `declare module '*.css'`
// it normally pulls in from expo/types is absent on a clean checkout — which broke
// App.tsx's `import './global.css'` (TS2882) and made the typecheck non-reproducible.
// Referencing expo/types here, in a committed file, restores it independent of codegen.
/// <reference types="expo/types" />
/// <reference types="nativewind/types" />

declare module 'react-native' {
  interface FlatListProps<ItemT> {
    columnWrapperClassName?: string;
    contentContainerClassName?: string;
  }
  interface ScrollViewProps {
    contentContainerClassName?: string;
  }
  interface TextInputProps {
    placeholderClassName?: string;
  }
}

export {};
