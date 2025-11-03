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

  const handleMouseEnter = (value: number) => {
    if (!readonly) {
      // 可以添加悬停效果
    }
  };

  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  for (let i = 1; i <= maxRating; i++) {
    if (i <= fullStars) {
      stars.push(
        <span
          key={i}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} text-yellow-400 hover:text-yellow-500 transition-colors ${sizeClasses[size]}`}
          onClick={() => handleClick(i)}
          onMouseEnter={() => handleMouseEnter(i)}
        >
          ⭐
        </span>
      );
    } else if (i === fullStars + 1 && hasHalfStar) {
      stars.push(
        <span
          key={i}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} text-yellow-400 hover:text-yellow-500 transition-colors ${sizeClasses[size]}`}
          onClick={() => handleClick(i)}
          onMouseEnter={() => handleMouseEnter(i)}
        >
          ⭐
        </span>
      );
    } else {
      stars.push(
        <span
          key={i}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} text-gray-300 hover:text-yellow-400 transition-colors ${sizeClasses[size]}`}
          onClick={() => handleClick(i)}
          onMouseEnter={() => handleMouseEnter(i)}
        >
          ☆
        </span>
      );
    }
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

