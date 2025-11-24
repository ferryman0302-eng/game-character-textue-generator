export enum AppMode {
  TEXTURE = 'texture',
  CHARACTER = 'character',
  EDITOR = 'editor',
  VIDEO = 'video',
}

export interface GeneratorOptions {
  isMacroShot?: boolean;
  isBodyOnly?: boolean;
  isHeadOnly?: boolean;
}

export interface ModeConfigItem {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  optimizeSystemPrompt: string;
  generateBasePrompt: (desc: string, options: GeneratorOptions) => string;
  generateImagePrompt: (desc: string, options: GeneratorOptions) => string;
  variationPrompt: (desc: string, options: GeneratorOptions) => string;
}

export interface ModeConfig {
  [key: string]: ModeConfigItem;
}

export enum ImageResolution {
  RES_1K = '1K',
  RES_2K = '2K',
  RES_4K = '4K',
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  WIDE = '21:9',
  STANDARD = '4:3',
  TALL = '3:4',
}
