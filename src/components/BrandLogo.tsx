/** 站点品牌图标（来自 public/app-icon.png，与 favicon 一致） */
const ICON_SRC = '/app-icon.png';

type BrandLogoSize = 'sm' | 'md' | 'lg';

const sizeClass: Record<BrandLogoSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

export const BrandLogo = ({ size = 'md', className = '' }: BrandLogoProps) => (
  <img
    src={ICON_SRC}
    alt="图书馆"
    className={`rounded-2xl object-cover shadow-lg shadow-black/20 ${sizeClass[size]} ${className}`.trim()}
  />
);
