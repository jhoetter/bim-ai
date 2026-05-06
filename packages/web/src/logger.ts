type LogArgs = unknown[];

function tag(label: string) {
  return `[bim:${label}]`;
}

export const log = {
  error(label: string, message: string, ...args: LogArgs) {
    console.error(tag(label), message, ...args);
  },
  warn(label: string, message: string, ...args: LogArgs) {
    console.warn(tag(label), message, ...args);
  },
  info(label: string, message: string, ...args: LogArgs) {
    console.info(tag(label), message, ...args);
  },
};
