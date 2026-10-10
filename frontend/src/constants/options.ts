import { Pill } from "lucide-react";
import { type Medicine } from "../api";
import { today } from "../lib/dates";

export const conditions = [
  "Type 2 diabetes",
  "Type 1 diabetes",
  "Hypertension (high blood pressure)",
  "High cholesterol",
  "Asthma",
  "COPD",
  "Chronic kidney disease",
  "Osteoarthritis",
  "Depression",
  "Anxiety disorder",
  "Hypothyroidism",
  "GERD / acid reflux",
  "Chronic pain",
];

export const relationships = [
  "Parent",
  "Spouse",
  "Child",
  "Sibling",
  "Grandparent",
  "Relative",
  "Friend",
  "Professional caregiver",
  "Other",
];

export const forms = ["Pill", "Injection", "Syrup", "Drops", "Inhaler", "Powder", "Other"];

export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const blank = (): Omit<Medicine, "id"> => ({
  name: "",
  strength: "",
  form: "Pill",
  condition: "",
  frequencyPattern: "daily",
  specificDays: [],
  cycleEvery: 1,
  cycleUnit: "days",
  times: ["08:00"],
  liquid: "No liquid needed",
  withFood: false,
  startDate: today(),
  durationType: "ongoing",
  durationValue: 30,
  durationUnit: "days",
  supplyCount: 30,
  refillThreshold: 7,
  isRecurring: true,
});
