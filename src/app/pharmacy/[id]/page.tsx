import { PharmacyDetails } from "@/components/pharmacy-details";

export default async function PharmacyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PharmacyDetails id={id} />;
}
