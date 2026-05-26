export type PackageKind = "pet" | "can" | "glass";

export type DepositPackage = {
  id: PackageKind;
  name: string;
  shortName: string;
  description: string;
  deposit: number;
  limit: string;
  color: string;
};

export type Counts = Record<PackageKind, number>;

export type ReturnEntry = {
  id: string;
  createdAt: string;
  counts: Counts;
  amount: number;
  placeName?: string;
};

export type Goal = {
  id: string;
  name: string;
  current: number;
  target: number;
  emoji: string;
};

export const PACKAGES: DepositPackage[] = [
  {
    id: "pet",
    name: "Butelki PET",
    shortName: "PET",
    description: "Plastikowe butelki ze znakiem kaucji",
    deposit: 0.5,
    limit: "do 3 l",
    color: "#2F80ED"
  },
  {
    id: "can",
    name: "Puszki",
    shortName: "Puszki",
    description: "Metalowe puszki ze znakiem kaucji",
    deposit: 0.5,
    limit: "do 1 l",
    color: "#0F9D58"
  },
  {
    id: "glass",
    name: "Szkło zwrotne",
    shortName: "Szkło",
    description: "Szklane butelki wielokrotnego użytku",
    deposit: 1,
    limit: "do 1,5 l",
    color: "#B65F28"
  }
];

export const INITIAL_COUNTS: Counts = {
  pet: 0,
  can: 0,
  glass: 0
};

export const DEFAULT_GOALS: Goal[] = [
  { id: "bike", name: "Oszczędzam na rower", current: 68.5, target: 100, emoji: "🚲" },
  { id: "school", name: "Zbiórka szkolna", current: 132, target: 250, emoji: "🎒" },
  { id: "week", name: "Wyzwanie tygodnia", current: 18.5, target: 25, emoji: "🏆" },
  { id: "class", name: "Na zieloną klasę", current: 210, target: 500, emoji: "🌿" }
];

export const calculateAmount = (counts: Counts) =>
  PACKAGES.reduce((sum, item) => sum + counts[item.id] * item.deposit, 0);

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN"
  }).format(amount);

export const countAll = (counts: Counts) =>
  Object.values(counts).reduce((sum, count) => sum + count, 0);
