import * as Haptics from 'expo-haptics';
import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colorForLevel, floatingShadow, palette, radii } from '@/theme';
import type { SmoothedPoint } from '@/hooks/useSmoothedLocations';

export type FriendMapMarkerProps = {
  point: SmoothedPoint;
  level: number;
  isStale?: boolean;
};

/**
 * Aesthetic map pin for friends:
 * - Glowing avatar badge with the friend's custom emoji and signature aura.
 * - Pulsing animated radar ring when live.
 * - Translucent glassmorphic name pill.
 * - Interactive tap to expand detail callout (accuracy, status).
 * - Sharp pin tip pointing to the exact coordinate.
 */
export const FriendMapMarker = memo(function FriendMapMarker({
  point,
  level,
  isStale = false,
}: FriendMapMarkerProps) {
  const [expanded, setExpanded] = useState(false);

  // Parse emoji and optional signature aura color (format: "emoji" or "emoji|#HEX")
  const avatarRaw = point.avatarUrl?.trim() || '🌸';
  const [emojiPart, auraPart] = avatarRaw.includes('|') ? avatarRaw.split('|') : [avatarRaw, null];
  const emoji = emojiPart?.trim() || '🌸';

  // Threat level color overrides or signature aura in safe mode
  const threatAccent = colorForLevel(level);
  const accentColor = level > 0 ? threatAccent : auraPart || palette.level1;

  const displayName = point.displayName || point.userId.slice(0, 8);

  // Smooth breathing animation for the outer halo
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isStale) return undefined;

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.28,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.12,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.45,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isStale, pulseAnim, pulseOpacity]);

  const handlePress = () => {
    setExpanded((prev) => !prev);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <Pressable onPress={handlePress} style={[styles.container, isStale && styles.staleContainer]}>
      {/* Expanded detail callout on tap */}
      {expanded ? (
        <View style={[styles.calloutCard, floatingShadow(12)]}>
          <View style={styles.calloutHeader}>
            <View style={[styles.calloutAvatarBadge, { borderColor: accentColor }]}>
              <Text style={styles.calloutEmoji}>{emoji}</Text>
            </View>
            <View style={styles.calloutMeta}>
              <Text style={styles.calloutTitle} numberOfLines={1}>
                {displayName}
              </Text>
              <Text
                style={[
                  styles.calloutStatus,
                  { color: isStale ? palette.textMuted : palette.success },
                ]}
              >
                {isStale ? '● Nieaktywna' : '● Na żywo'}
              </Text>
            </View>
          </View>
          {point.acc != null ? (
            <Text style={styles.calloutDetail}>GPS: ±{Math.round(point.acc)} m</Text>
          ) : null}
        </View>
      ) : null}

      {/* Name label pill */}
      <View style={[styles.namePill, floatingShadow(4)]}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isStale ? palette.textMuted : palette.success },
          ]}
        />
        <Text style={styles.nameText} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      {/* Avatar disc with pulsing live halo */}
      <View style={styles.avatarWrapper}>
        {!isStale ? (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                borderColor: accentColor,
                opacity: pulseOpacity,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        ) : null}

        <View style={[styles.avatarDisc, { borderColor: accentColor }, floatingShadow(8)]}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </View>
      </View>

      {/* Pin tip pointing to the exact coordinate */}
      <View style={[styles.pinTip, { borderTopColor: accentColor }]} />
      <View style={[styles.anchorDot, { backgroundColor: accentColor }]} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  staleContainer: {
    opacity: 0.65,
  },
  calloutCard: {
    position: 'absolute',
    bottom: 74,
    backgroundColor: 'rgba(15, 17, 23, 0.96)',
    borderRadius: radii.card,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    width: 140,
    zIndex: 99,
    gap: 4,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calloutAvatarBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E222D',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutEmoji: {
    fontSize: 14,
  },
  calloutMeta: {
    flex: 1,
  },
  calloutTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  calloutStatus: {
    fontSize: 10,
    fontWeight: '600',
  },
  calloutDetail: {
    fontSize: 10,
    color: palette.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  namePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17, 19, 24, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 4,
    maxWidth: 120,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  avatarDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161922',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 28,
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  anchorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
