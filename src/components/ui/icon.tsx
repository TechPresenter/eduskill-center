import {
  Accessibility, Award, BadgeCheck, BookMarked, BookOpen, Briefcase, Building2, Calculator, Camera, CheckCircle2, Clock, Code2, Coins, Globe,
  GraduationCap, Hammer, Handshake, Heart, HeartHandshake, Home, Languages, Laptop, Layers, Leaf, Lightbulb, LineChart, MapPin, Megaphone,
  Monitor, Palette, PenTool, Rocket, School, Scissors, ShieldCheck, Smartphone, Sparkles, Sprout, Star, Stethoscope, Store, Sun, Target,
  TrendingUp, Truck, UserCheck, Users, Wifi, Wrench, type LucideProps,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  Accessibility, Award, BadgeCheck, BookMarked, BookOpen, Briefcase, Building2, Calculator, Camera, CheckCircle2, Clock, Code2, Coins, Globe,
  GraduationCap, Hammer, Handshake, Heart, HeartHandshake, Home, Languages, Laptop, Layers, Leaf, Lightbulb, LineChart, MapPin, Megaphone,
  Monitor, Palette, PenTool, Rocket, School, Scissors, ShieldCheck, Smartphone, Sparkles, Sprout, Star, Stethoscope, Store, Sun, Target,
  TrendingUp, Truck, UserCheck, Users, Wifi, Wrench,
};

/** Renders a lucide icon by name (CMS-configurable). Falls back to Sparkles. */
export function DynamicIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return <Icon {...props} />;
}

export const ICON_NAMES = Object.keys(ICONS);
