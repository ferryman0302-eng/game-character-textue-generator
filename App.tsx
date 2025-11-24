import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Generator from './components/Generator';
import ImageEditor from './components/ImageEditor';
import VeoStudio from './components/VeoStudio';
import { AppMode } from './types';

const App = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TEXTURE);

  const renderContent = () => {
    switch (mode) {
      case AppMode.TEXTURE:
        return <Generator mode={AppMode.TEXTURE} />;
      case AppMode.CHARACTER:
        return <Generator mode={AppMode.CHARACTER} />;
      case AppMode.EDITOR:
        return <ImageEditor />;
      case AppMode.VIDEO:
        return <VeoStudio />;
      default:
        return <Generator mode={AppMode.TEXTURE} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-cyber-900 font-sans selection:bg-cyber-accent selection:text-cyber-900">
      <Sidebar currentMode={mode} setMode={setMode} />
      <main className="flex-1 overflow-y-auto relative">
         {/* Background Grid Effect */}
         <div className="absolute inset-0 z-0 pointer-events-none opacity-10" 
              style={{backgroundImage: 'radial-gradient(#2a4a75 1px, transparent 1px)', backgroundSize: '32px 32px'}}>
         </div>
         
         <div className="relative z-10">
            {renderContent()}
         </div>
      </main>
    </div>
  );
};

export default App;