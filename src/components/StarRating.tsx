interface StarRatingProps {
  rating: number; // 0-5
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  onRatingChange?: (rating: number) => void;
  showText?: boolean;
}

export const StarRating = ({
  rating,
  maxRating = 5,
  size = 'md',
  readonly = false,
  onRatingChange,
  showText = false,
}: StarRatingProps) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const handleClick = (value: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value);
    }
  };

  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  for (let i = 1; i <= maxRating; i++) {
    const filled = i <= fullStars || (i === fullStars + 1 && hasHalfStar);
    const className = `${filled ? 'text-yellow-400' : 'text-gray-300'} transition-colors ${sizeClasses[size]}`;
    stars.push(readonly
      ? <span key={i} className={className}>{filled ? '⭐' : '☆'}</span>
      : <button type="button" key={i} className={`${className} cursor-pointer hover:text-yellow-500 focus-visible:outline-2 focus-visible:outline-blue-500`}
          aria-label={`${i} / ${maxRating}`} aria-pressed={i === rating} onClick={() => handleClick(i)}>{filled ? '⭐' : '☆'}</button>);
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex">{stars}</div>
      {showText && rating > 0 && (
        <span className={`ml-2 text-gray-600 ${sizeClasses[size]}`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

