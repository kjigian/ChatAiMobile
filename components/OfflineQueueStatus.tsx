import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { messageQueue, QueuedMessage } from '@/utils/messageQueue';
import { logger } from '@/utils/logger';

interface OfflineQueueStatusProps {
  onRefresh?: () => void;
}

export const OfflineQueueStatus: React.FC<OfflineQueueStatusProps> = ({ onRefresh }) => {
  const [queueStatus, setQueueStatus] = useState({
    pending: 0,
    failed: 0,
    total: 0,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [queueItems, setQueueItems] = useState<QueuedMessage[]>([]);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondaryBackground');

  useEffect(() => {
    const updateStatus = () => {
      const queue = messageQueue.getQueue();
      const pending = messageQueue.getPendingCount();
      const failed = messageQueue.getFailedCount();
      
      setQueueStatus({
        pending,
        failed,
        total: queue.length,
      });
      setQueueItems(queue);
    };

    // Initial load
    updateStatus();

    // Set up listener
    const unsubscribe = messageQueue.addListener(updateStatus);

    return unsubscribe;
  }, []);

  const handleRetryFailed = async () => {
    try {
      await messageQueue.retryFailedMessages();
      onRefresh?.();
      logger.log('Retried failed messages');
    } catch (error) {
      logger.error('Failed to retry messages:', error);
    }
  };

  const handleClearQueue = async () => {
    try {
      await messageQueue.clearQueue();
      onRefresh?.();
      logger.log('Cleared message queue');
    } catch (error) {
      logger.error('Failed to clear queue:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status: QueuedMessage['status']) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'sending':
        return primaryColor;
      case 'failed':
        return '#FF6B6B';
      case 'sent':
        return '#4ECDC4';
      default:
        return textColor;
    }
  };

  const getStatusIcon = (status: QueuedMessage['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'sending':
        return '📤';
      case 'failed':
        return '❌';
      case 'sent':
        return '✅';
      default:
        return '❓';
    }
  };

  const renderQueueItem = ({ item }: { item: QueuedMessage }) => (
    <View style={[styles.queueItem, { borderBottomColor: borderColor }]}>
      <View style={styles.queueItemHeader}>
        <View style={styles.statusContainer}>
          <ThemedText style={styles.statusIcon}>
            {getStatusIcon(item.status)}
          </ThemedText>
          <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText style={[styles.timestamp, { color: textColor }]}>
          {formatTimestamp(item.timestamp)}
        </ThemedText>
      </View>
      
      <ThemedText style={[styles.messagePreview, { color: textColor }]} numberOfLines={2}>
        {item.message.text}
      </ThemedText>
      
      {item.error && (
        <ThemedText style={[styles.errorText, { color: '#FF6B6B' }]} numberOfLines={1}>
          Error: {item.error}
        </ThemedText>
      )}
      
      <ThemedText style={[styles.retryInfo, { color: textColor }]}>
        Retry {item.retryCount}/{item.maxRetries}
      </ThemedText>
    </View>
  );

  if (queueStatus.total === 0) {
    return null; // Don't show anything if queue is empty
  }

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1000,
    },
    statusButton: {
      backgroundColor: secondaryColor,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
    },
    badgeContainer: {
      flexDirection: 'row',
      gap: 4,
    },
    badge: {
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 2,
      minWidth: 16,
      alignItems: 'center',
    },
    pendingBadge: {
      backgroundColor: '#FFA500',
    },
    failedBadge: {
      backgroundColor: '#FF6B6B',
    },
    badgeText: {
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
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
    },
    closeButton: {
      padding: 4,
    },
    closeText: {
      fontSize: 20,
      color: primaryColor,
    },
    summaryContainer: {
      backgroundColor: secondaryColor,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    summaryText: {
      fontSize: 14,
      color: textColor,
      marginBottom: 4,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignItems: 'center',
    },
    retryButton: {
      backgroundColor: primaryColor,
    },
    clearButton: {
      backgroundColor: '#FF6B6B',
    },
    actionButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '500',
    },
    queueList: {
      maxHeight: 300,
    },
    queueItem: {
      padding: 12,
      borderBottomWidth: 1,
      marginBottom: 8,
    },
    queueItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusIcon: {
      fontSize: 14,
    },
    timestamp: {
      fontSize: 12,
      opacity: 0.7,
    },
    messagePreview: {
      fontSize: 14,
      marginBottom: 4,
    },
    errorText: {
      fontSize: 12,
      marginBottom: 4,
    },
    retryInfo: {
      fontSize: 12,
      opacity: 0.6,
    },
    emptyState: {
      alignItems: 'center',
      padding: 20,
    },
    emptyText: {
      fontSize: 14,
      color: textColor,
      opacity: 0.7,
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.statusButton}
        onPress={() => setShowDetails(true)}
      >
        <ThemedText style={[styles.statusText, { color: textColor }]}>
          Queue
        </ThemedText>
        <View style={styles.badgeContainer}>
          {queueStatus.pending > 0 && (
            <View style={[styles.badge, styles.pendingBadge]}>
              <ThemedText style={styles.badgeText}>{queueStatus.pending}</ThemedText>
            </View>
          )}
          {queueStatus.failed > 0 && (
            <View style={[styles.badge, styles.failedBadge]}>
              <ThemedText style={styles.badgeText}>{queueStatus.failed}</ThemedText>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={showDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Message Queue</ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetails(false)}
              >
                <ThemedText style={styles.closeText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryContainer}>
              <ThemedText style={styles.summaryText}>
                Total messages: {queueStatus.total}
              </ThemedText>
              <ThemedText style={styles.summaryText}>
                Pending: {queueStatus.pending}
              </ThemedText>
              <ThemedText style={styles.summaryText}>
                Failed: {queueStatus.failed}
              </ThemedText>
            </View>

            {queueStatus.total > 0 && (
              <View style={styles.actionButtons}>
                {queueStatus.failed > 0 && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.retryButton]}
                    onPress={handleRetryFailed}
                  >
                    <ThemedText style={styles.actionButtonText}>
                      Retry Failed
                    </ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.clearButton]}
                  onPress={handleClearQueue}
                >
                  <ThemedText style={styles.actionButtonText}>
                    Clear Queue
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {queueItems.length > 0 ? (
              <FlatList
                data={queueItems}
                renderItem={renderQueueItem}
                keyExtractor={item => item.id}
                style={styles.queueList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyText}>
                  No messages in queue
                </ThemedText>
              </View>
            )}
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
};

export default OfflineQueueStatus;