/**
 * Landing page copy and media, kept in one place so marketing text, real photos or
 * videos can be swapped in without touching layout code.
 *
 * Every claim here describes what the product actually does today. There are no
 * invented testimonials or usage numbers — add real ones here when you have them.
 */

/** Optional real media. Leave `null` to show the built-in animated product previews. */
export type SlideMedia = {
  type: "image" | "video";
  src: string;
  alt: string;
  poster?: string;
} | null;

/** One hero carousel slide. `preview` picks the built-in animated phone screen. */
export type HeroSlide = {
  id: string;
  label: string;
  title: string;
  text: string;
  preview: "today" | "refill" | "family";
  media: SlideMedia;
};

export const heroSlides: HeroSlide[] = [
  {
    id: "today",
    label: "Daily plan",
    title: "The whole day, sorted into four compartments",
    text: "Morning, afternoon, evening and night — just like a pill organizer, with a Take button when each dose is due.",
    preview: "today",
    media: null,
  },
  {
    id: "refill",
    label: "Reminders",
    title: "Nudged before every dose, warned before you run out",
    text: "Choose how early reminders start and how often they repeat. Refill alerts arrive at the level you set.",
    preview: "refill",
    media: null,
  },
  {
    id: "family",
    label: "Shared care",
    title: "Everyone who helps sees the same plan",
    text: "Invite family after they create an account. They see your patients only once they accept, and every dose shows who marked it.",
    preview: "family",
    media: null,
  },
];

/** Short factual highlights shown under the hero (product facts, not usage stats). */
export const facts = [
  { value: "4", label: "daypart compartments" },
  { value: "0–120", label: "minutes of reminder lead time" },
  { value: "1 hour", label: "window to mark each dose" },
  { value: "3", label: "screen sizes: phone, tablet, web" },
];

/** Feature grid. `art` selects an illustration in Illustrations.tsx. */
export const features = [
  {
    art: "schedule",
    title: "A schedule that reads like your day",
    text: "Daily, every other day, chosen weekdays or custom cycles. Doses are grouped by time of day so nothing hides.",
  },
  {
    art: "bell",
    title: "Reminders that keep trying",
    text: "A first nudge before the dose, gentle repeats, and a final alert on time — on any device you enable.",
  },
  {
    art: "refill",
    title: "Refills before the bottle is empty",
    text: "Tended counts down supply as doses are taken and warns you at your threshold.",
  },
  {
    art: "family",
    title: "Family care with consent",
    text: "Share patients with relatives or carers only after they accept. Every action records who did it.",
  },
  {
    art: "folder",
    title: "Health details in one profile",
    text: "Conditions, history, doctor, prescription photos and files (PDF, Excel, images) for each person.",
  },
  {
    art: "chart",
    title: "History you can actually use",
    text: "Filter by person, medicine, dates or time of day to see what was taken, skipped or missed.",
  },
] as const;

export const steps = [
  { title: "Create your account", text: "Sign up with email. It takes under a minute." },
  {
    title: "Add who you care for",
    text: "Yourself, a parent, a partner or a patient — add as many as you need.",
  },
  { title: "Add each medicine", text: "Strength, schedule, dose times and how many are left." },
  {
    title: "Take, skip, stay on track",
    text: "Mark doses as they happen and let reminders handle the rest.",
  },
];

export const audiences = [
  {
    id: "caregivers",
    tab: "Caregivers",
    title: "Caring for a parent or patient",
    points: [
      "Manage several people from one account and switch in a tap",
      "See what's due now, what's coming and what was missed",
      "Keep doctor details and prescriptions with each profile",
    ],
  },
  {
    id: "patients",
    tab: "Patients",
    title: "Managing your own medicines",
    points: [
      "A personal health profile kept separate from people you care for",
      "Reminders on your phone or computer before every dose",
      "A clear record to bring to your next appointment",
    ],
  },
  {
    id: "families",
    tab: "Families",
    title: "Sharing care across a household",
    points: [
      "One shared plan instead of group-chat updates",
      "Approved members can mark doses and see who did what",
      "Access starts only when each person accepts the invitation",
    ],
  },
] as const;

/** Security practices that the current implementation actually follows. */
export const privacyPoints = [
  { title: "Passwords are hashed", text: "We never store your password, only a salted hash." },
  { title: "Sessions expire", text: "Sign-ins last 8 hours, then you're asked to log in again." },
  {
    title: "Consent before sharing",
    text: "Family members see a patient only after accepting an invitation.",
  },
  {
    title: "Private file storage",
    text: "Photos and documents are stored privately and opened through links that expire after one hour.",
  },
];

export const faqs = [
  {
    q: "Does Tended replace advice from my doctor?",
    a: "No. Tended organizes the schedule your doctor or pharmacist gave you and reminds you to follow it. Always ask them before changing a medicine.",
  },
  {
    q: "What happens if a dose is missed?",
    a: "Each dose can be marked taken or skipped from its scheduled time until one hour after. After that it's recorded as missed, you get a missed-dose alert, and it appears in history.",
  },
  {
    q: "Who can see my information?",
    a: "Only you, and people you invite to your family who have accepted. Invitations never grant access on their own.",
  },
  {
    q: "Can I manage medicines for more than one person?",
    a: "Yes. Add yourself and anyone you care for, then switch between them from the Today screen.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. Tended works in the browser on phones, tablets and computers. To get alerts, turn on notifications for this device in Settings.",
  },
  {
    q: "What files can I attach to a profile?",
    a: "JPEG, PNG and HEIC photos, plus PDF and Excel files up to 10 MB each — handy for prescriptions and lab reports.",
  },
];
