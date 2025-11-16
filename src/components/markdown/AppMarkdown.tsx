import React, { useMemo } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import Marked, {
  Renderer as DefaultRenderer,
  type MarkdownProps,
  type RendererInterface,
} from "react-native-marked";

import type { AppTheme } from "@/constants/theme";
import { typography as defaultTypography } from "@/theme/typography";

const MONO_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "Courier New",
});

type AppMarkdownProps = Omit<MarkdownProps, "renderer" | "styles"> & {
  /** Optional scale applied to typography for chat messages (1 = default) */
  fontScale?: number;
};

const AppMarkdown: React.FC<AppMarkdownProps> = ({
  value,
  flatListProps,
  fontScale,
  ...rest
}) => {
  const theme = useTheme<AppTheme>();
  // If the caller passed a numeric scale (chat uses this), prefer it.
  // Otherwise, derive an app-wide scale from the theme config by comparing
  // the current `bodyLarge` token against the default scale.
  const derivedFontScale = useMemo(() => {
    if (typeof fontScale === "number") {
      return fontScale;
    }
    const themeScale =
      (theme.custom?.typography?.bodyLarge?.fontSize ??
        defaultTypography.bodyLarge.fontSize) /
      defaultTypography.bodyLarge.fontSize;

    return themeScale ?? 0.825;
  }, [fontScale, theme.custom?.typography?.bodyLarge?.fontSize]);
  const renderer = useMemo(
    () => createRenderer(theme, derivedFontScale),
    [theme, derivedFontScale],
  );

  const mergedFlatListProps = useMemo(() => {
    const listStyle = StyleSheet.flatten(flatListProps?.style) as
      | ViewStyle
      | undefined;

    const contentContainerStyle = StyleSheet.flatten([
      { paddingBottom: theme.custom.spacing.md },
      flatListProps?.contentContainerStyle,
    ]) as ViewStyle | undefined;

    return {
      nestedScrollEnabled: true,
      scrollEnabled: false,
      extraData: derivedFontScale,
      ...flatListProps,
      style: listStyle,
      contentContainerStyle,
    };
  }, [flatListProps, theme.custom.spacing.md, derivedFontScale]);

  return (
    <Marked
      key={`md-${derivedFontScale}`}
      value={value}
      renderer={renderer}
      flatListProps={mergedFlatListProps}
      {...rest}
    />
  );
};

export default AppMarkdown;

