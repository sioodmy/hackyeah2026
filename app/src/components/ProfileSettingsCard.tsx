import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useUser } from '@clerk/expo';

import { colorForLevel, floatingShadow, palette, radii, spacing, type } from '@/theme';
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
    name: '🌸 Pastel & Słodkie',
    emojis: ['🌸', '🌷', '✨', '💖', '🎀', '🍓', '🦋', '🧸', '🍰', '🕊️'],
  },
  {
    id: 'animals',
    name: '🦊 Zwierzaki',
    emojis: ['🦊', '🐱', '🐰', '🐼', '🐨', '🐯', '🦄', '🐣', '🐶', '🐝'],
  },
  {
    id: 'vibes',
    name: '⚡ Moc & Bunt',
    emojis: ['⚡', '🔥', '🌙', '💅', '🎧', '🕶️', '👑', '🚀', '🔮', '🛡️'],
  },
  {
    id: 'chill',
    name: '☕ Chill & Styl',
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
  const [customEmoji, setCustomEmoji] = useState('');
  const [previewLevel, setPreviewLevel] = useState<number>(0);

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
    setCustomEmoji('');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleSelectAura = useCallback((hex: string) => {
    setSelectedAura(hex);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleCustomEmojiChange = useCallback((text: string) => {
    setCustomEmoji(text);
    const trimmed = text.trim();
    if (trimmed) {
      const chars = Array.from(trimmed);
      const lastChar = chars[chars.length - 1];
      if (lastChar) {
        setSelectedEmoji(lastChar);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSavedNotice(false);

    try {
      const cleanName = displayName.trim();
      const cleanEmoji = selectedEmoji.trim() || '🌸';
      // Store emoji with signature aura: "emoji|#HEX"
      const payloadAvatar = `${cleanEmoji}|${selectedAura}`;

      await api.updateProfile({
        displayName: cleanName || null,
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
  const previewAccentColor = previewLevel > 0 ? colorForLevel(previewLevel) : selectedAura;

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={palette.textMuted} style={styles.spinner} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Live Map Marker Preview with Emergency Level Simulator */}
      <View style={styles.previewBox}>
        <View style={styles.previewHeaderRow}>
          <Text style={styles.previewBadge}>PODGLĄD TWOJEGO ZNACZNIKA</Text>
          <Text style={[styles.previewStatusTag, { color: previewAccentColor }]}>
            {previewLevel === 0 ? 'Normalny' : `Poziom ${previewLevel}`}
          </Text>
        </View>

        <View style={styles.previewCenter}>
          {/* Animated concentric radar halo */}
          <View
            style={[
              styles.haloOuter,
              { backgroundColor: previewAccentColor, opacity: previewLevel > 0 ? 0.22 : 0.12 },
            ]}
          />
          <View
            style={[
              styles.haloInner,
              { backgroundColor: previewAccentColor, opacity: previewLevel > 0 ? 0.35 : 0.25 },
            ]}
          />

          {/* Marker Component Preview */}
          <View style={[styles.previewNamePill, floatingShadow(4)]}>
            <View
              style={[
                styles.previewLiveDot,
                {
                  backgroundColor: previewLevel > 0 ? colorForLevel(previewLevel) : palette.success,
                },
              ]}
            />
            <Text style={styles.previewNameText} numberOfLines={1}>
              {displayName.trim() || 'Twoje Imię'}
            </Text>
          </View>

          <View
            style={[
              styles.previewAvatarDisc,
              { borderColor: previewAccentColor },
              floatingShadow(8),
            ]}
          >
            <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
          </View>

          <View style={[styles.previewPinTip, { borderTopColor: previewAccentColor }]} />
          <View style={[styles.previewAnchorDot, { backgroundColor: previewAccentColor }]} />
        </View>

        {/* Emergency Simulator Switch */}
        <View style={styles.simulatorRow}>
          <Text style={styles.simulatorLabel}>Symuluj stan:</Text>
          <View style={styles.simulatorButtons}>
            {[0, 1, 2, 3].map((lvl) => {
              const active = previewLevel === lvl;
              return (
                <Pressable
                  key={lvl}
                  style={[styles.simButton, active && styles.simButtonActive]}
                  onPress={() => {
                    setPreviewLevel(lvl);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                >
                  <Text
                    style={[
                      styles.simButtonText,
                      active && { color: lvl === 0 ? palette.text : colorForLevel(lvl) },
                    ]}
                  >
                    {lvl === 0 ? 'Baza' : `Lvl ${lvl}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.previewCaption}>
          Tak Twój znacznik widzą przyjaciółki na mapie wskazując Twoją lokalizację
        </Text>
      </View>

      {/* Name Input */}
      <View style={styles.inputSection}>
        <Text style={styles.fieldLabel}>TWOJE IMIĘ / PSEUDONIM</Text>
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
        <Text style={styles.fieldLabel}>TWOJA POŚWIATA NA MAPIE (AURA)</Text>
        <View style={styles.aurasRow}>
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
        <Text style={styles.fieldLabel}>TWOJE EMOJI / AWATAR</Text>

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

        {/* Emoji Grid */}
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

        {/* Custom Emoji Input */}
        <View style={styles.customEmojiRow}>
          <Text style={styles.customEmojiLabel}>Wpisz dowolne własne emoji:</Text>
          <TextInput
            style={styles.customEmojiInput}
            value={customEmoji}
            onChangeText={handleCustomEmojiChange}
            placeholder="✨"
            placeholderTextColor={palette.textFaint}
            maxLength={4}
          />
        </View>
      </View>

      {/* Error / Success Feedback */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {savedNotice ? (
        <View style={styles.savedNoticeBox}>
          <Text style={styles.savedNoticeGlyph}>✓</Text>
          <Text style={styles.savedNoticeText}>Zapisano profil pomyślnie!</Text>
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
          <Text style={styles.saveButtonText}>Zapisz profil i awatar</Text>
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
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  previewBadge: {
    ...type.label,
    fontSize: 9,
    letterSpacing: 1,
    color: palette.textFaint,
  },
  previewStatusTag: {
    ...type.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  },
  haloInner: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  previewNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17, 19, 24, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 4,
    zIndex: 2,
  },
  previewLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  simulatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  simulatorLabel: {
    ...type.caption,
    fontSize: 10,
    color: palette.textFaint,
  },
  simulatorButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  simButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  simButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  simButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textFaint,
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
    fontSize: 11,
    letterSpacing: 0.8,
    color: palette.textMuted,
    textTransform: 'uppercase',
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
  aurasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  auraPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    fontSize: 10,
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
    gap: 8,
    paddingVertical: spacing.xs,
    justifyContent: 'space-between',
  },
  emojiItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: 1.08 }],
  },
  emojiItemGlyph: {
    fontSize: 22,
  },
  customEmojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  customEmojiLabel: {
    ...type.caption,
    color: palette.textMuted,
    fontSize: 12,
  },
  customEmojiInput: {
    ...type.body,
    fontSize: 18,
    color: palette.text,
    textAlign: 'center',
    minWidth: 60,
    paddingVertical: spacing.xs,
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
