import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

export function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className={cn(sizeClasses[size], className)}>
      <DotLottieReact
        src="https://lottie.host/ced169d2-9855-4da7-bb54-b5564a667df7/8XTHY5apx5.lottie"
        loop
        autoplay
      />
    </div>
  );
}
