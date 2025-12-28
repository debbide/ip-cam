import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Grid2X2, Grid3X3, Square, LayoutGrid } from 'lucide-react';

export type LayoutType = '1x1' | '2x2' | '3x3' | 'auto';

interface LayoutSelectorProps {
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
}

const layouts: { value: LayoutType; label: string; icon: React.ReactNode }[] = [
  { value: 'auto', label: '自适应', icon: <LayoutGrid className="w-4 h-4" /> },
  { value: '1x1', label: '单画面', icon: <Square className="w-4 h-4" /> },
  { value: '2x2', label: '四分屏', icon: <Grid2X2 className="w-4 h-4" /> },
  { value: '3x3', label: '九分屏', icon: <Grid3X3 className="w-4 h-4" /> },
];

export function LayoutSelector({ layout, onLayoutChange }: LayoutSelectorProps) {
  const currentLayout = layouts.find(l => l.value === layout) || layouts[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {currentLayout.icon}
          <span className="hidden sm:inline">{currentLayout.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {layouts.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => onLayoutChange(l.value)}
            className={layout === l.value ? 'bg-accent' : ''}
          >
            <span className="mr-2">{l.icon}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
