"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { AcademicYear, Board, Grade, Me, Partner, School } from "./types";

// Query keys share prefixes so one invalidation refreshes lists and details
// together: ["projects"] covers ["projects", id], ["batches"] covers every
// filtered page.

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me") });

export const useGrades = () =>
  useQuery({ queryKey: ["lookups", "grades"], queryFn: () => api<Grade[]>("/cadb/grades"), staleTime: 10 * 60_000 });
export const useSchools = () =>
  useQuery({ queryKey: ["lookups", "schools"], queryFn: () => api<School[]>("/cadb/schools"), staleTime: 10 * 60_000 });
export const useAcademicYears = () =>
  useQuery({ queryKey: ["lookups", "years"], queryFn: () => api<AcademicYear[]>("/cadb/academic-years"), staleTime: 10 * 60_000 });

export const useBoards = () => useQuery({ queryKey: ["boards"], queryFn: () => api<Board[]>("/boards") });
export const usePartners = () => useQuery({ queryKey: ["partners"], queryFn: () => api<Partner[]>("/partners") });
