import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useUser } from '@clerk/expo';

import { floatingShadow, palette, radii, spacing, type } from '@/theme';
import { useApi } from '@/lib/ApiContext';
import { parseAvatar } from '@/lib/avatar';

type EmojiCategory = {
  id: string;
  name: string;
  emojis: string[];
};

const CATEGORIES: EmojiCategory[] = [
  {
    id: 'cute',
    name: 'Pastelowe',
    emojis: ['🌸', '🌷', '✨', '💖', '🎀', '🍓', '🦋', '🧸', '🍰', '🕊️'],
  },
  {
    id: 'animals',
    name: 'Zwierzęta',
    emojis: ['🦊', '🐱', '🐰', '🐼', '🐨', '🐯', '🦄', '🐣', '🐶', '🐝'],
  },
  {
    id: 'vibes',
    name: 'Symbole',
    emojis: ['⚡', '💫', '🌙', '💅', '🎧', '🕶️', '👑', '🚀', '🔮', '🛡️'],
  },
  {
    id: 'chill',
    name: 'Styl',
    emojis: ['☕', '🥑', '🍒', '🌻', '🎨', '📚', '🧩', '🌿', '💎', '🤍'],
  },
];

type AuraOption = {
  id: string;
  name: string;
  hex: string;
};

const AURAS: AuraOption[] = [
  { id: 'fuchsia', name: 'Róż', hex: '#F472B6' },
  { id: 'purple', name: 'Fiolet', hex: '#A78BFA' },
  { id: 'coral', name: 'Koral', hex: '#E05624' },
  { id: 'emerald', name: 'Mięta', hex: '#34D399' },
  { id: 'amber', name: 'Złoto', hex: '#FBBF24' },
  { id: 'sky', name: 'Błękit', hex: '#38BDF8' },
];

