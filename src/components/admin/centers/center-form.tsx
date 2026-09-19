"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/file-upload";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ImageField } from "@/components/admin/shared/image-field";

export interface CenterCourseOption {
  id: string;
  name: string;
  code: string;
  status: string;
  durationText: string;
  category: { name: string } | null;
}

export interface CenterFormInitial {
  id: string;
  code: string;
  name: string;
  stateId: string;
  districtId: string;
  blockId: string;
  address: string;
  landmark: string | null;
  villageTown: string | null;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  contactPerson: string | null;
  openingHours: Record<string, string> | null;
  capacity: number;
  facilities: string[];
  description: string | null;
  coverImage: string | null;
  isVerified: boolean;
  status: string;
  establishedOn: string | null;
  courseIds: string[];
}

interface HoursRow {
  key: string;
  label: string;
  hours: string;
}

const HOUR_PRESETS = ["Mon – Fri", "Mon – Sat", "Saturday", "Sunday", "Public holidays"];

let rowSeq = 0;
function newRow(label = "", hours = ""): HoursRow {
  return { key: `h${++rowSeq}`, label, hours };
}

export function CenterForm({ initial, courses, canVerify, codeFormat }: { initial?: CenterFormInitial; courses: CenterCourseOption[]; canVerify: boolean; codeFormat: string }) {
  const router = useRouter();
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [loc, setLoc] = React.useState<LocationValue>({ stateId: initial?.stateId, districtId: initial?.districtId, blockId: initial?.blockId });
  const [address, setAddress] = React.useState(initial?.address ?? "");
  const [landmark, setLandmark] = React.useState(initial?.landmark ?? "");
  const [villageTown, setVillageTown] = React.useState(initial?.villageTown ?? "");
  const [pincode, setPincode] = React.useState(initial?.pincode ?? "");
  const [latitude, setLatitude] = React.useState(initial?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = React.useState(initial?.longitude?.toString() ?? "");
  const [phone, setPhone] = React.useState(initial?.phone ?? "");
  const [whatsapp, setWhatsapp] = React.useState(initial?.whatsapp ?? "");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [contactPerson, setContactPerson] = React.useState(initial?.contactPerson ?? "");
  const [hours, setHours] = React.useState<HoursRow[]>(() => {
    const rows = Object.entries(initial?.openingHours ?? {}).map(([label, h]) => newRow(label, h));
    return rows.length ? rows : [newRow("Mon – Sat", "10:00 AM – 5:00 PM")];
  });
  const [capacity, setCapacity] = React.useState(String(initial?.capacity ?? 0));
  const [facilities, setFacilities] = React.useState<string[]>(initial?.facilities ?? []);
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [coverImage, setCoverImage] = React.useState(initial?.coverImage ?? "");
  const [status, setStatus] = React.useState(initial?.status ?? "PENDING");
  const [isVerified, setIsVerified] = React.useState(initial?.isVerified ?? false);
  const [establishedOn, setEstablishedOn] = React.useState(initial?.establishedOn ?? "");
  const [courseIds, setCourseIds] = React.useState<string[]>(initial?.courseIds ?? []);

  const toggleCourse = (id: string) => setCourseIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const openingHours: Record<string, string> = {};
    for (const r of hours) if (r.label.trim() && r.hours.trim()) openingHours[r.label.trim()] = r.hours.trim();
    const body = {
      name,
      stateId: loc.stateId ?? "",
      districtId: loc.districtId ?? "",
      blockId: loc.blockId ?? "",
      address,
      landmark: landmark || null,
      villageTown: villageTown || null,
      pincode,
      latitude: latitude.trim() === "" ? null : Number(latitude),
      longitude: longitude.trim() === "" ? null : Number(longitude),
      phone: phone || "",
      whatsapp: whatsapp || "",
      email: email || "",
      contactPerson: contactPerson || null,
      openingHours: Object.keys(openingHours).length ? openingHours : null,
      capacity: Number(capacity) || 0,
      facilities,
      description: description || null,
      coverImage: coverImage || null,
      status,
      ...(canVerify ? { isVerified } : {}),
      establishedOn: establishedOn || "",
      courseIds,
    };
    const res = await submit(() => (initial ? api.put<{ id: string; code: string }>(`/api/admin/centers/${initial.id}`, body) : api.post<{ id: string; code: string }>("/api/admin/centers", body)), { silent: true });
    if (!res) return;
    toast.success(initial ? "Center updated" : "Center created", `${res.code} · ${name}`);
    router.push(`/admin/centers/${res.id}`);
    router.refresh();
  };

  const locErrors = { stateId: fieldErrors.stateId, districtId: fieldErrors.districtId, blockId: fieldErrors.blockId };

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      {error && Object.keys(fieldErrors).length > 0 && <Alert tone="warning">{error}</Alert>}

      <FormSection title="Identity & location" description={initial ? `Center code ${initial.code} is permanent and cannot be changed.` : `The center code is generated on save using the format ${codeFormat} from the state and district codes.`}>
        <FormGrid>
          <Field label="Center name" htmlFor="cf-name" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="cf-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} required maxLength={160} invalid={!!fieldErrors.name} placeholder="e.g. EduSkill Training Center – Barasat" />
          </Field>
          <div className="sm:col-span-2">
            <LocationCascade
              value={loc}
              onChange={(v) => {
                setLoc(v);
                clearField("stateId");
                clearField("districtId");
                clearField("blockId");
              }}
              required
              errors={locErrors}
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            />
            {initial && (initial.stateId !== loc.stateId || initial.districtId !== loc.districtId) && <p className="mt-2 text-xs text-amber-700">Changing the state or district does not change the existing center code.</p>}
          </div>
          <Field label="Address" htmlFor="cf-address" required error={fieldErrors.address} className="sm:col-span-2">
            <Textarea id="cf-address" value={address} onChange={(e) => { setAddress(e.target.value); clearField("address"); }} rows={2} required maxLength={500} invalid={!!fieldErrors.address} />
          </Field>
          <Field label="Landmark" htmlFor="cf-landmark" error={fieldErrors.landmark}>
            <Input id="cf-landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={200} placeholder="Near…" />
          </Field>
          <Field label="Village / town" htmlFor="cf-town" error={fieldErrors.villageTown}>
            <Input id="cf-town" value={villageTown} onChange={(e) => setVillageTown(e.target.value)} maxLength={120} />
          </Field>
          <Field label="PIN code" htmlFor="cf-pin" required error={fieldErrors.pincode}>
            <Input id="cf-pin" value={pincode} onChange={(e) => { setPincode(e.target.value.replace(/\D/g, "").slice(0, 6)); clearField("pincode"); }} inputMode="numeric" required maxLength={6} invalid={!!fieldErrors.pincode} />
          </Field>
          <Field label="Established on" htmlFor="cf-est" error={fieldErrors.establishedOn}>
            <Input id="cf-est" type="date" value={establishedOn} onChange={(e) => setEstablishedOn(e.target.value)} />
          </Field>
          <Field label="Latitude" htmlFor="cf-lat" error={fieldErrors.latitude} hint="Decimal degrees, e.g. 22.7205. Used for the map on the website.">
            <Input id="cf-lat" type="number" step="any" min={-90} max={90} value={latitude} onChange={(e) => { setLatitude(e.target.value); clearField("latitude"); }} invalid={!!fieldErrors.latitude} />
          </Field>
          <Field label="Longitude" htmlFor="cf-lng" error={fieldErrors.longitude}>
            <Input id="cf-lng" type="number" step="any" min={-180} max={180} value={longitude} onChange={(e) => { setLongitude(e.target.value); clearField("longitude"); }} invalid={!!fieldErrors.longitude} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Contact">
        <FormGrid>
          <Field label="Contact person" htmlFor="cf-contact" error={fieldErrors.contactPerson}>
            <Input id="cf-contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Email" htmlFor="cf-email" error={fieldErrors.email}>
            <Input id="cf-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearField("email"); }} invalid={!!fieldErrors.email} />
          </Field>
          <Field label="Phone" htmlFor="cf-phone" error={fieldErrors.phone} hint="10-digit Indian mobile number">
            <Input id="cf-phone" value={phone} onChange={(e) => { setPhone(e.target.value); clearField("phone"); }} inputMode="tel" invalid={!!fieldErrors.phone} />
          </Field>
          <Field label="WhatsApp" htmlFor="cf-wa" error={fieldErrors.whatsapp}>
            <Input id="cf-wa" value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); clearField("whatsapp"); }} inputMode="tel" invalid={!!fieldErrors.whatsapp} />
          </Field>
        </FormGrid>
        <Field label="Opening hours" error={fieldErrors.openingHours} hint="One row per day group, e.g. “Mon – Sat” → “10:00 AM – 5:00 PM”.">
          <div className="space-y-2">
            {hours.map((r, i) => (
              <div key={r.key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input value={r.label} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Days" list="cf-hour-presets" aria-label={`Days for row ${i + 1}`} maxLength={40} />
                <Input value={r.hours} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} placeholder="Hours" aria-label={`Hours for row ${i + 1}`} maxLength={60} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setHours((h) => h.filter((_, j) => j !== i))} aria-label={`Remove row ${i + 1}`} className="h-11">
                  <Trash2 className="h-4 w-4 text-muted" />
                </Button>
              </div>
            ))}
            <datalist id="cf-hour-presets">
              {HOUR_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <Button type="button" variant="outline" size="xs" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setHours((h) => [...h, newRow()])} disabled={hours.length >= 7}>
              Add row
            </Button>
          </div>
        </Field>
      </FormSection>

      <FormSection title="Facilities & profile">
        <FormGrid>
          <Field label="Capacity (students at a time)" htmlFor="cf-cap" error={fieldErrors.capacity}>
            <Input id="cf-cap" type="number" min={0} max={100000} value={capacity} onChange={(e) => { setCapacity(e.target.value); clearField("capacity"); }} invalid={!!fieldErrors.capacity} />
          </Field>
          <Field label="Facilities" error={fieldErrors.facilities} hint="Press Enter after each item, e.g. Computer lab, Wi-Fi, Drinking water.">
            <TagInput value={facilities} onChange={setFacilities} placeholder="Add a facility" />
          </Field>
          <Field label="Description" htmlFor="cf-desc" error={fieldErrors.description} className="sm:col-span-2" hint="Shown on the public center page.">
            <Textarea id="cf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
          </Field>
          <Field label="Cover image" error={fieldErrors.coverImage} className="sm:col-span-2">
            <ImageField value={coverImage} onChange={setCoverImage} folder="centers" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Courses offered" description="Only courses selected here can have batches at this center.">
        {courses.length === 0 ? (
          <p className="text-sm text-muted">No courses exist yet. Create courses first, then add them to this center.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Checkbox key={c.id} checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} label={`${c.name}`} description={`${c.code} · ${c.durationText}${c.category ? ` · ${c.category.name}` : ""}${c.status !== "ACTIVE" ? ` · ${titleCase(c.status)}` : ""}`} className="rounded-xl border border-line bg-white p-3" />
            ))}
          </div>
        )}
        {fieldErrors.courseIds && <p className="text-xs font-medium text-danger">{fieldErrors.courseIds}</p>}
      </FormSection>

      <FormSection title="Status">
        <FormGrid>
          <Field label="Status" htmlFor="cf-status" error={fieldErrors.status} hint="Only active centers appear in public search. Pending centers are visible by direct link only.">
            <Select id="cf-status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "PENDING", label: "Pending" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
          </Field>
          <div className="flex items-end">
            <Checkbox checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} disabled={!canVerify} label="Verified center" description={canVerify ? "Shows the verified badge on the website." : "Only staff with the verify permission can change this."} />
          </div>
        </FormGrid>
      </FormSection>

      <StickyActionBar>
        <Button type="button" variant="outline" onClick={() => router.push(initial ? `/admin/centers/${initial.id}` : "/admin/centers")} disabled={loading} className="flex-1 lg:flex-none">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-2 lg:flex-none">
          {initial ? "Save changes" : "Create center"}
        </Button>
      </StickyActionBar>
    </form>
  );
}
