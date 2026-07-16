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
