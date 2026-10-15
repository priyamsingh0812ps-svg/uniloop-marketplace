import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us | UniLoop" },
      {
        name: "description",
        content:
          "Discover UniLoop, our mission, student marketplace categories, and the VentureX team building the platform.",
      },
    ],
  }),
  component: AboutPage,
});

const categories = [
  {
    title: "Study Materials",
    description: "Books, calculators, engineering tools, and academic essentials.",
  },
  {
    title: "Furniture & Hostel Essentials",
    description: "Furniture, study lamps, storage boxes, extension boards, and more.",
  },
  {
    title: "Sports & Fitness",
    description: "Cricket, badminton, football, basketball, and fitness equipment.",
  },
  {
    title: "Vehicles",
    description: "Explore eligible vehicles for sale or rental where legally permitted.",
  },
  {
    title: "Gadgets & Electronics",
    description: "Laptops, headphones, keyboards, mice, speakers, monitors, and accessories.",
  },
  {
    title: "Food & Meal Plans",
    description: "Discover food options and meal packages for student life.",
  },
  {
    title: "Accommodation",
    description: "Explore flats, hostels, and other accommodation options.",
  },
];

const team = [
  {
    name: "Viswaprakash Singh",
    role: "Founder & CEO",
    description:
      "Leads UniLoop's vision, strategy, and overall direction.",
  },
  {
    name: "Zaid Alam",
    role: "Co founder",
    description:
      "Focuses on the execution of plan& sharing vision, risk, and responsibilities.",
  },
  {
    name: "Yashi Raj",
    role: "Finance & Admin Lead",
    description:
      "Handles financial planning and administrative coordination.",
  },
  {
    name: "Sonali Choudhary",
    role: "Operations Head",
    description:
      "Focuses on operational planning and coordination.",
  },
  {
    name: "Unnati Katare",
    role: "CTO / Tech Lead",
    description:
      "Leads technical planning and the development of UniLoop.",
  },
  {
    name: "Vidhi Mishra",
    role: "Head of Product & UX Design",
    description:
      "Focuses on product experience, interface design, and usability.",
  },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main>
        <section className="bg-hero text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
            <span className="chip bg-primary-foreground/15 text-primary-foreground">
              Meet the people behind UniLoop
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold sm:text-6xl">
              About <span className="text-accent">UniLoop</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg opacity-90">
              One Campus. Endless Possibilities. Making college life simpler,
              smarter, and more affordable.
            </p>

            <Link
              to="/browse"
              className="btn-accent mt-8 inline-flex rounded-full px-7 py-3.5"
            >
              Explore Marketplace
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-semibold uppercase tracking-widest text-primary">
              Who We Are
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Built around student life
            </h2>
          </div>

          <div className="space-y-4 leading-7 text-muted-foreground">
            <p>
              UniLoop is a student-focused marketplace designed to bring
              everyday college needs together in one place.
            </p>
            <p>
              Students can discover products, buy and sell useful items, explore
              eligible rental options, and find food and accommodation
              opportunities through a convenient online platform.
            </p>
            <p>
              Our goal is to help students make smarter use of their resources
              and build a more connected campus community.
            </p>
          </div>
        </section>

        <section className="bg-secondary py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-semibold uppercase tracking-widest text-primary">
                Explore UniLoop
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
                What You Can Find Here
              </h2>
              <p className="mt-4 text-muted-foreground">
                Discover categories designed around the essentials of college
                life.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => (
                <article
                  key={category.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-1"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 font-display font-bold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">
                    {category.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {category.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-7 shadow-soft sm:p-9">
              <p className="font-semibold uppercase tracking-widest text-primary">
                Our Mission
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold">
                Make student life easier
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Our mission is to make college life more affordable, convenient,
                and connected by helping students discover essential products
                and useful opportunities in one place.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-7 shadow-soft sm:p-9">
              <p className="font-semibold uppercase tracking-widest text-primary">
                Our Vision
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold">
                A connected student community
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                We envision UniLoop becoming a trusted destination where
                students can exchange resources, discover useful services, and
                find solutions for everyday campus needs.
              </p>
            </article>
          </div>
        </section>

        <section className="bg-secondary py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-semibold uppercase tracking-widest text-primary">
                The Team
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
                Meet VentureX
              </h2>
              <p className="mt-4 text-muted-foreground">
                The six team members bringing different perspectives to the
                UniLoop journey.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((member, index) => (
                <article
                  key={member.name}
                  className="rounded-2xl border border-border bg-card p-6 shadow-soft"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 font-display text-xl font-bold text-primary">
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>

                  <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">
                    VentureX · {String(index + 1).padStart(2, "0")}
                  </p>

                  <h3 className="mt-2 font-display text-xl font-bold">
                    {member.name}
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    {member.role}
                  </p>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {member.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            Your Campus. Your Community. Your UniLoop.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-7 text-muted-foreground">
            Discover useful resources, explore marketplace categories, and be
            part of a more connected student experience.
          </p>
          <Link
            to="/browse"
            className="btn-accent mt-8 inline-flex rounded-full px-7 py-3.5"
          >
            Start Exploring
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
