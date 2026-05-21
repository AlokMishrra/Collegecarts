import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, Sparkles } from 'lucide-react';
import { useNavigation } from './NavigationProvider';
import { motion, AnimatePresence } from 'framer-motion';

export default function WorkspaceSwitcher() {
  const { 
    currentModuleDef, 
    availableModules, 
    switchModule, 
    workspaceSwitcherOpen, 
    setWorkspaceSwitcherOpen,
    activeModule 
  } = useNavigation();
  const navigate = useNavigate();
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setWorkspaceSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setWorkspaceSwitcherOpen]);

  const handleSwitch = (mod) => {
    setWorkspaceSwitcherOpen(false);
    if (mod.comingSoon) return;
    navigate(mod.homeRoute);
  };

  const Icon = currentModuleDef.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setWorkspaceSwitcherOpen(!workspaceSwitcherOpen)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all duration-200 w-full"
      >
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${currentModuleDef.color}15` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: currentModuleDef.color }} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{currentModuleDef.name}</p>
          <p className="text-[10px] text-gray-500 truncate">{currentModuleDef.tagline}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${workspaceSwitcherOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {workspaceSwitcherOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
          >
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Switch Module</p>
              {availableModules.map((mod) => {
                const ModIcon = mod.icon;
                const isActive = mod.id === activeModule;
                return (
                  <button
                    key={mod.id}
                    onClick={() => handleSwitch(mod)}
                    disabled={mod.comingSoon}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 ${
                      isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                    } ${mod.comingSoon ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div 
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: `${mod.color}15` }}
                    >
                      <ModIcon className="w-3.5 h-3.5" style={{ color: mod.color }} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {mod.name}
                        {mod.comingSoon && (
                          <span className="ml-1.5 text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">
                            SOON
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{mod.tagline}</p>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
