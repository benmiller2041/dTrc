import { clsx } from "clsx";

type ClassValue = Parameters<typeof clsx>[0];

export const cn = (...inputs: ClassValue[]) => clsx(inputs);
