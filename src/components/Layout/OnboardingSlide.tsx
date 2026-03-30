import { useEffect, useState } from 'react';

interface OnboardingSlideProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  direction: 'left' | 'right' | 'none';
}

export default function OnboardingSlide({ icon, title, description, active, direction }: OnboardingSlideProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [active]);

  if (!active) return null;

  const translateClass = direction === 'left' ? '-translate-x-8' : direction === 'right' ? 'translate-x-8' : 'translate-y-4';

  return (
    <div
      className={`flex flex-col items-center text-center px-8 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${translateClass}`
      }`}
    >
      {/* Icon area */}
      <div className="w-32 h-32 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-8 shadow-lg">
        {icon}
      </div>

      <h2 className="text-3xl font-bold text-white mb-3">{title}</h2>
      <p className="text-primary-100 dark:text-gray-300 text-lg leading-relaxed max-w-xs">
        {description}
      </p>
    </div>
  );
}
