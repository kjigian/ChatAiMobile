import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ children, style, lightColor, darkColor, ...otherProps }: React.PropsWithChildren<ThemedViewProps>) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  const cleanedChildren = React.Children.toArray(children).filter(
    (child) => !(typeof child === 'string' && child.trim() === '')
  );
  return (
    <View style={[{ backgroundColor }, style]} {...otherProps}>
      {cleanedChildren}
    </View>
  );
}
