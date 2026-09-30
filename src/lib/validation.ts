import { z } from "zod";

export const medicineSchema = z.object({
  name: z.string().trim().min(1, "Medicine name is required").max(120),
  genericName: z.string().trim().max(120),
  brand: z.string().trim().max(120),
  strength: z.string().trim().max(60),
  form: z.string().trim().min(1, "Choose a form").max(60),
  category: z.string().trim().max(80),
  description: z.string().trim().max(500),
});

export const pharmacySchema = z.object({
  name: z.string().trim().min(2, "Enter your pharmacy name").max(120),
  address: z.string().trim().min(4, "Enter the street address").max(240),
  city: z.string().trim().min(2, "Enter the city or area").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(30),
  latitude: z.string().trim().refine((value) => value === "" || (Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 90), "Enter a valid latitude"),
  longitude: z.string().trim().refine((value) => value === "" || (Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 180), "Enter a valid longitude"),
  openTime: z.string(),
  closeTime: z.string(),
});

export const inventorySchema = z.object({
  medicineId: z.string().min(1, "Choose a medicine"),
  quantity: z.number().int().min(0, "Stock cannot be negative").max(100_000),
  minimumStock: z.number().int().min(0, "Minimum stock cannot be negative").max(100_000),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});
