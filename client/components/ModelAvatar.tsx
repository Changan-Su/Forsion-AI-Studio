import React, { useMemo } from 'react';
import { Cpu } from 'lucide-react';
import { getPresetAvatar, svgToDataUrl } from '../src/utils/presetAvatars';
import { getCachedAvatar, setCachedAvatar } from '../src/utils/avatarCache';

interface ModelAvatarProps {
  modelId: string;
  avatarData?: string;
  className?: string;
  size?: number;
  fallbackIcon?: React.ReactNode;
}

const ModelAvatar: React.FC<ModelAvatarProps> = ({ 
  modelId, 
  avatarData, 
  className = '', 
  size = 36,
  fallbackIcon
}) => {
  const avatarUrl = useMemo(() => {
    if (!avatarData) return null;
    
    // Check cache first
    const cached = getCachedAvatar(modelId);
    if (cached) return cached;
    
    let url: string;
    
    // Handle preset avatars
    if (avatarData.startsWith('preset:')) {
      const presetId = avatarData.substring(7);
      const preset = getPresetAvatar(presetId);
      if (preset) {
        url = svgToDataUrl(preset.svg);
      } else {
        return null;
      }
    } 
    // Handle data URLs
    else if (avatarData.startsWith('data:image/')) {
      url = avatarData;
    } 
    else {
      return null;
    }
    
    // Cache the URL
    setCachedAvatar(modelId, url);
    return url;
  }, [modelId, avatarData]);
  
  if (avatarUrl) {
    return (
      <div 
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img 
          src={avatarUrl} 
          alt="Model avatar" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  
  // Fallback to icon
  return (
    <div className={className}>
      {fallbackIcon || <Cpu size={18} />}
    </div>
  );
};

export default ModelAvatar;

