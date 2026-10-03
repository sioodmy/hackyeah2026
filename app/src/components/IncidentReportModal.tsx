import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ReportIncidentInput } from '@/lib/api';
import { palette, radii, spacing, type } from '@/theme';

export type IncidentReportModalProps = {
  visible: boolean;
  userCoords?: [number, number] | null; // [lng, lat]
  onClose: () => void;
  onSubmit: (data: ReportIncidentInput) => Promise<void>;
};

const CATEGORIES = [
  {
    id: 'harassment',
    label: 'Zaczepianie / Molestowanie',
    severity: 2,
    icon: '🗣️',
    color: '#FDD835',
  },
  {
    id: 'sexual_assault',
    label: 'Próba gwałtu / Napaść seksualna',
    severity: 3,
    icon: '🛑',
    color: '#D32F2F',
  },
  {
    id: 'assault',
    label: 'Napaść fizyczna / Pobicie',
    severity: 3,
    icon: '⚠️',
    color: '#F4511E',
  },
  {
    id: 'robbery',
    label: 'Rozbój / Kradzież zuchwała',
    severity: 2,
    icon: '🚨',
    color: '#FB8C00',
  },
  {
    id: 'stalking',
    label: 'Śledzenie / Podejrzana osoba',
    severity: 2,
    icon: '👀',
    color: '#AB47BC',
  },
  {
    id: 'suspicious',
    label: 'Agresywna grupa / Zastraszanie',
    severity: 1,
    icon: '👥',
    color: '#FFA000',
  },
] as const;

export function IncidentReportModal({
  visible,
  userCoords,
  onClose,
  onSubmit,
}: IncidentReportModalProps) {
  const [selectedCat, setSelectedCat] = useState<string>('harassment');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackCoords = { lat: 50.0617, lng: 19.9373 }; // Kraków Rynek
  const coords = userCoords ? { lat: userCoords[1], lng: userCoords[0] } : fallbackCoords;

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCat) ?? CATEGORIES[0]!;

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        category: selectedCat,
        severity: activeCategory.severity,
        lat: coords.lat,
        lng: coords.lng,
        title: title.trim() || activeCategory.label,
        description: description.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas wysyłania zgłoszenia');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Zgłoś zagrożenie w Krakowie</Text>
              <Text style={styles.locationSubtitle}>
                Lokalizacja: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Zgłoszenie zarejestrowane</Text>
              <Text style={styles.successDesc}>Heatmapa zagrożeń została zaktualizowana.</Text>
            </View>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>RODZAJ ZDARZENIA</Text>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCat === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.catPill,
                        isSelected && {
                          borderColor: cat.color,
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        },
                      ]}
                      onPress={() => setSelectedCat(cat.id)}
                    >
                      <Text style={styles.catIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.catLabel,
                          isSelected && { color: '#FFFFFF', fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>OPCJONALNY TYTUŁ LUB MIEJSCE</Text>
              <TextInput
                style={styles.input}
                placeholder="np. Ciemny zaułek, pod bramą"
                placeholderTextColor={palette.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />

              <Text style={styles.sectionLabel}>SZCZEGÓŁY ZDARZENIA</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Opisz co się wydarzyło, ilu było sprawców..."
                placeholderTextColor={palette.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                maxLength={500}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Dodaj do mapy zagrożeń</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#181A20',
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...type.title,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationSubtitle: {
    ...type.caption,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: palette.textMuted,
  },
  scroll: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...type.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  categoriesGrid: {
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catIcon: {
    fontSize: 16,
  },
  catLabel: {
    ...type.caption,
    fontSize: 13,
    color: palette.text,
    flex: 1,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  errorText: {
    ...type.caption,
    color: palette.level3,
    marginTop: spacing.sm,
  },
  submitBtn: {
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  submitBtnText: {
    ...type.label,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  successIcon: {
    fontSize: 48,
    color: '#4CAF50',
    marginBottom: spacing.sm,
  },
  successTitle: {
    ...type.title,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  successDesc: {
    ...type.caption,
    color: palette.textMuted,
  },
});
