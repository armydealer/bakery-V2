import React from 'react';
import { useWorkshop } from '../store/WorkshopContext';

interface PrivacyValueProps {
  children: React.ReactNode;
  className?: string;
}

export const PrivacyValue: React.FC<PrivacyValueProps> = ({ children, className = '' }) => {
  const { data } = useWorkshop();
  return (
    <span className={`${className} ${data.settings.privacyMode ? 'privacy-blur' : ''}`}>
      {children}
    </span>
  );
};
