"use client";

import * as React from "react";
import { BadgeCheck, Eye, Pencil, Power, ShieldOff, Trash2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { RecordActions } from "@/components/admin/shared/record-actions";

export interface CenterActionTarget {
  id: string;
  code: string;
  name: string;
  status: string;
  isVerified: boolean;
  activeStudents: number;
}

export interface CenterPerms {
  update: boolean;
  verify: boolean;
  delete: boolean;
}

/** "…" menu for center rows in the list. */
export function CenterRowActions({ center, perms, className }: { center: CenterActionTarget; perms: CenterPerms; className?: string }) {
  return (
    <RecordActions
      className={className}
      label={`Actions for ${center.name}`}
      items={[
        { label: "View", href: `/admin/centers/${center.id}`, icon: <Eye className="h-4 w-4" /> },
        { label: "Edit", href: `/admin/centers/${center.id}/edit`, icon: <Pencil className="h-4 w-4" />, hidden: !perms.update },
      ]}
    >
      <CenterMenuActions center={center} perms={perms} />
    </RecordActions>
  );
}

function CenterMenuActions({ center, perms }: { center: CenterActionTarget; perms: CenterPerms }) {
  return (
    <>
      {perms.verify && (
        <ConfirmAction asMenuItem icon={center.isVerified ? <ShieldOff className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />} method="patch" url={`/api/admin/centers/${center.id}/verify`} body={{ verified: !center.isVerified }} title={center.isVerified ? `Remove verification from ${center.code}?` : `Verify ${center.code}?`} description={center.isVerified ? "The verified badge is removed from the website." : "The center gets the verified badge. A pending center is activated at the same time."} confirmLabel={center.isVerified ? "Remove verification" : "Verify"} successMessage={center.isVerified ? "Verification removed" : "Center verified"}>
          {center.isVerified ? "Remove verification" : "Mark as verified"}
        </ConfirmAction>
      )}
      {perms.update && center.status !== "ACTIVE" && (
        <ConfirmAction asMenuItem icon={<Power className="h-4 w-4" />} method="patch" url={`/api/admin/centers/${center.id}/status`} body={{ status: "ACTIVE" }} title={`Activate ${center.code}?`} description="The center becomes visible in public search and can accept applications." confirmLabel="Activate" successMessage="Center activated">
          Activate
        </ConfirmAction>
      )}
      {perms.update && center.status === "ACTIVE" && (
        <ConfirmAction asMenuItem icon={<Power className="h-4 w-4" />} method="patch" url={`/api/admin/centers/${center.id}/status`} body={{ status: "INACTIVE" }} title={`Deactivate ${center.code}?`} description="The center is hidden from public search. Existing batches and students are not affected." confirmLabel="Deactivate" successMessage="Center deactivated">
          Deactivate
        </ConfirmAction>
      )}
      {perms.delete && (
        <ConfirmAction asMenuItem danger icon={<Trash2 className="h-4 w-4" />} method="delete" url={`/api/admin/centers/${center.id}`} title={`Delete ${center.code}?`} description={center.activeStudents > 0 ? `This center has ${center.activeStudents} active student(s) and cannot be deleted. Deactivate it instead.` : "The center is archived and removed from every list. Its code is never reused."} confirmLabel="Delete" successMessage="Center deleted" redirectTo="/admin/centers" disabled={center.activeStudents > 0}>
          Delete
        </ConfirmAction>
      )}
    </>
  );
}

/** Header buttons for the center detail page. */
export function CenterHeaderActions({ center, perms }: { center: CenterActionTarget; perms: CenterPerms }) {
  return (
    <>
      {perms.update && (
        <ButtonLink href={`/admin/centers/${center.id}/edit`} variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>
          Edit
        </ButtonLink>
      )}
      {perms.verify && (
        <ConfirmAction size="sm" variant={center.isVerified ? "outline" : "navy"} icon={center.isVerified ? <ShieldOff className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />} method="patch" url={`/api/admin/centers/${center.id}/verify`} body={{ verified: !center.isVerified }} title={center.isVerified ? `Remove verification from ${center.code}?` : `Verify ${center.code}?`} description={center.isVerified ? "The verified badge is removed from the website." : "The center gets the verified badge. A pending center is activated at the same time."} confirmLabel={center.isVerified ? "Remove verification" : "Verify"} successMessage={center.isVerified ? "Verification removed" : "Center verified"}>
          {center.isVerified ? "Unverify" : "Verify"}
        </ConfirmAction>
      )}
      {(perms.update || perms.delete) && (
        <RecordActions className="max-md:[&_button]:h-11 max-md:[&_button]:w-11" label="More actions">
          <CenterMenuActions center={center} perms={{ ...perms, verify: false }} />
        </RecordActions>
      )}
    </>
  );
}
