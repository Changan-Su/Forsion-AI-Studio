// Preset avatars for AI models
// These are simple, colorful SVG avatars that can be used as model avatars

export interface PresetAvatar {
  id: string;
  name: string;
  svg: string;
  category: 'ai' | 'robot' | 'abstract' | 'animal';
}

export const presetAvatars: PresetAvatar[] = [
  {
    id: 'ai-brain-1',
    name: 'AI Brain Blue',
    category: 'ai',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#4F46E5"/>
      <path d="M35 40 Q50 30 65 40" stroke="white" stroke-width="3" fill="none"/>
      <circle cx="40" cy="45" r="4" fill="white"/>
      <circle cx="60" cy="45" r="4" fill="white"/>
      <path d="M35 65 Q50 70 65 65" stroke="white" stroke-width="3" fill="none"/>
      <path d="M30 50 L25 50 M70 50 L75 50 M50 25 L50 20 M50 75 L50 80" stroke="white" stroke-width="2"/>
    </svg>`
  },
  {
    id: 'ai-brain-2',
    name: 'AI Brain Purple',
    category: 'ai',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#9333EA"/>
      <path d="M30 35 Q50 25 70 35 Q75 50 70 65 Q50 75 30 65 Q25 50 30 35" fill="#C084FC" opacity="0.5"/>
      <circle cx="42" cy="45" r="3" fill="white"/>
      <circle cx="58" cy="45" r="3" fill="white"/>
      <path d="M40 60 Q50 65 60 60" stroke="white" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    id: 'robot-1',
    name: 'Robot Green',
    category: 'robot',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="30" width="60" height="50" rx="5" fill="#10B981"/>
      <rect x="30" y="40" width="15" height="15" rx="2" fill="white"/>
      <rect x="55" y="40" width="15" height="15" rx="2" fill="white"/>
      <rect x="35" y="65" width="30" height="5" rx="2" fill="white"/>
      <circle cx="50" cy="20" r="5" fill="#10B981"/>
      <line x1="50" y1="15" x2="50" y2="30" stroke="#10B981" stroke-width="3"/>
    </svg>`
  },
  {
    id: 'robot-2',
    name: 'Robot Orange',
    category: 'robot',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="40" fill="#F97316"/>
      <circle cx="38" cy="45" r="6" fill="white"/>
      <circle cx="62" cy="45" r="6" fill="white"/>
      <circle cx="38" cy="45" r="3" fill="#1F2937"/>
      <circle cx="62" cy="45" r="3" fill="#1F2937"/>
      <rect x="35" y="60" width="30" height="4" rx="2" fill="white"/>
      <rect x="30" y="30" width="8" height="3" rx="1" fill="#DC2626"/>
      <rect x="62" y="30" width="8" height="3" rx="1" fill="#DC2626"/>
    </svg>`
  },
  {
    id: 'abstract-1',
    name: 'Abstract Gradient',
    category: 'abstract',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#06B6D4;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#grad1)"/>
      <circle cx="35" cy="40" r="8" fill="white" opacity="0.3"/>
      <circle cx="65" cy="60" r="12" fill="white" opacity="0.2"/>
      <circle cx="60" cy="35" r="6" fill="white" opacity="0.4"/>
    </svg>`
  },
  {
    id: 'abstract-2',
    name: 'Abstract Geometric',
    category: 'abstract',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#EC4899"/>
      <polygon points="50,25 65,45 50,65 35,45" fill="white" opacity="0.3"/>
      <circle cx="50" cy="50" r="15" fill="white" opacity="0.5"/>
      <circle cx="50" cy="50" r="8" fill="white"/>
    </svg>`
  },
  {
    id: 'abstract-3',
    name: 'Abstract Waves',
    category: 'abstract',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#EC4899;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#grad2)"/>
      <path d="M20 40 Q35 35 50 40 T80 40" stroke="white" stroke-width="3" fill="none" opacity="0.5"/>
      <path d="M20 55 Q35 50 50 55 T80 55" stroke="white" stroke-width="3" fill="none" opacity="0.5"/>
      <path d="M20 70 Q35 65 50 70 T80 70" stroke="white" stroke-width="3" fill="none" opacity="0.5"/>
    </svg>`
  },
  {
    id: 'animal-cat',
    name: 'Cat',
    category: 'animal',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#F59E0B"/>
      <polygon points="25,25 35,45 20,45" fill="#F59E0B"/>
      <polygon points="75,25 65,45 80,45" fill="#F59E0B"/>
      <circle cx="38" cy="48" r="4" fill="#1F2937"/>
      <circle cx="62" cy="48" r="4" fill="#1F2937"/>
      <path d="M50 55 L50 65 M50 65 L45 60 M50 65 L55 60" stroke="#1F2937" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    id: 'animal-dog',
    name: 'Dog',
    category: 'animal',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#EF4444"/>
      <ellipse cx="30" cy="35" rx="8" ry="15" fill="#EF4444"/>
      <ellipse cx="70" cy="35" rx="8" ry="15" fill="#EF4444"/>
      <circle cx="40" cy="48" r="4" fill="#1F2937"/>
      <circle cx="60" cy="48" r="4" fill="#1F2937"/>
      <ellipse cx="50" cy="58" rx="8" ry="6" fill="#1F2937"/>
      <path d="M50 64 L50 70" stroke="#1F2937" stroke-width="2"/>
    </svg>`
  },
  {
    id: 'animal-owl',
    name: 'Owl',
    category: 'animal',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#6366F1"/>
      <circle cx="38" cy="45" r="12" fill="white"/>
      <circle cx="62" cy="45" r="12" fill="white"/>
      <circle cx="38" cy="45" r="6" fill="#1F2937"/>
      <circle cx="62" cy="45" r="6" fill="#1F2937"/>
      <polygon points="50,55 45,62 55,62" fill="#F59E0B"/>
      <path d="M25 35 L20 30 M75 35 L80 30" stroke="#6366F1" stroke-width="3"/>
    </svg>`
  },
  {
    id: 'sparkle-1',
    name: 'Sparkle Blue',
    category: 'abstract',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#0EA5E9"/>
      <path d="M50 20 L52 45 L50 48 L48 45 Z" fill="white"/>
      <path d="M80 50 L55 52 L52 50 L55 48 Z" fill="white"/>
      <path d="M50 80 L48 55 L50 52 L52 55 Z" fill="white"/>
      <path d="M20 50 L45 48 L48 50 L45 52 Z" fill="white"/>
      <circle cx="50" cy="50" r="8" fill="white"/>
    </svg>`
  },
  {
    id: 'diamond-1',
    name: 'Diamond Purple',
    category: 'abstract',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#A855F7;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#EC4899;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#grad3)"/>
      <polygon points="50,20 70,50 50,80 30,50" fill="white" opacity="0.3"/>
      <polygon points="50,30 62,50 50,70 38,50" fill="white" opacity="0.5"/>
    </svg>`
  }
];

// Convert SVG to base64 data URL
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Get preset avatar by id
export function getPresetAvatar(id: string): PresetAvatar | undefined {
  return presetAvatars.find(avatar => avatar.id === id);
}

// Get preset avatars by category
export function getPresetAvatarsByCategory(category: string): PresetAvatar[] {
  return presetAvatars.filter(avatar => avatar.category === category);
}