export function ProfileSettingsCard() {
  const api = useApi();
  const { user } = useUser();
  // Read through a ref so a new Clerk `user` object identity does not re-run the
  // load effect and overwrite whatever the user is currently typing. Depending on
  // `user` directly re-fetched on every identity change, which silently discarded
  // an in-progress name or emoji selection.
  const clerkFirstName = user?.firstName;
  const clerkFirstNameRef = useRef(clerkFirstName);
  clerkFirstNameRef.current = clerkFirstName;

  const [displayName, setDisplayName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🌸');
  const [selectedAura, setSelectedAura] = useState('#F472B6');
  const [activeCategory, setActiveCategory] = useState<string>('cute');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const fallbackName = clerkFirstNameRef.current;
      try {
        const profile = await api.myProfile();
        if (cancelled) return;
        if (profile.displayName) {
          setDisplayName(profile.displayName);
        } else if (fallbackName) {
          setDisplayName(fallbackName);
        }

        if (profile.avatarUrl) {
          const { emoji, aura } = parseAvatar(profile.avatarUrl);
          setSelectedEmoji(emoji);
          if (aura) setSelectedAura(aura);
        }
      } catch {
        if (fallbackName && !cancelled) {
          setDisplayName(fallbackName);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const handleSelectEmoji = useCallback((emoji: string) => {
    setSelectedEmoji(emoji);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleSelectAura = useCallback((hex: string) => {
    setSelectedAura(hex);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSavedNotice(false);

    try {
      const cleanName = displayName.trim();
      if (cleanName.length > 120) {
        setError('Imię jest za długie (maks. 120 znaków).');
        return;
      }
      const cleanEmoji = selectedEmoji.trim() || '🌸';
      // Store emoji with signature aura: "emoji|#HEX"
      const payloadAvatar = `${cleanEmoji}|${selectedAura}`;
      if (payloadAvatar.length > 500) {
        setError('Wybrany awatar jest za długi.');
        return;
      }

      await api.updateProfile({
        displayName: cleanName ? cleanName : null,
        avatarUrl: payloadAvatar,
      });

      setSavedNotice(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian.');
    } finally {
      setSaving(false);
    }
  }, [api, displayName, selectedAura, selectedEmoji]);

  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0]!;

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={palette.textMuted} style={styles.spinner} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Live Map Marker Preview */}
      <View style={styles.previewBox}>
        <Text style={styles.previewTitle}>Podgląd znacznika</Text>

        <View style={styles.previewCenter}>
          {/* Animated concentric radar halo */}
          <View style={[styles.haloOuter, { backgroundColor: selectedAura }]} />
          <View style={[styles.haloInner, { backgroundColor: selectedAura }]} />

          {/* Marker Component Preview without green dot */}
          <View style={[styles.previewNamePill, floatingShadow(4)]}>
            <Text style={styles.previewNameText} numberOfLines={1}>
              {displayName.trim() || 'Twoje imię'}
            </Text>
          </View>

          <View
            style={[styles.previewAvatarDisc, { borderColor: selectedAura }, floatingShadow(8)]}
          >
            <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
          </View>

          <View style={[styles.previewPinTip, { borderTopColor: selectedAura }]} />
          <View style={[styles.previewAnchorDot, { backgroundColor: selectedAura }]} />
        </View>

        <Text style={styles.previewCaption}>Tak Twój znacznik widzą przyjaciółki na mapie</Text>
      </View>

      {/* Name Input */}
      <View style={styles.inputSection}>
        <Text style={styles.fieldLabel}>Twoje imię</Text>
        <TextInput
          style={styles.textInput}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="np. Kasia, Ola, Zosia"
          placeholderTextColor={palette.textFaint}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={30}
        />
      </View>

      {/* Signature Aura Color Selector */}
      <View style={styles.pickerSection}>
        <Text style={styles.fieldLabel}>Kolor aury</Text>
        <View style={styles.aurasGrid}>
          {AURAS.map((aura) => {
            const isSelected = selectedAura === aura.hex;
            return (
              <Pressable
                key={aura.id}
                style={[
                  styles.auraPill,
                  isSelected && [styles.auraPillSelected, { borderColor: aura.hex }],
                ]}
                onPress={() => handleSelectAura(aura.hex)}
                accessibilityRole="button"
                accessibilityLabel={`Aura ${aura.name}`}
              >
                <View style={[styles.auraSwatch, { backgroundColor: aura.hex }]} />
                <Text style={[styles.auraText, isSelected && styles.auraTextSelected]}>
                  {aura.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Emoji Picker Section */}
      <View style={styles.pickerSection}>
        <Text style={styles.fieldLabel}>Wybierz emoji</Text>

        {/* Category Tabs */}
        <View style={styles.tabsRow}>
          {CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategory;
            return (
              <Pressable
                key={cat.id}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => {
                  setActiveCategory(cat.id);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
              >
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Symmetrical 5x2 Emoji Grid */}
        <View style={styles.emojiGrid}>
          {currentCategory.emojis.map((emoji) => {
            const isSelected = selectedEmoji === emoji;
            return (
              <Pressable
                key={emoji}
                style={[
                  styles.emojiItem,
                  isSelected && [styles.emojiItemSelected, { borderColor: selectedAura }],
                ]}
                onPress={() => handleSelectEmoji(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`Wybierz emoji ${emoji}`}
              >
                <Text style={styles.emojiItemGlyph}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Error / Success Feedback */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {savedNotice ? (
        <View style={styles.savedNoticeBox}>
          <Text style={styles.savedNoticeGlyph}>✓</Text>
          <Text style={styles.savedNoticeText}>Zapisano profil pomyślnie</Text>
        </View>
      ) : null}

      {/* Save Button */}
      <Pressable
        style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator color={palette.surfaceSolid} />
        ) : (
          <Text style={styles.saveButtonText}>Zapisz profil</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    backgroundColor: palette.surfaceRaised,
    padding: spacing.lg,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  spinner: {
    paddingVertical: spacing.xl,
  },
  previewBox: {
    backgroundColor: '#0D0F14',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  previewTitle: {
    ...type.caption,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  previewCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    width: '100%',
  },
  haloOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0.15,
  },
  haloInner: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0.28,
  },
  previewNamePill: {
    backgroundColor: 'rgba(17, 19, 24, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 4,
    zIndex: 2,
  },
  previewNameText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  previewAvatarDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#161922',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewEmoji: {
    fontSize: 27,
    textAlign: 'center',
    lineHeight: 34,
  },
  previewPinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
    zIndex: 2,
  },
  previewAnchorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  previewCaption: {
    ...type.caption,
    fontSize: 11,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  inputSection: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...type.label,
    fontSize: 12,
    color: palette.textMuted,
  },
  textInput: {
    ...type.body,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
  },
  pickerSection: {
    gap: spacing.sm,
  },
  aurasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  auraPill: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  auraPillSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  auraSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  auraText: {
    ...type.caption,
    fontSize: 11,
    color: palette.textMuted,
  },
  auraTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: radii.pill,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  tabButtonActive: {
    backgroundColor: palette.surfaceRaised,
  },
  tabButtonText: {
    ...type.caption,
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
  },
  tabButtonTextActive: {
    color: palette.text,
    fontWeight: '700',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    paddingVertical: spacing.xs,
  },
  emojiItem: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: 1.05 }],
  },
  emojiItemGlyph: {
    fontSize: 24,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: palette.text,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    ...type.body,
    fontWeight: '700',
    color: palette.surfaceSolid,
  },
  savedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  savedNoticeGlyph: {
    color: palette.success,
    fontSize: 14,
    fontWeight: '700',
  },
  savedNoticeText: {
    ...type.caption,
    color: palette.success,
    fontWeight: '600',
  },
  errorText: {
    ...type.caption,
    color: palette.level3,
    textAlign: 'center',
  },
});
