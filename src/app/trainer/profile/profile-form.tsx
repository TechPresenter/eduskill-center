"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormActions, FormGrid } from "@/components/ui/form";
import { FileUpload, TagInput, type UploadedFile } from "@/components/ui/file-upload";
import { Avatar } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";

interface Initial {
  bio: string;
  qualification: string;
  skills: string[];
  languages: string[];
  avatarUrl: string | null;
}

export function ProfileForm({ initial, disabled }: { trainerId: string; initial: Initial; disabled?: boolean }) {
  const router = useRouter();
  const [bio, setBio] = React.useState(initial.bio);
  const [qualification, setQualification] = React.useState(initial.qualification);
  const [skills, setSkills] = React.useState(initial.skills);
  const [languages, setLanguages] = React.useState(initial.languages);
  const [photo, setPhoto] = React.useState<UploadedFile | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await api.patch("/api/trainer/profile", { bio, qualification, skills, languages, photoUrl: photo?.url ?? null });
      toast.success("Profile updated");
      setPhoto(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error("Could not save profile", err.message);
      } else toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <Field label="Profile photo" hint="JPG or PNG up to 2 MB. Shown on your trainer card and in the portal header.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name="Profile photo" src={photo?.url ?? initial.avatarUrl} size={72} />
          <FileUpload endpoint="/api/trainer/uploads" fields={{ kind: "photo" }} accept=".jpg,.jpeg,.png" maxSizeMb={2} value={photo} onChange={setPhoto} label="Upload new photo" disabled={disabled} className="flex-1" />
        </div>
      </Field>
      <FormGrid>
        <Field label="Highest qualification" htmlFor="qualification" error={errors.qualification} className="sm:col-span-2">
          <Input id="qualification" value={qualification} onChange={(e) => setQualification(e.target.value)} disabled={disabled} invalid={!!errors.qualification} maxLength={200} />
        </Field>
        <Field label="Skills" error={errors.skills} hint="Type a skill and press Enter." className="sm:col-span-2">
          <TagInput value={skills} onChange={setSkills} placeholder="e.g. MS Office, Tally" />
        </Field>
        <Field label="Languages" error={errors.languages} hint="Languages you can teach in." className="sm:col-span-2">
          <TagInput value={languages} onChange={setLanguages} placeholder="e.g. Hindi, English" />
        </Field>
        <Field label="Bio" htmlFor="bio" error={errors.bio} hint={`${bio.length} / 2000`} className="sm:col-span-2">
          <Textarea id="bio" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} disabled={disabled} invalid={!!errors.bio} maxLength={2000} placeholder="A short introduction students and the Foundation can read." />
        </Field>
      </FormGrid>
      <FormActions>
        <Button type="submit" loading={saving} disabled={disabled}>
          Save changes
        </Button>
      </FormActions>
    </form>
  );
}
