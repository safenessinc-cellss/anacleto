export interface DrawingViewportFit {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function fitDrawingToViewport(
  widthMm: number,
  heightMm: number,
  containerWidth: number,
  containerHeight: number,
  padding = 48,
): DrawingViewportFit {
  const width = Math.max(1, Number.isFinite(widthMm) ? widthMm : 1);
  const height = Math.max(1, Number.isFinite(heightMm) ? heightMm : 1);
  const viewportWidth = Math.max(1, Number.isFinite(containerWidth) ? containerWidth : 1);
  const viewportHeight = Math.max(1, Number.isFinite(containerHeight) ? containerHeight : 1);
  const safePadding = Math.max(0, Number.isFinite(padding) ? padding : 48);
  const availableWidth = Math.max(1, viewportWidth - safePadding * 2);
  const availableHeight = Math.max(1, viewportHeight - safePadding * 2);
  const scale = Math.min(availableWidth / width, availableHeight / height);
  const fittedWidth = width * scale;
  const fittedHeight = height * scale;
  return {
    scale,
    x: (viewportWidth - fittedWidth) / 2,
    y: (viewportHeight - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}
