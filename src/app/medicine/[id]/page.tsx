import { MedicineDetails } from "@/components/medicine-details";

export default async function MedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MedicineDetails id={id} />;
}
