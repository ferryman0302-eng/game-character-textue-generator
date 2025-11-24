export const UNITY_BRIDGE_SCRIPT = `
using UnityEngine;
using UnityEditor;
using System.IO;
using System.Collections.Generic;
using System.Linq;

public class NeuroGenBridge : EditorWindow
{
    private string texturePath = "Assets/Textures";
    private List<string> discoveredMaterials = new List<string>();
    private Vector2 scrollPos;
    private bool useDisplacement = false;

    [MenuItem("Window/NeuroGen Bridge")]
    public static void ShowWindow()
    {
        GetWindow<NeuroGenBridge>("NeuroGen Bridge");
    }

    void OnGUI()
    {
        GUILayout.Label("NeuroGen Studio Bridge (HDRP)", EditorStyles.boldLabel);
        
        GUILayout.Space(10);
        
        GUILayout.Label("Texture Folder Path (relative to Assets/):");
        texturePath = EditorGUILayout.TextField(texturePath);
        
        if (GUILayout.Button("Refresh Library"))
        {
            ScanForTextures();
        }

        useDisplacement = EditorGUILayout.Toggle("Assign Height/Displacement", useDisplacement);

        GUILayout.Space(10);
        GUILayout.Label("Detected Material Sets:", EditorStyles.boldLabel);

        scrollPos = EditorGUILayout.BeginScrollView(scrollPos);

        if (discoveredMaterials.Count == 0)
        {
            GUILayout.Label("No complete sets found.");
            GUILayout.Label("Ensure files are named 'neurogen_{id}_albedo.png' etc.");
        }

        foreach (string id in discoveredMaterials)
        {
            GUILayout.BeginHorizontal("box");
            GUILayout.Label($"ID: {id}");
            if (GUILayout.Button("Create Material"))
            {
                CreateHDRPMaterial(id);
            }
            GUILayout.EndHorizontal();
        }

        GUILayout.EndScrollView();
    }

    private void ScanForTextures()
    {
        discoveredMaterials.Clear();
        string fullPath = Path.Combine(Application.dataPath, texturePath.Replace("Assets/", ""));
        
        if (!Directory.Exists(fullPath))
        {
            Debug.LogError("Directory not found: " + fullPath);
            return;
        }

        string[] files = Directory.GetFiles(fullPath, "neurogen_*_albedo.png");
        foreach (string file in files)
        {
            string fileName = Path.GetFileName(file);
            // Expected format: neurogen_{ID}_albedo.png
            string[] parts = fileName.Split('_');
            if (parts.Length >= 3)
            {
                string id = parts[1];
                if (!discoveredMaterials.Contains(id))
                {
                    discoveredMaterials.Add(id);
                }
            }
        }
    }

    private void CreateHDRPMaterial(string id)
    {
        string basePath = $"{texturePath}/neurogen_{id}";
        
        // Load Textures
        Texture2D albedo = AssetDatabase.LoadAssetAtPath<Texture2D>($"{basePath}_albedo.png");
        Texture2D normal = AssetDatabase.LoadAssetAtPath<Texture2D>($"{basePath}_normal.png");
        Texture2D mask = AssetDatabase.LoadAssetAtPath<Texture2D>($"{basePath}_HDRP_Mask.png");
        Texture2D height = AssetDatabase.LoadAssetAtPath<Texture2D>($"{basePath}_height.png");

        if (albedo == null)
        {
            Debug.LogError($"Could not find Albedo for ID {id}");
            return;
        }

        // Create Material
        Material mat = new Material(Shader.Find("HDRP/Lit"));
        if (mat.shader.name != "HDRP/Lit")
        {
             // Fallback to Standard if HDRP is missing, though Mask Map won't map correctly 1:1
             mat = new Material(Shader.Find("Standard"));
             Debug.LogWarning("HDRP/Lit shader not found. Falling back to Standard (Mask map mapping may be incorrect).");
        }
        
        mat.name = $"NeuroGen_Mat_{id}";

        // Assign Maps (HDRP/Lit properties)
        mat.SetTexture("_BaseColorMap", albedo);
        
        if (normal != null)
        {
            mat.SetTexture("_NormalMap", normal);
            mat.EnableKeyword("_NORMALMAP");
        }

        if (mask != null)
        {
            // HDRP Mask Map: R=Metallic, G=Occlusion, B=Detail, A=Smoothness
            mat.SetTexture("_MaskMap", mask);
            mat.EnableKeyword("_MASKMAP");
        }

        if (useDisplacement && height != null)
        {
            mat.SetTexture("_HeightMap", height);
            mat.EnableKeyword("_HEIGHTMAP");
            mat.SetFloat("_HeightAmplitude", 0.02f); // Default small displacement
            mat.EnableKeyword("_DISPLACEMENT_LOCK_TILING_SCALE");
        }

        // Save Asset
        string matPath = $"{texturePath}/NeuroGen_Mat_{id}.mat";
        AssetDatabase.CreateAsset(mat, matPath);
        AssetDatabase.SaveAssets();
        
        Selection.activeObject = mat;
        Debug.Log($"Created Material: {matPath}");
    }
}
`;