export const BLENDER_ADDON_SCRIPT = `
bl_info = {
    "name": "NeuroGen Bridge",
    "author": "NeuroGen Studio",
    "version": (1, 0),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > NeuroGen",
    "description": "One-click PBR material import from NeuroGen Studio",
    "category": "Material",
}

import bpy
import os
import re

class MaterialItem(bpy.types.PropertyGroup):
    name: bpy.props.StringProperty(name="Name")
    id: bpy.props.StringProperty(name="ID")

class NEUROGEN_PT_MainPanel(bpy.types.Panel):
    bl_label = "NeuroGen Bridge"
    bl_idname = "NEUROGEN_PT_MainPanel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'NeuroGen'

    def draw(self, context):
        layout = self.layout
        scene = context.scene
        
        layout.label(text="Texture Library Path:")
        layout.prop(scene, "neurogen_texture_path", text="")
        
        layout.separator()
        
        if not os.path.isdir(bpy.path.abspath(scene.neurogen_texture_path)):
            layout.label(text="Select a valid folder", icon='ERROR')
            return

        layout.operator("neurogen.refresh_library", text="Refresh Library", icon='FILE_REFRESH')
        
        layout.label(text="Detected Materials:")
        row = layout.row()
        row.template_list("NEUROGEN_UL_MaterialList", "", scene, "neurogen_materials", scene, "neurogen_material_index")
        
        layout.separator()
        
        if len(scene.neurogen_materials) > 0:
            layout.operator("neurogen.apply_material", text="Apply to Selected", icon='MATERIAL')
            layout.prop(scene, "neurogen_use_displacement", text="Use Displacement")

class NEUROGEN_UL_MaterialList(bpy.types.UIList):
    def draw_item(self, context, layout, data, item, icon, active_data, active_propname):
        layout.label(text=item.name, icon='TEXTURE')

class NEUROGEN_OT_RefreshLibrary(bpy.types.Operator):
    bl_idname = "neurogen.refresh_library"
    bl_label = "Refresh Library"

    def execute(self, context):
        scene = context.scene
        path = bpy.path.abspath(scene.neurogen_texture_path)
        
        if not os.path.isdir(path):
            return {'CANCELLED'}
            
        scene.neurogen_materials.clear()
        
        # Regex to find NeuroGen files: neurogen_[TIMESTAMP]_[TYPE].png
        # Group 1: Timestamp (ID)
        files = os.listdir(path)
        found_ids = set()
        
        for f in files:
            if f.startswith("neurogen_") and f.endswith(".png"):
                parts = f.split("_")
                if len(parts) >= 3:
                    # parts[0] = neurogen
                    # parts[1] = timestamp ID
                    img_id = parts[1]
                    if img_id not in found_ids:
                        found_ids.add(img_id)
                        item = scene.neurogen_materials.add()
                        item.name = f"Material_{img_id}"
                        item.id = img_id
                        
        return {'FINISHED'}

class NEUROGEN_OT_ApplyMaterial(bpy.types.Operator):
    bl_idname = "neurogen.apply_material"
    bl_label = "Apply Material"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        scene = context.scene
        idx = scene.neurogen_material_index
        
        if idx < 0 or idx >= len(scene.neurogen_materials):
            return {'CANCELLED'}
            
        mat_item = scene.neurogen_materials[idx]
        mat_id = mat_item.id
        path = bpy.path.abspath(scene.neurogen_texture_path)
        
        obj = context.active_object
        if not obj:
            self.report({'ERROR'}, "No object selected")
            return {'CANCELLED'}
            
        # Create Material
        mat_name = f"NeuroGen_{mat_id}"
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        
        # Clear default nodes
        nodes.clear()
        
        # Create Principled BSDF & Output
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.location = (0, 0)
        output = nodes.new('ShaderNodeOutputMaterial')
        output.location = (300, 0)
        links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        # Helper to load image
        def load_image_node(suffix, label, x, y, is_data=True):
            filename = f"neurogen_{mat_id}_{suffix}.png"
            filepath = os.path.join(path, filename)
            if os.path.exists(filepath):
                img_node = nodes.new('ShaderNodeTexImage')
                try:
                    img_node.image = bpy.data.images.load(filepath)
                    if is_data:
                        img_node.image.colorspace_settings.name = 'Non-Color'
                except:
                    pass
                img_node.label = label
                img_node.location = (x, y)
                return img_node
            return None

        # 1. Base Color
        albedo = load_image_node("albedo", "Albedo", -600, 300, is_data=False)
        if albedo:
            links.new(albedo.outputs['Color'], bsdf.inputs['Base Color'])
            
        # 2. Normal Map
        normal = load_image_node("normal", "Normal", -600, 0)
        if normal:
            normal_map_node = nodes.new('ShaderNodeNormalMap')
            normal_map_node.location = (-300, 0)
            links.new(normal.outputs['Color'], normal_map_node.inputs['Color'])
            links.new(normal_map_node.outputs['Normal'], bsdf.inputs['Normal'])
            
        # 3. Packed Map (Standard packed download from App)
        # Assumes R=Roughness, G=Metallic, B=AO/None
        packed = load_image_node("packed", "Packed (R=Rough, G=Metal)", -600, -300)
        if packed:
            sep = nodes.new('ShaderNodeSeparateColor')
            sep.location = (-300, -300)
            links.new(packed.outputs['Color'], sep.inputs['Color'])
            
            # Red -> Roughness
            links.new(sep.outputs['Red'], bsdf.inputs['Roughness'])
            # Green -> Metallic
            links.new(sep.outputs['Green'], bsdf.inputs['Metallic'])
            
        # 4. Individual Roughness (if not packed)
        if not packed:
            rough = load_image_node("roughness", "Roughness", -600, -300)
            if rough:
                links.new(rough.outputs['Color'], bsdf.inputs['Roughness'])
                
        # 5. Individual Metallic (if not packed)
        if not packed:
            metal = load_image_node("metallic", "Metallic", -600, -600)
            if metal:
                links.new(metal.outputs['Color'], bsdf.inputs['Metallic'])

        # Assign to object
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
            
        return {'FINISHED'}

classes = (
    MaterialItem,
    NEUROGEN_PT_MainPanel,
    NEUROGEN_UL_MaterialList,
    NEUROGEN_OT_RefreshLibrary,
    NEUROGEN_OT_ApplyMaterial,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    
    bpy.types.Scene.neurogen_texture_path = bpy.props.StringProperty(
        name="Texture Path",
        subtype='DIR_PATH',
        default="//"
    )
    bpy.types.Scene.neurogen_materials = bpy.props.CollectionProperty(type=MaterialItem)
    bpy.types.Scene.neurogen_material_index = bpy.props.IntProperty()
    bpy.types.Scene.neurogen_use_displacement = bpy.props.BoolProperty(name="Use Displacement", default=False)

def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)
    
    del bpy.types.Scene.neurogen_texture_path
    del bpy.types.Scene.neurogen_materials
    del bpy.types.Scene.neurogen_material_index
    del bpy.types.Scene.neurogen_use_displacement

if __name__ == "__main__":
    register()
`;