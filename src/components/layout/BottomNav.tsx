import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Map, Compass, Route, Calendar, Heart, Users } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useAppState();

  const navItems = [
    { id: 'home', label: 'Home', icon: Map },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'routes', label: 'Routes', icon: Route },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'saved', label: 'Saved', icon: Heart },
    { id: 'group', label: 'Friends', icon: Users },
  ] as const;

  return (
    <nav
      id="bottom-navigation-deck"
      className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/90 backdrop-blur-lg border-t border-neutral-900 px-4 py-2 pb-safe flex items-center justify-around md:left-auto md:right-4 md:bottom-4 md:top-auto md:w-96 md:rounded-full md:border md:border-neutral-800"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`nav-item-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center space-y-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 ${
              isActive
                ? 'text-indigo-400 font-medium scale-105'
                : 'text-neutral-500 hover:text-neutral-300 hover:scale-102'
            }`}
          >
            <Icon size={19} className={isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
            <span className="text-[10px] tracking-wider uppercase font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
