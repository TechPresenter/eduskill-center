import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { myTrainerDocuments, trainerDocumentExts, trainerDocumentTypes, TRAINER_DOCUMENT_MAX_MB } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { TrainerDocumentsManager } from "@/components/trainer/documents-manager";

export const metadata: Metadata = { title: "My documents" };

export default async function TrainerDocumentsPage() {
  const user = await requireTrainer();
  const [types, documents] = await Promise.all([trainerDocumentTypes(), myTrainerDocuments(user.trainer.id)]);

  return (
    <>
      <PageHeader
        title="My documents"
        mobileTitle="My documents"
        backHref="/trainer/profile"
        description="Your resume and certificates on file with the Foundation. Keep them current — a new upload is verified again before it counts."
        breadcrumbs={[{ label: "My Profile", href: "/trainer/profile" }, { label: "My documents" }]}
      />
      <TrainerDocumentsManager
        maxMb={TRAINER_DOCUMENT_MAX_MB}
        types={types.map((t) => ({
          key: t.key,
          name: t.name,
          description: t.description,
          isRequired: t.isRequired,
          accept: trainerDocumentExts(t.key)
            .map((e) => `.${e}`)
            .join(","),
        }))}
        documents={documents.map((d) => ({
          id: d.id,
          type: d.type,
          name: d.name,
          url: d.url,
          mimeType: d.mimeType,
          size: d.size,
          status: d.status,
          remarks: d.remarks,
          verifiedAt: d.verifiedAt?.toISOString() ?? null,
          createdAt: d.createdAt.toISOString(),
          fromApplication: !!d.applicationId,
        }))}
      />
    </>
  );
}
