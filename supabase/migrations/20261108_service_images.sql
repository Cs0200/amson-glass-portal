-- Preserve all pricing and descriptions while replacing the film service image.
update public.services set image='/images/glass-film-installation.png' where id='films';
