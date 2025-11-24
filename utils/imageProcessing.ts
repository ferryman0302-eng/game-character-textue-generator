
/**
 * Generates a Normal Map from an image source using a Sobel filter.
 * This creates a mathematically correct tangent space normal map.
 */
export const generateNormalMapFromData = async (
    base64Data: string, 
    intensity: number = 2.0
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `data:image/png;base64,${base64Data}`;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("No Canvas Context");

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const width = imgData.width;
            const height = imgData.height;
            const data = imgData.data;
            const outputData = ctx.createImageData(width, height);
            const output = outputData.data;

            // Helper to get grayscale value (height estimate)
            const getVal = (x: number, y: number) => {
                // Wrap coordinates for tileability
                const wx = (x + width) % width;
                const wy = (y + height) % height;
                const idx = (wy * width + wx) * 4;
                // Simple luminance
                return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255.0;
            };

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // Sobel Filter
                    const tl = getVal(x - 1, y - 1);
                    const t  = getVal(x,     y - 1);
                    const tr = getVal(x + 1, y - 1);
                    const l  = getVal(x - 1, y);
                    const r  = getVal(x + 1, y);
                    const bl = getVal(x - 1, y + 1);
                    const b  = getVal(x,     y + 1);
                    const br = getVal(x + 1, y + 1);

                    const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
                    const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);
                    const dZ = 1.0 / intensity;

                    // Normalize vector
                    const invLen = 1.0 / Math.sqrt(dX * dX + dY * dY + dZ * dZ);
                    const nX = dX * invLen;
                    const nY = dY * invLen;
                    const nZ = dZ * invLen;

                    const idx = (y * width + x) * 4;
                    
                    // Pack to RGB [0,1] -> [0,255]
                    output[idx]     = (nX * 0.5 + 0.5) * 255; // R
                    output[idx + 1] = (nY * 0.5 + 0.5) * 255; // G (Y usually flipped in some engines, but standard OpenGL is up)
                    output[idx + 2] = (nZ * 0.5 + 0.5) * 255; // B
                    output[idx + 3] = 255; // Alpha
                }
            }

            ctx.putImageData(outputData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
    });
};
