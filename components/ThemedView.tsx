import React from 'react';
import { View, Text, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ children, style, lightColor, darkColor, ...otherProps }: React.PropsWithChildren<ThemedViewProps>) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  const processedChildren = React.Children.map(children, (child, index) => {
    if (typeof child === 'string') {
      const trimmed = child.trim();
      if (!trimmed) {
        return null; // skip empty strings
      }
      return <Text key={`text-${index}`}>{trimmed}</Text>; // wrap non-empty strings
    }
    return child;
  });
  return (
    <View style={[{ backgroundColor }, style]} {...otherProps}>
      {processedChildren}
    </View>
  );
}
