import React from 'react';
import { Layers, User, Video, Edit, Command } from 'lucide-react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode }) => {
  const navItems = [
    { id: AppMode.TEXTURE, label: 'Texture Lab', icon: Layers },
    { id: AppMode.CHARACTER, label: 'Character Forge', icon: User },
    { id: AppMode.EDITOR, label: 'Neuro Editor', icon: Edit },
    { id: AppMode.VIDEO, label: 'Veo Studio', icon: Video },
  ];

  return (
    <div className="w-20 lg:w-64 bg-cyber-900 border-r border-cyber-700 flex flex-col h-screen sticky top-0 z-50">
      <div className="p-6 flex items-center justify-center lg:justify-start space-x-3 border-b border-cyber-700">
        <Command className="w-8 h-8 text-cyber-accent animate-pulse-slow" />
        <span className="hidden lg:block font-display font-bold text-xl text-white tracking-wider">
          NEURO<span className="text-cyber-accent">GEN</span>
        </span>
      </div>

      <nav className="flex-1 py-8 flex flex-col gap-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentMode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`
                flex items-center p-3 rounded-xl transition-all duration-300 group
                ${isActive 
                  ? 'bg-cyber-600 text-cyber-accent shadow-[0_0_15px_rgba(0,240,255,0.2)] border border-cyber-500' 
                  : 'text-gray-400 hover:bg-cyber-800 hover:text-white'
                }
              `}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'animate-pulse' : ''}`} />
              <span className="hidden lg:block ml-4 font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute left-0 w-1 h-8 bg-cyber-accent rounded-r-full shadow-[0_0_10px_#00f0ff]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-cyber-700 text-xs text-gray-600 hidden lg:block">
        <p>Gemini 3 Pro Equipped</p>
        <p>v2.5.0 Stable</p>
      </div>
    </div>
  );
};

export default Sidebar;