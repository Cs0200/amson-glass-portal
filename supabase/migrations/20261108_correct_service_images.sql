-- Replace illustrative service images; preserve descriptions and pricing.
update public.services set image='/images/glass-interior.png' where id='partitions';
update public.services set image='/images/glass-railings.png' where id='railings';
update public.services set image='/images/shower-cubicle.png' where id='showers';
update public.services set image='/images/glass-doors.png' where id='doors';
update public.services set image='/images/custom-mirrors.png' where id='mirrors';
