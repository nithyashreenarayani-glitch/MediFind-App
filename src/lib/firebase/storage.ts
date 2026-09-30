import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

export async function uploadPharmacyLogo(pharmacyId: string, ownerId: string, file: File) {
  if (!storage) throw new Error("Firebase Storage is not configured");
  if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) throw new Error("Choose an image under 3 MB.");
  const extension = file.name.split(".").pop()?.toLocaleLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const object = ref(storage, `pharmacies/${pharmacyId}/logos/${ownerId}.${extension}`);
  await uploadBytes(object, file, { contentType: file.type });
  return getDownloadURL(object);
}
