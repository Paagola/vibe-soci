/** Los iconos del catálogo de herramientas (por nombre de lucide), sin traer el juego entero. */
import { BadgeCheck, Camera, ClipboardList, Crop, GitCompare, ImageDown, LayoutGrid, Library, Palette, ScanEye, ScanSearch, Scissors, SearchCheck, Sparkles, Store, StickyNote, SunMedium, Type, Wallet, WandSparkles, Wrench, type LucideIcon } from 'lucide-react';

const ICONOS: Record<string, LucideIcon> = { BadgeCheck, Camera, ClipboardList, Crop, GitCompare, ImageDown, LayoutGrid, Library, Palette, ScanEye, ScanSearch, Scissors, SearchCheck, Sparkles, Store, StickyNote, SunMedium, Type, Wallet, WandSparkles };

export const iconoDe = (nombre?: string): LucideIcon => (nombre && ICONOS[nombre]) || Wrench;
