# Field-editor animations & keyboard handling — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)
**Scope:** UI/presentation only — no data-flow, Firestore, or validation changes.

## Problem

Two rough edges in the catalog UI:

1. **No feedback when adding/removing fields** in the catalog create/edit screen
   (`EditListFieldsScreen`). Buttons don't react to taps, field cards appear and
   disappear instantly, and adding a field gives no cue that something happened
   below the fold.
2. **The keyboard covers the text input** being edited, most painfully when adding
   an item (`ItemFormScreen`). Its `ScrollView` has no keyboard handling, so the
   on-screen keyboard sits on top of the focused input and the user can't see what
   they're typing.

## Constraints & environment

- `react-native-reanimated` **4.5.0** is already installed. **No new native
  dependencies** — the Android release pipeline stays untouched.
- Expo `~57.0.4`, React Native `0.86.0` (new architecture).
- Per `AGENTS.md`: verify exact reanimated-4 / Expo v57 APIs against the versioned
  docs (`https://docs.expo.dev/versions/v57.0.0/`) before writing code —
  specifically `useAnimatedKeyboard`, `LinearTransition`, and the entering/exiting
  layout animations.

## Design

### Part A — Field editor feedback & animations (`EditListFieldsScreen.tsx`)

The screen renders fields via a `FlatList`, with `addField` (appends to the end),
`removeField`, an "+ Add field" `Pressable`, and a "Save" `Pressable`.

1. **Card enter / exit / reflow animations.** Convert the `FlatList` to reanimated's
   `Animated.FlatList` and wrap each field card's root `View` in an `Animated.View`:
   - `entering` → new field **slides up + fades in** (`FadeInDown` /
     `SlideInUp`, ~250 ms).
   - `exiting` → removed field **slides left + fades out** (`SlideOutLeft`,
     ~200 ms). (User referenced slide-right but deferred the choice; slide-left
     reads as dismissing the card.)
   - `itemLayoutAnimation={LinearTransition}` on the list so the remaining cards
     **glide** into their new positions after an add/remove instead of snapping.

2. **Auto-scroll to the newly added field.** Keep a `ref` to the list. After
   `addField` appends (new field is last), scroll to the end on the next frame
   (`requestAnimationFrame` / `onContentSizeChange` guard) with
   `scrollToEnd({ animated: true })`, so the view "moves down" to reveal the new
   card.

3. **Button press feedback.** Introduce a small reusable `PressableScale` component
   (reanimated-based) that scales to ~0.96 and dips opacity on press-in, springing
   back on release. Apply it to **"+ Add field"**, **"Remove field"**, and
   **"Save"** so every add/remove tap has a tactile response.

### Part B — Keyboard no longer covers inputs (both screens)

4. **New shared `KeyboardAwareScrollView` component** (`src/components/`) wrapping
   `Animated.ScrollView`. It:
   - uses `useAnimatedKeyboard()` to apply an animated bottom padding equal to the
     keyboard height (content lifts in sync with the keyboard), and
   - scrolls the focused input into view on focus.
   - sets `keyboardShouldPersistTaps="handled"`.
   `ItemFormScreen` swaps its bare `ScrollView` for this component; its existing
   `contentContainerClassName` padding/gap is preserved.

5. **`EditListFieldsScreen`** is a `FlatList` (can't be nested in a ScrollView), so
   it gets the same `useAnimatedKeyboard()` bottom-padding treatment applied to the
   list's content container, plus `keyboardShouldPersistTaps="handled"`, so
   field-name inputs lift above the keyboard.

## Components & boundaries

- `PressableScale` — presentational; props: standard `Pressable` props + children.
  No knowledge of fields or forms.
- `KeyboardAwareScrollView` — presentational scroll container; encapsulates all
  `useAnimatedKeyboard` + scroll-to-focus logic so neither screen duplicates it.
- The keyboard-padding logic for the `FlatList` case may share a tiny
  `useKeyboardPadding()` hook with `KeyboardAwareScrollView` if it reduces
  duplication; decided during implementation.

## Out of scope

- Haptics (would need `expo-haptics`; visual feedback only for now).
- Swipe-to-remove gestures (would need `react-native-gesture-handler`).
- Any change to Firestore, validation, or the domain layer.

## Verification

UI-only change with no meaningful unit-test surface for animations. Verify
on-device:
- Adding a field animates in and the screen scrolls to reveal it.
- Removing a field slides it left and the rest glide up.
- "+ Add field" / "Remove field" / "Save" visibly react to taps.
- On the add-item screen and the field editor, focusing any input lifts it clear
  of the keyboard.
