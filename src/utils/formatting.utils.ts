export const numberFormatter = new Intl.NumberFormat();

export const formatResponseTime = (seconds?: number): string => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "---";
  }

  const ms = seconds * 1000;
  if (ms < 1000) {
    const roundedMs = Math.round(ms);
    return `${numberFormatter.format(roundedMs)} ms`;
  }

  const secsFixed = Number(seconds.toFixed(2));
  return `${numberFormatter.format(secsFixed)} s`;
};

export const formatTokens = (tokens?: number): string => {
  if (tokens === undefined || tokens === null || Number.isNaN(tokens)) {
    return "---";
  }
  return `${numberFormatter.format(tokens)}`;
};
