import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Map, Compass, Route, Calendar, Heart, Users, Footprints } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useAppState();

  const navItems = [
    { id: 'home', label: 'Home', icon: Map },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'routes', label: 'Routes', icon: Route },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'saved', label: 'Saved', icon: Heart },
    { id: 'journey', label: 'Journey', icon: Footprints },
    { id: 'group', label: 'Friends', icon: Users },
  ] as const;

  return (
    <nav
      id="bottom-navigation-deck"
      className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-900 px-1 sm:px-2 py-1 pb-safe flex items-center justify-between md:justify-around md:left-auto md:right-4 md:bottom-4 md:top-auto md:w-[440px] md:rounded-full md:border md:border-neutral-800"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`nav-item-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center space-y-0.5 px-1 sm:px-2 py-1 rounded-xl transition-all duration-300 min-w-0 flex-1 touch-manipulation cursor-pointer ${
              isActive
                ? 'text-indigo-400 font-semibold scale-105'
                : 'text-neutral-500 hover:text-neutral-300 hover:scale-102'
            }`}
          >
            <Icon size={17} className={isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
            <span className="text-[8.5px] sm:text-[9.5px] tracking-tight sm:tracking-wider uppercase font-semibold truncate max-w-full">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
