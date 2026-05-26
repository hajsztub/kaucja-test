import returnPoints from "./return-points.json";

export type ReturnPoint = {
  id: string;
  name: string;
  address: string;
  type: "automat" | "sklep" | "punkt";
  status: "active" | "manual" | "unknown";
  latitude: number;
  longitude: number;
  hours?: string;
};

export const RETURN_POINTS = returnPoints as ReturnPoint[];
