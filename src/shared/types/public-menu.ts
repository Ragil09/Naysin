/* Serializable fields exposed to the public catalog. */
export type PublicMenuItem = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  description: string;
  price: number | null;
  isAvailable: boolean;
  imageUrl: string | null;
};
