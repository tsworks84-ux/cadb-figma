"use client";

import { useAcademicYears, usePartners } from "@/lib/queries";
import { PROJECT_TYPE_LABEL, type ProjectType } from "@/lib/types";
import { Field, Input, Select } from "./ui";

export interface ProjectDetailsValue {
  partnerId: string;
  type: ProjectType;
  internalName: string;
  displayName: string;
  startDate: string;
  startAcademicYearId: string;
}

export const emptyDetails: ProjectDetailsValue = {
  partnerId: "",
  type: "SIP",
  internalName: "",
  displayName: "",
  startDate: "",
  startAcademicYearId: "",
};

export function ProjectDetailsForm({
  value,
  onChange,
  partnerLocked,
}: {
  value: ProjectDetailsValue;
  onChange: (v: ProjectDetailsValue) => void;
  partnerLocked?: boolean;
}) {
  const { data: partners } = usePartners();
  const { data: years } = useAcademicYears();
  const set = <K extends keyof ProjectDetailsValue>(k: K, v: ProjectDetailsValue[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Partner" htmlFor="partnerId" hint={partnerLocked ? "A project stays with the partner it was created for." : undefined}>
        <Select id="partnerId" required disabled={partnerLocked} value={value.partnerId} onChange={(e) => set("partnerId", e.target.value)}>
          <option value="">Choose a partner…</option>
          {partners
            ?.filter((p) => !p.isArchived || p.id === value.partnerId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isInternal ? " (internal)" : ""}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Program type" htmlFor="type">
        <Select id="type" value={value.type} onChange={(e) => set("type", e.target.value as ProjectType)}>
          {(Object.keys(PROJECT_TYPE_LABEL) as ProjectType[]).map((t) => (
            <option key={t} value={t}>
              {t} · {PROJECT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Internal name" htmlFor="internalName" hint="Used by your team only, e.g. VIBGYOR SIP 2026.">
        <Input id="internalName" required maxLength={120} value={value.internalName} onChange={(e) => set("internalName", e.target.value)} />
      </Field>
      <Field label="Name partners see" htmlFor="displayName" hint="Shown on the partner dashboard. Keep internal names out of it.">
        <Input id="displayName" required maxLength={120} value={value.displayName} onChange={(e) => set("displayName", e.target.value)} />
      </Field>
      <Field label="Start date" htmlFor="startDate">
        <Input id="startDate" type="date" required value={value.startDate} onChange={(e) => set("startDate", e.target.value)} />
      </Field>
      <Field label="Starting academic year" htmlFor="startAcademicYearId">
        <Select id="startAcademicYearId" required value={value.startAcademicYearId} onChange={(e) => set("startAcademicYearId", e.target.value)}>
          <option value="">Choose a year…</option>
          {years?.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
              {y.isArchived ? " (archived)" : ""}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
