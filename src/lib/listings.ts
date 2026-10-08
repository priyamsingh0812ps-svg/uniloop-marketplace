import { queryOptions } from "@tanstack/react-query";
import { BookOpen, Calculator, Bike, Armchair, Headphones, Package, type LucideIcon } from "lucide-react";
import { supabase } from "./supabase";

export type Mode = "buy" | "rent" | "exchange";
export type Category = "books" | "calculators" | "cycles" | "furniture" | "gadgets" | "other";
export type Status = "available" | "reserved" | "sold" | "unavailable";

export interface SellerInfo { id: string; full_name: string; verified: boolean; avatar_url: string | null }

export interface Listing {
  id: string;
  seller_id: string | null;
  title: string;
  description: string;
  category: Category;
  mode: Mode;
  price: number;
  rent_period: string | null;
  condition: string;
  campus: string;
  image_url: string | null;
  images: string[] | null;
  status: Status;
  seller_name?: string | null;
  seller_rating?: number | null;
  seller?: SellerInfo | null;
  created_at: string;
}

export const CATEGORIES: { value: Category; label: string; emoji: string; icon: LucideIcon }[] = [
  { value: "books", label: "Books", emoji: "📚", icon: BookOpen },
  { value: "calculators", label: "Calculators", emoji: "🧮", icon: Calculator },
  { value: "cycles", label: "Cycles", emoji: "🚲", icon: Bike },
  { value: "furniture", label: "Furniture", emoji: "🪑", icon: Armchair },
  { value: "gadgets", label: "Gadgets", emoji: "🎧", icon: Headphones },
  { value: "other", label: "Other", emoji: "📦", icon: Package },
];
export const CAMPUSES = ["IIT Delhi", "BITS Pilani", "VIT Vellore", "NIT Trichy"];
export const CONDITIONS = ["Like new", "Good", "Fair", "Used"];

const u = (id: string) => `https://images.unsplash.com/${id}?w=800`;
const d = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
const s = (x: Omit<Listing, "seller_id" | "images" | "status">): Listing => ({ ...x, seller_id: null, images: x.image_url ? [x.image_url] : [], status: "available" });

// Sample listings shown only until real listings exist in the database.
export const SAMPLE: Listing[] = [
  s({ id: "s1", title: "HC Verma Concepts of Physics (Vol 1 & 2)", description: "Both volumes, light pencil marks, no torn pages. Perfect for first-years.", category: "books", mode: "buy", price: 450, rent_period: null, condition: "Good", campus: "IIT Delhi", image_url: u("photo-1544947950-fa07a98d237f"), seller_name: "Aarav Mehta", seller_rating: 4.8, created_at: d(1) }),
  s({ id: "s2", title: "Casio fx-991EX Classwiz", description: "Barely used scientific calculator, with cover. Exam-approved.", category: "calculators", mode: "buy", price: 900, rent_period: null, condition: "Like new", campus: "BITS Pilani", image_url: u("photo-1564939558297-fc396f18e5c7"), seller_name: "Sneha Iyer", seller_rating: 4.9, created_at: d(2) }),
  s({ id: "s3", title: "Hero Sprint 21-speed cycle", description: "Serviced last month, new brakes. Great for campus rides.", category: "cycles", mode: "rent", price: 300, rent_period: "week", condition: "Good", campus: "IIT Delhi", image_url: u("photo-1485965120184-e220f721d03e"), seller_name: "Rohan Gupta", seller_rating: 4.6, created_at: d(3) }),
  s({ id: "s4", title: "Foldable study table", description: "Wooden top, steel legs. Fits any hostel room.", category: "furniture", mode: "buy", price: 1200, rent_period: null, condition: "Good", campus: "VIT Vellore", image_url: u("photo-1518455027359-f3f8164ba6bd"), seller_name: "Priya Nair", seller_rating: 4.7, created_at: d(4) }),
  s({ id: "s5", title: "JBL Tune 510BT headphones", description: "Swap for a mechanical keyboard or similar gadget.", category: "gadgets", mode: "exchange", price: 0, rent_period: null, condition: "Like new", campus: "BITS Pilani", image_url: u("photo-1505740420928-5e560c06d30e"), seller_name: "Kabir Singh", seller_rating: 4.5, created_at: d(5) }),
  s({ id: "s6", title: "Engineering drawing kit + drafter", description: "Complete Omega drafter set with mini-drafter and sheet holder.", category: "other", mode: "rent", price: 40, rent_period: "day", condition: "Fair", campus: "NIT Trichy", image_url: u("photo-1503387762-592deb58ef4e"), seller_name: "Ananya Rao", seller_rating: 4.4, created_at: d(6) }),
  s({ id: "s7", title: "Cormen – Introduction to Algorithms", description: "3rd edition, hardcover. Some highlights in chapters 1–10.", category: "books", mode: "exchange", price: 0, rent_period: null, condition: "Good", campus: "NIT Trichy", image_url: u("photo-1532012197267-da84d127e765"), seller_name: "Vikram Joshi", seller_rating: 4.9, created_at: d(7) }),
  s({ id: "s8", title: "Mini fridge 50L", description: "Works perfectly. Pickup from Hostel 4.", category: "furniture", mode: "rent", price: 150, rent_period: "week", condition: "Good", campus: "VIT Vellore", image_url: u("photo-1571175443880-49e1d25b2bc5"), seller_name: "Meera Pillai", seller_rating: 4.3, created_at: d(8) }),
  s({ id: "s9", title: "iPad 9th Gen 64GB + Pencil", description: "For notes and reading. Battery health 92%.", category: "gadgets", mode: "buy", price: 18500, rent_period: null, condition: "Like new", campus: "IIT Delhi", image_url: u("photo-1544244015-0df4b3ffc6b0"), seller_name: "Ishaan Kapoor", seller_rating: 5.0, created_at: d(9) }),
];

export const isSample = (id: string) => /^s\d+$/.test(id);
const SELECT = "*, seller:profiles(id, full_name, verified, avatar_url)";

async function fetchListings(): Promise<Listing[]> {
  try {
    const { data, error } = await supabase.from("listings").select(SELECT)
      .in("status", ["available", "reserved"]).order("created_at", { ascending: false });
    if (error || !data?.length) return SAMPLE;
    return data as unknown as Listing[];
  } catch {
    return SAMPLE;
  }
}
export const listingsQuery = queryOptions({ queryKey: ["listings"], queryFn: fetchListings });

export const listingQuery = (id: string) => queryOptions({
  queryKey: ["listing", id],
  queryFn: async (): Promise<Listing | null> => {
    if (isSample(id)) return SAMPLE.find((l) => l.id === id) ?? null;
    const { data, error } = await supabase.from("listings").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as Listing | null;
  },
});

export async function fetchRating(userId: string) {
  const { data } = await supabase.from("reviews").select("rating").eq("reviewee_id", userId);
  if (!data?.length) return { avg: null as number | null, count: 0 };
  return { avg: Math.round((data.reduce((a, r) => a + r.rating, 0) / data.length) * 10) / 10, count: data.length };
}

export function formatPrice(l: Pick<Listing, "mode" | "price" | "rent_period">) {
  if (l.mode === "exchange") return "Exchange";
  const p = `₹${Number(l.price).toLocaleString("en-IN")}`;
  return l.mode === "rent" ? `${p}/${l.rent_period ?? "day"}` : p;
}

export function sellerName(l: Listing) {
  return l.seller?.full_name || l.seller_name || "Student";
}
