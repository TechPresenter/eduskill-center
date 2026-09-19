/**
 * Documents a centre applicant may upload without a login (authorised by the signed upload token).
 *
 * `DocumentType` rows only cover STUDENT / TRAINER owners, so the centre catalogue is a fixed list
 * shared by the public upload UI and the route handler that validates `type`.
 * Keys are stored in `CentreApplicationDocument.type`.
 */
export interface CentreDocumentType {
  key: string;
  name: string;
  description: string;
  required: boolean;
  /** Several files of this type are useful (extra upload slots in the UI). */
  multiple?: boolean;
  /** `accept` for the file input. */
  accept: string;
  maxMb: number;
}

export const CENTRE_DOCUMENT_TYPES: readonly CentreDocumentType[] = [
  {
    key: "identity_proof",
    name: "Identity proof",
    description: "Aadhaar, voter ID, driving licence or passport of the applicant.",
    required: true,
    accept: ".jpg,.jpeg,.png,.pdf",
    maxMb: 5,
  },
  {
    key: "address_proof",
    name: "Address proof",
    description: "Aadhaar, ration card, electricity bill or any document showing your address.",
    required: true,
    accept: ".jpg,.jpeg,.png,.pdf",
    maxMb: 5,
  },
  {
    key: "space_photo",
    name: "Photos of the proposed space",
    description: "Room, classroom and entrance photos. These help the centre verification visit.",
    required: false,
    multiple: true,
    accept: ".jpg,.jpeg,.png",
    maxMb: 5,
  },
];

/** Uploads from the applicant are accepted until the application reaches a final state. */
export const CENTRE_UPLOAD_CLOSED_STATUSES: readonly string[] = ["APPROVED", "REJECTED"];

/** Image-only document types are stored with the `image` upload preset. */
export const CENTRE_IMAGE_DOCUMENT_TYPES: readonly string[] = ["space_photo"];

export function centreDocumentType(key: string): CentreDocumentType | undefined {
  return CENTRE_DOCUMENT_TYPES.find((d) => d.key === key);
}

/** Extra slots offered for a `multiple` document type. */
export const CENTRE_MAX_SPACE_PHOTOS = 4;
