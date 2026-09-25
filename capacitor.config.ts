import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eclipsegps.app',
  appName: 'উমা এলো',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'maps.googleapis.com',
      '*.googleapis.com',
      '*.gstatic.com',
      '*.google.com',
      '*.googleusercontent.com',
      '*.ggpht.com',
      '*.openstreetmap.org',
      '*.cartocdn.com',
      '*.arcgisonline.com',
      'server.arcgisonline.com',
      'router.project-osrm.org',
    ],
  },
};

export default config;
