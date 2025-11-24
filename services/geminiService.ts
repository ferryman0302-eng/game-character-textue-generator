

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { TEXT_MODEL_SMART, TEXT_MODEL_FAST, IMAGE_MODEL_PRO, IMAGE_MODEL_EDIT, VIDEO_MODEL } from "../constants";
import { AspectRatio, ImageResolution } from "../types";

// NOTE: We instantiate GoogleGenAI inside functions to ensure we use the latest process.env.API_KEY

/**
 * Optimize text prompt using Thinking Mode (Gemini 3 Pro) or Fast Mode.
 */
export const optimizeText = async (
  prompt: string, 
  systemInstruction: string,
  useThinking = false
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = useThinking ? TEXT_MODEL_SMART : TEXT_MODEL_FAST;
    const config: any = {
      systemInstruction: systemInstruction,
    };

    if (useThinking) {
      config.thinkingConfig = { thinkingBudget: 1024 }; // Moderate thinking budget
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: config,
    });

    return response.text || "";
  } catch (error) {
    console.error("Optimization Error:", error);
    throw error;
  }
};

/**
 * Generate Image using Gemini 3 Pro Image Preview
 */
export const generateImage = async (
  prompt: string,
  imageParts: { data: string; mimeType: string }[] = [],
  aspectRatio: AspectRatio = AspectRatio.SQUARE,
  resolution: ImageResolution = ImageResolution.RES_1K
): Promise<string[]> => {
  // Gemini 3 Pro Image Preview requires a selected API Key
  if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
    throw new Error("API Key not selected. Please select a paid project key.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Gemini 3 Pro Image Preview supports image prompts (multimodal)
    // We add images FIRST to establish context, then the text instruction.
    const parts: any[] = [];
    
    imageParts.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
        }
      });
    });

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_PRO,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolution,
        }
      }
    });

    const urls: string[] = [];
    if (response.candidates && response.candidates[0].content.parts) {
       for (const part of response.candidates[0].content.parts) {
         if (part.inlineData) {
           urls.push(`data:image/png;base64,${part.inlineData.data}`);
         } else if (part.text) {
            // Log text output if any (usually implies the model didn't generate an image)
            console.warn("Model returned text:", part.text);
         }
       }
    }
    
    return urls;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

/**
 * Edit Image using Gemini 2.5 Flash Image (Nano Banana)
 */
export const editImage = async (
  prompt: string,
  baseImage: { data: string; mimeType: string }
): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts = [
      {
        inlineData: {
          mimeType: baseImage.mimeType,
          data: baseImage.data
        }
      },
      { text: prompt }
    ];

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_EDIT,
      contents: { parts },
      // Note: Nano Banana doesn't support aspect/size config in same way as Pro
    });

    const urls: string[] = [];
    if (response.candidates && response.candidates[0].content.parts) {
       for (const part of response.candidates[0].content.parts) {
         if (part.inlineData) {
           urls.push(`data:image/png;base64,${part.inlineData.data}`);
         }
       }
    }
    return urls;
  } catch (error) {
    console.error("Image Edit Error:", error);
    throw error;
  }
};

/**
 * Generate Texture Maps (Roughness, Metallic, Occlusion, Height)
 * Normal Maps are now generated via Client-side algorithm in textureUtils.
 */
export const generateTextureMaps = async (
  baseImage: { data: string; mimeType: string },
  mapType: 'roughness' | 'metallic' | 'occlusion' | 'height'
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let prompt = "";
    switch (mapType) {
      case 'roughness':
        prompt = "Turn this image into a grayscale PBR roughness map. White = rough, Black = glossy/smooth. High contrast. Output ONLY the roughness map image.";
        break;
      case 'metallic':
        prompt = "Turn this image into a grayscale PBR metallic map. White = metal, Black = non-metal. If the material is not metal, return a mostly black image. Output ONLY the metallic map image.";
        break;
      case 'occlusion':
        prompt = "Turn this image into a grayscale Ambient Occlusion (AO) map. White = exposed, Black = occluded/shadowed crevices. Soft shadows in cracks. Output ONLY the AO map image.";
        break;
      case 'height':
         // Professional Height Map prompt
         prompt = "Turn this image into a high-quality 16-bit style grayscale Height/Displacement map. White represents the highest geometry points, Black represents the lowest. Ensure smooth gradients for accurate 3D displacement. Avoid noise. Focus on structural depth. Output ONLY the height map image.";
         break;
    }

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_EDIT,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: baseImage.mimeType,
              data: baseImage.data
            }
          },
          { text: prompt }
        ]
      }
    });

    // Iterate through parts to find the image
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) {
        console.warn(`Map Gen Text Output (${mapType}):`, textPart.text);
    }
    
    throw new Error(`Failed to generate ${mapType} map. The model did not return an image.`);

  } catch (error) {
    console.error(`Map Gen Error (${mapType}):`, error);
    throw error;
  }
};

/**
 * Generate Video using Veo
 */
export const generateVideo = async (
  prompt: string,
  imageBytes?: string,
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | undefined> => {
  // Check for user selected key
  if (!(await window.aistudio?.hasSelectedApiKey())) {
    throw new Error("API Key not selected");
  }
  
  const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    let operation;
    
    if (imageBytes) {
      operation = await videoAi.models.generateVideos({
        model: VIDEO_MODEL,
        prompt: prompt || "Animate this image",
        image: {
           imageBytes: imageBytes,
           mimeType: 'image/png'
        },
        config: {
          numberOfVideos: 1,
          aspectRatio: aspectRatio,
          resolution: '1080p'
        }
      });
    } else {
      operation = await videoAi.models.generateVideos({
        model: VIDEO_MODEL,
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          aspectRatio: aspectRatio,
          resolution: '1080p'
        }
      });
    }

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await videoAi.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!downloadLink) return undefined;

    const vidResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await vidResponse.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Video Gen Error:", error);
    throw error;
  }
};
