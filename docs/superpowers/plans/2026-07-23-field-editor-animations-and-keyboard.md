# Field-Editor Animations & Keyboard Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tactile press feedback and enter/exit/reflow animations to the catalog field editor, and stop the on-screen keyboard from covering focused inputs on the add-item and field-editor screens.

**Architecture:** Pure presentation layer using the already-installed `react-native-reanimated` 4.5. Two small reusable components (`PressableScale`, `KeyboardAwareScrollView`) plus one shared keyboard-padding hook are introduced, then wired into `EditListFieldsScreen` and `ItemFormScreen`. No changes to domain, validation, Firestore, or navigation.

**Tech Stack:** Expo ~57, React Native 0.86 (new architecture), react-native-reanimated 4.5, NativeWind, TypeScript.

---

## Pre-flight: verify the reanimated-4 / Expo v57 APIs

Per `AGENTS.md`, confirm the exact APIs before writing code. They are all from the top-level `react-native-reanimated` export in v4:

- `Animated.ScrollView`, `Animated.FlatList` (animated wrappers)
- `useAnimatedKeyboard()` → returns `{ height, state }` shared values
- `useAnimatedStyle`, `useSharedValue`, `withSpring`, `withTiming`
- Layout animation presets: `FadeInDown`, `SlideOutLeft`, `LinearTransition`

Reference: https://docs.expo.dev/versions/v57.0.0/ and the reanimated docs for layout animations + `useAnimatedKeyboard`. If any import path differs in the installed version, adjust and note it in the commit.

Quick check step:

- [ ] **Confirm the exports exist via typecheck**

Do NOT try to `require()` reanimated or react-native in plain Node — they are
Metro-only (Flow/ESM) and will throw `ERR_MODULE_NOT_FOUND` /
`Unexpected token 'typeof'`. Instead, the imports in each task's code are type-
checked by `npx tsc --noEmit`. If any named export (`useAnimatedKeyboard`,
`FadeInDown`, `SlideOutLeft`, `LinearTransition`) does not exist in the installed
4.5.0 typings, tsc will report `has no exported member` — adjust the import to the
correct name from the reanimated 4 docs and note it in the commit.

---

## Task 1: `PressableScale` reusable pressable

A drop-in replacement for `Pressable` that scales down + dips opacity on press-in and springs back on release. Presentational only — forwards all `Pressable` props.

**Files:**
- Create: `src/components/PressableScale.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { forwardRef } from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** How far to scale down on press-in. Default 0.96. */
  activeScale?: number;
};

/**
 * Pressable that gives tactile feedback: scales to `activeScale` and dips
 * opacity while pressed, springing back on release. Forwards all Pressable
 * props (onPress, disabled, className via NativeWind, etc.).
 */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { activeScale = 0.96, onPressIn, onPressOut, disabled, ...rest },
  ref
) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(activeScale, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(0.7, { duration: 80 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      style={style}
      {...rest}
    />
  );
});
```

Note on NativeWind: `className` is passed through via `{...rest}`. If NativeWind's
`className`→`style` merge conflicts with the animated `style` prop on the
animated component, wrap the inner content instead — but first try this form,
which works because NativeWind resolves `className` to `style` and reanimated
merges style arrays.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/work/personal/random/catalogify && npx tsc --noEmit`
Expected: no errors referencing `PressableScale.tsx`.

- [ ] **Step 3: Commit**

```bash
cd /Users/work/personal/random/catalogify
git add src/components/PressableScale.tsx
git commit -m "feat: PressableScale reusable pressable with press feedback"
```

---

## Task 2: `useKeyboardPadding` hook + `KeyboardAwareScrollView`

Shared hook that returns an animated style adding bottom padding equal to the
keyboard height, plus a scroll container that uses it and, on keyboard show,
scrolls the currently-focused input above the keyboard.

**Files:**
- Create: `src/hooks/useKeyboardPadding.ts`
- Create: `src/components/KeyboardAwareScrollView.tsx`

- [ ] **Step 1: Create the hook**

```ts
import { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

/**
 * Returns an animated style whose bottom padding tracks the on-screen keyboard
 * height, so scrollable content gains room to lift focused inputs clear of the
 * keyboard. Works on both Android and iOS under the new architecture.
 */
export function useKeyboardPadding() {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));
}
```

- [ ] **Step 2: Create the scroll container**

Two things happen here, and they are deliberately separate mechanisms:

1. **Room** — `useKeyboardPadding()` grows the content's bottom padding to the
   keyboard height so any input *can* be scrolled clear of the keyboard. This is
   the reanimated part and the smooth-motion the user asked for. (Note: with
   `useAnimatedKeyboard` the app reads the keyboard inset itself rather than the
   OS auto-resizing the window, so this manual padding is the correct pattern —
   do NOT also add `android:adjustResize` / `softwareKeyboardLayoutMode`.)
2. **Bring the focused input up** — on `keyboardDidShow`, ask the ScrollView's
   scroll responder to scroll the currently-focused native input above the
   keyboard. `scrollResponderScrollNativeHandleToKeyboard` is the long-standing RN
   method (the same one `react-native-keyboard-aware-scroll-view` uses); it does
   the offset math from the keyboard frame internally. This is generic — no
   per-`TextInput` wiring. Do NOT use `onFocus`/`onFocusCapture` on the ScrollView:
   focus does not bubble to parent views in React Native, so those never fire.

```tsx
import { forwardRef, useEffect, useRef } from 'react';
import {
  findNodeHandle,
  Keyboard,
  ScrollView,
  ScrollViewProps,
  TextInput,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardPadding } from '../hooks/useKeyboardPadding';

