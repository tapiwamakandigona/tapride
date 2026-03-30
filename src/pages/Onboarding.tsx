import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingSlide from '../components/Layout/OnboardingSlide';

const slides = [
  {
    title: 'Welcome to TapRide',
    description: 'Your ride, one tap away. The smartest way to get around Zimbabwe.',
    icon: (
      <svg viewBox="0 0 100 100" className="w-16 h-16 text-white" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="30" cy="70" r="8" fill="currentColor" />
        <circle cx="70" cy="30" r="8" fill="currentColor" />
        <path d="M30 70 C30 45, 70 55, 70 30" />
        <path d="M62 22 L70 30 L62 38" />
      </svg>
    ),
  },
  {
    title: 'Set Your Price',
    description: 'Suggest your own fare — drivers can accept or counter. You\'re in control.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: 'Stay Safe',
    description: 'SOS button, verified drivers, and real-time tracking on every ride.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    title: 'Ready to Go',
    description: 'Create an account or sign in to start riding in minutes.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | 'none'>('none');

  const goTo = useCallback((index: number) => {
    setDirection(index > current ? 'right' : 'left');
    setCurrent(index);
  }, [current]);

  const next = useCallback(() => {
    if (current < slides.length - 1) {
      goTo(current + 1);
    }
  }, [current, goTo]);

  const finish = useCallback(() => {
    localStorage.setItem('onboarding_seen', 'true');
    navigate('/register', { replace: true });
  }, [navigate]);

  const skip = useCallback(() => {
    localStorage.setItem('onboarding_seen', 'true');
    navigate('/login', { replace: true });
  }, [navigate]);

  const isLast = current === slides.length - 1;

  // Touch handling
  const [touchStart, setTouchStart] = useState<number | null>(null);

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (diff > 50 && current < slides.length - 1) goTo(current + 1);
        if (diff < -50 && current > 0) goTo(current - 1);
        setTouchStart(null);
      }}
    >
      {/* Skip button */}
      <div className="flex justify-end p-6">
        {!isLast && (
          <button
            onClick={skip}
            className="text-white/70 hover:text-white text-sm font-medium transition-colors px-3 py-1"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center">
        {slides.map((slide, i) => (
          <OnboardingSlide
            key={i}
            icon={slide.icon}
            title={slide.title}
            description={slide.description}
            active={i === current}
            direction={direction}
          />
        ))}
      </div>

      {/* Bottom section */}
      <div className="flex-shrink-0 pb-12 px-8">
        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-8 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={isLast ? finish : next}
          className="w-full bg-white text-primary-700 font-bold py-4 rounded-2xl text-lg shadow-xl hover:bg-gray-50 transition-colors active:scale-[0.98] transform"
        >
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
