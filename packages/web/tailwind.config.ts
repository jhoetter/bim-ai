import { bimAIPreset } from '@bim-ai/design-tokens/tailwind-preset';
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../ui/src/**/*.{ts,tsx}'],
  presets: [bimAIPreset],
} satisfies Config;
