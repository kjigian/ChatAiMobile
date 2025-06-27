import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ChatMessage, MessageVersion, hasMultipleVersions, getMessageVersions } from '@/utils/conversations';

interface MessageVersionsProps {
  message: ChatMessage;
  conversationId: string;
  messageIndex: number;
  onVersionSwitch: (versionNumber: number) => Promise<void>;
}

export const MessageVersions: React.FC<MessageVersionsProps> = ({
  message,
  conversationId,
  messageIndex,
  onVersionSwitch,
}) => {
  const [showVersions, setShowVersions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  if (!hasMultipleVersions(message)) {
    return null; // Don't show if there's only one version
  }

  const versions = getMessageVersions(message);
  const activeVersion = versions.find(v => v.isActive);

  const handleVersionSwitch = async (versionNumber: number) => {
    setIsLoading(true);
    try {
      await onVersionSwitch(versionNumber);
      setShowVersions(false);
    } catch (error) {
      console.error('Failed to switch version:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString([], { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderVersionItem = ({ item }: { item: MessageVersion }) => (
    <TouchableOpacity
      style={[
        styles.versionItem,
        { borderBottomColor: borderColor },
        item.isActive && { backgroundColor: primaryColor + '20' }
      ]}
      onPress={() => handleVersionSwitch(item.version)}
      disabled={isLoading || item.isActive}
    >
      <View style={styles.versionHeader}>
        <ThemedText style={[styles.versionTitle, { color: textColor }]}>
          Version {item.version} {item.isActive && '(Current)'}
        </ThemedText>
        <ThemedText style={[styles.versionTimestamp, { color: textColor }]}>
          {formatTimestamp(item.timestamp)}
        </ThemedText>
      </View>
      
      {item.provider && (
        <ThemedText style={[styles.versionProvider, { color: primaryColor }]}>
          {item.provider}
        </ThemedText>
      )}
      
      <ThemedText 
        style={[styles.versionPreview, { color: textColor }]} 
        numberOfLines={3}
      >
        {item.text}
      </ThemedText>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    versionIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: secondaryColor,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    versionText: {
      fontSize: 11,
      opacity: 0.8,
      marginRight: 4,
    },
    versionBadge: {
      backgroundColor: primaryColor,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginRight: 4,
    },
    versionBadgeText: {
      fontSize: 10,
      color: 'white',
      fontWeight: 'bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      margin: 20,
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor,
      backgroundColor,
      maxWidth: 400,
      width: '90%',
      maxHeight: '70%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 16,
    },
    versionsList: {
      maxHeight: 400,
    },
    versionItem: {
      padding: 12,
      borderBottomWidth: 1,
      marginBottom: 8,
      borderRadius: 8,
    },
    versionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    versionTitle: {
      fontSize: 14,
      fontWeight: '600',
    },
    versionTimestamp: {
      fontSize: 11,
      opacity: 0.7,
    },
    versionProvider: {
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 4,
    },
    versionPreview: {
      fontSize: 13,
      lineHeight: 18,
      opacity: 0.8,
    },
    closeButton: {
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: primaryColor,
      borderRadius: 8,
      marginTop: 16,
    },
    closeButtonText: {
      color: 'white',
      fontWeight: '500',
    },
  });

  return (
    <View>
      <TouchableOpacity
        style={styles.versionIndicator}
        onPress={() => setShowVersions(true)}
      >
        <View style={styles.versionBadge}>
          <ThemedText style={styles.versionBadgeText}>
            {activeVersion?.version || 1}
          </ThemedText>
        </View>
        <ThemedText style={[styles.versionText, { color: textColor }]}>
          {versions.length} versions
        </ThemedText>
        <ThemedText style={[styles.versionText, { color: textColor }]}>
          📝
        </ThemedText>
      </TouchableOpacity>

      <Modal
        visible={showVersions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVersions(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>
              Message Versions
            </ThemedText>
            
            <FlatList
              data={versions.sort((a, b) => b.version - a.version)} // Newest first
              renderItem={renderVersionItem}
              keyExtractor={item => `${item.version}`}
              style={styles.versionsList}
              showsVerticalScrollIndicator={false}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowVersions(false)}
            >
              <ThemedText style={styles.closeButtonText}>
                Close
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
};

export default MessageVersions;