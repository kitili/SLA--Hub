'use client';

import { create } from 'zustand';

export const useFeedbackUi = create((set) => ({
  open: false,
  setOpen: (open) => set({ open: !!open }),
}));
