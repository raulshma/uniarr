import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  List,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaPoster } from './MediaPoster';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { Series } from '@/models/media.types';
import type { Movie } from '@/models/movie.types';
import type { QualityProfile } from '@/models/media.types';
import { spacing } from '@/theme/spacing';

export type MediaItem = Series | Movie;

interface MediaEditorProps {
  visible: boolean;
  mediaItem: MediaItem | null;
  onDismiss: () => void;
  onSave: (updatedItem: MediaItem) => Promise<void>;
  serviceId: string;
}

interface Tag {
  id: number;
  label: string;
}

const MediaEditor: React.FC<MediaEditorProps> = ({
  visible,
  mediaItem,
  onDismiss,
  onSave,
  serviceId,
}) => {
  const theme = useTheme<AppTheme>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editedItem, setEditedItem] = useState<MediaItem | null>(null);

  const manager = ConnectorManager.getInstance();
  const connector = manager.getConnector(serviceId);

  useEffect(() => {
    if (visible && mediaItem) {
      setEditedItem(mediaItem);
      loadMetadata();
    }
  }, [visible, mediaItem]);

  const loadMetadata = useCallback(async () => {
    if (!connector) return;

    setIsLoading(true);
    try {
      const [profiles, tagList] = await Promise.all([
        (connector as any).getQualityProfiles(),
        (connector as any).getTags(),
      ]);

      setQualityProfiles(profiles);
      setTags(tagList);
    } catch (error) {
      console.error('Failed to load metadata:', error);
      Alert.alert('Error', 'Failed to load metadata for editing.');
    } finally {
      setIsLoading(false);
    }
  }, [connector]);

  const handleSave = useCallback(async () => {
    if (!editedItem || !connector) return;

    setIsSaving(true);
    try {
      if (connector.config.type === 'sonarr') {
        const series = editedItem as Series;
        await (connector as any).updateSeries(editedItem.id, {
          title: series.title,
          monitored: series.monitored,
          qualityProfileId: series.qualityProfileId,
          tags: series.tags,
        });
      } else if (connector.config.type === 'radarr') {
        const movie = editedItem as Movie;
        await (connector as any).updateMovie(editedItem.id, {
          title: movie.title,
          monitored: movie.monitored,
          qualityProfileId: movie.qualityProfileId,
          tags: movie.tags,
        });
      }

      await onSave(editedItem);
      onDismiss();
    } catch (error) {
      console.error('Failed to save media:', error);
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  }, [editedItem, connector, onSave, onDismiss]);

  const handleRefreshMetadata = useCallback(async () => {
    if (!editedItem || !connector) return;

    try {
      if (connector.config.type === 'sonarr') {
        await (connector as any).refreshSeries(editedItem.id);
      } else if (connector.config.type === 'radarr') {
        await (connector as any).refreshMovie(editedItem.id);
      }

      Alert.alert('Success', 'Metadata refresh started.');
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
      Alert.alert('Error', 'Failed to refresh metadata.');
    }
  }, [editedItem, connector]);

  const handleMoveFiles = useCallback(async () => {
    if (!editedItem || !connector) return;

    Alert.prompt(
      'Move Files',
      'Enter the new path for the media files:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: async (newPath?: string) => {
            if (!newPath?.trim()) return;

            try {
              if (connector.config.type === 'sonarr') {
                await (connector as any).moveSeries({
                  seriesId: editedItem.id,
                  destinationPath: newPath.trim(),
                  moveFiles: true,
                });
              } else if (connector.config.type === 'radarr') {
                await (connector as any).moveMovie({
                  movieId: editedItem.id,
                  destinationPath: newPath.trim(),
                  moveFiles: true,
                });
              }

              Alert.alert('Success', 'Files move operation started.');
            } catch (error) {
              console.error('Failed to move files:', error);
              Alert.alert('Error', 'Failed to move files.');
            }
          },
        },
      ],
      'plain-text',
      editedItem.path,
    );
  }, [editedItem, connector]);

  const updateEditedItem = useCallback((updates: Partial<MediaItem>) => {
    setEditedItem(prev => prev ? { ...prev, ...updates } as MediaItem : null);
  }, []);

  const toggleTag = useCallback((tagId: number) => {
    if (!editedItem) return;

    const currentTags = (editedItem as any).tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id: number) => id !== tagId)
      : [...currentTags, tagId];

    updateEditedItem({ tags: newTags } as Partial<MediaItem>);
  }, [editedItem, updateEditedItem]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    poster: {
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      marginBottom: spacing.md,
    },
    textInput: {
      marginBottom: spacing.sm,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    tagChip: {
      margin: 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
    },
    actionButton: {
      flex: 1,
      marginHorizontal: spacing.sm,
    },
  });

  if (!mediaItem || !editedItem) {
    return null;
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: '90%' }}>
        <Dialog.Title>Edit Media</Dialog.Title>
        <Dialog.ScrollArea style={{ maxHeight: '70%' }}>
          <ScrollView style={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text variant="bodyMedium" style={{ marginTop: spacing.md }}>
                  Loading metadata...
                </Text>
              </View>
            ) : (
              <>
                <MediaPoster
                  uri={editedItem.posterUrl}
                  size={120}
                  borderRadius={16}
                  style={styles.poster}
                />

                <Text variant="headlineSmall" style={styles.title}>
                  {editedItem.title}
                </Text>

                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Basic Information
                  </Text>

                  <TextInput
                    label="Title"
                    value={editedItem.title}
                    onChangeText={(text) => updateEditedItem({ title: text })}
                    style={styles.textInput}
                  />

                  <View style={styles.switchRow}>
                    <Text variant="bodyMedium">Monitored</Text>
                    <Switch
                      value={(editedItem as any).monitored}
                      onValueChange={(value) => updateEditedItem({ monitored: value } as Partial<MediaItem>)}
                    />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Quality Profile
                  </Text>
                  {qualityProfiles.map((profile) => (
                    <List.Item
                      key={profile.id}
                      title={profile.name}
                      onPress={() => updateEditedItem({ qualityProfileId: profile.id } as Partial<MediaItem>)}
                      right={() =>
                        (editedItem as any).qualityProfileId === profile.id ? (
                          <List.Icon icon="check" />
                        ) : null
                      }
                    />
                  ))}
                </View>

                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Tags
                  </Text>
                  <View style={styles.tagsContainer}>
                    {tags.map((tag) => {
                      const isSelected = (editedItem as any).tags?.includes(tag.id) || false;
                      return (
                        <Chip
                          key={tag.id}
                          selected={isSelected}
                          onPress={() => toggleTag(tag.id)}
                          style={styles.tagChip}
                        >
                          {tag.label}
                        </Chip>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Actions
                  </Text>

                  <Button
                    mode="outlined"
                    onPress={handleRefreshMetadata}
                    icon="refresh"
                    style={{ marginBottom: spacing.sm }}
                  >
                    Refresh Metadata
                  </Button>

                  <Button
                    mode="outlined"
                    onPress={handleMoveFiles}
                    icon="folder-move"
                    style={{ marginBottom: spacing.sm }}
                  >
                    Move Files
                  </Button>
                </View>
              </>
            )}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving || isLoading}
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default MediaEditor;
