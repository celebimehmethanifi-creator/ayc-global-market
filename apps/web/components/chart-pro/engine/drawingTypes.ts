export type DrawingType = 
  | 'trendLine' | 'horizontalLine' | 'verticalLine' | 'priceLine'
  | 'fibonacci' | 'rectangle' | 'text' | 'entryLine' | 'targetLine' | 'stopLine';

export interface DrawingPoint {
  time: number;
  price: number;
}

export interface DrawingStyle {
  color: string;
  width: number;
  dash?: boolean;
  label?: string;
}

export interface Drawing {
  id: string;
  userId?: string;
  symbol: string;
  timeframe: string;
  type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  createdAt: string;
  updatedAt: string;
}

export function createDrawingId(): string {
  return `drw_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}
