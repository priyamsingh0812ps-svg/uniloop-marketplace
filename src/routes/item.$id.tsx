
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MessageCircle, ShoppingBag, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Header, Footer, ListingCard, Loader } from "@/components/site";
import { CATEGORIES, formatPrice, isSample, listingQuery, sellerName, listingsQuery, SAMPLE } from "@/lib/listings";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/item/$id")({
  head: () => ({
    meta: [
      { title: "Item details — UniLoop" },
      { name: "description", content: "See item details, condition and seller rating on UniLoop." },
      { property: "og:title", content: "Item details — UniLoop" },
      { property: "og:description", content: "A student listing on UniLoop." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Item,
});

function Item() {
  const { id } = Route.useParams();
  const { data = SAMPLE } = useQuery(listingsQuery);
  const one = useQuery(listingQuery(id));
  const { user } = useAuth();
  const nav = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<{
    id: string;
    price: number;
  } | null>(null);
  const qc = useQueryClient();
  const l = one.data ?? data.find((x) => x.id === id);

  if (!l) {
    if (one.isLoading) return <div className="min-h-screen"><Header /><Loader /></div>;
    return (
      <div className="min-h-screen"><Header />
        <div className="py-32 text-center">
          <p className="text-muted-foreground">This item has looped on.</p>
          <Link to="/browse" className="btn-primary mt-4 px-6 py-3">Back to browse</Link>
        </div>
      </div>
    );
  }

  const demo = isSample(l.id) || !l.seller_id;
  const own = !!user && user.id === l.seller_id;

  const startChat = async () => {
    if (demo || own || !l.seller_id) return;
    if (!user) {
      nav({ to: "/login", search: { redirect: `/item/${l.id}` } });
      return;
    }

    setBusy(true);
    try {
      const find = () =>
        supabase.from("conversations").select("id")
          .eq("item_id", l.id).eq("buyer_id", user.id).maybeSingle();

      let { data: cv } = await find();

      if (!cv) {
        const ins = await supabase.from("conversations")
          .insert({ item_id: l.id, buyer_id: user.id, seller_id: l.seller_id })
          .select("id").single();

        if (ins.error) {
          if (ins.error.code !== "23505") throw new Error(ins.error.message);
          cv = (await find()).data;
        } else {
          cv = ins.data;
        }
      }

      if (!cv) throw new Error("Could not open the chat");
      nav({ to: "/messages", search: { c: cv.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cat = CATEGORIES.find((c) => c.value === l.category);
  const similar = data.filter(
    (x) => x.id !== l.id && (x.category === l.category || x.campus === l.campus)
  ).slice(0, 4);

  const canBuy = !!user && !own && !demo && l.mode === "buy" && l.status === "available";

  const placeOrder = async () => {
    if (!user) return;

    setOrdering(true);
    try {
      const { data: res, error } = await supabase.rpc("place_order", {
        p_listing_id: l.id,
      });

      if (error) {
        throw new Error(
          error.message.includes("place_order")
            ? "Ordering isn't set up correctly. Please check db/orders.sql in Supabase."
            : error.message
        );
      }

      // The SQL function returns the newly created order ID.
      const result = Array.isArray(res) ? res[0] : res;
      const orderId = result?.order_id;

      if (!orderId) {
        throw new Error("The order was created, but its ID wasn't returned. Check My Orders before trying again.");
      }

      // Use the saved order price rather than relying on the displayed listing price.
      const { data: order, error: orderError } = await supabase
        .from("requests")
        .select("id, price")
        .eq("id", orderId)
        .eq("buyer_id", user.id)
        .single();

      if (orderError) {
        throw new Error(
          `Your order may have been created, but its saved price couldn't be loaded. Check My Orders before trying again. ${orderError.message}`
        );
      }

      if (order.price == null || !Number.isFinite(Number(order.price))) {
        throw new Error("The order price is missing. Please contact UniLoop support before paying.");
      }

      setConfirm(false);
      setPaymentOrder({ id: order.id, price: Number(order.price) });

      qc.invalidateQueries({ queryKey: ["listing", l.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      toast.error((e as Error).message);
      qc.invalidateQueries({ queryKey: ["listing", l.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } finally {
      setOrdering(false);
    }
  };

  const reportPayment = async () => {
    if (!user || !paymentOrder) return;

    setPaymentBusy(true);
    try {
      const { data: updated, error } = await supabase
        .from("requests")
        .update({ payment_status: "reported" })
        .eq("id", paymentOrder.id)
        .eq("buyer_id", user.id)
        .eq("payment_status", "awaiting_payment")
        .select("id")
        .maybeSingle();

      if (error) throw new Error(error.message);

      if (!updated) {
        throw new Error(
          "Payment wasn't marked as reported. It may already have been reported, or the order may no longer be eligible."
        );
      }

      toast.success("Payment reported. UniLoop must verify receipt manually.");
      setPaymentOrder(null);
      qc.invalidateQueries({ queryKey: ["orders"] });
      nav({ to: "/my-orders" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPaymentBusy(false);
    }
  };

  const platformFee = paymentOrder
    ? Math.round(paymentOrder.price * 0.05 * 100) / 100
    : 0;
  const sellerPayout = paymentOrder
    ? Math.round((paymentOrder.price - platformFee) * 100) / 100
    : 0;

  return (
    <div className="min-h-screen">
      <Header />

      <Dialog
        open={confirm}
        onOpenChange={(o) => !ordering && setConfirm(o)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your order</DialogTitle>
            <DialogDescription>
              Confirm to create your order and continue to payment.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
            {l.image_url && (
              <img src={l.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{l.title}</p>
              <p className="font-display text-xl font-bold text-primary">{formatPrice(l)}</p>
            </div>
          </div>

          <p className="rounded-xl bg-accent/15 px-4 py-3 text-sm font-medium">
            Your order will be created and the item reserved. Review the payment details on the next screen.
          </p>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setConfirm(false)}
              disabled={ordering}
              className="rounded-full border border-border px-5 py-2.5 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={placeOrder}
              disabled={ordering}
              className="btn-accent gap-2 px-5 py-2.5 disabled:opacity-60"
            >
              {ordering && <Loader2 className="h-4 w-4 animate-spin" />}
              {ordering ? "Creating order..." : "Confirm order"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!paymentOrder}
        onOpenChange={(open) => {
          if (!open && !paymentBusy) setPaymentOrder(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Complete your payment
            </DialogTitle>
            <DialogDescription>
              Scan the QR code using your payment app. Check the recipient and amount before paying.
            </DialogDescription>
          </DialogHeader>

          {paymentOrder && (
            <>
              <div className="rounded-2xl border border-border bg-white p-4">
                <img
                  src="/payment-qr.png"
                  alt="UniLoop payment QR code"
                  className="mx-auto max-h-64 w-full object-contain"
                />
              </div>

              <div className="space-y-3 rounded-xl bg-secondary p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Product price</span>
                 <span className="font-semibold">₹{paymentOrder.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">UniLoop commission (5%)</span>
                  <span className="font-semibold">₹{platformFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="font-semibold">Seller's net amount</span>
                  <span className="font-bold">₹{sellerPayout.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                The QR code may not automatically fill in the amount or split the payment. The displayed commission is a calculation only; it is not automatically deducted. Only report payment after you have actually paid. UniLoop must verify receipt manually before recording the payment as verified.
              </p>

              <DialogFooter className="gap-2 sm:flex-col">
                <button
                  onClick={reportPayment}
                  disabled={paymentBusy}
                  className="btn-accent w-full gap-2 py-3 disabled:opacity-60"
                >
                  {paymentBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {paymentBusy ? "Reporting payment..." : "I've Paid"}
                </button>
                <button
                  onClick={() => setPaymentOrder(null)}
                  disabled={paymentBusy}
                  className="w-full rounded-full border border-border px-5 py-2.5 font-semibold"
                >
                  Pay later
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/browse" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back to browse
        </Link>

        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <div className="overflow-hidden rounded-3xl bg-muted shadow-lift">
            {l.image_url && (
              <img
                src={l.image_url.replace("w=800", "w=1200")}
                alt={l.title}
                className="aspect-square w-full object-cover"
              />
            )}
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`chip chip-${l.mode}`}>{l.mode}</span>
              <span className="chip bg-secondary text-secondary-foreground">{cat?.label}</span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{l.title}</h1>
            <p className="mt-3 font-display text-3xl font-extrabold text-primary">{formatPrice(l)}</p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-muted-foreground">Condition</dt>
                <dd className="font-semibold">{l.condition}</dd>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-muted-foreground">Campus</dt>
                <dd className="font-semibold">{l.campus}</dd>
              </div>
            </dl>

            <p className="mt-6 leading-relaxed text-muted-foreground">{l.description}</p>

            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hero font-display text-lg font-bold text-primary-foreground">
                {sellerName(l)[0]}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{sellerName(l)}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">✓ Verified Student</span> · ★ {l.seller_rating ?? "New"}
                </p>
              </div>
            </div>

            {demo && (
              <p className="mt-6 rounded-xl bg-accent/15 px-4 py-3 text-sm">
                <b>Demo listing</b> — this is sample data with no real seller account, so chat is disabled.
              </p>
            )}

            {l.status !== "available" && (
              <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide ${l.status === "sold" ? "bg-foreground text-background" : "bg-accent/20 text-accent-foreground"}`}>
                {l.status === "sold" ? "Sold" : l.status === "reserved" ? "Reserved" : "Unavailable"}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {own ? (
                <Link to="/my-listings" className="btn-primary flex-1 py-3.5">
                  This is your listing — manage it
                </Link>
              ) : (
                <>
                  {canBuy && (
                    <button onClick={() => setConfirm(true)} className="btn-accent flex-1 gap-2 py-3.5">
                      <ShoppingBag className="h-4 w-4" />Buy Now
                    </button>
                  )}
                  <button
                    onClick={startChat}
                    disabled={demo || busy}
                    className={`${canBuy ? "btn-primary" : "btn-accent"} flex-1 gap-2 py-3.5 disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    {demo ? "Chat unavailable" : "Chat with seller"}
                  </button>
                </>
              )}

              <button
                onClick={() => setSaved(!saved)}
                aria-label="Save to wishlist"
                className={`rounded-full border px-5 text-xl transition ${saved ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card"}`}
              >
                {saved ? "♥" : "♡"}
              </button>
            </div>
          </div>
        </div>

        {!!similar.length && (
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold">You might also like</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {similar.map((x) => <ListingCard key={x.id} l={x} />)}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
