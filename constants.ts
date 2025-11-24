import { ModeConfig } from './types';

// --- Models ---
export const TEXT_MODEL_FAST = 'gemini-2.5-flash-lite-latest';
export const TEXT_MODEL_SMART = 'gemini-3-pro-preview';
export const IMAGE_MODEL_PRO = 'gemini-3-pro-image-preview'; // Nano Banana Pro
export const IMAGE_MODEL_EDIT = 'gemini-2.5-flash-image'; // Nano Banana
export const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';

// --- Prompts & Logic (Preserved from user request) ---
export const MODE_CONFIG: ModeConfig = {
    texture: {
        title: 'Nano Texture Lab',
        description: 'Generate seamless PBR textures with high-resolution detail.',
        label: "Texture Description (e.g., 'mossy cobblestone', 'brushed aluminum'):",
        placeholder: 'Describe your texture here...',
        optimizeSystemPrompt: "You are an AI prompt optimizer for generating seamless PBR textures. Your task is to take a short user description (e.g., 'old brick wall') and expand it into a single, detailed, highly descriptive prompt. Focus on keywords like 'seamless', 'tileable', 'PBR', 'base color', 'albedo', '4K', 'photorealistic', 'material properties' (e.g., 'roughness', 'grout color', 'wear and tear', 'moss'). The output MUST be a single, continuous paragraph, suitable for direct use in an image generation input field, and MUST only contain the optimized description. Do not include any headers, labels, or conversational text.",
        generateBasePrompt: (desc, options) => {
            const { isMacroShot } = options;
            const macroText = isMacroShot 
                ? "**This should be a close-up macro shot of a single, non-repeating section of the material.** **The image itself should not show a tiled pattern**, but it must be *able* to tile seamlessly." 
                : "Ensure the texture can tile seamlessly.";
            return `A high-resolution, seamless, tileable 4K PBR texture. ${macroText} Photorealistic, centered, flat perspective. Base color (albedo) map. Flat, even studio lighting. Material details: ${desc}`;
        },
        generateImagePrompt: (desc, options) => {
            const { isMacroShot } = options;
            const macroText = isMacroShot
                ? "**This should look like a single, non-repeating tile.** **Do not show repeating patterns within this single image.**"
                : "Ensure the resulting texture can tile seamlessly.";
            return `Analyze the uploaded image as a reference. Turn it into a new, high-resolution, seamless, tileable 4K PBR texture. ${macroText} Ensure it's photorealistic, centered, with a flat perspective. Base color (albedo) map. Flat(top-down view, regardless of the photograph angle of the image), even studio lighting. Use the following text as additional guidance: ${desc}`;
        },
        variationPrompt: (desc, options) => {
            const { isMacroShot } = options;
            const macroText = isMacroShot
                ? "**It must be a close-up, non-repeating portion of the material.** **Do not create a tiled pattern within the image itself.**"
                : "Ensure the resulting texture can tile seamlessly.";
            return `Analyze the uploaded image as a reference. Create a new, but similar, high-resolution, seamless, tileable 4K PBR texture. This should be a clear variation, not an exact copy. ${macroText} Ensure it's photorealistic, centered, with a flat perspective. Use this text as guidance: ${desc}`;
        }
    },
    character: {
        title: 'Character Forge',
        description: 'Design T-pose character reference sheets for 3D modeling.',
        label: "Character Description (e.g., 'sci-fi soldier', 'fantasy mage'):",
        placeholder: 'Describe your character here...',
        optimizeSystemPrompt: "You are an AI prompt optimizer for 3D character reference sheets. Take a user description and expand it into a single, detailed, highly descriptive prompt. Focus on anatomy, clothing, armor, style (e.g., 'realistic', 'stylized', 'anime'), and ensure the output is suitable for generating a 'T-pose' reference sheet. The output MUST be a single, continuous paragraph, suitable for direct use in an image generation input field, and MUST only contain the optimized description. Do not include any headers, labels, or conversational text.",
        
        generateBasePrompt: (desc, options) => `Professional 3D character modeling reference. Style: realistic 3D concept art, professional character design reference, high detail, studio lighting, cinematic tone. Orthographic front view, neutral light gray background. Character details: ${desc}`,
        
        generateImagePrompt: (desc, options) => `Use the uploaded image as a reference to generate a NEW character design. **Ignore the aspect ratio/dimensions of the uploaded image and generate a standard square image.** Style: realistic 3D concept art, professional character design reference, high detail, studio lighting, cinematic tone. Orthographic front view, neutral light gray background. Use this text as additional guidance: ${desc}`,
        
        variationPrompt: (desc, options) => `Analyze the uploaded image as a reference (this is the T-pose body). **Ignore the input image aspect ratio; generate a standard square image.** Create a new character reference sheet in a similar style but as a clear variation (e.g., different clothing color, slightly different build). Ensure it is in a full-body T-pose. **Completely remove the head and neck.** Use this text as guidance: ${desc}`
    }
};