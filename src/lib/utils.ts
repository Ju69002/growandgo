import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalise un nom d'entreprise en un ID technique unique et propre.
 * Supprime les accents, les majuscules, les espaces et les caractères spéciaux.
 */
export function normalizeId(name: string) {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/\s+/g, '-') // Remplace les espaces par des tirets
    .replace(/[^a-z0-9-]/g, '') // Supprime tout ce qui n'est pas alphanumérique ou tiret
    .replace(/-+/g, '-') // Évite les tirets doubles
    .replace(/^-+|-+$/g, ''); // Supprime les tirets au début et à la fin
}
