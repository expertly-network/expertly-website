-- 0007 — homepage Coverage tile photo for the "Wealth Management" category.
--
-- The 0004 seed left this one category without an image (the tile fell back to an initial). Data
-- only: no schema change. Same format as the other seeded thumbnails — a square Unsplash crop
-- (free licence, hotlinked per Unsplash API guidelines): a seedling growing from a pile of coins.
--
-- Safe on live data and re-runnable: it only fills the image while it is still empty, so an image
-- an admin has since set via PATCH /v1/admin/categories/:id is never overwritten.

begin;

update public.categories
set image_url = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=192&h=192&fit=crop&auto=format&q=70'
where name = 'Wealth Management'
  and image_url is null;

notify pgrst, 'reload schema';

commit;