type Props = ScrollViewProps & { children: React.ReactNode };

/**
 * ScrollView that keeps the focused input visible above the keyboard: it grows
 * its bottom padding with the keyboard height (reanimated) and, when the keyboard
 * appears, scrolls the currently-focused input above it. Drop-in replacement for
 * a plain ScrollView — no per-input wiring needed.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, Props>(
  function KeyboardAwareScrollView({ children, contentContainerStyle, ...rest }, ref) {
    const padStyle = useKeyboardPadding();
    const scrollRef = useRef<ScrollView | null>(null);

    useEffect(() => {
      const sub = Keyboard.addListener('keyboardDidShow', () => {
        const focused = TextInput.State.currentlyFocusedInput?.();
        const responder = (scrollRef.current as any)?.getScrollResponder?.();
        const node = focused ? findNodeHandle(focused) : null;
        if (node != null && responder?.scrollResponderScrollNativeHandleToKeyboard) {
          // 24 = extra px kept above the keyboard; true = don't overscroll past top.
          responder.scrollResponderScrollNativeHandleToKeyboard(node, 24, true);
        }
      });
      return () => sub.remove();
    }, []);

    return (
      <Animated.ScrollView
        ref={(r) => {
          scrollRef.current = r as unknown as ScrollView;
          if (typeof ref === 'function') ref(r as any);
          else if (ref) (ref as any).current = r;
        }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[contentContainerStyle, padStyle]}
        {...rest}
      >
        {children}
      </Animated.ScrollView>
    );
  }
);
```

Note: `TextInput.State.currentlyFocusedInput()` is the documented way to get the
focused input node without wiring every field. Everything is null-guarded, so if
the scroll-responder method is unavailable on some platform the padding alone
still prevents the input from being trapped behind the keyboard.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/work/personal/random/catalogify && npx tsc --noEmit`
Expected: no errors in the two new files. If `currentlyFocusedInput` or
`getScrollResponder` are missing from the RN typings, keep the `?.`/`as any`
guards already present — they are runtime-safe.

- [ ] **Step 4: Commit**

```bash
cd /Users/work/personal/random/catalogify
git add src/hooks/useKeyboardPadding.ts src/components/KeyboardAwareScrollView.tsx
git commit -m "feat: useKeyboardPadding hook + KeyboardAwareScrollView"
```

---

## Task 3: Wire keyboard handling into `ItemFormScreen`

Swap the bare `ScrollView` for `KeyboardAwareScrollView`, preserving existing
padding/gap classes.

**Files:**
- Modify: `src/screens/ItemFormScreen.tsx:2` (imports), `:84` (open tag), `:212` (close tag)

- [ ] **Step 1: Update the imports**

Remove `ScrollView` from the `react-native` import (line 2) and add the new
component import below the existing local imports (after line 12):

```tsx
import { View, Text, TextInput, Pressable, Image, Switch, Alert } from 'react-native';
```

```tsx
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView';
```

- [ ] **Step 2: Swap the container element**

Change the opening tag at line 84 from:

```tsx
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-5 gap-8 pb-16">
```

to:

```tsx
    <KeyboardAwareScrollView className="flex-1 bg-background" contentContainerClassName="p-5 gap-8 pb-16">
```

And the closing tag at line 212 from `</ScrollView>` to
`</KeyboardAwareScrollView>`.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/work/personal/random/catalogify && npx tsc --noEmit`
Expected: no errors. `ScrollView` no longer referenced directly, no unused-import warning.

- [ ] **Step 4: Commit**

```bash
cd /Users/work/personal/random/catalogify
git add src/screens/ItemFormScreen.tsx
git commit -m "feat: keyboard-aware scrolling on the add/edit item form"
```

---

## Task 4: Field editor — press feedback on buttons

Replace the three `Pressable`s that add/remove/save with `PressableScale`.

**Files:**
- Modify: `src/screens/EditListFieldsScreen.tsx:2` (import), `:230` (Remove), `:238` (Add field), `:241` (Save)

- [ ] **Step 1: Import `PressableScale`**

Add after the existing local imports (after line 10):

```tsx
import { PressableScale } from '../components/PressableScale';
```

- [ ] **Step 2: Swap the "Remove field" pressable (line 230)**

From:

```tsx
                <Pressable onPress={() => removeField(index)}>
                  <Text className="font-label-sm text-label-sm text-error">Remove field</Text>
                </Pressable>
```

to:

```tsx
                <PressableScale onPress={() => removeField(index)}>
                  <Text className="font-label-sm text-label-sm text-error">Remove field</Text>
                </PressableScale>
```

- [ ] **Step 3: Swap the "+ Add field" and "Save" pressables (lines 238-247)**

From:

```tsx
      <Pressable className="py-4 items-center" onPress={addField}>
        <Text className="font-label-md text-label-md text-primary">+ Add field</Text>
      </Pressable>
      <Pressable
        className={`bg-primary rounded-lg py-4 items-center ${saving ? 'opacity-60' : ''}`}
        onPress={save}
        disabled={saving}
      >
        <Text className="text-white text-base">{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
```

to:

```tsx
      <PressableScale className="py-4 items-center" onPress={addField}>
        <Text className="font-label-md text-label-md text-primary">+ Add field</Text>
      </PressableScale>
      <PressableScale
        className={`bg-primary rounded-lg py-4 items-center ${saving ? 'opacity-60' : ''}`}
        onPress={save}
        disabled={saving}
      >
        <Text className="text-white text-base">{saving ? 'Saving...' : 'Save'}</Text>
      </PressableScale>
```

Leave the per-type selector `Pressable`s (lines 197-213) as plain `Pressable` —
they are toggle chips, not add/remove actions, and already show an active state.

- [ ] **Step 4: Typecheck**

Run: `cd /Users/work/personal/random/catalogify && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/work/personal/random/catalogify
git add src/screens/EditListFieldsScreen.tsx
git commit -m "feat: press feedback on field editor add/remove/save buttons"
```

---

## Task 5: Field editor — card animations + auto-scroll + keyboard padding

Animate field cards in/out/reflow, scroll to the newly added field, and lift
field-name inputs above the keyboard.

**Files:**
- Modify: `src/screens/EditListFieldsScreen.tsx` — imports (line 1-2), `addField` (60-65), the `FlatList` (115-237)

- [ ] **Step 1: Add reanimated imports + a list ref**

Add to the imports block (after line 10):

```tsx
import { useRef } from 'react';
import { FlatList as RNFlatList } from 'react-native';
import Animated, {
  FadeInDown,
  SlideOutLeft,
  LinearTransition,
} from 'react-native-reanimated';
import { useKeyboardPadding } from '../hooks/useKeyboardPadding';
```

Note: `useState` is already imported from `react` on line 1 — add `useRef` there
instead of a duplicate import if you prefer: `import { useState, useRef } from 'react';`
and drop the standalone `useRef` line above.

Inside the component, after the `saving` state (line 58), add:

```tsx
  const listRef = useRef<RNFlatList<FieldDef>>(null);
  const keyboardPad = useKeyboardPadding();
```

- [ ] **Step 2: Scroll to the new field after adding**

Change `addField` (lines 60-65) from:

```tsx
  function addField() {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length}_${Date.now()}`, label: '', type: 'shortText', required: false },
    ]);
  }
```

to:

```tsx
  function addField() {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length}_${Date.now()}`, label: '', type: 'shortText', required: false },
    ]);
    // Reveal the freshly appended card once it has laid out.
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }
```

- [ ] **Step 3: Convert to `Animated.FlatList` with layout animation + keyboard padding**

Change the `FlatList` opening (lines 115-119) from:

```tsx
      <FlatList
        data={fields}
        keyExtractor={(f) => f.key}
        contentContainerClassName="gap-4 pb-6"
        showsVerticalScrollIndicator={false}
```

to:

```tsx
      <Animated.FlatList
        ref={listRef}
        data={fields}
        keyExtractor={(f) => f.key}
        contentContainerClassName="gap-4 pb-6"
        contentContainerStyle={keyboardPad}
        keyboardShouldPersistTaps="handled"
        itemLayoutAnimation={LinearTransition.duration(220)}
        showsVerticalScrollIndicator={false}
```

Note: `contentContainerClassName` and `contentContainerStyle` coexist —
NativeWind's className resolves to style and reanimated merges the animated
`keyboardPad` style on top. If the installed reanimated types reject a
`SharedValue`-backed `contentContainerStyle` on `Animated.FlatList`, cast the
prop `contentContainerStyle={keyboardPad as any}`.

- [ ] **Step 4: Wrap each card in an animated View with enter/exit**

Change the `renderItem` card root (lines 171-174) from:

```tsx
        renderItem={({ item, index }) => {
          const locked = isLockedRating(item);
          return (
            <View className="bg-surface-container-low rounded-lg p-4 gap-3">
```

to:

```tsx
        renderItem={({ item, index }) => {
          const locked = isLockedRating(item);
          return (
            <Animated.View
              entering={FadeInDown.duration(250)}
              exiting={SlideOutLeft.duration(200)}
              className="bg-surface-container-low rounded-lg p-4 gap-3"
            >
```

And change that card's closing `</View>` (line 234) to `</Animated.View>`.

- [ ] **Step 5: Close the list tag**

Change the `FlatList` closing tag (line 237) from `/>`-style close — it currently
ends with `      />` after the `renderItem` prop closes. Ensure the closing tag
matches the new element name: the self-closing `/>` at line 237 stays `/>`, but
since we opened `<Animated.FlatList`, no separate closing tag is needed (it's
still self-closing with all props inline). Verify the element opened as
`<Animated.FlatList` and closes with `/>`.

- [ ] **Step 6: Typecheck**

Run: `cd /Users/work/personal/random/catalogify && npx tsc --noEmit`
Expected: no errors. If `itemLayoutAnimation` or `contentContainerStyle` typing
complains, apply the `as any` cast noted in Step 3.

- [ ] **Step 7: Commit**

```bash
cd /Users/work/personal/random/catalogify
git add src/screens/EditListFieldsScreen.tsx
git commit -m "feat: field card enter/exit/reflow animations + auto-scroll + keyboard lift"
```

---

## Task 6: On-device verification

No unit tests — animations and keyboard behavior are verified by driving the app.
Use the `/run` skill or `npx expo start` and exercise the flows on a device/emulator.

- [ ] **Step 1: Launch the app**

Run: `cd /Users/work/personal/random/catalogify && npx expo start`
(or the project's usual device build). Open a catalog.

- [ ] **Step 2: Verify field editor animations**

- Create or edit a catalog → tap **"+ Add field"**: the button visibly scales on
  tap, a new card **fades/slides up** into place, and the list **scrolls down** to
  reveal it.
- Tap **"Remove field"** on a non-rating card: the button reacts, the card
  **slides left + fades out**, and the remaining cards **glide up** to close the gap.
- Confirm the locked **Rating** card has no "Remove field" action (unchanged).

- [ ] **Step 3: Verify keyboard handling**

- **Add-item screen:** focus the Title input and each field input near the bottom
  of a long form → each input **lifts above the keyboard** and stays visible while
  typing.
- **Field editor:** focus a field-label input mid-list with the keyboard open →
  the input is **not covered** by the keyboard.

- [ ] **Step 4: Confirm no regressions**

- Saving a new catalog and a new item still works (data unchanged).
- Cover/photo pickers, date picker, and type-selector chips behave as before.

- [ ] **Step 5: Final typecheck**

Run: `cd /Users/work/personal/random/catalogify && npx tsc --noEmit`
Expected: clean.

---

## Self-Review notes

- **Spec coverage:** Part A #1 (card anim) → Task 5; #2 (auto-scroll) → Task 5
  Step 2; #3 (button feedback) → Task 4. Part B #4 (KeyboardAwareScrollView +
  ItemForm) → Tasks 2–3; #5 (FlatList keyboard padding) → Task 5 Steps 1,3. All
  spec requirements mapped.
- **Type consistency:** `useKeyboardPadding()` defined in Task 2, consumed in
  Tasks 2 and 5 with the same name. `PressableScale` defined Task 1, used Task 4.
  `KeyboardAwareScrollView` defined Task 2, used Task 3.
- **Line numbers** reflect the files as read on 2026-07-23; if earlier tasks
  shift them, match on the quoted code rather than the line number.
