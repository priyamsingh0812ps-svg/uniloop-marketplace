import { queryOptions } from "@tanstack/react-query";
import { BookOpen, Armchair, Dumbbell, Car, Headphones, UtensilsCrossed, Home, type LucideIcon } from "lucide-react";
import { supabase } from "./supabase";

export type Mode = "buy" | "rent" | "exchange" | "meal";
export type Category = "study" | "hostel" | "sports" | "vehicles" | "gadgets" | "food" | "accommodation";
export type Status = "available" | "reserved" | "sold" | "unavailable";

export interface SellerInfo { id: string; full_name: string; verified: boolean; avatar_url: string | null }

export interface Listing {
  id: string;
  seller_id: string | null;
  title: string;
  description: string;
  category: Category;
  subcategory: string | null;
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

export interface CategoryDef { value: Category; label: string; icon: LucideIcon; subs: string[]; modes: Mode[]; blurb: string }

export const CATEGORIES: CategoryDef[] = [
  { value: "study", label: "Study Materials", icon: BookOpen, subs: ["Books", "Calculators", "Engineering Tools"], modes: ["buy", "rent", "exchange"], blurb: "Textbooks, calculators and drawing kits" },
  { value: "hostel", label: "Furniture & Hostel Essentials", icon: Armchair, subs: ["Furniture", "Study Lamps", "Storage Boxes", "Extension Boards", "Other Hostel Essentials"], modes: ["buy", "rent", "exchange"], blurb: "Everything for your room" },
  { value: "sports", label: "Sports & Fitness", icon: Dumbbell, subs: ["Cricket", "Badminton", "Football", "Basketball", "Fitness Equipment"], modes: ["buy", "rent", "exchange"], blurb: "Gear for the ground and gym" },
  { value: "vehicles", label: "Vehicles", icon: Car, subs: ["Scooters", "Motorbikes", "Other Vehicles"], modes: ["buy", "rent", "exchange"], blurb: "Scooters and bikes — rentals where legally permitted" },
  { value: "gadgets", label: "Gadgets & Electronics", icon: Headphones, subs: ["Headphones", "Earphones", "Laptops", "Keyboards", "Mice", "Speakers", "Monitors", "Other Accessories"], modes: ["buy", "rent", "exchange"], blurb: "Laptops, audio and accessories" },
  { value: "food", label: "Food & Meal Plans", icon: UtensilsCrossed, subs: ["Daily Lunch", "Dinner", "Breakfast", "Tiffin Services", "Monthly Meal Packages", "Mess Services", "Home-Cooked Food"], modes: ["meal"], blurb: "Tiffins, mess and monthly meal plans" },
  { value: "accommodation", label: "Accommodation", icon: Home, subs: ["Flats", "Shared Flats", "PG", "Hostels", "Rooms for Rent", "Student Housing"], modes: ["rent"], blurb: "Flats, PGs and rooms near campus" },
];
export const catDef = (c: string) => CATEGORIES.find((x) => x.value === c);
export const CONDITIONS = ["Like new", "Good", "Fair", "Used"];
export const MODE_LABEL: Record<Mode, string> = { buy: "Sell", rent: "Rent", exchange: "Exchange", meal: "Meal plan" };

const u = (id: string) => `https://images.unsplash.com/${id}?w=800`;
const d = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
const s = (x: Omit<Listing, "seller_id" | "images" | "status">): Listing => ({ ...x, seller_id: null, images: x.image_url ? [x.image_url] : [], status: "available" });
const C = "Demo College";

// Sample listings shown only until real listings exist in the database.
export const SAMPLE: Listing[] = [
  s({ id: "s1", title: "HC Verma Concepts of Physics (Vol 1 & 2)", description: "Both volumes, light pencil marks, no torn pages. Perfect for first-years.", category: "study", subcategory: "Books", mode: "buy", price: 450, rent_period: null, condition: "Good", campus: C, image_url: u("photo-1544947950-fa07a98d237f"), seller_name: "Aarav Mehta", seller_rating: 4.8, created_at: d(1) }),
  s({ id: "s2", title: "Casio fx-991EX Classwiz", description: "Barely used scientific calculator, with cover. Exam-approved.", category: "study", subcategory: "Calculators", mode: "buy", price: 900, rent_period: null, condition: "Like new", campus: C, image_url: u("photo-1564939558297-fc396f18e5c7"), seller_name: "Sneha Iyer", seller_rating: 4.9, created_at: d(2) }),
  s({ id: "s3", title: "Honda Activa scooter", description: "Well maintained, papers in order. Helmet included. Rental subject to local rules.", category: "vehicles", subcategory: "Scooters", mode: "rent", price: 1500, rent_period: "week", condition: "Good", campus: C, image_url: u("photo-1558981806-ec527fa84c39"), seller_name: "Rohan Gupta", seller_rating: 4.6, created_at: d(3) }),
  s({ id: "s4", title: "Foldable study table", description: "Wooden top, steel legs. Fits any hostel room.", category: "hostel", subcategory: "Furniture", mode: "buy", price: 1200, rent_period: null, condition: "Good", campus: C, image_url: u("photo-1518455027359-f3f8164ba6bd"), seller_name: "Priya Nair", seller_rating: 4.7, created_at: d(4) }),
  s({ id: "s5", title: "JBL Tune 510BT headphones", description: "Swap for a mechanical keyboard or similar gadget.", category: "gadgets", subcategory: "Headphones", mode: "exchange", price: 0, rent_period: null, condition: "Like new", campus: C, image_url: u("photo-1505740420928-5e560c06d30e"), seller_name: "Kabir Singh", seller_rating: 4.5, created_at: d(5) }),
  s({ id: "s6", title: "Engineering drawing kit + drafter", description: "Complete Omega drafter set with mini-drafter and sheet holder.", category: "study", subcategory: "Engineering Tools", mode: "rent", price: 40, rent_period: "day", condition: "Fair", campus: C, image_url: u("photo-1503387762-592deb58ef4e"), seller_name: "Ananya Rao", seller_rating: 4.4, created_at: d(6) }),
  s({ id: "s7", title: "Yonex badminton racket pair", description: "Two rackets with cover and a tube of shuttles.", category: "sports", subcategory: "Badminton", mode: "buy", price: 1100, rent_period: null, condition: "Good", campus: C, image_url: u("photo-1626224583764-f87db24ac4ea"), seller_name: "Vikram Joshi", seller_rating: 4.9, created_at: d(7) }),
  s({ id: "s8", title: "Home-style veg tiffin — lunch & dinner", description: "Dal, sabzi, 4 rotis, rice. Delivered to hostel gate at 1 PM and 8 PM. Menu changes daily.", category: "food", subcategory: "Tiffin Services", mode: "meal", price: 3200, rent_period: "month", condition: "Fresh", campus: C, image_url: u("photo-1546833999-b9f581a1996d"), seller_name: "Meera's Kitchen", seller_rating: 4.3, created_at: d(8) }),
  s({ id: "s9", title: "Shared 2BHK room near main gate", description: "One bed in a 2-sharing room. Wi-Fi, washing machine, 5 min walk. Deposit ₹10,000. Available from next month.", category: "accommodation", subcategory: "Shared Flats", mode: "rent", price: 7500, rent_period: "month", condition: "Furnished", campus: C, image_url: u("photo-1522708323590-d24dbb6b0267"), seller_name: "Ishaan Kapoor", seller_rating: 5.0, created_at: d(9) }),
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
  return l.mode === "rent" || l.mode === "meal" ? `${p}/${l.rent_period ?? "day"}` : p;
}

export function sellerName(l: Listing) {
  return l.seller?.full_name || l.seller_name || "Student";
}
