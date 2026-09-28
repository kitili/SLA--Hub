-- Farm plot map pins (Usa River campus field layout)
-- Safe to re-run.

alter table public.farm_plots
  add column if not exists lat numeric,
  add column if not exists lng numeric;

comment on column public.farm_plots.lat is 'Plot centroid latitude for map view (optional)';
comment on column public.farm_plots.lng is 'Plot centroid longitude for map view (optional)';