// Builds a renderer instance with UniArr theme tokens applied to each markdown node.
const createRenderer = (theme: AppTheme, fontScale = 1): RendererInterface => {
  const defaultRenderer = new DefaultRenderer();
  const spacing = theme.custom.spacing;
  const typography = theme.custom.typography;
  const radiusScale = theme.custom.sizes?.borderRadius;
  const radiusSm = radiusScale?.sm ?? 8;
  const radiusMd = radiusScale?.md ?? 16;

  let keyIndex = 0;
  const keyPrefix = `app-md-${Math.random().toString(36).slice(2, 8)}`;
  const nextKey = () => `${keyPrefix}-${keyIndex++}`;

  const flattenText = (base?: TextStyle, override?: TextStyle) =>
    StyleSheet.flatten([base, override]) as TextStyle | undefined;

  const scaleTextStyle = (
    style?: TextStyle,
    scale = 1,
  ): TextStyle | undefined => {
    if (!style || scale === 1) return style;
    const copy = { ...style } as TextStyle;
    if (typeof copy.fontSize === "number") {
      copy.fontSize = (copy.fontSize ?? 14) * scale;
    }
    if (typeof copy.lineHeight === "number") {
      copy.lineHeight = (copy.lineHeight ?? 20) * scale;
    }
    return copy;
  };

  const flattenView = (base?: ViewStyle, override?: ViewStyle) =>
    StyleSheet.flatten([base, override]) as ViewStyle | undefined;

  const flattenImage = (base?: ImageStyle, override?: ImageStyle) =>
    StyleSheet.flatten([base, override]) as ImageStyle | undefined;

  // Use onBackground for better contrast with surface and background colors
  const textColor = theme.colors.onBackground ?? theme.colors.onSurface;
  // Use a lighter/more visible color in dark mode by preferring white tones
  const surfaceTextColor = theme.dark ? "#FFFFFF" : textColor;

  const headingStyles: Record<number, TextStyle> = {
    1: {
      ...(scaleTextStyle(
        typography.headlineLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      color: theme.colors.primary,
      marginTop: spacing.xl,
      fontWeight: "700",
      marginBottom: spacing.sm,
    },
    2: {
      ...(scaleTextStyle(
        typography.headlineMedium as TextStyle,
        fontScale,
      ) as TextStyle),
      color: theme.colors.primary,
      marginTop: spacing.lg,
      fontWeight: "600",
      marginBottom: spacing.sm,
    },
    3: {
      ...(scaleTextStyle(
        typography.headlineSmall as TextStyle,
        fontScale,
      ) as TextStyle),
      color: theme.colors.primary,
      marginTop: spacing.lg,
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    4: {
      ...(scaleTextStyle(
        typography.titleLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      color: theme.colors.primary,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    5: {
      ...(scaleTextStyle(
        typography.titleMedium as TextStyle,
        fontScale,
      ) as TextStyle),
      color: theme.colors.primary,
      marginTop: spacing.md,
      marginBottom: spacing.xxs,
    },
    6: {
      ...(scaleTextStyle(
        typography.titleSmall as TextStyle,
        fontScale,
      ) as TextStyle),
      color: theme.colors.primary,
      marginTop: spacing.md,
      marginBottom: spacing.xxs,
    },
  };

  type AppMarkdownStyles = {
    paragraphContainer: ViewStyle;
    paragraphText: TextStyle;
    blockquoteContainer: ViewStyle;
    blockquoteText: TextStyle;
    codeContainer: ViewStyle;
    codeText: TextStyle;
    inlineText: TextStyle;
    inlineEmphasis: TextStyle;
    inlineStrong: TextStyle;
    inlineStrike: TextStyle;
    inlineCode: TextStyle;
    linkText: TextStyle;
    divider: ViewStyle;
    listContainer: ViewStyle;
    listRow: ViewStyle;
    listMarker: TextStyle;
    listBody: ViewStyle;
    listItemInner: ViewStyle;
    listItemText: TextStyle;
    image: ImageStyle;
    tableWrapper: ViewStyle;
    tableRow: ViewStyle;
    tableCell: ViewStyle;
  };

  const styles = StyleSheet.create<AppMarkdownStyles>({
    paragraphContainer: {
      marginBottom: spacing.md,
    },
    paragraphText: {
      ...(scaleTextStyle(
        typography.bodyLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      color: surfaceTextColor,
    },
    blockquoteContainer: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceVariant,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radiusMd,
      marginBottom: spacing.md,
    },
    blockquoteText: {
      ...(scaleTextStyle(
        typography.bodyLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      color: surfaceTextColor,
    },
    codeContainer: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: radiusMd,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    codeText: {
      color: surfaceTextColor,
      fontFamily: MONO_FONT,
      fontSize: (typography.bodyMedium?.fontSize ?? 14) * fontScale,
      lineHeight: (typography.bodyMedium?.lineHeight ?? 20) * fontScale,
      letterSpacing: typography.bodyMedium.letterSpacing,
    },
    inlineText: {
      ...(scaleTextStyle(
        typography.bodyLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      color: surfaceTextColor,
    },
    inlineEmphasis: {
      fontStyle: "italic",
    },
    inlineStrong: {
      fontWeight: "600",
    },
    inlineStrike: {
      textDecorationLine: "line-through",
    },
    inlineCode: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: radiusSm,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxxs,
      fontFamily: MONO_FONT,
      fontSize: (typography.bodyMedium?.fontSize ?? 14) * fontScale,
      lineHeight: (typography.bodyMedium?.lineHeight ?? 20) * fontScale,
      letterSpacing: typography.bodyMedium.letterSpacing,
      color: surfaceTextColor,
    },
    linkText: {
      ...(scaleTextStyle(
        typography.bodyLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      color: theme.colors.primary,
      textDecorationLine: "underline",
    },
    divider: {
      marginVertical: spacing.md,
      backgroundColor: theme.colors.outlineVariant,
      height: StyleSheet.hairlineWidth,
    },
    listContainer: {
      marginBottom: spacing.md,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.xs,
    },
    listMarker: {
      ...(scaleTextStyle(
        typography.bodyLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      width: spacing.lg,
      color: surfaceTextColor,
    },
    listBody: {
      flex: 1,
    },
    listItemInner: {
      flexShrink: 1,
    },
    listItemText: {
      ...(scaleTextStyle(
        typography.bodyLarge as TextStyle,
        fontScale,
      ) as TextStyle),
      color: surfaceTextColor,
      fontWeight: "500",
    },
    image: {
      width: "100%",
      borderRadius: radiusMd,
      marginBottom: spacing.md,
    },
    tableWrapper: {
      marginBottom: spacing.lg,
      borderRadius: radiusMd,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outlineVariant,
    },
    tableRow: {
      backgroundColor: theme.colors.surface,
    },
    tableCell: {
      padding: spacing.sm,
    },
  });

  const openLink = (href: string) => {
    if (!href) {
      return;
    }

    void Linking.openURL(href).catch(() => {});
  };

  const renderTextNode = (
    content: string | React.ReactNode | React.ReactNode[],
    override?: TextStyle,
  ) => (
    <Text
      key={nextKey()}
      style={flattenText(override, styles.inlineText)}
      allowFontScaling={true}
    >
      {content}
    </Text>
  );

  return {
    paragraph(children, viewStyle) {
      return (
        <View
          key={nextKey()}
          style={flattenView(styles.paragraphContainer, viewStyle)}
        >
          <Text style={styles.paragraphText} allowFontScaling={true}>
            {children}
          </Text>
        </View>
      );
    },
    blockquote(children, viewStyle) {
      return (
        <View
          key={nextKey()}
          style={flattenView(styles.blockquoteContainer, viewStyle)}
        >
          <Text style={styles.blockquoteText} allowFontScaling={true}>
            {children}
          </Text>
        </View>
      );
    },
    heading(text, textStyle, depth = 1) {
      const fallbackDepth = Math.min(Math.max(depth, 1), 6);
      return (
        <Text
          key={nextKey()}
          style={flattenText(textStyle, headingStyles[fallbackDepth])}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          {text}
        </Text>
      );
    },
    code(text, _language, containerStyle, textStyle) {
      return (
        <ScrollView
          key={nextKey()}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View style={flattenView(styles.codeContainer, containerStyle)}>
            <Text
              style={flattenText(textStyle, styles.codeText)}
              allowFontScaling={true}
            >
              {text}
            </Text>
          </View>
        </ScrollView>
      );
    },
    hr(viewStyle) {
      return (
        <Divider
          key={nextKey()}
          style={flattenView(styles.divider, viewStyle)}
        />
      );
    },
    listItem(children, viewStyle) {
      return (
        <View
          key={nextKey()}
          style={flattenView(styles.listItemInner, viewStyle)}
        >
          {typeof children === "string" ? (
            <Text style={styles.listItemText} allowFontScaling={true}>
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      );
    },
    list(ordered, li, listStyle, textStyle, startIndex) {
      const baseIndex = typeof startIndex === "number" ? startIndex : 1;
      const markerStyle = flattenText(textStyle, styles.listMarker);
      const itemTextStyle = flattenText(textStyle, styles.listItemText);

      return (
        <View
          key={nextKey()}
          style={flattenView(styles.listContainer, listStyle)}
        >
          {li.map((item, index) => {
            const marker = ordered ? `${baseIndex + index}.` : "\u2022";
            const content = React.isValidElement(item) ? (
              item
            ) : (
              <Text style={itemTextStyle} allowFontScaling={true}>
                {item as string}
              </Text>
            );

            return (
              <View key={nextKey()} style={styles.listRow}>
                <Text style={markerStyle} allowFontScaling={true}>
                  {marker}
                </Text>
                <View style={styles.listBody}>{content}</View>
              </View>
            );
          })}
        </View>
      );
    },
    escape(text, textStyle) {
      return renderTextNode(text, textStyle);
    },
    link(children, href, textStyle) {
      return (
        <Text
          key={nextKey()}
          style={flattenText(textStyle, styles.linkText)}
          accessibilityRole="link"
          onPress={() => openLink(href)}
          allowFontScaling={true}
        >
          {children}
        </Text>
      );
    },
    image(uri, alt, imageStyle) {
      return defaultRenderer.image(
        uri,
        alt,
        flattenImage(styles.image, imageStyle),
      );
    },
    strong(children, textStyle) {
      return renderTextNode(
        children,
        flattenText(styles.inlineStrong, textStyle),
      );
    },
    em(children, textStyle) {
      return renderTextNode(
        children,
        flattenText(styles.inlineEmphasis, textStyle),
      );
    },
    codespan(text, textStyle) {
      return (
        <Text
          key={nextKey()}
          style={flattenText(textStyle, styles.inlineCode)}
          allowFontScaling={true}
        >
          {text}
        </Text>
      );
    },
    br() {
      return (
        <Text key={nextKey()} style={styles.inlineText} allowFontScaling={true}>
          {"\n"}
        </Text>
      );
    },
    del(children, textStyle) {
      return renderTextNode(
        children,
        flattenText(styles.inlineStrike, textStyle),
      );
    },
    text(text, textStyle) {
      return renderTextNode(text, textStyle);
    },
    html(text, textStyle) {
      return renderTextNode(text, textStyle);
    },
    linkImage(href, imageUrl, alt, imageStyle) {
      const imageNode = defaultRenderer.image(
        imageUrl,
        alt,
        flattenImage(styles.image, imageStyle),
      );
      return (
        <TouchableOpacity
          key={nextKey()}
          accessibilityRole="link"
          onPress={() => openLink(href)}
          activeOpacity={0.7}
        >
          {imageNode}
        </TouchableOpacity>
      );
    },
    table(header, rows, tableStyle, rowStyle, cellStyle) {
      const mergedTableStyle = flattenView(styles.tableWrapper, tableStyle);
      const tableNode = defaultRenderer.table(
        header,
        rows,
        mergedTableStyle,
        flattenView(styles.tableRow, rowStyle),
        flattenView(styles.tableCell, cellStyle),
      );

      return (
        <View key={nextKey()} style={mergedTableStyle}>
          {tableNode}
        </View>
      );
    },
  };
};
