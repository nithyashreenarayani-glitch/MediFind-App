import { redirect } from "next/navigation";

export default function PharmacySignupPage() {
  redirect("/register?role=PHARMACY");
}
